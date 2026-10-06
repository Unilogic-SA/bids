import assert from "node:assert/strict"
import { test } from "node:test"
import { boundedPageIndex, filterOperations, operationsCsv } from "./operations"
import type { AdminDashboardRow } from "./dashboard"

function row(status: string, reference = status): AdminDashboardRow {
  return {
    id: reference,
    name: "range sync",
    category: "Sync run",
    status,
    observedAt: "06 Oct 2026, 09:00 SAST",
    duration: "1m",
    volume: "2,000 tenders",
    documents: "3",
    detail: "OCDS HTTP 500\nPortal recovered",
    reference,
    metrics: { fetched: 2000, tenders: 2000, documents: 3 },
  }
}

test("attention filtering includes fallback recovery and stalled runs without treating them as healthy", () => {
  const rows = [
    row("completed"),
    row("Recovered · portal"),
    row("Stalled"),
    row("Failed"),
    row("Running"),
  ]
  assert.deepEqual(
    filterOperations(rows, "", "attention").map((r) => r.status),
    ["Recovered · portal", "Stalled", "Failed"]
  )
  assert.deepEqual(
    filterOperations(rows, "", "running").map((r) => r.status),
    ["Stalled", "Running"]
  )
  assert.equal(filterOperations(rows, "HTTP 500", "completed").length, 2)
  assert.equal(filterOperations(rows, "does not exist", "all").length, 0)
})

test("search is case-insensitive and finds run references and multiline failure details", () => {
  assert.equal(
    filterOperations([row("Failed", "ABC-123")], "  abc-123  ", "all").length,
    1
  )
  assert.equal(
    filterOperations([row("Failed")], "portal recovered", "all").length,
    1
  )
})

test("CSV preserves commas, quotes, Unicode and multiline details and neutralizes formulas", () => {
  const input = row("Failed", '=HYPERLINK("https://example.com")')
  input.name = 'Tender, "quoted"'
  input.detail = "  +SUM(1,2)\nsecond line"
  const csv = operationsCsv([input])
  assert.ok(csv.startsWith("\uFEFF"))
  assert.ok(csv.includes('"Tender, ""quoted"""'))
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'))
  assert.ok(csv.includes('"\'  +SUM(1,2)\nsecond line"'))
  assert.equal(operationsCsv([]).split("\r\n").length, 1)
})

test("pagination remains valid when refresh shrinks the result set or filters return zero", () => {
  assert.equal(boundedPageIndex(9, 2, 10), 0)
  assert.equal(boundedPageIndex(9, 0, 10), 0)
  assert.equal(boundedPageIndex(9, 100, 10), 9)
  assert.equal(boundedPageIndex(-1, 100, 10), 0)
})

test("repeated filtering and CSV export remain deterministic for large fixture histories", () => {
  const rows = Array.from({ length: 10000 }, (_, i) =>
    row(i % 10 === 0 ? "Failed" : "completed", `run-${i}`)
  )
  for (let i = 0; i < 20; i++)
    assert.equal(filterOperations(rows, "", "attention").length, 1000)
  assert.equal(operationsCsv(rows).split("\r\n").length, 10001)
  assert.equal(rows.length, 10000)
})
