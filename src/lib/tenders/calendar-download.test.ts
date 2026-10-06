import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key"

const tender = {
  ocid: "ocds-test-one",
  tender_no: "SCM/1",
  bid_description: "Supply equipment",
  buyer_name: "Test buyer",
  closing_at: "2699-10-06T10:00:00+02:00",
  briefing_datetime: "2699-10-01T09:00:00+02:00",
}

async function handler(
  t: TestContext,
  result: typeof tender | null,
  fail = false
) {
  const originalFetch = globalThis.fetch
  const requests: URL[] = []
  globalThis.fetch = async (input, init) => {
    const url = new URL(new Request(input, init).url)
    requests.push(url)
    if (fail)
      return Response.json(
        { message: "private database error", code: "42501" },
        { status: 403 }
      )
    return Response.json(
      url.pathname.endsWith("/tenders") && result ? [result] : []
    )
  }
  t.after(() => {
    globalThis.fetch = originalFetch
  })
  const { GET } = await import("../../app/tenders/[ocid]/calendar/route")
  return {
    requests,
    get: (event: string) =>
      GET(
        new Request(
          `https://example.test/tenders/ocds-test-one/calendar?event=${event}`
        ),
        { params: Promise.resolve({ ocid: tender.ocid }) }
      ),
  }
}

test("calendar download validates the event before reading public data", async (t) => {
  const { get, requests } = await handler(t, tender)
  assert.equal((await get("combined")).status, 400)
  assert.equal((await get("")).status, 400)
  assert.equal(requests.length, 0)
})

test("calendar HTTP file uses the source instant, safe filename and no-store headers", async (t) => {
  const { get, requests } = await handler(t, tender)
  const response = await get("closing")
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type")!, /^text\/calendar/)
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="openbids-scm-1-closing.ics"'
  )
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.match(await response.text(), /DTSTART:26991006T080000Z/)
  assert.ok(
    requests.every(
      (url) =>
        url.hostname === "example.supabase.co" &&
        url.searchParams.get(
          url.pathname.endsWith("/tenders") ? "ocid" : "tender_ocid"
        ) === "eq.ocds-test-one"
    )
  )
})

test("calendar download rejects missing or elapsed events and hides upstream errors", async (t) => {
  const missing = await handler(t, null)
  assert.equal((await missing.get("closing")).status, 404)
  const expired = await handler(t, {
    ...tender,
    closing_at: "2000-01-01T00:00:00Z",
  })
  assert.equal((await expired.get("closing")).status, 410)
  const failed = await handler(t, tender, true)
  const response = await failed.get("closing")
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /private database error|42501/)
})
