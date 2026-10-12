import assert from "node:assert/strict"
import { test } from "node:test"
import { WorkspaceGeneration } from "./client-state"
import { acknowledgeGuestImport } from "./import"
import {
  mutationSchema,
  importSchema,
  parseWorkspaceFilters
} from "./validation"
import { attentionSignals, fromSastInput, sastInput } from "./presentation"
import { readTenderBookmarks, setTenderBookmark } from "../tenders/bookmarks"
import type { WorkspaceEntry } from "./types"
test("validation rejects forged fields, invalid OCIDs, duplicate imports and oversized notes", () => {
  assert.equal(importSchema.safeParse(["a", "a"]).success, false)
  assert.equal(importSchema.safeParse([" ../a"]).success, false)
  assert.equal(
    mutationSchema.safeParse({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 1,
      patch: { company_id: "x" }
    }).success,
    false
  )
  assert.equal(
    mutationSchema.safeParse({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 1,
      patch: { notes: "x".repeat(10001) }
    }).success,
    false
  )
  assert.deepEqual(
    parseWorkspaceFilters(
      new URLSearchParams("view=board&stage=submitted&page=-1&offset_saved=31")
    ).offsets.saved,
    31
  )
})
test("generation excludes delayed responses, account switch and logout/login of same identity", () => {
  const gate = new WorkspaceGeneration()
  const a = gate.scope("a")
  assert.equal(gate.current(a, "a"), true)
  gate.scope("b")
  assert.equal(gate.current(a, "a"), false)
  const b = gate.scope("b")
  gate.invalidate()
  assert.equal(gate.current(b, "b"), false)
  gate.scope(null)
  const newer = gate.scope("a")
  assert.notEqual(a, newer)
  assert.equal(gate.current(a, "a"), false)
})
test("import only cleans acknowledged IDs for same identity and retains additions/failures", () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    }
  }
  for (const id of ["a", "b", "c"]) setTenderBookmark(storage, id, true)
  setTenderBookmark(storage, "new", true)
  const results = [
    { ocid: "a", status: "inserted" as const },
    { ocid: "b", status: "already_exists" as const },
    { ocid: "c", status: "failed" as const }
  ]
  acknowledgeGuestImport(storage, results, false)
  assert.equal(readTenderBookmarks(storage).length, 4)
  acknowledgeGuestImport(storage, results, true)
  assert.deepEqual(readTenderBookmarks(storage), ["c", "new"])
})
test("SAST inputs and attention signals respect midnight, submission and changed deadlines", () => {
  const now = Date.parse("2026-10-12T22:30:00Z")
  assert.equal(fromSastInput("2026-10-13T10:00"), "2026-10-13T08:00:00.000Z")
  assert.equal(sastInput("2026-10-13T08:00:00Z"), "2026-10-13T10:00")
  const bid = {
    stage: "preparing",
    outcome: null,
    archived_at: null,
    checklist: [],
    source_available: true,
    next_action_due_at: null,
    acknowledged_closing_at: "2026-10-14T10:00:00Z",
    tender: { closing_at: "2026-10-14T10:00:00Z", compulsory_briefing: false }
  } as unknown as WorkspaceEntry
  assert.match(attentionSignals(bid, now)[0].text, /tomorrow/)
  assert.equal(attentionSignals({ ...bid, stage: "submitted" }, now).length, 0)
  assert.equal(
    attentionSignals(
      { ...bid, acknowledged_closing_at: "2026-10-15T10:00:00Z" },
      now
    )[0].kind,
    "deadline"
  )
  assert.equal(
    attentionSignals({ ...bid, source_available: false }, now)[0].kind,
    "source"
  )
  assert.match(
    attentionSignals(bid, Date.parse("2026-10-15T10:00:00Z"))[0].text,
    /passed/
  )
})
test("expanded board rereads only existing pages, deduplicates and retains correct stage/count projection", async () => {
  const { boardRounds, mergeBoardPages } = await import("./board")
  const counts = {
    saved: 36,
    reviewing: 1,
    preparing: 0,
    ready: 0,
    submitted: 0
  }
  assert.equal(boardRounds({ saved: 30 }, counts), 1)
  assert.equal(boardRounds({ saved: 99999 }, { ...counts, saved: 0 }), 0)
  const a = {
    id: "a",
    stage: "saved",
    tender: { closing_at: "2026-10-15" }
  } as WorkspaceEntry
  const b = {
    id: "b",
    stage: "reviewing",
    tender: { closing_at: "2026-10-14" }
  } as WorkspaceEntry
  const merged = mergeBoardPages([
    { items: [a, b], total: 37, counts },
    {
      items: [a, { ...b, stage: "preparing" }],
      total: 37,
      counts: { ...counts, reviewing: 0, preparing: 1 }
    }
  ])
  assert.equal(merged.items.length, 2)
  assert.equal(merged.items[1].stage, "preparing")
  assert.equal(merged.counts.preparing, 1)
})
