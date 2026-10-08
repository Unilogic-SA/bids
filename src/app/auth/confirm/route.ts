import type { NextRequest } from "next/server"
import { hasSupabasePublicConfig } from "@/lib/supabase/server"
import { parseConfirmation } from "@/lib/auth/flows"
import { ensureCustomerWorkspace, isVerifiedCustomer } from "@/lib/auth/workspace"
import { authPageHref, getSafePublicNextPath, getTrustedAuthOrigin } from "@/lib/auth/redirects"
import { createCustomerRouteClient, customerRedirect } from "@/lib/auth/route-client"
import { createRecoveryProof, RECOVERY_COOKIE, RECOVERY_TTL } from "@/lib/auth/recovery"

export async function GET(request: NextRequest) {
  const input = parseConfirmation(request.nextUrl)
  const next = getSafePublicNextPath(request.nextUrl.searchParams.get("next"))
  const failed = `${authPageHref(input?.type === "recovery" ? "/forgot-password" : "/sign-in", next)}&error=expired`
  if (!input) return customerRedirect(failed)
  if (!hasSupabasePublicConfig()) return customerRedirect(`${authPageHref("/sign-in", next)}&error=configuration`)
  try {
    getTrustedAuthOrigin()
    // Do not consume a valid recovery token when recovery cannot be completed.
    if (input.type === "recovery") createRecoveryProof("configuration-check", "configuration-check", "/")
  } catch { return customerRedirect(`${authPageHref("/sign-in", next)}&error=configuration`) }
  const { client, pending } = createCustomerRouteClient(request)
  try {
    const verified = await client.auth.verifyOtp({ type: input.type, token_hash: input.token_hash })
    if (verified.error) return customerRedirect(failed, pending)
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !isVerifiedCustomer(user)) return customerRedirect(failed, pending)
    if (input.type === "recovery") {
      const claims = await client.auth.getClaims()
      if (claims.error || claims.data?.claims.sub !== user.id) return customerRedirect(failed, pending)
      pending.cookies.set(RECOVERY_COOKIE, createRecoveryProof(user.id, claims.data.claims.session_id, next), {
        httpOnly: true, sameSite: "lax", secure: getTrustedAuthOrigin().startsWith("https:"), path: "/account/update-password", maxAge: RECOVERY_TTL,
      })
      return customerRedirect("/account/update-password", pending)
    }
    const ready = await ensureCustomerWorkspace(user).catch(() => false)
    return customerRedirect(ready ? next : `${authPageHref("/sign-in", next)}&error=workspace`, pending)
  } catch { return customerRedirect(failed, pending) }
}
