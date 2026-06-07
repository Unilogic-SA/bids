"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  ADMIN_HOME_PATH,
  ADMIN_LOGIN_PATH,
  getSafeNextPath,
  isAdminEmailAllowed,
  normalizeAdminEmail,
} from "@/lib/admin/auth"
import {
  createServerAuthClient,
  hasSupabasePublicConfig,
} from "@/lib/supabase/server"

export type AdminLoginState = {
  status: "idle" | "sent" | "error"
  message: string
  email: string
}

export async function requestAdminLogin(
  _state: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const email = normalizeAdminEmail(String(formData.get("email") || ""))
  const next = getSafeNextPath(String(formData.get("next") || ADMIN_HOME_PATH))

  if (!email) {
    return {
      status: "error",
      message: "Enter the admin email address.",
      email: "",
    }
  }

  if (!hasSupabasePublicConfig()) {
    return {
      status: "error",
      message: "Admin login is not configured.",
      email,
    }
  }

  const allowed = await isAdminEmailAllowed(email)
  if (!allowed) {
    return {
      status: "sent",
      message: "If this email is authorized, a sign-in link has been sent.",
      email,
    }
  }

  const supabase = await createServerAuthClient()
  const origin = await getRequestOrigin()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    return {
      status: "error",
      message: error.message,
      email,
    }
  }

  return {
    status: "sent",
    message: "Check your email for the admin sign-in link.",
    email,
  }
}

export async function signOutAdmin() {
  const supabase = await createServerAuthClient()
  await supabase.auth.signOut()
  redirect(ADMIN_LOGIN_PATH)
}

async function getRequestOrigin() {
  const requestHeaders = await headers()
  const forwardedHost = requestHeaders.get("x-forwarded-host")
  const host = forwardedHost || requestHeaders.get("host")

  if (!host) {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  }

  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")
  const protocol =
    forwardedProtocol ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")

  return `${protocol}://${host}`
}
