import {
  readTenderBookmarks,
  setTenderBookmark,
  type BookmarkStorage
} from "@/lib/tenders/bookmarks"
import type { ImportResult } from "./types"
/** Read current device state after acknowledgement, preserving additions made during import. */
export function acknowledgeGuestImport(
  storage: BookmarkStorage | null,
  results: ImportResult[],
  accountStillMatches: boolean
) {
  if (!accountStillMatches) return readTenderBookmarks(storage)
  for (const result of results)
    if (result.status === "inserted" || result.status === "already_exists")
      setTenderBookmark(storage, result.ocid, false)
  return readTenderBookmarks(storage)
}
export function browserBookmarkStorage(): BookmarkStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
export const BOOKMARK_CHANGE_EVENT = "openbids:tender-bookmarks-change"
