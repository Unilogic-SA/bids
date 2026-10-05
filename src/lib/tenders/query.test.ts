import assert from "node:assert/strict"
import { test } from "node:test"

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key"

test("saved out-of-range pages recover to page one and include closing-today tenders", async () => {
  const originalFetch = globalThis.fetch
  const urls: URL[] = []
  globalThis.fetch = async input => {
    urls.push(new URL(String(input)))
    if (urls.length === 1) return Response.json({ code: "PGRST103", message: "Requested range not satisfiable" }, { status: 416 })
    return Response.json([{ ocid: "one" }], { headers: { "content-range": "0-0/1" } })
  }
  try {
    const { getTenderListing } = await import("./query")
    const { parseListingSearchParams } = await import("./navigation")
    const result = await getTenderListing(parseListingSearchParams({ page: "500", q: "hardware", region: "Gauteng" }))
    assert.equal(result.resolvedPage, 1)
    assert.equal(result.totalCount, 1)
    assert.equal(result.items.length, 1)
    assert.equal(urls.length, 2)
    for (const url of urls) {
      assert.equal(url.searchParams.get("derived_status"), "in.(open,closing_today)")
      assert.equal(url.searchParams.get("province"), "eq.Gauteng")
      assert.match(url.searchParams.get("or")!, /hardware/)
      assert.match(url.searchParams.get("closing_at")!, /^gte\./)
    }
  } finally { globalThis.fetch = originalFetch }
})
