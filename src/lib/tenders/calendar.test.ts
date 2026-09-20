import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTenderCalendar,
  getTenderCalendarFilename,
  isValidTenderTimestamp,
} from "./calendar"

const tender = {
  ocid: "ocds-abc123-001",
  tenderNumber: "SCM/12, 2026",
  description: "Supply, install; and test\\commission\nacross sites",
  buyer: "Example Department",
  canonicalUrl: "https://openbids.co.za/tenders/ocds-abc123-001",
  closingAt: "2026-09-09T10:00:00+02:00",
  briefingAt: "2026-09-01T09:30:00+0200",
  briefingVenue: "Room 1, Civic Centre; Main Street",
  briefingCompulsory: true,
}

test("creates a UTC closing event without inventing an end time", () => {
  const calendar = buildTenderCalendar(
    tender,
    "closing",
    new Date("2026-08-01T00:00:00Z")
  )

  assert.ok(calendar)
  assert.match(calendar, /DTSTART:20260909T080000Z\r\n/)
  assert.match(calendar, /SUMMARY:Tender closes — SCM\/12\\, 2026\r\n/)
  assert.doesNotMatch(calendar, /DTEND/)
  assert.equal(calendar.replaceAll("\r\n", "").includes("\n"), false)
})

test("treats timezone-free source timestamps as South African time", () => {
  const calendar = buildTenderCalendar(
    { ...tender, closingAt: "2026-09-09 10:00:00" },
    "closing",
    new Date("2026-08-01T00:00:00Z")
  )

  assert.match(calendar || "", /DTSTART:20260909T080000Z/)
})

test("escapes ICS text and exports both valid events with stable UIDs", () => {
  const firstCalendar = buildTenderCalendar(
    tender,
    "combined",
    new Date("2026-08-01T00:00:00Z")
  )
  const secondCalendar = buildTenderCalendar(
    tender,
    "combined",
    new Date("2026-08-02T00:00:00Z")
  )

  assert.ok(firstCalendar)
  assert.ok(secondCalendar)
  assert.equal(firstCalendar.match(/BEGIN:VEVENT/g)?.length, 2)
  const unfoldedCalendar = firstCalendar.replaceAll("\r\n ", "")
  assert.match(
    unfoldedCalendar,
    /DESCRIPTION:Supply\\, install\\; and test\\\\commission across sites\\nIssued by/
  )
  assert.match(
    unfoldedCalendar,
    /LOCATION:Room 1\\, Civic Centre\\; Main Street/
  )

  const firstUids = firstCalendar.match(/^UID:.*$/gm)
  const secondUids = secondCalendar.match(/^UID:.*$/gm)
  assert.deepEqual(firstUids, secondUids)
  assert.equal(new Set(firstUids).size, 2)
})

test("rejects missing and invalid exact timestamps", () => {
  assert.equal(isValidTenderTimestamp(null), false)
  assert.equal(isValidTenderTimestamp("2026-09-09"), false)
  assert.equal(isValidTenderTimestamp("2026-02-31T10:00:00+02:00"), false)
  assert.equal(
    buildTenderCalendar(
      { ...tender, closingAt: "invalid", briefingAt: null },
      "combined"
    ),
    null
  )
})

test("creates a safe calendar filename", () => {
  assert.equal(
    getTenderCalendarFilename("SCM/12: 2026?", "combined"),
    "openbids-scm-12-2026-dates.ics"
  )
})
