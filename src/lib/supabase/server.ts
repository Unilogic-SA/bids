import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const syncSecret = process.env.ETENDERS_SYNC_SECRET

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey)
}

export function hasSupabaseServiceConfig() {
  return Boolean(supabaseUrl && (supabaseServiceKey || (supabasePublishableKey && syncSecret)))
}

export function createPublicClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    )
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function createServiceClient() {
  if (!supabaseUrl || (!supabaseServiceKey && !(supabasePublishableKey && syncSecret))) {
    throw new Error(
      "Missing Supabase write configuration."
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey || supabasePublishableKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: syncSecret
      ? {
          headers: {
            "x-sync-secret": syncSecret,
          },
        }
      : undefined,
  })
}
