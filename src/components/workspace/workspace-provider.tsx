"use client"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react"
import { useAccount } from "@/components/account/account-provider"
import { saveBid, updateBid, deleteBid, importGuestBids } from "@/lib/workspace/actions"
import { summarizeBid } from "@/lib/workspace/presentation"
import { WorkspaceSwitchGuard } from "@/lib/workspace/switch-guard"
import { usePathname } from "next/navigation"
import { WorkspaceGeneration } from "@/lib/workspace/client-state"
import type { BidPatch, MutationResult, SavedBid, ImportResult } from "@/lib/workspace/types"

type Snapshot = {
  scope: string | null
  bids: Record<string, SavedBid>
  loaded: Set<string>
  error: boolean
  pending: Set<string>
  revision: number
}
type Context = {
  identity: string | null
  accountGuard: () => () => boolean
  revision: number
  register: (ocid: string) => () => void
  status: (ocid: string) => {
    bid?: SavedBid
    ready: boolean
    error: boolean
    pending: boolean
  }
  trackOperation: <T>(operation: Promise<T>) => Promise<T>
  importBids: (ocids: string[]) => Promise<ImportResult[]>
  save: (ocid: string) => Promise<MutationResult>
  update: (
    id: string,
    version: number,
    patch: BidPatch
  ) => Promise<MutationResult>
  remove: (id: string, version: number) => Promise<MutationResult>
  refresh: () => void
  switching: boolean
  companyId: string | null
  prepareToLeave: () => Promise<boolean>
  releaseSwitch: () => void
  registerLeaveGuard: (guard: () => Promise<boolean>) => () => void
}
const WorkspaceContext = createContext<Context | null>(null)
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error("Workspace provider missing")
  return context
}
const changedAccount = (): MutationResult => ({
  ok: false,
  code: "unauthorized",
  message: "Your account changed. Sign in and try again."
})
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { account } = useAccount()
  const identity =
    account.status === "signed-in"
      ? `${account.user.id}:${account.workspace.id}`
      : null
  return (
    <ScopedWorkspaceProvider
      key={identity || account.status}
      identity={identity}
    >
      {children}
    </ScopedWorkspaceProvider>
  )
}
function ScopedWorkspaceProvider({
  children,
  identity
}: {
  children: ReactNode
  identity: string | null
}) {
  const { refreshAccount, registerWorkspaceGuard } = useAccount()
  const pathname = usePathname()
  const companyId = identity?.split(":")[1] || null
  const [switchGuard] = useState(() => new WorkspaceSwitchGuard())
  const switching = useSyncExternalStore(switchGuard.subscribe, switchGuard.getSnapshot, switchGuard.getSnapshot)
  const registerLeaveGuard = useCallback((guard: () => Promise<boolean>) => switchGuard.register(guard), [switchGuard])
  const prepareToLeave = useCallback(() => switchGuard.prepare(), [switchGuard])
  const releaseSwitch = useCallback(() => switchGuard.release(), [switchGuard])
  useEffect(() => registerWorkspaceGuard(async () => { const ready = await switchGuard.prepare(); switchGuard.release(); return ready }), [registerWorkspaceGuard, switchGuard])
  const [snapshot, setSnapshot] = useState<Snapshot>({
    scope: null,
    bids: {},
    loaded: new Set(),
    error: false,
    pending: new Set(),
    revision: 0
  })
  const [gate] = useState(() => {
    const value = new WorkspaceGeneration()
    value.scope(identity)
    return value
  })
  const visible = useRef(new Map<string, number>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRef = useRef<() => void>(() => {})
  const channel = useRef<BroadcastChannel | null>(null)
  const queues = useRef(new Map<string, Promise<unknown>>())
  const pendingCounts = useRef(new Map<string, number>())
  const state =
    snapshot.scope === identity
      ? snapshot
      : {
          scope: identity,
          bids: {},
          loaded: new Set<string>(),
          error: false,
          pending: new Set<string>(),
          revision: 0
        }
  const trackOperation = useCallback(<T,>(operation: Promise<T>) => switchGuard.track(operation), [switchGuard])
  const refresh = useCallback(() => refreshRef.current(), [])
  const register = useCallback((ocid: string) => {
    visible.current.set(ocid, (visible.current.get(ocid) || 0) + 1)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => refreshRef.current(), 20)
    return () => {
      const count = (visible.current.get(ocid) || 1) - 1
      if (count) visible.current.set(ocid, count)
      else visible.current.delete(ocid)
    }
  }, [])
  useEffect(() => {
    const generation = gate.scope(identity)
    queues.current.clear()
    const controllers = new Set<AbortController>()
    let request = 0
    let active = false
    let again = false
    const load = async (notify = false) => {
      if (!identity || !gate.current(generation, identity)) return
      if (active) { again ||= notify; return }
      const ids = Array.from(visible.current.keys())
      if (!ids.length) {
        if (notify) setSnapshot(previous => ({ ...previous, scope: identity, revision: previous.revision + 1 }))
        return
      }
      active = true
      const sequence = ++request
      for (const previous of controllers) previous.abort()
      controllers.clear()
      try {
        const bids: SavedBid[] = []
        for (let i = 0; i < ids.length; i += 50) {
          const controller = new AbortController()
          controllers.add(controller)
          const response = await fetch(
            `/api/workspace/saved?company=${companyId}&ocids=${encodeURIComponent(JSON.stringify(ids.slice(i, i + 50)))}`,
            {
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal
            }
          )
          if (response.status === 403) refreshAccount()
          if (!response.ok) throw new Error("Saved state unavailable")
          bids.push(...((await response.json()).bids as SavedBid[]))
        }
        if (!gate.current(generation, identity) || sequence !== request) return
        setSnapshot((previous) => ({
          scope: identity,
          bids: Object.fromEntries(bids.map((bid) => [bid.tender_ocid, bid])),
          loaded: new Set(ids),
          error: false,
          pending: previous.scope === identity ? previous.pending : new Set(),
          revision: previous.scope === identity ? previous.revision + 1 : 1
        }))
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        if (gate.current(generation, identity) && sequence === request)
          setSnapshot((previous) => ({
            ...previous,
            scope: identity,
            error: true,
            loaded: new Set(ids),
            bids: previous.scope === identity ? previous.bids : {}
          }))
      } finally { active = false; if (again) { again = false; void load(true) } }
    }
    refreshRef.current = () => {
      void load(true)
    }
    void load()
    const focus = () => {
      void load(true)
    }
    const visibleFocus = () => { if (document.visibilityState === "visible" && navigator.onLine) focus() }
    document.addEventListener("visibilitychange", visibleFocus)
    window.addEventListener("online", visibleFocus)
    window.addEventListener("focus", visibleFocus)
    let broadcast: BroadcastChannel | null = null
    if (identity)
      try {
        broadcast = new BroadcastChannel(`openbids-workspace:${identity}`)
        broadcast.onmessage = focus
        channel.current = broadcast
      } catch {}
    return () => {
      gate.scope(null)
      for (const controller of controllers) controller.abort()
      refreshRef.current = () => {}
      channel.current = null
      broadcast?.close()
      document.removeEventListener("visibilitychange", visibleFocus)
      window.removeEventListener("online", visibleFocus)
      window.removeEventListener("focus", visibleFocus)
    }
  }, [identity, companyId, gate, refreshAccount])
  useEffect(() => {
    if (pathname !== "/workspace" || !identity) return
    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) { refreshRef.current(); refreshAccount() }
    }, 30000)
    return () => clearInterval(poll)
  }, [pathname, identity, refreshAccount])
  const mutate = useCallback(
    async (key: string, operation: () => Promise<MutationResult>) => {
      if (!identity || !switchGuard.canMutate()) return changedAccount()
      const generation = gate.token()
      if (!gate.current(generation, identity)) return changedAccount()
      pendingCounts.current.set(key, (pendingCounts.current.get(key) || 0) + 1)
      setSnapshot((previous) => ({
        ...previous,
        scope: identity,
        pending: new Set(
          previous.scope === identity ? previous.pending : []
        ).add(key)
      }))
      const previous = queues.current.get(key) || Promise.resolve()
      const promise = previous
        .catch(() => {})
        .then(async () => {
          if (!gate.current(generation, identity)) return changedAccount()
          const result = await operation()
          if (!gate.current(generation, identity)) return changedAccount()
          const bid = result.ok ? result.bid : result.bid
          if (bid) {
            setSnapshot((previous) => ({
              ...previous,
              scope: identity,
              bids: { ...previous.bids, [bid.tender_ocid]: summarizeBid(bid) }
            }))
          }
          if (result.ok) {
            channel.current?.postMessage("refresh")
            refreshRef.current()
          }
          return result
        })
        .catch(
          () =>
            ({
              ok: false,
              code: "unavailable",
              message: "Your change could not be saved. Please retry."
            }) as MutationResult
        )
        .finally(() => {
          const remaining = (pendingCounts.current.get(key) || 1) - 1
          if (remaining) pendingCounts.current.set(key, remaining)
          else pendingCounts.current.delete(key)
          if (!remaining && gate.current(generation, identity))
            setSnapshot((previous) => {
              const pending = new Set(previous.pending)
              pending.delete(key)
              return { ...previous, pending }
            })
          if (queues.current.get(key) === promise) queues.current.delete(key)
        })
      queues.current.set(key, promise)
      return switchGuard.track(promise)
    },
    [identity, gate, switchGuard]
  )
  const importBids = useCallback((ocids: string[]) => {
    if (!identity || !switchGuard.canMutate()) return Promise.resolve(ocids.map(ocid => ({ ocid, status: "failed" as const })))
    const generation = gate.token()
    return switchGuard.track((async () => {
      const results: ImportResult[] = []
      for (let i = 0; i < ocids.length; i += 50) {
        if (!gate.current(generation, identity)) break
        results.push(...await importGuestBids(companyId!, ocids.slice(i, i + 50)))
      }
      return results
    })())
  }, [identity, companyId, switchGuard, gate])
  const save = useCallback(
    (ocid: string) => mutate(ocid, () => saveBid(companyId!, ocid)),
    [mutate, companyId]
  )
  const update = useCallback(
    (id: string, version: number, patch: BidPatch) =>
      mutate(id, () => updateBid(companyId!, id, version, patch)),
    [mutate, companyId]
  )
  const remove = useCallback(
    (id: string, version: number) => mutate(id, () => deleteBid(companyId!, id, version)),
    [mutate, companyId]
  )
  const accountGuard = useCallback(() => {
    const generation = gate.token()
    return () => gate.current(generation, identity)
  }, [gate, identity])
  return (
    <WorkspaceContext.Provider
      value={{
        identity,
        companyId,
        switching,
        prepareToLeave,
        releaseSwitch,
        registerLeaveGuard,
        accountGuard,
        revision: state.revision,
        register,
        status: (ocid) => ({
          bid: state.bids[ocid],
          ready: Boolean(identity && state.loaded.has(ocid)),
          error: state.error,
          pending:
            state.pending.has(ocid) ||
            Boolean(state.bids[ocid] && state.pending.has(state.bids[ocid].id))
        }),
        trackOperation,
        importBids,
        save,
        update,
        remove,
        refresh
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
