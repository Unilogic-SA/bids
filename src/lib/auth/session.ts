import { redirect } from "next/navigation"
import { createServerAuthClient, hasSupabasePublicConfig } from "@/lib/supabase/server"
import type { AccountSnapshot } from "./account-state"
import { authPageHref } from "./redirects"
import { isVerifiedCustomer } from "./workspace"

export const ACCOUNT_CACHE_HEADERS = { "Cache-Control": "private, no-store", "Vary": "Cookie", "Referrer-Policy": "no-referrer" }

export async function getCustomerAccount(): Promise<AccountSnapshot> {
  if (!hasSupabasePublicConfig()) return { status: "signed-out" }
  try {
    const supabase = await createServerAuthClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      if (error.name === "AuthSessionMissingError" || ["session_not_found", "user_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt"].includes(error.code || "")) return { status: "signed-out" }
      return { status: "unavailable", message: "Your account is temporarily unavailable. Try again." }
    }
    if (!isVerifiedCustomer(user)) return { status: "signed-out" }
    const identity = { id: user.id, email: user.email! }
    const [profile, membership] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("company_memberships").select("company_id,role").eq("user_id", user.id).maybeSingle(),
    ])
    if (profile.error || membership.error || !profile.data || !membership.data || membership.data.role !== "owner") {
      return { status: "unavailable", user: identity, message: "Your workspace could not be loaded. Retry account setup or continue browsing." }
    }
    const company = await supabase.from("companies").select("id,name").eq("id", membership.data.company_id).maybeSingle()
    if (company.error || !company.data) return { status: "unavailable", user: identity, message: "Your workspace could not be loaded. Retry account setup or continue browsing." }
    return { status: "signed-in", user: identity, profile: { displayName: profile.data.display_name }, workspace: company.data }
  } catch {
    return { status: "unavailable", message: "Your account is temporarily unavailable. Try again." }
  }
}

export async function requireCustomerUser(next = "/account/settings") {
  if (!hasSupabasePublicConfig()) redirect(authPageHref("/sign-in", next))
  const supabase = await createServerAuthClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !isVerifiedCustomer(user)) redirect(authPageHref("/sign-in", next))
  return { supabase, user }
}
