import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getTrustedAuthOrigin } from "@/lib/auth/redirects"
import { invitationIdSchema, invitationTokenSchema } from "@/lib/workspace/invitation-validation"
import { reviewInvitationToken, PENDING_INVITATION_COOKIE, pendingInvitationCookieOptions } from "@/lib/workspace/invitations"
export const dynamic = "force-dynamic"
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" }
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!invitationIdSchema.safeParse(id).success) return new NextResponse("Reopen the invitation from your email.", { status: 404, headers: privateHeaders })
  const nonce = randomBytes(18).toString("base64")
  // This Route Handler bypasses the root React layout and its analytics entirely.
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Review your OpenBids invitation</title></head><body><main><h1>Opening your invitation</h1><p id="status" role="status">Please wait…</p><button id="retry" hidden>Retry</button><noscript>Enable JavaScript and reopen the invitation from your email.</noscript></main><script nonce="${nonce}">(()=>{const token=new URLSearchParams(location.hash.slice(1)).get('token');history.replaceState(null,'',location.pathname);const status=document.getElementById('status');const button=document.getElementById('retry');async function handoff(){button.hidden=true;if(!token){status.textContent='Reopen the original invitation from your email to continue.';return;}try{const response=await fetch(location.pathname,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!response.ok)throw new Error();location.replace('/invitations/${id}');}catch{status.textContent='Your invitation could not be opened. Retry or reopen the original email.';button.hidden=false;}}button.addEventListener('click',handoff);handoff();})();</script></body></html>`, { headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` } })
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const fail = (status: number) => NextResponse.json({ message: "Reopen the original invitation from your email." }, { status, headers: privateHeaders })
  try {
    if (request.headers.get("origin") !== getTrustedAuthOrigin() || request.headers.get("content-type")?.split(";")[0] !== "application/json" || Number(request.headers.get("content-length") || "0") > 512) return fail(403)
    const { id } = await params
    // Bound actual body too: Content-Length may be absent or untrusted.
    const reader = request.body?.getReader()
    if (!reader) return fail(400)
    let size = 0, text = ""
    const decoder = new TextDecoder()
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 512) { await reader.cancel(); return fail(413) }; text += decoder.decode(chunk.value, { stream: true }) }
    text += decoder.decode()
    const body = JSON.parse(text)
    if (!invitationIdSchema.safeParse(id).success || !invitationTokenSchema.safeParse(body?.token).success) return fail(400)
    if (!await reviewInvitationToken(id, body.token)) return fail(404)
    const response = NextResponse.json({ next: `/invitations/${id}` }, { headers: privateHeaders })
    response.cookies.set(PENDING_INVITATION_COOKIE, JSON.stringify({ id, token: body.token }), pendingInvitationCookieOptions)
    return response
  } catch { return fail(503) }
}
