import assert from "node:assert/strict"
import { test, mock } from "node:test"
import * as nodeModule from "node:module"
import { NextRequest } from "next/server"
// server-only is a Next bundler marker; this isolated Node process is server-side.
const hooks = (nodeModule as unknown as { registerHooks: (hooks: { resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) => unknown }) => { deregister: () => void } }).registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: "node:assert/strict", shortCircuit: true } : next(specifier, context) } })
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
process.env.CUSTOMER_AUTH_SITE_URL = "http://127.0.0.1:3000"
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", token = "a".repeat(43)
test("fragment handoff has no analytics, never consumes invitation, sets only HttpOnly cookie after same-origin validation", async t => {
  t.after(() => hooks.deregister())
  let calls = 0, invalid = false
  const adapter = mock.method(globalThis, "fetch", async (input: string | URL | Request) => { assert.match(String(input), /rest\/v1\/rpc\/review_workspace_invitation$/); calls++; return Response.json(invalid ? null : { id, workspaceName: "Test team", inviterName: "Alice", maskedEmail: "b…@example.test", email: "b@example.test", acceptedBy: null, companyId: id }) })
  t.after(() => adapter.mock.restore())
  const route = await import("@/app/join/[id]/route")
  const params = { params: Promise.resolve({ id }) }
  const get = await route.GET(new NextRequest(`http://127.0.0.1:3000/join/${id}`), params)
  const html = await get.text(); assert.equal(calls, 0); assert.ok(!/umami|google|analytics/i.test(html)); assert.match(html, /history.replaceState/); assert.ok(!html.includes(token)); assert.match(get.headers.get("Content-Security-Policy")!, /default-src 'none'/); assert.equal(get.headers.get("Referrer-Policy"), "no-referrer")
  const post = (origin: string, body: string) => route.POST(new NextRequest(`http://127.0.0.1:3000/join/${id}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body }), params)
  assert.equal((await post("https://evil.test", JSON.stringify({ token }))).status, 403); assert.equal(calls, 0)
  assert.equal((await post("http://127.0.0.1:3000", "x".repeat(513))).status, 413); assert.equal(calls, 0)
  const result = await post("http://127.0.0.1:3000", JSON.stringify({ token })); assert.equal(result.status, 200); assert.equal(calls, 1)
  const json = await result.text(); assert.equal(json, JSON.stringify({ next: `/invitations/${id}` })); assert.ok(!json.includes(token)); assert.ok(!json.includes("b@example.test"))
  const cookie = result.cookies.getAll()[0]; assert.ok(cookie.httpOnly); assert.equal(cookie.sameSite, "lax"); assert.equal(cookie.path, "/"); assert.equal(cookie.maxAge, 1800)
  invalid = true; assert.equal((await post("http://127.0.0.1:3000", JSON.stringify({ token }))).status, 404)
})
