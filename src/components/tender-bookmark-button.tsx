"use client"

import { useCallback, useState, useSyncExternalStore } from "react"
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  readTenderBookmarks,
  setTenderBookmark,
  type BookmarkStorage,
} from "@/lib/tenders/bookmarks"
import { trackUmamiEvent } from "@/lib/analytics"

export function TenderBookmarkButton({ ocid }: { ocid: string }) {
  const [sessionBookmark, setSessionBookmark] = useState<{
    ocid: string
    value: boolean
  } | null>(null)
  const subscribe = useCallback(
    (onChange: () => void) =>
      subscribeToBookmarkChanges(() => {
        setSessionBookmark(null)
        onChange()
      }),
    []
  )
  const storedBookmark = useSyncExternalStore(
    subscribe,
    () => readTenderBookmarks(getBrowserStorage()).includes(ocid),
    () => false
  )
  const bookmarked =
    sessionBookmark?.ocid === ocid ? sessionBookmark.value : storedBookmark

  function toggleBookmark() {
    const nextBookmarked = !bookmarked
    const nextBookmarks = setTenderBookmark(
      getBrowserStorage(),
      ocid,
      nextBookmarked
    )

    window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT))
    // A session override is needed only if persistence is blocked. External
    // changes clear it, so a successful local toggle never masks storage.
    setSessionBookmark(
      readTenderBookmarks(getBrowserStorage()).includes(ocid) === nextBookmarked
        ? null
        : {
            ocid,
            value: nextBookmarked ? nextBookmarks.includes(ocid) : false,
          }
    )
    trackUmamiEvent(
      nextBookmarked ? "tender_bookmark_added" : "tender_bookmark_removed",
      { ocid }
    )
  }

  return (
    <Button
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark tender"}
      className="h-8 min-w-18 sm:h-7 sm:min-w-28"
      onClick={toggleBookmark}
      size="sm"
      type="button"
      variant={bookmarked ? "default" : "outline"}
    >
      {bookmarked ? (
        <IconBookmarkFilled data-icon="inline-start" />
      ) : (
        <IconBookmark data-icon="inline-start" />
      )}
      <span className="sm:hidden">{bookmarked ? "Saved" : "Save"}</span>
      <span className="hidden sm:inline">
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </span>
    </Button>
  )
}

const BOOKMARK_CHANGE_EVENT = "openbids:tender-bookmarks-change"

function subscribeToBookmarkChanges(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(BOOKMARK_CHANGE_EVENT, onChange)

  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(BOOKMARK_CHANGE_EVENT, onChange)
  }
}

function getBrowserStorage(): BookmarkStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
