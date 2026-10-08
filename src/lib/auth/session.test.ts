import assert from "node:assert/strict"
import { mock, test } from "node:test"
import { NextRequest } from "next/server"

// This file runs in a separate node:test process; only fake local bindings are used.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
process.env.CUSTOMER_AUTH_SITE_URL = "http://127.0.0.1:3000"
process.env.CUSTOMER_AUTH_RECOVERY_SECRET = "test-only-signing-secret-with-at-least-32-bytes"
const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "test@example.test", email_confirmed_at: "2026-10-08T00:00:00Z", is_anonymous: false, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-10-08T00:00:00Z" }
const claims = { sub: user.id, session_id: "session-a", aud: "authenticated", role: "authenticated", aal: "aal1", exp: Math.floor(Date.now()/1000)+3600, iat: Math.floor(Date.now()/1000), iss: "http://127.0.0.1:54321/auth/v1" }
const jwt = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify(claims)).toString("base64url"), "test-signature"].join(".")
const session = { access_token: jwt, refresh_token: "test-refresh-token", expires_in: 3600, token_type: "bearer", user }

test("customer confirmation/callback responses retain cookies, clean credentials and do not cache identity", async t => {
  let rejectToken = false
  let rejectBootstrap = false
  const calls: string[] = []
  const fetch = mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    if (url.includes("/auth/v1/verify") || url.includes("/auth/v1/token")) return new Response(JSON.stringify(rejectToken ? { code: "otp_expired", msg: "private provider detail" } : session), { status: rejectToken ? 403 : 200, headers: { "Content-Type": "application/json" } })
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify(user), { headers: { "Content-Type": "application/json" } })
    if (url.includes("/rest/v1/rpc/bootstrap_customer_workspace")) return new Response(JSON.stringify(rejectBootstrap ? { message: "missing schema" } : "company-a"), { status: rejectBootstrap ? 400 : 200, headers: { "Content-Type": "application/json" } })
    throw new Error(`Unexpected fake adapter destination: ${new URL(url).pathname} ${init?.method || "GET"}`)
  })
  t.after(() => fetch.mock.restore())
  const confirm = await import("@/app/auth/confirm/route")
  const callback = await import("@/app/auth/customer/callback/route")
  const { RECOVERY_COOKIE, readRecoveryProof } = await import("./recovery")
  const token = "a".repeat(64)
  const request = (path: string) => new NextRequest("http://untrusted-host.test"+path)
  const verifyHeaders = (response: Response) => {
    assert.match(response.headers.get("Cache-Control")!, /private.*no-store/)
    assert.equal(response.headers.get("Referrer-Policy"), "no-referrer")
    assert.ok(!response.headers.get("Location")?.includes(token))
    assert.ok(!response.headers.get("Location")?.includes("untrusted-host"))
  }
  await t.test("signup token_hash works without a PKCE verifier, sanitizes next and forwards session cookies", async () => {
    const response = await confirm.GET(request(`/auth/confirm?type=signup&token_hash=${token}&next=${encodeURIComponent("/?q=chairs#result-2")}`))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get("Location"), "http://127.0.0.1:3000/?q=chairs#result-2")
    assert.ok(response.cookies.getAll().some(c => c.name.includes("auth-token")))
    verifyHeaders(response)
  })
  await t.test("recovery consumes the approved token and issues session-bound server proof only for update-password", async () => {
    const response = await confirm.GET(request(`/auth/confirm?type=recovery&token_hash=${token}&next=/admin`))
    assert.equal(response.headers.get("Location"), "http://127.0.0.1:3000/account/update-password")
    const cookie = response.cookies.get(RECOVERY_COOKIE)!
    assert.ok(cookie.httpOnly)
    assert.equal(cookie.path, "/account/update-password")
    assert.equal(readRecoveryProof(cookie.value, user.id, claims.session_id)?.next, "/")
    verifyHeaders(response)
  })
  await t.test("expired/invalid types do not leak credentials or create recovery proofs", async () => {
    rejectToken = true
    const response = await confirm.GET(request(`/auth/confirm?type=recovery&token_hash=${token}`))
    assert.match(response.headers.get("Location")!, /forgot-password.*error=expired/)
    assert.equal(response.cookies.get(RECOVERY_COOKIE), undefined)
    verifyHeaders(response)
    rejectToken = false
    const before = calls.length
    await confirm.GET(request(`/auth/confirm?type=magiclink&token_hash=${token}`))
    assert.equal(calls.length, before)
  })
  await t.test("workspace failure retains the valid session and provides recoverable account destination", async () => {
    rejectBootstrap = true
    const response = await confirm.GET(request(`/auth/confirm?type=signup&token_hash=${token}&next=/?q=x`))
    assert.match(response.headers.get("Location")!, /sign-in\?next=.*error=workspace/)
    assert.ok(response.cookies.getAll().some(c => c.name.includes("auth-token") && c.value))
    rejectBootstrap = false
  })
  await t.test("cancelled OAuth is clean and never calls an admin claim", async () => {
    const before = calls.length
    const response = await callback.GET(request("/auth/customer/callback?error=access_denied&error_description=private-provider-info"))
    assert.match(response.headers.get("Location")!, /sign-in.*error=callback/)
    verifyHeaders(response)
    assert.equal(calls.length, before)
    assert.ok(!calls.some(url => url.includes("admin_users")))
  })
})
