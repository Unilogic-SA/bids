import type { User } from "@supabase/supabase-js"
import { createServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/supabase/server"

export function isVerifiedCustomer(user: Pick<User, "id" | "email" | "email_confirmed_at" | "is_anonymous"> | null): user is User {
  return Boolean(user?.id && user.email && user.email_confirmed_at && !user.is_anonymous)
}

// Callers must obtain the user with fresh auth.getUser(), never FormData/metadata.
export async function ensureCustomerWorkspace(user: User) {
  if (!isVerifiedCustomer(user) || !hasSupabaseServiceRoleConfig()) return false
  const { error } = await createServiceRoleClient().rpc("bootstrap_customer_workspace", { p_user_id: user.id })
  return !error
}
