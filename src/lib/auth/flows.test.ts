import assert from "node:assert/strict"
import { test } from "node:test"
import type { User } from "@supabase/supabase-js"
import { completeCustomerCallback, finishCustomerLogin, parseConfirmation, runCustomerFlow, type FlowDependencies } from "./flows"

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "a@example.test", email_confirmed_at: "2026-10-08", is_anonymous: false } as User
function adapter(overrides: Record<string, unknown> = {}, bootstrap = true) {
  const calls: Array<{ method: string; args: unknown }> = []
  const values: Record<string, unknown> = { getUser: { data: { user }, error: null }, signUp: { data: { user, session: null }, error: null }, signInWithPassword: { data: { user }, error: null }, signInWithOAuth: { data: { url: "https://provider.example.test/oauth" }, error: null }, exchangeCodeForSession: { data: { user }, error: null }, resend: { error: null }, resetPasswordForEmail: { error: null }, signOut: { error: null }, ...overrides }
  const auth = Object.fromEntries(Object.entries(values).map(([method, value]) => [method, async (args: unknown) => { calls.push({ method, args }); return value }])) as unknown as FlowDependencies["auth"]
  const deps: FlowDependencies = { auth, bootstrap: async u => { calls.push({ method: "bootstrap", args: u.id }); return bootstrap }, callbackUrl: (kind, next) => `https://preview.example.test/${kind}?next=${encodeURIComponent(next || "/")}` }
  return { deps, calls }
}
const input = { email: "a@example.test", password: "  exact password  ", confirmation: "  exact password  ", next: "/?q=chairs#result-2" }

