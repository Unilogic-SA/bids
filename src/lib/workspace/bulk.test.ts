import { test } from "node:test"
import assert from "node:assert/strict"
import { updateBidStages } from "./bulk"
import type { BidPatch, WorkspaceEntry } from "./types"
const bid = (id: string, stage: WorkspaceEntry["stage"] = "saved", version = 1) => ({ id, stage, version }) as WorkspaceEntry

test("bulk status writes preserve versions and retain only failed bids for retry", async () => {
  const calls: unknown[] = []
  const result = await updateBidStages([bid("a", "saved", 4), bid("b"), bid("c", "ready")], "ready", null, () => true, async (id, version, patch) => {
    calls.push({ id, version, patch })
    return id === "b" ? { ok: false, code: "conflict", message: "Changed elsewhere" } : { ok: true, bid: null }
  })
  assert.deepEqual(calls, [{ id: "a", version: 4, patch: { stage: "ready" } }, { id: "b", version: 1, patch: { stage: "ready" } }])
  assert.deepEqual([...result!.succeeded], ["a", "c"])
  assert.equal(result!.failed, 1)
  assert.equal(result!.message, "Changed elsewhere")
})
test("bulk submission records the chosen date without overwriting existing submissions", async () => {
  const patches: BidPatch[] = []
  await updateBidStages([bid("a"), bid("b", "submitted")], "submitted", "2026-10-13T09:00:00Z", () => true, async (_id, _version, patch) => {
    patches.push(patch)
    return { ok: true, bid: null }
  })
  assert.deepEqual(patches, [{ stage: "submitted", submitted_at: "2026-10-13T09:00:00Z", submission_reference: null }])
})
test("bulk updates stop on account change and discard old-account results", async () => {
  let current = true
  let calls = 0
  const result = await updateBidStages([bid("a"), bid("b")], "ready", null, () => current, async () => {
    calls++
    current = false
    return { ok: true, bid: null }
  })
  assert.equal(result, null)
  assert.equal(calls, 1)
})
test("transport failure does not stop remaining selected updates", async () => {
  const result = await updateBidStages([bid("a"), bid("b")], "ready", null, () => true, async id => {
    if (id === "a") throw new Error("offline")
    return { ok: true, bid: null }
  })
  assert.deepEqual([...result!.succeeded], ["b"])
  assert.equal(result!.failed, 1)
})
