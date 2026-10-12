import assert from "node:assert/strict"
import test from "node:test"
import { campaignAttribution, googleMeasurementId, isMeasurementPage, measurementReferrer, measurementUrl, safeGoogleEventData } from "./google-analytics"

test("campaign measurement excludes private and authentication routes", () => {
  for (const path of ["/", "/tenders/ocds-123"]) assert.equal(isMeasurementPage(path), true)
  for (const path of ["/admin", "/sign-in", "/auth/callback", "/account/settings", "/workspace", "/api/account/session", "/tenders/ocds-123/calendar"]) assert.equal(isMeasurementPage(path), false)
  assert.equal(googleMeasurementId("G-ABC123"), "G-ABC123")
  for (const value of [undefined, "", "G-ABC<script>", "AW-123"]) assert.equal(googleMeasurementId(value), null)
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
