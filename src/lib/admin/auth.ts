import type { User } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

import {
  createServerAuthClient,
  createServiceRoleClient,
  hasSupabasePublicConfig,
  hasSupabaseServiceRoleConfig,
} from "@/lib/supabase/server"

export const ADMIN_HOME_PATH = "/admin"
export const ADMIN_LOGIN_PATH = "/admin/login"

type AdminUserRow = {
  email: string
  user_id: string | null
  role: "owner" | "admin"
}

export type AdminSession = {
  user: User
  admin: AdminUserRow
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession()

  if (!session) {
    redirect(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(ADMIN_HOME_PATH)}`)
  }

  return session
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!hasSupabasePublicConfig() || !hasSupabaseServiceRoleConfig()) {
    return null
  }

  const supabase = await createServerAuthClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.email) return null

  const admin = await getAllowedAdminUser(user)
  if (!admin) return null

  return { user, admin }
}

export async function getAllowedAdminUser(
  user: Pick<User, "id" | "email">
): Promise<AdminUserRow | null> {
  const email = normalizeAdminEmail(user.email)
  if (!email || !hasSupabaseServiceRoleConfig()) return null

  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("admin_users")
    .select("email,user_id,role")
    .eq("email", email)
    .maybeSingle()

  if (error || !data) return null

  const admin = data as AdminUserRow
  if (admin.user_id && admin.user_id !== user.id) return null

  return admin
}

export async function isAdminEmailAllowed(email: string) {
  const normalizedEmail = normalizeAdminEmail(email)
  if (!normalizedEmail || !hasSupabaseServiceRoleConfig()) return false

  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("admin_users")
    .select("email")
    .eq("email", normalizedEmail)
    .maybeSingle()

  return !error && Boolean(data)
}

export async function claimAdminUser(user: Pick<User, "id" | "email">) {
  const admin = await getAllowedAdminUser(user)
  if (!admin || admin.user_id) return Boolean(admin)

  const service = createServiceRoleClient()
  const { error } = await service
    .from("admin_users")
    .update({ user_id: user.id })
    .eq("email", admin.email)
    .is("user_id", null)

  return !error
}

export function normalizeAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null
}

export function getSafeNextPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return ADMIN_HOME_PATH
  }

  if (value.startsWith("/admin/login")) return ADMIN_HOME_PATH

  return value
}
