import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getSiteUrl,
  getTenderTitle,
  getTenderLastModified,
  isTenderIndexable,
  pageMetadata,
  stringifyJsonLd,
} from "./seo"
test("production canonicals do not follow ephemeral deployment URLs", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.VERCEL_URL = "preview.vercel.app"
    assert.equal(getSiteUrl(), "https://www.openbid.co.za")
    process.env.NEXT_PUBLIC_SITE_URL = "https://wrong.vercel.app"
    assert.throws(getSiteUrl, /production origin/)
  } finally {
    if (original) process.env.NEXT_PUBLIC_SITE_URL = original
    else delete process.env.NEXT_PUBLIC_SITE_URL
  }
})
test("tender metadata leads with the subject and excludes ingestion time from freshness", () => {
  const tender = {
    bid_description: "Supply and support of computer equipment",
    title: null,
    title_snippet: null,
    tender_no: "RFQ-12",
    buyer_name: "Buyer",
    department: null,
  }
  assert.match(getTenderTitle(tender), /^Supply.*RFQ-12$/)
  assert.equal(isTenderIndexable(tender), true)
  assert.equal(isTenderIndexable({ ...tender, bid_description: "RFQ-12" }), false)
  assert.equal(
    getTenderLastModified({ modified_at: "2026-01-01", published_at: "2025-12-01" }, [
      { date_modified: "2026-01-03", date_published: null },
    ])?.toISOString(),
    "2026-01-03T00:00:00.000Z"
  )
  assert.equal(getTenderLastModified({ modified_at: "bad", published_at: null }), undefined)
  assert.equal(stringifyJsonLd({ text: "</script>" }).includes("</script>"), false)
  assert.equal(
    pageMetadata("Gauteng tenders", "Description", "/tenders/province/gauteng?page=2").alternates
      .canonical,
    "/tenders/province/gauteng?page=2"
  )
})
