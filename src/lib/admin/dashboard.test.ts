import assert from "node:assert/strict"
import { test } from "node:test"
import { createAdminDashboard } from "./dashboard"
import type { AdminMonitoringSnapshot } from "./monitoring"

function snapshot(): AdminMonitoringSnapshot {
  return {
    checkedAt: "2026-10-04T18:00:00Z", configMissing: false, queryErrors: [], latestRuns: [], latestRun: null,
    latestSuccessfulRun: { id: "run", mode: "range", status: "completed", date_from: "2026-09-01", date_to: "2026-09-02", page_size: 20000, fetched_count: 2121, open_count: 2000, upserted_tender_count: 2121, upserted_document_count: 3000, started_at: "2026-10-04T17:30:00Z", completed_at: "2026-10-04T17:31:00Z", message: null, raw_summary: { sourceMode: "portal_active_fallback", coverage: "active_portal_only", warnings: ["OCDS HTTP 404; active portal refreshed"] } },
    metrics: { totalTenderCount: 18000, expiredTenderCount: 16000, addedTenderCountLastDay: 900, closingTenderCountNextDay: 100, availableOpenTenderCount: 2000, availableOpenTenderWithDocumentCount: 1500, totalDocumentCount: 3000, runningSyncCount: 0, stuckRunningSyncCount: 0, completedSyncCountLastWindow: 1, failedSyncCountLastWindow: 0 },
  }
}
test("successful portal recovery remains visibly degraded and counts have distinct meanings", () => {
  const result = createAdminDashboard(snapshot())
  assert.equal(result.health.label, "Degraded")
  assert.equal(result.health.title, "Active portal recovery")
  assert.equal(result.cards.documentCoverage, 75)
  assert.notEqual(result.cards.totalTenders, result.cards.availableTenders)
  assert.match(result.health.description, /404/)
})
test("failed monitoring never presents unknown catalog counts as zero", () => {
  const input = snapshot(); input.queryErrors = ["database unavailable"]
  const result = createAdminDashboard(input)
  assert.equal(result.cards.availableTenders, "—")
  assert.equal(result.cards.totalTenders, "—")
  assert.equal(result.cards.freshness, "Unavailable")
})
test("interrupted running rows are labelled stalled without inventing completion", () => {
  const input = snapshot()
  input.latestRuns = [{ ...input.latestSuccessfulRun!, status: "running", completed_at: null }]
  const row = createAdminDashboard(input).rows[0]
  assert.equal(row.status, "Stalled")
})
test("missing or failed source reads never imply verified OCDS coverage", () => {
  const input = snapshot()
  input.latestSuccessfulRun = null
  let row = createAdminDashboard(input).rows.find((row) => row.id === "check-source-coverage")!
  assert.equal(row.status, "Unavailable")
  assert.match(row.detail, /could not be established/)
  input.latestSuccessfulRun = snapshot().latestSuccessfulRun
  input.queryErrors = ["read failed"]
  row = createAdminDashboard(input).rows.find((row) => row.id === "check-source-coverage")!
  assert.equal(row.status, "Unavailable")
})
