export const TENDER_BOOKMARKS_STORAGE_KEY = "openbids:tender-bookmarks:v1"

export type BookmarkStorage = Pick<Storage, "getItem" | "setItem">

export function readTenderBookmarks(storage?: BookmarkStorage | null) {
  if (!storage) return []

  try {
    const storedValue = storage.getItem(TENDER_BOOKMARKS_STORAGE_KEY)
    if (!storedValue) return []

    const parsedValue: unknown = JSON.parse(storedValue)
    if (!Array.isArray(parsedValue)) return []

    return Array.from(
      new Set(
        parsedValue.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      )
    )
  } catch {
    return []
  }
}

export function setTenderBookmark(
  storage: BookmarkStorage | null | undefined,
  ocid: string,
  bookmarked: boolean
) {
  const normalizedOcid = ocid.trim()
  const currentBookmarks = readTenderBookmarks(storage)
  const nextBookmarks = bookmarked
    ? Array.from(new Set([...currentBookmarks, normalizedOcid])).filter(Boolean)
    : currentBookmarks.filter((value) => value !== normalizedOcid)

  if (storage) {
    try {
      storage.setItem(
        TENDER_BOOKMARKS_STORAGE_KEY,
        JSON.stringify(nextBookmarks)
      )
    } catch {
      // Keep the interaction usable when storage is blocked or unavailable.
    }
  }

  return nextBookmarks
}
