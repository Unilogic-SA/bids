import type { AccountSnapshot, AccountState } from "./account-state"

/** One reader per provider; coalesces reads and prevents an old identity winning a race. */
export function createAccountSnapshotReader(read: (signal: AbortSignal) => Promise<AccountSnapshot>, publish: (state: AccountState) => void) {
  let disposed = false
  let scheduled = false
  let generation = 0
  let active: AbortController | null = null
  return {
    refresh() {
      if (disposed) return
      generation++
      active?.abort()
      publish({ status: "loading" })
      if (scheduled) return
      scheduled = true
      queueMicrotask(async () => {
        scheduled = false
        if (disposed) return
        const current = generation
        active = new AbortController()
        try {
          const result = await read(active.signal)
          if (!disposed && current === generation) publish(result)
        } catch {
          if (!disposed && current === generation) publish({ status: "unavailable", message: "Your account is temporarily unavailable. Try again." })
        }
      })
    },
    dispose() { disposed = true; generation++; active?.abort() },
  }
}
