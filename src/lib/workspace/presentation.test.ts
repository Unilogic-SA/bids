import { test } from "node:test"
import assert from "node:assert/strict"
import {
  attentionSignals,
  closingUrgency,
  compactWorkspaceDate,
  workspaceDate,
  workspaceMutationMessage
} from "./presentation"
import {
  clearWorkspaceFilters,
  preferredBoardStage,
  workspacePagination
} from "./client-state"
import type { WorkspaceEntry } from "./types"
const now = Date.parse("2026-10-14T21:30:00Z") // 23:30 SAST
function bid(closing: string | null): WorkspaceEntry {
  return {
    stage: "preparing",
    outcome: null,
    archived_at: null,
    source_available: true,
    acknowledged_closing_at: closing,
    checklist: [],
    tender: {
      closing_at: closing,
      compulsory_briefing: false,
      briefing_datetime: null
    }
  } as unknown as WorkspaceEntry
}
test("deadline urgency follows SAST calendar boundaries, validity and submission state", () => {
  assert.equal(closingUrgency(bid("2026-10-14T21:45:00Z"), now), "Today")
  assert.equal(closingUrgency(bid("2026-10-14T22:15:00Z"), now), "Tomorrow")
  assert.equal(closingUrgency(bid("2026-10-15T22:00:00Z"), now), "2 days left")
  assert.equal(
    closingUrgency(bid("2026-10-14T20:00:00Z"), now),
    "Deadline passed"
  )
  for (const value of [null, "invalid"]) {
    assert.equal(closingUrgency(bid(value), now), null)
    assert.equal(compactWorkspaceDate(value), "Not supplied")
    assert.equal(workspaceDate(value), "Not supplied")
    assert.deepEqual(attentionSignals(bid(value), now), [])
  }
  assert.equal(
    closingUrgency({ ...bid("2026-10-14T20:00:00Z"), stage: "submitted" }, now),
    null
  )
  assert.equal(
    closingUrgency(
      { ...bid("2026-10-14T20:00:00Z"), archived_at: "2026-10-14" },
      now
    ),
    null
  )
  assert.equal(
    closingUrgency({ ...bid("2026-10-14T20:00:00Z"), outcome: "won" }, now),
    null
  )
})
test("urgent closing remains first when source and briefing alerts coexist", () => {
  const entry = bid("2026-10-14T21:45:00Z")
  entry.source_available = false
  entry.tender.compulsory_briefing = true
  entry.tender.briefing_datetime = "2026-10-14T20:00:00Z"
  assert.deepEqual(
    attentionSignals(entry, now).map((signal) => signal.kind),
    ["close", "briefing", "source"]
  )
  entry.stage = "submitted"
  assert.equal(
    attentionSignals(entry, now).some((signal) => signal.kind === "close"),
    false
  )
})
test("missing and changed closing timestamps generate meaningful change alerts", () => {
  const entry = bid(null)
  entry.acknowledged_closing_at = "invalid"
  assert.deepEqual(attentionSignals(entry, now), [])
  entry.tender.closing_at = "2026-10-20T10:00:00Z"
  assert.deepEqual(
    attentionSignals(entry, now).map((signal) => signal.kind),
    ["deadline"]
  )
})
test("specific feedback confirms checklist, stage, archive and deadline actions", () => {
  assert.equal(workspaceMutationMessage({ checklist: [] }), "Checklist saved")
  assert.equal(
    workspaceMutationMessage({ stage: "preparing" }),
    "Moved to preparing"
  )
  assert.equal(
    workspaceMutationMessage({ archive: false }),
    "Restored to workspace"
  )
  assert.equal(
    workspaceMutationMessage({ acknowledge_deadline: true }),
    "Deadline change acknowledged"
  )
})
test("range counts reflect zero results and a partial final page", () => {
  assert.deepEqual(workspacePagination(0, 1, 0), { start: 0, end: 0, pages: 1 })
  assert.deepEqual(workspacePagination(126, 3, 26), {
    start: 101,
    end: 126,
    pages: 3
  })
  assert.deepEqual(workspacePagination(126, 4, 0), {
    start: 0,
    end: 0,
    pages: 3
  })
})
test("filter clearing preserves view, record state and open bid; stored stages are validated", () => {
  const query = new URLSearchParams(
    clearWorkspaceFilters(
      "q=wifi&stage=ready&week=1&page=2&offset_ready=30&state=archived&view=board&bid=abc"
    )
  )
  assert.deepEqual(
    [...query],
    [
      ["state", "archived"],
      ["view", "board"],
      ["bid", "abc"]
    ]
  )
  assert.equal(preferredBoardStage("preparing"), "preparing")
  assert.equal(preferredBoardStage("unknown"), "saved")
  assert.equal(preferredBoardStage(null), "saved")
})
