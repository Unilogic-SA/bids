"use client"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react"
import { useAccount } from "@/components/account/account-provider"
import { saveBid, updateBid, deleteBid } from "@/lib/workspace/actions"
import { summarizeBid } from "@/lib/workspace/presentation"
import { WorkspaceGeneration } from "@/lib/workspace/client-state"
import type { BidPatch, MutationResult, SavedBid } from "@/lib/workspace/types"

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
  save: (ocid: string) => Promise<MutationResult>
  update: (
    id: string,
    version: number,
    patch: BidPatch
  ) => Promise<MutationResult>
  remove: (id: string, version: number) => Promise<MutationResult>
  refresh: () => void
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
    const load = async () => {
      if (!identity) return
      const ids = Array.from(visible.current.keys())
      const sequence = ++request
      for (const previous of controllers) previous.abort()
      controllers.clear()
      try {
        const bids: SavedBid[] = []
        for (let i = 0; i < ids.length; i += 50) {
          const controller = new AbortController()
          controllers.add(controller)
          const response = await fetch(
            `/api/workspace/saved?ocids=${encodeURIComponent(JSON.stringify(ids.slice(i, i + 50)))}`,
            {
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal
            }
          )
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
      }
    }
    refreshRef.current = () => {
      void load()
    }
    void load()
    const focus = () => {
      void load()
    }
    window.addEventListener("focus", focus)
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
      window.removeEventListener("focus", focus)
    }
  }, [identity, gate])
  const mutate = useCallback(
    async (key: string, operation: () => Promise<MutationResult>) => {
      if (!identity) return changedAccount()
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
      return promise
    },
    [identity, gate]
  )
  const save = useCallback(
    (ocid: string) => mutate(ocid, () => saveBid(ocid)),
    [mutate]
  )
  const update = useCallback(
    (id: string, version: number, patch: BidPatch) =>
      mutate(id, () => updateBid(id, version, patch)),
    [mutate]
  )
  const remove = useCallback(
    (id: string, version: number) => mutate(id, () => deleteBid(id, version)),
    [mutate]
  )
  const accountGuard = useCallback(() => {
    const generation = gate.token()
    return () => gate.current(generation, identity)
  }, [gate, identity])
  return (
    <WorkspaceContext.Provider
      value={{
        identity,
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
