import type { AccountSnapshot, AccountState } from "./account-state"

/** One reader per provider; coalesces reads and prevents an old identity winning a race. */
export function createAccountSnapshotReader(
  read: (signal: AbortSignal) => Promise<AccountSnapshot>,
  publish: (state: AccountState) => void
) {
  let disposed = false
  let scheduled = false
  let generation = 0
  let active: AbortController | null = null
  let background = false
  let lastConfirmed: AccountSnapshot | null = null
  return {
    refresh(options?: { background?: boolean }) {
      if (disposed) return
      generation++
      background = Boolean(options?.background)
      active?.abort()
      if (!options?.background) {
        lastConfirmed = null
        publish({ status: "loading" })
      }
      if (scheduled) return
      scheduled = true
      queueMicrotask(async () => {
        scheduled = false
        if (disposed) return
        const current = generation
        const quiet = background
        active = new AbortController()
        try {
          const result = await read(active.signal)
          if (!disposed && current === generation) {
            // A transient background outage is not a sign-out. Preserve private
            // drafts until a definitive identity response or foreground refresh.
            if (
              quiet &&
              lastConfirmed?.status === "signed-in" &&
              result.status === "unavailable" &&
              (!result.user || result.user.id === lastConfirmed.user.id)
            )
              return
            lastConfirmed = result
            publish(result)
          }
        } catch {
          if (
            !disposed &&
            current === generation &&
            !(quiet && lastConfirmed?.status === "signed-in")
          )
            publish({
              status: "unavailable",
              message: "Your account is temporarily unavailable. Try again."
            })
        }
      })
    },
    dispose() {
      disposed = true
      generation++
      active?.abort()
    }
  }
}
