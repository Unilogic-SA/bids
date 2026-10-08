import type { NextRequest } from "next/server"
import { hasSupabasePublicConfig } from "@/lib/supabase/server"
import { completeCustomerCallback } from "@/lib/auth/flows"
import { ensureCustomerWorkspace } from "@/lib/auth/workspace"
import { authPageHref, getSafePublicNextPath, getTrustedAuthOrigin } from "@/lib/auth/redirects"
import { createCustomerRouteClient, customerRedirect } from "@/lib/auth/route-client"

export async function GET(request: NextRequest) {
  const next = getSafePublicNextPath(request.nextUrl.searchParams.get("next"))
  const failed = (error: string) => `${authPageHref("/sign-in", next)}&error=${error}`
  if (!hasSupabasePublicConfig()) return customerRedirect(failed("configuration"))
  try { getTrustedAuthOrigin() } catch { return customerRedirect(failed("configuration")) }
  const { client, pending } = createCustomerRouteClient(request)
  const result = await completeCustomerCallback(request.nextUrl, { auth: client.auth, bootstrap: ensureCustomerWorkspace })
  return customerRedirect(result.redirect ?? failed(result.state.status === "unavailable" ? "workspace" : "callback"), pending)
}
