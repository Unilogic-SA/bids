"use server"

import { redirect } from "next/navigation"

import {
  ADMIN_HOME_PATH,
  ADMIN_LOGIN_PATH,
  claimAdminUser,
  getSafeNextPath,
  isAdminEmailAllowed,
  normalizeAdminEmail,
} from "@/lib/admin/auth"
import {
  createServerAuthClient,
  hasSupabasePublicConfig,
} from "@/lib/supabase/server"

export type AdminLoginState = {
  status: "idle" | "error"
  message: string
  email: string
}

export async function signInAdmin(
  _state: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const email = normalizeAdminEmail(String(formData.get("email") || ""))
  const password = String(formData.get("password") || "")
  const next = getSafeNextPath(String(formData.get("next") || ADMIN_HOME_PATH))

  if (!email || !password) {
    return {
      status: "error",
      message: "Enter your admin email address and password.",
      email: email || "",
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
      status: "error",
      message: "The email or password is incorrect.",
      email,
    }
  }

  const supabase = await createServerAuthClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user?.email) {
    await supabase.auth.signOut()
    return {
      status: "error",
      message: "The email or password is incorrect.",
      email,
    }
  }

  const claimed = await claimAdminUser(data.user)
  if (!claimed) {
    await supabase.auth.signOut()
    return {
      status: "error",
      message: "This account is not authorized for admin access.",
      email,
    }
  }

  redirect(next)
}

export async function signOutAdmin() {
  const supabase = await createServerAuthClient()
  await supabase.auth.signOut()
  redirect(ADMIN_LOGIN_PATH)
}
