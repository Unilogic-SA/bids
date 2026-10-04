import assert from "node:assert/strict"
import { test } from "node:test"
import { portalCatalogRelease, portalDate, preserveOcdsPayload, resolveCatalogSources } from "../../../supabase/functions/_shared/portal-fallback"

const tender = {
  id: 172793, tender_No: "SK8/3/1-13/2026/2027", description: "Computer hardware",
  status: "Published", date_Published: "2026-10-04T00:00:00",
  closing_Date: "2026-11-04T11:00:00", province: "Limpopo",
}
const portal = async () => ({ tenders: new Map([[String(tender.id), tender]]), warning: null })

test("OCDS HTTP 404 uses the complete active portal, with explicit limited coverage", async () => {
  const result = await resolveCatalogSources({ fetchOcds: async () => { throw new Error("HTTP 404") }, fetchPortal: portal, allowPortalFallback: true })
  assert.equal(result.sourceMode, "portal_active_fallback")
  assert.equal(result.portal.tenders.size, 1)
  assert.match(result.warnings[0], /historical OCDS coverage is incomplete/)
})
test("both sources unavailable or empty cannot become a successful zero import", async () => {
  for (const response of [{ tenders: new Map(), warning: null }, { tenders: new Map(), warning: "HTTP 502" }]) {
    await assert.rejects(resolveCatalogSources({ fetchOcds: async () => { throw new Error("HTTP 404") }, fetchPortal: async () => response, allowPortalFallback: true }), /Both tender sources unavailable/)
  }
})
test("historical backfill cannot claim coverage from active portal data", async () => {
  await assert.rejects(resolveCatalogSources({ fetchOcds: async () => { throw new Error("HTTP 404") }, fetchPortal: portal, allowPortalFallback: false }), /cannot recover historical/)
})
test("healthy OCDS source and optional portal warning keep their real provenance", async () => {
  const releases = [{ ocid: "ocds-test" }]
  const result = await resolveCatalogSources({ fetchOcds: async () => releases, fetchPortal: async () => ({ tenders: new Map(), warning: "Portal failed" }), allowPortalFallback: true })
  assert.deepEqual(result.releases, releases)
  assert.equal(result.sourceMode, "ocds")
  assert.deepEqual(result.warnings, ["Portal failed"])
})
test("official portal IDs correlate to existing OCDS identities and deadlines use SAST", () => {
  const release = portalCatalogRelease(tender)
  assert.equal(release.ocid, "ocds-9t57fa-172793")
  assert.equal(release.tender.tenderPeriod.endDate, "2026-11-04T09:00:00.000Z")
  assert.equal(release.tender.status, "active")
  assert.equal(portalDate("2026-11-04T11:00:00Z"), "2026-11-04T11:00:00.000Z")
  assert.throws(() => portalCatalogRelease({ ...tender, ocid: "foreign-172793" }), /Unexpected/)
  assert.throws(() => portalCatalogRelease({ ...tender, closing_Date: undefined }), /Incomplete/)
})
test("portal recovery never overwrites original OCDS history or clears absent enrichment", () => {
  const prior = { release_id: "original", raw_release: { awards: [{ id: "award-1" }] }, raw_tender: { extra: "retained" }, procurement_method: "open" }
  const row = preserveOcdsPayload({ release_id: "portal", raw_release: {}, raw_tender: {}, closing_at: "new-deadline", procurement_method: null }, prior)
  assert.equal(row.raw_release, prior.raw_release)
  assert.equal(row.raw_tender, prior.raw_tender)
  assert.equal(row.release_id, "original")
  assert.equal(row.closing_at, "new-deadline")
  assert.equal(row.procurement_method, "open")
  assert.deepEqual(preserveOcdsPayload({ release_id: "portal" }).raw_release, {})
})