test("email signup without session yields confirmation only, never workspace or password state", async () => {
  const { deps, calls } = adapter()
  const result = await runCustomerFlow("signup", input, deps)
  assert.equal(result.state.status, "confirmation")
  assert.equal(result.redirect, undefined)
  assert.equal(calls.filter(c => c.method === "bootstrap").length, 0)
  assert.ok(!JSON.stringify(result.state).includes(input.password))
  assert.equal((calls.find(c => c.method === "signUp")!.args as { password: string }).password, input.password)
})
test("duplicate email signup and recovery retain generic responses; immediate signup session is not accepted", async () => {
  const duplicate = adapter({ signUp: { data: { session: null }, error: { code: "user_already_exists" } } })
  const normal = adapter()
  const a = await runCustomerFlow("signup", input, duplicate.deps)
  const b = await runCustomerFlow("signup", input, normal.deps)
  assert.equal(a.state.message, b.state.message)
  const existing = adapter({ signUp: { data: { session: {} }, error: null } })
  assert.equal((await runCustomerFlow("signup", input, existing.deps)).state.status, "unavailable")
  assert.ok(existing.calls.some(c => c.method === "signOut"))
  assert.equal(existing.calls.some(c => c.method === "bootstrap"), false)
  const missing = adapter({ resetPasswordForEmail: { error: { code: "user_not_found" } } })
  assert.equal((await runCustomerFlow("forgot", input, missing.deps)).state.message, (await runCustomerFlow("forgot", input, normal.deps)).state.message)
})
test("password sign-in verifies fresh identity before bootstrapping and preserves safe original destination", async () => {
  const { deps, calls } = adapter()
  assert.equal((await runCustomerFlow("signin", input, deps)).redirect, input.next)
  assert.deepEqual(calls.map(c => c.method), ["signInWithPassword", "getUser", "bootstrap"])
  const expired = adapter({ getUser: { data: { user: null }, error: { code: "user_not_found" } } })
  assert.equal((await finishCustomerLogin(expired.deps, "/")).state.status, "error")
  assert.equal(expired.calls.some(c => c.method === "bootstrap"), false)
  const unverified = adapter({ getUser: { data: { user: { ...user, email_confirmed_at: null } }, error: null } })
  assert.equal((await finishCustomerLogin(unverified.deps, "/")).state.status, "error")
  assert.equal(unverified.calls.some(c => c.method === "bootstrap"), false)
  const unconfirmed = adapter({ signInWithPassword: { error: { code: "email_not_confirmed" } } })
  assert.equal((await runCustomerFlow("signin", input, unconfirmed.deps)).state.status, "confirmation")
})
test("workspace failure is retryable without signing out the verified customer", async () => {
  const { deps, calls } = adapter({}, false)
  assert.equal((await runCustomerFlow("signin", input, deps)).state.status, "unavailable")
  assert.equal(calls.some(c => c.method === "signOut"), false)
  deps.bootstrap = async () => true
  assert.equal((await runCustomerFlow("retry", input, deps)).redirect, input.next)
})
test("resend handles provider errors/rate limits and sanitizes returned states", async () => {
  const limited = adapter({ resend: { error: { status: 429 } } })
  assert.match((await runCustomerFlow("resend", input, limited.deps)).state.message, /Wait a minute/)
  const failed = adapter({ resend: { error: { code: "smtp_failed", message: "sensitive upstream info" } } })
  const result = await runCustomerFlow("resend", input, failed.deps)
  assert.equal(result.state.status, "error")
  assert.ok(!JSON.stringify(result).includes("sensitive upstream"))
  const good = adapter()
  assert.ok((await runCustomerFlow("resend", input, good.deps)).state.resendAfter! > Date.now())
})
test("Google uses only its customer callback and never an admin claim", async () => {
  const { deps, calls } = adapter()
  assert.equal((await runCustomerFlow("google", input, deps)).redirect, "https://provider.example.test/oauth")
  const oauth = calls.find(c => c.method === "signInWithOAuth")!.args as { provider: string; options: { redirectTo: string; scopes: string } }
  assert.equal(oauth.provider, "google")
  assert.match(oauth.options.redirectTo, /^https:\/\/preview.example.test\/oauth/)
  assert.equal(oauth.options.scopes, "openid email profile")
  assert.equal((await completeCustomerCallback(new URL("https://preview.example.test/auth/customer/callback?code=one&next=%2Fadmin"), deps)).redirect, "/")
  assert.deepEqual(calls.slice(1).map(c => c.method), ["exchangeCodeForSession", "getUser", "bootstrap"])
})
test("OAuth cancellation/malformed/expired callbacks do not bootstrap or echo auth query data", async () => {
  for (const query of ["?error=access_denied&error_description=private", "", "?next=//evil.test"]) {
    const { deps, calls } = adapter()
    const result = await completeCustomerCallback(new URL("https://preview.example.test/auth/customer/callback" + query), deps)
    assert.equal(result.state.status, "error")
    assert.equal(calls.length, 0)
    assert.ok(!JSON.stringify(result).includes("private"))
  }
  const { deps, calls } = adapter({ exchangeCodeForSession: { error: { code: "expired" } } })
  assert.equal((await completeCustomerCallback(new URL("https://preview.example.test/auth/customer/callback?code=expired"), deps)).state.status, "error")
  assert.equal(calls.some(c => c.method === "bootstrap"), false)
})
test("confirmation accepts only approved token-hash types, ignoring arbitrary OTP/login methods", () => {
  const token = "a".repeat(64)
  for (const type of ["signup", "recovery", "email_change"]) assert.equal(parseConfirmation(new URL(`https://preview.example.test/auth/confirm?token_hash=${token}&type=${type}`))?.type, type)
  for (const type of ["email", "magiclink", "invite", "sms", "unknown"]) assert.equal(parseConfirmation(new URL(`https://preview.example.test/auth/confirm?token_hash=${token}&type=${type}`)), null)
  for (const token of ["", "abc", "not-hex", "%00"]) assert.equal(parseConfirmation(new URL(`https://preview.example.test/auth/confirm?token_hash=${token}&type=signup`)), null)
})
test("ordinary sign-out uses local scope and safe public redirect", async () => {
  const { deps, calls } = adapter()
  assert.equal((await runCustomerFlow("signout", { next: "//evil.test" }, deps)).redirect, "/")
  assert.deepEqual(calls, [{ method: "signOut", args: { scope: "local" } }])
  const failed = adapter({ signOut: { error: { code: "failed" } } })
  assert.equal((await runCustomerFlow("signout", { next: "/" }, failed.deps)).redirect, undefined)
})
