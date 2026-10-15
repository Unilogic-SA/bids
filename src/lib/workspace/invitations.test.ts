import assert from "node:assert/strict"
import { test } from "node:test"
import { invitationEmailSchema, invitationToken, hashInvitationToken, readPendingInvitation } from "./invitation-validation"
import { getSafePublicNextPath } from "@/lib/auth/redirects"
import { sendWorkspaceInvitation, workspaceInvitationEmail } from "@/lib/email/invitation-delivery"
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
test("invitation tokens are random, hash-only persisted representation and bounded cookie parsing", () => {
  const first = invitationToken(), second = invitationToken()
  assert.equal(first.token.length, 43); assert.match(first.hash, /^[0-9a-f]{64}$/); assert.notEqual(first.token, second.token)
  assert.equal(hashInvitationToken(first.token), first.hash)
  assert.deepEqual(readPendingInvitation(JSON.stringify({ id, token: first.token }), id), { id, token: first.token })
  for (const value of [undefined, "bad", JSON.stringify({ id, token: "short" }), "x".repeat(201)]) assert.equal(readPendingInvitation(value, id), null)
  assert.equal(readPendingInvitation(JSON.stringify({ id, token: first.token }), "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), null)
  assert.equal(invitationEmailSchema.parse(" Person+Work@EXAMPLE.COM "), "person+work@example.com")
})
test("auth continuation permits exact invitation UUID only and drops query/fragment", () => {
  assert.equal(getSafePublicNextPath(`/invitations/${id}?token=secret#token=secret`), `/invitations/${id}`)
  for (const value of [`//evil.test/invitations/${id}`, `/invitations/${id}/extra`, "/invitations/not-a-uuid", `/invitations%2f${id}`, "/admin", "/invitations/../admin"]) assert.equal(getSafePublicNextPath(value), "/")
})
test("transactional template escapes labels and keeps operational sharing/acceptance language", () => {
  const email = workspaceInvitationEmail({ workspaceName: '<img onerror="bad">', inviterName: "A & B", url: `https://app.example.test/join/${id}#token=opaque` })
  assert.ok(!email.html.includes('<img onerror="bad">')); assert.match(email.html, /&lt;img/); assert.match(email.html, /A &amp; B/); assert.match(email.html, /lang="en"/)
  assert.match(email.text, /explicit acceptance/); assert.match(email.text, /seven days/); assert.match(email.text, /other workspaces stay private/)
})
test("Resend transport retries identical generation and payload, permanent failures do not loop, unknown outcome remains truthful", async t => {
  const oldKey = process.env.RESEND_API_KEY, oldFrom = process.env.WORKSPACE_INVITE_FROM
  process.env.RESEND_API_KEY = "test-only"; process.env.WORKSPACE_INVITE_FROM = "OpenBids <test@example.test>"
  t.after(() => { if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey; if (oldFrom === undefined) delete process.env.WORKSPACE_INVITE_FROM; else process.env.WORKSPACE_INVITE_FROM = oldFrom })
  const input = { email: "b@example.test", id, sendVersion: 4, workspaceName: "Test team", inviterName: "Alice", url: `https://app.example.test/join/${id}#token=opaque` }
  const payloads: string[] = [], keys: string[] = []
  const transport: typeof fetch = async (_url, init) => { payloads.push(String(init?.body)); keys.push(new Headers(init?.headers).get("idempotency-key")!); return payloads.length < 2 ? new Response("{}", { status: 503, headers: { "Retry-After": "0" } }) : Response.json({ id: "test-provider-id" }) }
  assert.deepEqual(await sendWorkspaceInvitation(input, transport), { status: "sent", providerId: "test-provider-id" }); assert.equal(payloads.length, 2); assert.equal(payloads[0], payloads[1]); assert.deepEqual(keys, [`workspace-invite/${id}/4`, `workspace-invite/${id}/4`])
  let calls = 0
  assert.deepEqual(await sendWorkspaceInvitation(input, async () => { calls++; return new Response("private provider error", { status: 403 }) }), { status: "failed", code: "rejected" }); assert.equal(calls, 1)
  calls = 0; assert.deepEqual(await sendWorkspaceInvitation(input, async () => { calls++; throw new DOMException("private timeout", "TimeoutError") }), { status: "unknown", code: "timeout" }); assert.equal(calls, 3)
  assert.deepEqual(await sendWorkspaceInvitation(input, async () => new Response("{}", { status: 429, headers: { "Retry-After": "3600" } })), { status: "failed", code: "rate_limit" })
  delete process.env.RESEND_API_KEY
  assert.deepEqual(await sendWorkspaceInvitation(input, async () => { throw new Error("must not call") }), { status: "failed", code: "configuration" })
})
