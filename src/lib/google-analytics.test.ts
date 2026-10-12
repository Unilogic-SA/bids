import assert from "node:assert/strict"
import test from "node:test"
import { campaignAttribution, googleMeasurementId, isMeasurementHost, isMeasurementPage, measurementReferrer, measurementUrl, nextMeasurementContext, safeGoogleEventData, setAnalyticsChoice, trackGoogleEvent } from "./google-analytics"

test("campaign measurement excludes private and authentication routes", () => {
  for (const path of ["/", "/tenders/ocds-123"]) assert.equal(isMeasurementPage(path), true)
  for (const path of ["/admin", "/sign-in", "/auth/callback", "/account/settings", "/workspace", "/api/account/session", "/tenders/ocds-123/calendar"]) assert.equal(isMeasurementPage(path), false)
  assert.equal(googleMeasurementId("G-ABC123"), "G-ABC123")
  for (const value of [undefined, "", "G-ABC<script>", "AW-123"]) assert.equal(googleMeasurementId(value), null)
  assert.equal(isMeasurementHost("www.openbid.co.za"), true)
  for (const host of ["localhost", "bids-preview.vercel.app", "openbid.co.za.evil.test"]) assert.equal(isMeasurementHost(host), false)
})

test("tender measurement never exports a user controlled URL segment", () => {
  for (const path of ["/tenders/private%40example.com", "/tenders/secret-token", "/tenders/ocds-123"]) {
    assert.equal(measurementUrl(new URL(path, "https://www.openbid.co.za")), "https://www.openbid.co.za/tenders/detail")
  }
})

test("SPA referrers advance using sanitized virtual URLs", () => {
  const home = nextMeasurementContext(new URL("https://www.openbid.co.za/?utm_source=google&q=private"), undefined, "https://google.com/search?q=private")
  assert.equal(home.referrer, "https://google.com")
  const tender = nextMeasurementContext(new URL("https://www.openbid.co.za/tenders/ocds-123?from=private"), home, "https://google.com/search?q=private")
  assert.equal(tender.referrer, "https://www.openbid.co.za/?utm_source=google")
  assert.deepEqual(nextMeasurementContext(new URL("https://www.openbid.co.za/tenders/ocds-123"), tender, "https://google.com"), tender)
  assert.equal(nextMeasurementContext(new URL("https://www.openbid.co.za/tenders/ocds-456"), tender, "https://google.com").referrer, "https://www.openbid.co.za/tenders/detail")
})

test("measurement URLs retain campaign attribution without leaking search or auth data", () => {
  const url = new URL("https://www.openbid.co.za/?q=private@example.com&buyer=Someone&code=secret&next=%2Faccount&utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_term=private@example.com&gclid=abc_123#token")
  assert.equal(measurementUrl(url), "https://www.openbid.co.za/?utm_source=google&utm_medium=cpc&utm_campaign=launch&gclid=abc_123")
  assert.deepEqual(campaignAttribution(new URL("https://www.openbid.co.za/?utm_campaign=private@example.com")), {})
  assert.equal(measurementReferrer("https://www.openbid.co.za/auth/callback?code=secret"), "https://www.openbid.co.za")
  assert.equal(measurementReferrer(""), "")
})

test("Google events use an allowlist and reject private text and URLs", () => {
  assert.deepEqual(safeGoogleEventData({
    email: "private@example.com", query: "private search", url: "https://private.test",
    ocid: "ocds-123", documents_count: 3, buyer_present: true, extension: "pdf",
    source: "https://private.test?token=secret", context: "private@example.com",
    industry: "untrusted free text", missing: undefined,
  }), { ocid: "ocds-123", documents_count: 3, buyer_present: true, extension: "pdf" })
})

test("Google engagement is sent only after opt-in and stops after declining or entering private routes", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
  const previousId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
  const stored = new Map<string, string>()
  const storage = { getItem: (key: string) => stored.get(key) || null, setItem: (key: string, value: string) => stored.set(key, value) }
  const calls: unknown[][] = []
  const browser = { location: { pathname: "/", hostname: "www.openbid.co.za", href: "https://www.openbid.co.za/", origin: "https://www.openbid.co.za" }, localStorage: storage, sessionStorage: storage, dispatchEvent: () => true, gtag: (...args: unknown[]) => calls.push(args) }
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser })
  Object.defineProperty(globalThis, "document", { configurable: true, value: { referrer: "https://google.com/search?q=private" } })
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123"
  try {
    trackGoogleEvent("tender_result_open")
    assert.equal(calls.length, 0)
    setAnalyticsChoice("allowed")
    trackGoogleEvent("tender_result_open", { email: "private@example.com", documents_count: 3 })
    assert.equal(calls.length, 1)
    assert.equal((calls[0][2] as Record<string, unknown>).email, undefined)
    setAnalyticsChoice("declined")
    trackGoogleEvent("tender_result_open")
    assert.equal(calls.length, 1)
    setAnalyticsChoice("allowed")
    browser.location.hostname = "bids-preview.vercel.app"
    trackGoogleEvent("tender_result_open")
    assert.equal(calls.length, 1)
    browser.location.hostname = "www.openbid.co.za"
    browser.location.pathname = "/account/settings"
    trackGoogleEvent("tender_result_open")
    assert.equal(calls.length, 1)
  } finally {
    setAnalyticsChoice("declined")
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow)
    else Reflect.deleteProperty(globalThis, "window")
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument)
    else Reflect.deleteProperty(globalThis, "document")
    if (previousId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
    else process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = previousId
  }
})
