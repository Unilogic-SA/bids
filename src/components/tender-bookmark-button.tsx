"use client"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconBookmark,
  IconBookmarkFilled,
  IconArrowRight
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { useAccount } from "@/components/account/account-provider"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { GuestImportPrompt } from "@/components/workspace/guest-import-prompt"
import { readTenderBookmarks, setTenderBookmark } from "@/lib/tenders/bookmarks"
import {
  browserBookmarkStorage,
  BOOKMARK_CHANGE_EVENT
} from "@/lib/workspace/import"
import { STAGE_LABELS } from "@/lib/workspace/types"
import { trackUmamiEvent } from "@/lib/analytics"

export function TenderBookmarkButton({ ocid }: { ocid: string }) {
  const { account } = useAccount()
  const workspace = useWorkspace()
  const router = useRouter()
  const [session, setSession] = useState<{
    ocid: string
    value: boolean
  } | null>(null)
  const [archive, setArchive] = useState(false)
  const subscribe = useCallback((onChange: () => void) => {
    const change = () => {
      setSession(null)
      onChange()
    }
    window.addEventListener("storage", change)
    window.addEventListener(BOOKMARK_CHANGE_EVENT, change)
    return () => {
      window.removeEventListener("storage", change)
      window.removeEventListener(BOOKMARK_CHANGE_EVENT, change)
    }
  }, [])
  const guestSaved = useSyncExternalStore(
    subscribe,
    () => readTenderBookmarks(browserBookmarkStorage()).includes(ocid),
    () => false
  )
  const { register } = workspace
  useEffect(() => register(ocid), [register, ocid])
  const remote = workspace.status(ocid)
  const signedIn = account.status === "signed-in"
  const guest = account.status === "signed-out"
  const bookmarked = signedIn
    ? Boolean(remote.bid && !remote.bid.archived_at)
    : guest && (session?.ocid === ocid ? session.value : guestSaved)
  const disabled =
    (!guest && !signedIn) || remote.pending || (signedIn && !remote.ready)
  async function toggle() {
    if (guest) {
      const next = !bookmarked
      setTenderBookmark(browserBookmarkStorage(), ocid, next)
      window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT))
      const persisted =
        readTenderBookmarks(browserBookmarkStorage()).includes(ocid) === next
      setSession(persisted ? null : { ocid, value: next })
      toast(
        next
          ? persisted
            ? "Saved on this device"
            : "Saved for this visit"
          : "Device save removed",
        {
          action: next
            ? {
                label: "Sign in",
                onClick: () =>
                  router.push(
                    `/sign-in?next=${encodeURIComponent(`/tenders/${ocid}`)}`
                  )
              }
            : undefined
        }
      )
      trackUmamiEvent(
        next ? "tender_bookmark_added" : "tender_bookmark_removed",
        { ocid }
      )
      return
    }
    if (!signedIn) return
    if (remote.error) {
      workspace.refresh()
      toast("Saved state could not be loaded. Retrying…")
      return
    }
    if (remote.bid && !remote.bid.archived_at && remote.bid.has_work) {
      setArchive(true)
      return
    }
    const result = remote.bid
      ? remote.bid.archived_at
        ? await workspace.update(remote.bid.id, remote.bid.version, {
            archive: false
          })
        : await workspace.remove(remote.bid.id, remote.bid.version)
      : await workspace.save(ocid)
    if (!result.ok) {
      toast.error(result.message, {
        action: { label: "Retry", onClick: () => void toggle() }
      })
      return
    }
    if (!result.bid)
      toast("Save removed", {
        action: { label: "Undo", onClick: () => void workspace.save(ocid) }
      })
    else
      toast("Saved to workspace", {
        action: {
          label: "View",
          onClick: () => router.push(`/workspace?bid=${result.bid!.id}`)
        }
      })
  }
  async function prepare() {
    const saved = await workspace.save(ocid)
    if (!saved.ok || !saved.bid) {
      toast.error(saved.ok ? "Bid unavailable" : saved.message)
      return
    }
    const result = await workspace.update(saved.bid.id, saved.bid.version, {
      stage: "preparing",
      archive: false
    })
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    router.push(`/workspace?bid=${saved.bid.id}`)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-pressed={bookmarked}
        aria-label={
          remote.bid?.archived_at
            ? "Restore to workspace"
            : bookmarked
              ? "Manage saved tender"
              : "Save tender"
        }
        className="h-8 min-w-18 sm:h-7 sm:min-w-28"
        onClick={() => void toggle()}
        disabled={disabled}
        size="sm"
        type="button"
        variant={bookmarked ? "default" : "outline"}
      >
        {bookmarked ? (
          <IconBookmarkFilled data-icon="inline-start" />
        ) : (
          <IconBookmark data-icon="inline-start" />
        )}
        {remote.pending
          ? "Saving…"
          : signedIn && remote.error
            ? "Retry save status"
            : remote.bid?.archived_at
              ? "Restore"
              : bookmarked
                ? "Saved"
                : "Save"}
      </Button>
      {signedIn && remote.bid && !remote.bid.archived_at ? (
        <Button asChild size="sm" variant="ghost" className="h-8 sm:h-7">
          <Link href={`/workspace?bid=${remote.bid.id}`}>
            {STAGE_LABELS[remote.bid.stage]}
            <IconArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : null}
      {signedIn &&
      remote.ready &&
      !remote.error &&
      (!remote.bid ||
        ((remote.bid.stage === "saved" || remote.bid.stage === "reviewing") &&
          !remote.bid.outcome)) ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 sm:h-7"
          disabled={remote.pending}
          onClick={() => void prepare()}
        >
          Prepare bid
        </Button>
      ) : null}
      <Dialog open={archive} onOpenChange={setArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this bid?</DialogTitle>
            <DialogDescription>
              Your preparation will be kept. You can restore the bid from
              Archived in your workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchive(false)}>
              Cancel
            </Button>
            <Button
              disabled={remote.pending}
              onClick={async () => {
                if (!remote.bid) return
                const result = await workspace.update(
                  remote.bid.id,
                  remote.bid.version,
                  { archive: true }
                )
                if (result.ok) {
                  setArchive(false)
                  toast("Bid archived")
                } else toast.error(result.message)
              }}
            >
              Archive bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {signedIn ? <GuestImportPrompt compact /> : null}
    </div>
  )
}
