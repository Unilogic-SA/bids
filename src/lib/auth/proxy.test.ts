import assert from "node:assert/strict"
import { mock, test } from "node:test"
import { NextRequest } from "next/server"
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key"

test("public proxy leaves guests/stale sessions browsing; admin keeps its redirect/cache boundary", async t => {
  const fetch = mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ code: "refresh_token_not_found", msg: "Session expired" }), { status: 400, headers: { "Content-Type": "application/json" } }))
  t.after(() => fetch.mock.restore())
  const { proxy } = await import("@/proxy")
  for (const path of ["/", "/tenders/ocds-one", "/sign-in", "/sign-up"]) {
    const response = await proxy(new NextRequest("https://preview.example.test"+path))
    assert.equal(response.headers.get("Location"), null)
    assert.equal(response.headers.get("x-middleware-next"), "1")
  }
  assert.equal(fetch.mock.calls.length, 0)
  const admin = await proxy(new NextRequest("https://preview.example.test/admin"))
  assert.equal(admin.status, 307)
  assert.match(admin.headers.get("Location")!, /\/admin\/login\?next=%2Fadmin/)
  assert.match(admin.headers.get("Cache-Control")!, /private.*no-store/)
  const login = await proxy(new NextRequest("https://preview.example.test/admin/login"))
  assert.equal(login.headers.get("Location"), null)
  const expired = [Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"), Buffer.from(JSON.stringify({ exp: 1, sub: "old-user" })).toString("base64url"), "test-signature"].join(".")
  const cookie = "base64-"+Buffer.from(JSON.stringify({ access_token: expired, refresh_token: "expired-refresh-token", expires_at: 1, token_type: "bearer", user: { id: "old-user" } })).toString("base64url")
  const publicResponse = await proxy(new NextRequest("https://preview.example.test/tenders/ocds-one", { headers: { cookie: `sb-127-auth-token=${cookie}` } }))
  assert.equal(publicResponse.headers.get("Location"), null)
  assert.match(publicResponse.headers.get("Cache-Control")!, /no-store/)
})
