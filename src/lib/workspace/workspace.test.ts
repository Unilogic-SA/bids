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
    ).some((signal) => signal.kind === "deadline"),
    true
  )
  assert.equal(
    attentionSignals({ ...bid, source_available: false }, now).some(
      (signal) => signal.kind === "source"
    ),
    true
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

test("opening and closing a bid sheet does not change the workspace list request", async () => {
  const { workspaceListQuery } = await import("./client-state")
  const query = "view=board&q=software&state=active&offset_saved=30"
  assert.equal(
    workspaceListQuery(`${query}&bid=one`),
    workspaceListQuery(query)
  )
  assert.equal(
    workspaceListQuery(`${query}&bid=two`),
    workspaceListQuery(query)
  )
  assert.notEqual(
    workspaceListQuery(`${query}&page=2`),
    workspaceListQuery(query)
  )
  assert.notEqual(workspaceListQuery("q=hardware"), workspaceListQuery(query))
})

test("retired next-action fields are rejected while notes and checklist patches stay valid", () => {
  const base = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1 }
  for (const patch of [
    { next_action: "Review tomorrow" },
    { next_action_due_at: "2026-10-15T10:00:00Z" },
    { notes: "Keep", next_action: null }
  ])
    assert.equal(mutationSchema.safeParse({ ...base, patch }).success, false)
  assert.equal(
    mutationSchema.safeParse({ ...base, patch: { notes: "My draft" } }).success,
    true
  )
  assert.equal(
    mutationSchema.safeParse({ ...base, patch: { checklist: [] } }).success,
    true
  )
})
test("legacy next actions never create overdue signals and still count as private work", async () => {
  const { summarizeBid } = await import("./presentation")
  const bid = {
    id: "one",
    stage: "saved",
    outcome: null,
    archived_at: null,
    notes: "",
    checklist: [],
    checklist_initialized: false,
    source_available: true,
    acknowledged_closing_at: null,
    next_action: "Legacy action",
    next_action_due_at: "2020-01-01T00:00:00Z",
    tender: { closing_at: null, compulsory_briefing: false }
  } as unknown as WorkspaceEntry
  assert.deepEqual(
    attentionSignals(bid, Date.parse("2026-10-15T10:00:00Z")),
    []
  )
  assert.equal(summarizeBid(bid).has_work, true)
  assert.equal(summarizeBid({ ...bid, next_action: null }).has_work, true)
})
test("workspace title matches Discover description priority, whitespace fallback and snapshot retention", async () => {
  const {
    descriptiveWorkspaceTitle,
    withWorkspaceTitles,
    MAX_WORKSPACE_TITLE_LENGTH
  } = await import("./titles")
  const source = {
    ocid: "one",
    bid_description: "  SUPPLY OF ICT EQUIPMENT  ",
    title_snippet: "Snippet",
    title: "006/2026"
  }
  assert.equal(
    descriptiveWorkspaceTitle(source, "006/2026"),
    "Supply of ICT equipment"
  )
  assert.equal(
    descriptiveWorkspaceTitle(
      {
        ...source,
        bid_description: " \n ",
        title_snippet: " CONTRACTED SERVICES "
      },
      null
    ),
    "Contracted services"
  )
  assert.equal(
    descriptiveWorkspaceTitle(
      { ...source, bid_description: "", title_snippet: " ", title: "Title" },
      null
    ),
    "Title"
  )
  const missing = {
    tender_ocid: "one",
    source_available: false,
    tender: { title: " " },
    tender_snapshot: { title: "SAVED DESCRIPTION" }
  } as WorkspaceEntry
  const shown = withWorkspaceTitles([missing], [source])[0]
  assert.equal(shown.tender.title, "Saved description")
  assert.equal(shown.tender_snapshot, missing.tender_snapshot)
  assert.equal(descriptiveWorkspaceTitle(undefined, null), null)
  assert.equal(
    descriptiveWorkspaceTitle(
      { ...source, bid_description: "x".repeat(3000) },
      null
    )?.length,
    MAX_WORKSPACE_TITLE_LENGTH
  )
})
test("title enrichment uses one bounded batch from the supplied caller and retains work on catalog failure", async () => {
  const { enrichWorkspaceTitles } = await import("./query")
  const entries = Array.from(
    { length: 160 },
    (_, index) =>
      ({
        tender_ocid: `bid-${index}`,
        source_available: index !== 0,
        tender: { title: "Numeric reference" },
        tender_snapshot: { title: "Snapshot" }
      }) as WorkspaceEntry
  )
  const calls: {
    table?: string
    columns?: string
    ids?: string[]
    limit?: number
  } = {}
  let reads = 0
  const client = {
    from: (table: string) => {
      reads++
      calls.table = table
      return {
        select: (columns: string) => {
          calls.columns = columns
          return {
            in: (_key: string, ids: string[]) => {
              calls.ids = ids
              return {
                limit: async (limit: number) => {
                  calls.limit = limit
                  return {
                    data: [
                      {
                        ocid: "bid-1",
                        bid_description: "DESCRIPTIVE RESPONSE",
                        title_snippet: null,
                        title: "001"
                      }
                    ],
                    error: null
                  }
                }
              }
            }
          }
        }
      }
    }
  } as unknown as Parameters<typeof enrichWorkspaceTitles>[0]
  const result = await enrichWorkspaceTitles(client, entries)
  assert.equal(reads, 1)
  assert.equal(calls.table, "tenders")
  assert.equal(calls.columns, "ocid,bid_description,title_snippet,title")
  assert.equal(calls.ids?.length, 150)
  assert.equal(calls.ids?.includes("bid-0"), false)
  assert.equal(calls.limit, 150)
  assert.equal(result[1].tender.title, "Descriptive response")
  assert.equal(result.length, entries.length)
  let failureReads = 0
  const failedClient = {
    from: () => {
      failureReads++
      return {
        select: () => ({
          in: () => ({
            limit: async () => ({
              data: null,
              error: { message: "private error details must not be logged" }
            })
          })
        })
      }
    }
  } as unknown as Parameters<typeof enrichWorkspaceTitles>[0]
  const originalWarn = console.warn
  const warnings: unknown[][] = []
  console.warn = (...values: unknown[]) => {
    warnings.push(values)
  }
  try {
    const fallback = await enrichWorkspaceTitles(failedClient, [entries[1]])
    assert.equal(fallback[0].tender.title, "Numeric reference")
    assert.equal(failureReads, 1)
    assert.deepEqual(warnings, [
      ["Workspace tender descriptions could not be loaded"]
    ])
  } finally {
    console.warn = originalWarn
  }
})
test("surface routing excludes nested controls and drag release remains suppressed after cards move", async () => {
  const { WorkspaceGesture, isWorkspaceControl, canStartWorkspaceDrag } =
    await import("./interaction")
  const surface = { closest: () => null } as unknown as EventTarget
  const menuChild = {
    closest: (selector: string) =>
      selector.includes("data-workspace-control") ? {} : null
  } as unknown as EventTarget
  const openButton = {
    closest: (selector: string) =>
      selector === "[data-workspace-open]" || selector.includes("button,")
        ? {}
        : null
  } as unknown as EventTarget
  assert.equal(isWorkspaceControl(surface), false)
  assert.equal(isWorkspaceControl(menuChild), true)
  assert.equal(isWorkspaceControl(openButton), true)
  assert.equal(canStartWorkspaceDrag(surface), true)
  assert.equal(canStartWorkspaceDrag(menuChild), false)
  assert.equal(canStartWorkspaceDrag(openButton), true)
  const gesture = new WorkspaceGesture()
  gesture.pointerStarted()
  assert.equal(gesture.canOpen(1), true)
  gesture.dragStarted("card-a")
  assert.equal(
    gesture.canOpen(1),
    false,
    "release on A stays blocked after dragging ends"
  )
  assert.equal(gesture.canOpen(1), false, "release targeting B is also blocked")
  assert.equal(
    gesture.canOpen(0),
    true,
    "semantic keyboard activation is independent"
  )
  gesture.pointerStarted()
  assert.equal(
    gesture.canOpen(1),
    true,
    "a new deliberate pointer click opens normally"
  )
})
