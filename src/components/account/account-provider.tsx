"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import type { AccountState, AccountSnapshot } from "@/lib/auth/account-state"
import { isSameAccountAuthEvent } from "@/lib/auth/account-state"
import { createAccountSnapshotReader } from "@/lib/auth/snapshot-reader"
import { createBrowserAuthClient } from "@/lib/supabase/client"

const AccountContext = createContext<{ account: AccountState; refreshAccount: () => void }>({ account: { status: "loading" }, refreshAccount: () => {} })
export function useAccount() { return useContext(AccountContext) }

export function AccountProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AccountState>({ status: "loading" })
  // The account belongs to this browser session, not to a page. Route changes
  // preserve the verified shell; identity changes still clear it immediately.
  const account = snapshot
  const refreshRef = useRef<() => void>(() => {})
  const channelRef = useRef<BroadcastChannel | null>(null)
  const refreshAccount = useCallback(() => {
    refreshRef.current()
    channelRef.current?.postMessage("refresh")
  }, [])

  useEffect(() => {
    let confirmed: AccountState = { status: "loading" }
    let disposed = false
    let firstRead = true
    const reader = createAccountSnapshotReader(async signal => {
      const response = await fetch("/api/account/session", { cache: "no-store", credentials: "same-origin", signal })
      if (!response.ok) throw new Error("Account request failed")
      return await response.json() as AccountSnapshot
    }, state => {
      confirmed = state
      setSnapshot(state)
      if (firstRead && state.status !== "loading") {
        firstRead = false
        // Full-document OAuth returns need to notify other tabs. Include the
        // confirmed identity so an unchanged account can refresh quietly.
        channelRef.current?.postMessage({ type: "refresh", userId: state.status === "signed-in" ? state.user.id : null })
      }
    })
    const refresh = () => reader.refresh()
    refreshRef.current = refresh
    const client = createBrowserAuthClient()
    // Queue work outside Supabase's synchronous callback/lock.
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return
      // Supabase emits SIGNED_IN on refocus too. Only a new identity or
      // explicit sign-out should tear down private drafts and the app shell.
      const background = isSameAccountAuthEvent(event, session?.user.id, confirmed)
      if (!background) refresh()
      else queueMicrotask(() => { if (!disposed) reader.refresh({ background: true }) })
    })
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel("openbids-account")
      channel.onmessage = event => {
        const sameUser = event.data?.type === "refresh" && confirmed.status === "signed-in" && event.data.userId === confirmed.user.id
        reader.refresh({ background: sameUser })
      }
      channelRef.current = channel
    } catch { /* Auth SDK events and focus still refresh when channels are unavailable. */ }
    // Focus revalidation preserves drafts for the same account. Auth events
    // and explicit sign-out still clear identity immediately.
    const focus = () => reader.refresh({ background: true })
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
  }, [])

  return <AccountContext.Provider value={{ account, refreshAccount }}>{children}</AccountContext.Provider>
}
