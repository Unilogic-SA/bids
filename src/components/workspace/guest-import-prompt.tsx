"use client"
import { useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useAccount } from "@/components/account/account-provider"
import { workspaceLabel } from "@/lib/auth/account-state"
import { useWorkspace } from "./workspace-provider"
import {
  acknowledgeGuestImport,
  browserBookmarkStorage,
  BOOKMARK_CHANGE_EVENT
} from "@/lib/workspace/import"
import { readTenderBookmarks } from "@/lib/tenders/bookmarks"
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify)
  window.addEventListener(BOOKMARK_CHANGE_EVENT, notify)
  return () => {
    window.removeEventListener("storage", notify)
    window.removeEventListener(BOOKMARK_CHANGE_EVENT, notify)
  }
}
export function GuestImportPrompt({ compact = false }: { compact?: boolean }) {
  const workspace = useWorkspace()
  const { account } = useAccount()
  const name = account.status === "signed-in" ? workspaceLabel(account.workspace.name) : "workspace"
  const ids = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readTenderBookmarks(browserBookmarkStorage())),
    () => "[]"
  )
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const count = (JSON.parse(ids) as string[]).length
  if (!workspace.identity || !count || dismissed === workspace.identity)
    return null
  async function importSaved() {
    const current = workspace.accountGuard()
    setBusy(true)
    const results = []
    const captured = JSON.parse(ids) as string[]
    try {
      results.push(...await workspace.importBids(captured))
      if (!current()) return
      acknowledgeGuestImport(browserBookmarkStorage(), results, true)
      window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT))
      workspace.refresh()
      const done = results.filter(
        (result) =>
          result.status === "inserted" || result.status === "already_exists"
      ).length
      toast(
        done
          ? `${done} saved tender${done === 1 ? "" : "s"} connected to your workspace${done < captured.length ? ". Unavailable or failed items remain on this device." : "."}`
          : "No tenders imported. Your device saves are kept; please retry."
      )
    } catch {
      if (current())
        toast.error(
          "Import could not be completed. Your device saves are kept. Please retry."
        )
    } finally {
      setBusy(false)
    }
  }
  if (compact)
    return (
      <div className="space-y-1"><Button
        variant="link"
        size="sm"
        disabled={busy}
        onClick={() => void importSaved()}
      >
        {busy
          ? "Importing…"
          : `Bring ${count} device save${count === 1 ? "" : "s"} into ${name}`}
      </Button><p className="text-xs text-muted-foreground">Everyone in {name} can see imported bids.</p></div>
    )
  return (
    <Alert>
      <AlertTitle>
        Bring your {count} saved tender{count === 1 ? "" : "s"} into {name}?
      </AlertTitle>
      <AlertDescription>
        <p>
          These saves are on this device. Everyone in {name} can see imported bids.
          Existing bids stay as they are.
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void importSaved()}>
            {busy ? "Importing…" : "Import saved tenders"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setDismissed(workspace.identity)}
          >
            Not now
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
