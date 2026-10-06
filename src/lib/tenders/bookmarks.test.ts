import assert from "node:assert/strict"
import test from "node:test"

import {
  readTenderBookmarks,
  setTenderBookmark,
  TENDER_BOOKMARKS_STORAGE_KEY,
  type BookmarkStorage,
} from "./bookmarks"

function createStorage(initialValue: string | null = null) {
  let value = initialValue
  const storage: BookmarkStorage = {
    getItem(key) {
      assert.equal(key, TENDER_BOOKMARKS_STORAGE_KEY)
      return value
    },
    setItem(key, nextValue) {
      assert.equal(key, TENDER_BOOKMARKS_STORAGE_KEY)
      value = nextValue
    },
  }

  return { storage, value: () => value }
}

test("adds, persists, and removes an OCID without duplicates", () => {
  const fakeStorage = createStorage('["ocid-1"]')

  assert.deepEqual(
    setTenderBookmark(fakeStorage.storage, "ocid-2", true),
    ["ocid-1", "ocid-2"]
  )
  assert.deepEqual(
    setTenderBookmark(fakeStorage.storage, "ocid-2", true),
    ["ocid-1", "ocid-2"]
  )
  assert.deepEqual(
    setTenderBookmark(fakeStorage.storage, "ocid-1", false),
    ["ocid-2"]
  )
  assert.equal(fakeStorage.value(), '["ocid-2"]')
})

test("ignores invalid stored data", () => {
  assert.deepEqual(readTenderBookmarks(createStorage("not-json").storage), [])
  assert.deepEqual(
    readTenderBookmarks(
      createStorage('["ocid-1", 42, "", "ocid-1"]').storage
    ),
    ["ocid-1"]
  )
})

test("does not crash when local storage is unavailable", () => {
  const unavailableStorage: BookmarkStorage = {
    getItem() {
      throw new Error("blocked")
    },
    setItem() {
      throw new Error("blocked")
    },
  }

  assert.deepEqual(readTenderBookmarks(unavailableStorage), [])
  assert.deepEqual(
    setTenderBookmark(unavailableStorage, "ocid-1", true),
    ["ocid-1"]
  )
  assert.deepEqual(setTenderBookmark(null, "ocid-1", false), [])
})
