import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const ADMIN_HOME_PATH = "/admin"
const ADMIN_LOGIN_PATH = "/admin/login"

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    const response = createNoStoreResponse(request)
    if (isAdminLoginPath(request.nextUrl.pathname)) return response

    return redirectToAdminLogin(request, response)
  }

  let supabaseResponse = createNoStoreResponse(request)

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        supabaseResponse = createNoStoreResponse(request)

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value)
        })
      },
    },
  })

  const { data } = await supabase.auth.getClaims()

  if (!data?.claims && !isAdminLoginPath(request.nextUrl.pathname)) {
    return redirectToAdminLogin(request, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
}

function createNoStoreResponse(request: NextRequest) {
  const response = NextResponse.next({ request })
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function redirectToAdminLogin(
  request: NextRequest,
  supabaseResponse: NextResponse
) {
  const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
  loginUrl.searchParams.set("next", getSafeAdminNextPath(request))

  const response = NextResponse.redirect(loginUrl)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie)
  })
  supabaseResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      response.headers.set(key, value)
    }
  })
  response.headers.set("Cache-Control", "private, no-store")

  return response
}

function getSafeAdminNextPath(request: NextRequest) {
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`

  if (
    !next.startsWith(ADMIN_HOME_PATH) ||
    next.startsWith(ADMIN_LOGIN_PATH) ||
    next.startsWith("//")
  ) {
    return ADMIN_HOME_PATH
  }

  return next
}

function isAdminLoginPath(pathname: string) {
  return pathname === ADMIN_LOGIN_PATH
}
