"use client"

import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import type { AccountState, AccountSnapshot } from "@/lib/auth/account-state"
import { accountNavigationRefresh, accountRouteKey, isSameAccountAuthEvent } from "@/lib/auth/account-state"
import { AccountTransition } from "@/lib/auth/account-transition"
import { createAccountSnapshotReader } from "@/lib/auth/snapshot-reader"
import { createBrowserAuthClient } from "@/lib/supabase/client"

const AccountContext = createContext<{ account: AccountState; refreshAccount: (options?: { foreground?: boolean }) => void; registerWorkspaceGuard: (guard: () => Promise<boolean>) => () => void }>({ account: { status: "loading" }, refreshAccount: () => {}, registerWorkspaceGuard: () => () => {} })
export function useAccount() { return useContext(AccountContext) }

export function AccountProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<AccountState>({ status: "loading" })
  // The account belongs to this browser session, not to a page. Route changes
  // preserve the verified shell; identity changes still clear it immediately.
  const account = snapshot
  const workspaceGuards = useRef(new Set<() => Promise<boolean>>())
  const registerWorkspaceGuard = useCallback((guard: () => Promise<boolean>) => { workspaceGuards.current.add(guard); return () => { workspaceGuards.current.delete(guard) } }, [])
  const refreshRef = useRef<(foreground?: boolean) => void>(() => {})
  const navigateRef = useRef<(background: boolean) => void>(() => {})
  const revalidateNavigation = useCallback((background: boolean) => navigateRef.current(background), [])
  const channelRef = useRef<BroadcastChannel | null>(null)
  const identityRef = useRef<string | null>(null)
  const refreshAccount = useCallback((options?: { foreground?: boolean }) => {
    refreshRef.current(Boolean(options?.foreground))
    channelRef.current?.postMessage({ type: "refresh", userId: options?.foreground ? null : identityRef.current })
  }, [])

  useEffect(() => {
    let confirmed: AccountState = { status: "loading" }
    let disposed = false
    let lastBroadcastIdentity: string | null | undefined
    const transition = new AccountTransition(state => {
      if (confirmed.status === "signed-in" && state.status === "signed-in" && confirmed.workspace.id !== state.workspace.id && window.location.pathname === "/workspace") router.replace("/workspace", { scroll: true })
      confirmed = state
      identityRef.current = state.status === "signed-in" ? state.user.id : null
      setSnapshot(state)
      const identity = state.status === "signed-in" ? state.user.id : state.status === "signed-out" ? null : state.status === "unavailable" ? state.user?.id : undefined
      if (identity !== undefined && identity !== lastBroadcastIdentity) {
        lastBroadcastIdentity = identity
        channelRef.current?.postMessage({ type: "refresh", userId: identity })
      }
    }, () => workspaceGuards.current)
    const reader = createAccountSnapshotReader(async signal => {
      const response = await fetch("/api/account/session", { cache: "no-store", credentials: "same-origin", signal })
      if (!response.ok) throw new Error("Account request failed")
      return await response.json() as AccountSnapshot
    }, state => { void transition.accept(state) })
    const refresh = (foreground = false) => reader.refresh({ background: !foreground })
    refreshRef.current = refresh
    navigateRef.current = background => reader.refresh({ background })
    const client = createBrowserAuthClient()
    // Queue work outside Supabase's synchronous callback/lock.
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return
      // Supabase emits SIGNED_IN on refocus too. Only a new identity or
      // explicit sign-out should tear down private drafts and the app shell.
      const background = isSameAccountAuthEvent(event, session?.user.id, confirmed)
      if (!background) reader.refresh()
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
      transition.dispose()
      subscription?.data.subscription.unsubscribe()
      channel?.close()
      channelRef.current = null
      refreshRef.current = () => {}
      navigateRef.current = () => {}
      window.removeEventListener("focus", focus)
    }
  }, [router])

  return <AccountContext.Provider value={{ account, refreshAccount, registerWorkspaceGuard }}>
    <Suspense fallback={null}><AccountRouteObserver revalidate={revalidateNavigation} /></Suspense>
    {children}
  </AccountContext.Provider>
}

// Keep search-param subscription inside its own boundary, not around the app.
function AccountRouteObserver({ revalidate }: { revalidate: (background: boolean) => void }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const route = accountRouteKey(pathname, search.toString())
  const previous = useRef(route)
  useLayoutEffect(() => {
    const mode = accountNavigationRefresh(previous.current, route)
    previous.current = route
    if (mode !== "none") revalidate(mode === "background")
  }, [route, revalidate])
  return null
}
