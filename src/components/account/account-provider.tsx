"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import type { AccountState, AccountSnapshot } from "@/lib/auth/account-state"
import { createAccountSnapshotReader } from "@/lib/auth/snapshot-reader"
import { createBrowserAuthClient } from "@/lib/supabase/client"

const AccountContext = createContext<{ account: AccountState; refreshAccount: () => void }>({ account: { status: "loading" }, refreshAccount: () => {} })
export function useAccount() { return useContext(AccountContext) }

export function AccountProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [snapshot, setSnapshot] = useState<{ path: string | null; state: AccountState }>({ path: null, state: { status: "loading" } })
  // Route changes cannot render a previous route's/user's identity for one frame.
  const account: AccountState = snapshot.path === pathname ? snapshot.state : { status: "loading" }
  const refreshRef = useRef<() => void>(() => {})
  const channelRef = useRef<BroadcastChannel | null>(null)
  const refreshAccount = useCallback(() => {
    refreshRef.current()
    channelRef.current?.postMessage("refresh")
  }, [])

  useEffect(() => {
    const publicRoute = pathname === "/" || pathname.startsWith("/tenders/") || pathname.startsWith("/account/") || ["/sign-in", "/sign-up", "/forgot-password"].includes(pathname)
    if (!publicRoute) return
    let disposed = false
    const reader = createAccountSnapshotReader(async signal => {
      const response = await fetch("/api/account/session", { cache: "no-store", credentials: "same-origin", signal })
      if (!response.ok) throw new Error("Account request failed")
      return await response.json() as AccountSnapshot
    }, state => setSnapshot({ path: pathname, state }))
    const refresh = () => reader.refresh()
    refreshRef.current = refresh
    const client = createBrowserAuthClient()
    // Queue work outside Supabase's synchronous callback/lock.
    const subscription = client?.auth.onAuthStateChange(event => {
      if (event !== "INITIAL_SESSION") queueMicrotask(() => { if (!disposed) refresh() })
    })
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel("openbids-account")
      channel.onmessage = () => refresh()
      channelRef.current = channel
      // Server Action/OAuth navigation changes shared cookies without necessarily
      // emitting a browser SDK event. Notify other tabs to read fresh identity.
      channel.postMessage("refresh")
    } catch { /* Auth SDK events and focus still refresh when channels are unavailable. */ }
    const focus = () => refresh()
    window.addEventListener("focus", focus)
    refresh()
    return () => {
      disposed = true
      reader.dispose()
      subscription?.data.subscription.unsubscribe()
      channel?.close()
      channelRef.current = null
      refreshRef.current = () => {}
      window.removeEventListener("focus", focus)
    }
  }, [pathname])

  return <AccountContext.Provider value={{ account, refreshAccount }}>{children}</AccountContext.Provider>
}
