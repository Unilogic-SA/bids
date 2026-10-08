"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createBrowserAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  try { return url && key ? createBrowserClient(url, key) : null } catch { return null }
}
