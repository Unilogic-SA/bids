import assert from "node:assert/strict"
import test from "node:test"

import {
  differenceInSastCalendarDays,
  getSastDateKey,
  isSameSastDay,
} from "./sast-date"

test("uses the South African date at the UTC midnight boundary", () => {
  assert.equal(getSastDateKey("2026-09-08T22:00:00.000Z"), "2026-09-09")
  assert.equal(getSastDateKey("2026-09-08T21:59:59.999Z"), "2026-09-08")
})

test("compares today and tomorrow in SAST rather than the host timezone", () => {
  const now = "2026-09-08T21:30:00.000Z"

  assert.equal(isSameSastDay(now, "2026-09-08T22:15:00.000Z"), false)
  assert.equal(
    differenceInSastCalendarDays("2026-09-08T22:15:00.000Z", now),
    1
  )
})

test("handles the SAST year boundary", () => {
  assert.equal(
    differenceInSastCalendarDays(
      "2026-12-31T22:00:00.000Z",
      "2026-12-31T21:59:59.999Z"
    ),
    1
  )
})
