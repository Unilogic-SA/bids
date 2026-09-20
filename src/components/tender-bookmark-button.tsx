"use client"

import { useState, useSyncExternalStore } from "react"
import { IconBookmark } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  readTenderBookmarks,
  setTenderBookmark,
  type BookmarkStorage,
} from "@/lib/tenders/bookmarks"
import { trackUmamiEvent } from "@/lib/analytics"

export function TenderBookmarkButton({ ocid }: { ocid: string }) {
  const storedBookmark = useSyncExternalStore(
    subscribeToBookmarkChanges,
    () => readTenderBookmarks(getBrowserStorage()).includes(ocid),
    () => false
  )
  const [sessionBookmark, setSessionBookmark] = useState<{
    ocid: string
    value: boolean
  } | null>(null)
  const bookmarked =
    sessionBookmark?.ocid === ocid ? sessionBookmark.value : storedBookmark

  function toggleBookmark() {
    const nextBookmarked = !bookmarked
    const nextBookmarks = setTenderBookmark(
      getBrowserStorage(),
      ocid,
      nextBookmarked
    )

    setSessionBookmark({
      ocid,
      value: nextBookmarked ? nextBookmarks.includes(ocid) : false,
    })
    window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT))
    trackUmamiEvent(
      nextBookmarked ? "tender_bookmark_added" : "tender_bookmark_removed",
      { ocid }
    )
  }

  return (
    <Button
      aria-pressed={bookmarked}
      className="min-h-11 sm:min-h-7"
      onClick={toggleBookmark}
      size="sm"
      type="button"
      variant="outline"
    >
      <IconBookmark data-icon="inline-start" />
      {bookmarked ? "Bookmarked" : "Bookmark"}
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
