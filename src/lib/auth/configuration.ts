import { hasSupabasePublicConfig } from "@/lib/supabase/server"
import { getTrustedAuthOrigin } from "./redirects"

export function hasCustomerAuthConfiguration() {
  if (!hasSupabasePublicConfig()) return false
  try { getTrustedAuthOrigin(); return true } catch { return false }
}
