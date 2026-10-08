import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_CACHE_HEADERS } from "./session"
import { getTrustedAuthOrigin } from "./redirects"

export function createCustomerRouteClient(request: NextRequest) {
  const pending = new NextResponse(null, { headers: ACCOUNT_CACHE_HEADERS })
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          pending.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([name, value]) => pending.headers.set(name, value))
      },
    },
  })
  return { client, pending }
}

export function customerRedirect(path: string, pending?: NextResponse) {
  let location = path
  try { location = new URL(path, getTrustedAuthOrigin()).toString() } catch { /* Relative error destination when no origin is configured. */ }
  const response = new NextResponse(null, { status: 303, headers: { ...ACCOUNT_CACHE_HEADERS, Location: location } })
  if (pending) {
    pending.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = pending.headers.get(name)
      if (value) response.headers.set(name, value)
    }
  }
  response.headers.set("Cache-Control", "private, no-store")
  return response
}
