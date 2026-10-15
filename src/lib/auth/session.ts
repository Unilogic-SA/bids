import { cookies } from "next/headers"
import { resolveWorkspace, SELECTED_WORKSPACE_COOKIE } from "./workspace-selection"
import { invitationsEnabled } from "@/lib/workspace/invitation-configuration"
import { redirect } from "next/navigation"
import { createServerAuthClient, hasSupabasePublicConfig } from "@/lib/supabase/server"
import type { AccountSnapshot, AccountWorkspace } from "./account-state"
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
    const [profile, memberships] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      (async () => {
        const rows = []
        for (let offset = 0; ; offset += 100) {
          const result = await supabase.from("company_memberships").select("company_id,role,created_at,companies!inner(id,name)").eq("user_id", user.id).order("created_at").order("company_id").range(offset, offset + 99)
          if (result.error) return { data: null, error: result.error }
          rows.push(...result.data)
          if (result.data.length < 100) return { data: rows, error: null }
        }
      })(),
    ])
    if (profile.error || memberships.error || !profile.data || !memberships.data?.length) {
      return { status: "unavailable", user: identity, message: "Your workspace could not be loaded. Retry account setup or continue browsing." }
    }
    const workspaces: AccountWorkspace[] = memberships.data.flatMap(membership => {
      const company = membership.companies as unknown as { id: string; name: string | null } | null
      return company && ["owner", "member"].includes(membership.role) ? [{ ...company, role: membership.role as "owner" | "member" }] : []
    })
    const workspace = resolveWorkspace(workspaces, (await cookies()).get(SELECTED_WORKSPACE_COOKIE)?.value)
    if (!workspace) return { status: "unavailable", user: identity, message: "Your workspace could not be loaded. Please retry." }
    return { status: "signed-in", user: identity, profile: { displayName: profile.data.display_name }, workspace, workspaces, invitationsEnabled: invitationsEnabled() }

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
