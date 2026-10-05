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

test("provider URLs preserve the instant, encoded text and placeholder durations", async () => {
  const { buildTenderCalendarProviderUrl } = await import("./calendar")
  const now = new Date("2026-08-01T00:00:00Z")
  for (const provider of ["google", "outlook", "microsoft365"] as const) {
    for (const event of ["closing", "briefing"] as const) {
      const url = new URL(
        buildTenderCalendarProviderUrl(tender, event, provider, now)!
      )
      const params = url.searchParams
      const start =
        event === "closing"
          ? "2026-09-09T08:00:00.000Z"
          : "2026-09-01T07:30:00.000Z"
      const end =
        event === "closing"
          ? "2026-09-09T08:05:00.000Z"
          : "2026-09-01T08:00:00.000Z"
      if (provider === "google") {
        assert.equal(
          params.get("dates"),
          `${start.replace(/[-:]/g, "").replace(".000", "")}/${end.replace(/[-:]/g, "").replace(".000", "")}`
        )
        assert.equal(url.pathname, "/calendar/r/eventedit")
        assert.equal(params.get("stz"), "Africa/Johannesburg")
        assert.equal(params.get("etz"), "Africa/Johannesburg")
        assert.equal(url.search.includes("+"), false)
      } else {
        assert.equal(params.get("startdt"), start)
        assert.equal(params.get("enddt"), end)
        assert.equal(url.pathname, "/calendar/deeplink/compose")
      }
      const details = params.get(provider === "google" ? "details" : "body")!
      assert.ok(details.includes(tender.canonicalUrl))
      assert.ok(details.includes("Supply, install; and test\\commission"))
      assert.ok(
        details.includes(
          event === "closing" ? "not extended" : "end time was not supplied"
        )
      )
      assert.equal(
        params.get("location"),
        event === "briefing" ? tender.briefingVenue : ""
      )
      assert.equal(
        params.get(provider === "google" ? "text" : "subject"),
        `Tender ${event === "closing" ? "closes" : "briefing"} — ${tender.tenderNumber}`
      )
    }
  }
})

test("calendar handoffs exclude elapsed, boundary, missing and impossible events", async () => {
  const { getUpcomingTenderEvents, buildTenderCalendarProviderUrl } =
    await import("./calendar")
  const now = new Date("2026-09-09T08:00:00Z")
  assert.deepEqual(getUpcomingTenderEvents(tender, now), [])
  assert.equal(
    buildTenderCalendarProviderUrl(tender, "closing", "google", now),
    null
  )
  assert.deepEqual(
    getUpcomingTenderEvents(
      { ...tender, briefingAt: null, closingAt: "2026-02-31T12:00:00" },
      now
    ),
    []
  )
  assert.deepEqual(
    getUpcomingTenderEvents(tender, new Date("2026-09-02T00:00:00Z")),
    ["closing"]
  )
  const url = new URL(
    buildTenderCalendarProviderUrl(
      { ...tender, closingAt: "2026-09-09 10:00:00" },
      "closing",
      "outlook",
      new Date("2026-08-01")
    )!
  )
  assert.equal(url.searchParams.get("startdt"), "2026-09-09T08:00:00.000Z")
})
