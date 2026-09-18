import { NextResponse, type NextRequest } from "next/server"

import {
  ADMIN_LOGIN_PATH,
  claimAdminUser,
  getSafeAdminNextPath,
} from "@/lib/admin/auth"
import {
  createServerAuthClient,
  hasSupabasePublicConfig,
  hasSupabaseServiceRoleConfig,
} from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = getSafeAdminNextPath(requestUrl.searchParams.get("next"))

  if (!hasSupabasePublicConfig() || !hasSupabaseServiceRoleConfig()) {
    return redirectToLogin(request, "configuration")
  }

  if (!code) {
    return redirectToLogin(request, "callback")
  }

  const supabase = await createServerAuthClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user?.email) {
    await supabase.auth.signOut()
    return redirectToLogin(request, "callback")
  }

  const allowed = await claimAdminUser(user)

  if (!allowed) {
    await supabase.auth.signOut()
    return redirectToLogin(request, "not-authorized")
  }

  return noStoreRedirect(new URL(next, request.url))
}

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL(ADMIN_LOGIN_PATH, request.url)
  url.searchParams.set("error", error)
  return noStoreRedirect(url)
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}
