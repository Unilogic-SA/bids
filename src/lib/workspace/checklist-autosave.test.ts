import { test } from "node:test"
import assert from "node:assert/strict"
import { ChecklistAutosave } from "./checklist-autosave"
import { workspaceListQuery } from "./client-state"
import type { ChecklistItem, MutationResult, WorkspaceBid } from "./types"
const item = (label: string): ChecklistItem => ({ id: "one", label, completed: false })
const bid = (checklist: ChecklistItem[], version = 1) => ({ checklist, version }) as WorkspaceBid
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

test("autosave coalesces typing and flushes immediately before closing", async () => {
  const calls: ChecklistItem[][] = []
  const save = new ChecklistAutosave(bid([]), async items => {
    calls.push(items); return { ok: true, bid: bid(items, calls.length + 1) }
  }, 10)
  save.edit(() => [item("First")]); save.edit(() => [item("Latest")])
  assert.equal(calls.length, 0)
  assert.equal(await save.flush(), true)
  assert.equal(calls.length, 1); assert.equal(calls[0][0].label, "Latest")
  await wait(20); assert.equal(calls.length, 1)
  assert.equal(save.getSnapshot().status, "saved")
})

test("edits during a slow write queue without overwriting newer input or reusing versions", async () => {
  const calls: { items: ChecklistItem[]; version: number }[] = []
  let complete!: (result: MutationResult) => void
  const save = new ChecklistAutosave(bid([]), async (items, version) => {
    calls.push({ items, version })
    if (calls.length === 1) return new Promise(resolve => { complete = resolve })
    return { ok: true, bid: bid(items, version + 1) }
  })
  save.edit(() => [item("Before")]); const flight = save.flush()
  save.edit(() => [item("After")]); const close = save.flush()
  assert.equal(calls.length, 1)
  complete({ ok: true, bid: bid([item("Before")], 2) })
  assert.equal(await flight, true); assert.equal(await close, true)
  assert.deepEqual(calls.map(call => call.version), [1, 2])
  assert.equal(calls[1].items[0].label, "After")
  assert.equal(save.getSnapshot().items[0].label, "After")
  assert.equal(save.getSnapshot().dirty, false)
})

test("failed saves preserve the draft and retry without falsely closing", async () => {
  let fail = true
  const save = new ChecklistAutosave(bid([]), async items => {
    if (fail) throw new Error("offline")
    return { ok: true, bid: bid(items, 2) }
  })
  save.edit(() => [item("Retained")]); assert.equal(await save.flush(), false)
  assert.equal(save.getSnapshot().status, "failed")
  assert.equal(save.getSnapshot().items[0].label, "Retained")
  fail = false; assert.equal(await save.flush(), true)
})

test("conflicts require explicit review and retry against the latest version", async () => {
  const versions: number[] = []
  const save = new ChecklistAutosave(bid([]), async (items, version) => {
    versions.push(version)
    return versions.length === 1
      ? { ok: false, code: "conflict", message: "Changed", bid: bid([item("Other tab")], 5) }
      : { ok: true, bid: bid(items, 6) }
  })
  save.edit(() => [item("Mine")]); assert.equal(await save.flush(), false)
  assert.equal(save.getSnapshot().latest[0].label, "Other tab")
  assert.equal(await save.flush(), false); assert.equal(versions.length, 1)
  assert.equal(await save.flush(true), true); assert.deepEqual(versions, [1, 5])
})

test("unrelated stage revisions advance the version; changed server checklists are protected", async () => {
  const versions: number[] = []
  const save = new ChecklistAutosave(bid([item("Original")]), async (items, version) => {
    versions.push(version); return { ok: true, bid: bid(items, version + 1) }
  })
  save.edit(() => [item("Mine")]); save.observe(bid([item("Original")], 2))
  assert.equal(await save.flush(), true); assert.deepEqual(versions, [2])
  save.edit(() => [item("Still mine")]); save.observe(bid([item("Elsewhere")], 4))
  assert.equal(await save.flush(), false); assert.equal(save.getSnapshot().status, "conflict")
})

test("blank labels block saving safely; deleting the blank item recovers", async () => {
  let calls = 0
  const save = new ChecklistAutosave(bid([]), async items => {
    calls++; return { ok: true, bid: bid(items, 2) }
  })
  save.edit(() => [item("")]); assert.equal(await save.flush(), false)
  assert.equal(calls, 0); assert.equal(save.getSnapshot().status, "invalid")
  save.edit(() => []); assert.equal(await save.flush(), true)
})

test("unmount cleanup cancels a queued write", async () => {
  let calls = 0
  const save = new ChecklistAutosave(bid([]), async items => {
    calls++; return { ok: true, bid: bid(items, 2) }
  }, 10)
  save.edit(() => [item("Draft")]); save.dispose(); await wait(20)
  assert.equal(calls, 0)
})

test("mobile list queries override board links and offsets without dropping filters", () => {
  const q = new URLSearchParams(workspaceListQuery("view=board&bid=x&stage=ready&q=IT&week=1&offset_ready=40", true))
  assert.equal(q.get("view"), "list"); assert.equal(q.has("offset_ready"), false)
  assert.equal(q.has("bid"), false); assert.equal(q.get("stage"), "ready")
  assert.equal(q.get("q"), "IT"); assert.equal(q.get("week"), "1")
})

test("unmount during a request prevents queued writes after the editor or account leaves", async () => {
  let calls = 0
  let complete!: (result: MutationResult) => void
  const save = new ChecklistAutosave(bid([]), async () => {
    calls++
    return new Promise(resolve => { complete = resolve })
  })
  save.edit(() => [item("In flight")]); const flight = save.flush()
  save.edit(() => [item("Queued")]); save.dispose()
  complete({ ok: true, bid: bid([item("In flight")], 2) })
  assert.equal(await flight, false); assert.equal(calls, 1)
})
