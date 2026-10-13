"use client"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { IconBookmark, IconArrowRight } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAccount } from "@/components/account/account-provider"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { readTenderBookmarks, setTenderBookmark } from "@/lib/tenders/bookmarks"
import {
  browserBookmarkStorage,
  BOOKMARK_CHANGE_EVENT
} from "@/lib/workspace/import"
import { trackUmamiEvent } from "@/lib/analytics"

export function TenderBookmarkButton({ ocid }: { ocid: string }) {
  const { account } = useAccount()
  const workspace = useWorkspace()
  const router = useRouter()
  const [session, setSession] = useState<{
    ocid: string
    value: boolean
  } | null>(null)
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
  async function save() {
    if (guest) {
      setTenderBookmark(browserBookmarkStorage(), ocid, true)
      window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT))
      const persisted = readTenderBookmarks(browserBookmarkStorage()).includes(
        ocid
      )
      setSession(persisted ? null : { ocid, value: true })
      toast(persisted ? "Saved on this device" : "Saved for this visit", {
        action: {
          label: "Sign in",
          onClick: () =>
            router.push(
              `/sign-in?next=${encodeURIComponent(`/tenders/${ocid}`)}`
            )
        }
      })
      trackUmamiEvent("tender_bookmark_added", { ocid })
      return
    }
    if (!signedIn) return
    if (remote.error) {
      workspace.refresh()
      toast("Saved state could not be loaded. Retrying…")
      return
    }
    const result = remote.bid?.archived_at
      ? await workspace.update(remote.bid.id, remote.bid.version, {
          archive: false
        })
      : await workspace.save(ocid)
    if (!result.ok) {
      toast.error(result.message, {
        action: { label: "Retry", onClick: () => void save() }
      })
      return
    }
    if (result.bid)
      toast("Saved to workspace", {
        action: {
          label: "View",
          onClick: () => router.push(`/workspace?bid=${result.bid!.id}`)
        }
      })
  }
  if (bookmarked && !remote.pending)
    return (
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-8 cursor-pointer sm:h-7"
      >
        <Link
          href={
            signedIn && remote.bid
              ? `/workspace?bid=${remote.bid.id}`
              : "/workspace"
          }
        >
          View in workspace
          <IconArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    )
  return (
    <Button
      aria-label={
        remote.bid?.archived_at ? "Restore to workspace" : "Save tender"
      }
      className="h-8 min-w-18 cursor-pointer disabled:cursor-not-allowed sm:h-7 sm:min-w-28"
      onClick={() => void save()}
      disabled={disabled}
      size="sm"
      type="button"
      variant="outline"
    >
      <IconBookmark data-icon="inline-start" />
      {remote.pending
        ? "Saving…"
        : signedIn && remote.error
          ? "Retry save status"
          : remote.bid?.archived_at
            ? "Restore"
            : "Save"}
    </Button>
  )
}
