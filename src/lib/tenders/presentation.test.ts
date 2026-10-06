import assert from "node:assert/strict"
import test from "node:test"
import { formatClosingUrgency, normalizeTenderTitle } from "./presentation"

test("normalizes uppercase display titles while retaining acronyms and mixed case", () => {
  assert.equal(
    normalizeTenderTitle("SUPPLY OF ICT AND CCTV FOR SITA"),
    "Supply of ICT and CCTV for SITA"
  )
  assert.equal(
    normalizeTenderTitle("Supply iPhone devices"),
    "Supply iPhone devices"
  )
  assert.equal(normalizeTenderTitle(""), null)
})

test("urgency emphasizes only near deadlines and uses SAST calendar days", () => {
  const now = Date.parse("2026-10-05T21:30:00Z")
  assert.equal(
    formatClosingUrgency("2026-10-06T23:45:00+02:00", now).label,
    "Closes tomorrow"
  )
  assert.equal(
    formatClosingUrgency("2026-10-10T10:00:00+02:00", now).className,
    "text-primary"
  )
  assert.equal(
    formatClosingUrgency("2026-12-10T10:00:00+02:00", now).className,
    "text-muted-foreground"
  )
  assert.equal(
    formatClosingUrgency("2026-10-05T10:00:00+02:00", now).label,
    "Closed"
  )
  assert.equal(formatClosingUrgency("invalid", now).label, "Closing date TBC")
})
