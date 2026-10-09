import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildListingHref,
  buildTenderDetailHref,
  parseListingReturnHref,
  parseListingSearchParams,
  parseHeaderSearchParams,
} from "./navigation"

test("keyword searches default to relevance without changing the normal default", () => {
  assert.equal(parseListingSearchParams({}).sort, "closing_at_asc")
  assert.equal(parseListingSearchParams({ q: "laptop" }).sort, "relevance")
  assert.equal(
    parseListingSearchParams({ q: "laptop", sort: "closing_at_asc" }).sort,
    "closing_at_asc"
  )
})

test("header search preserves listing filters and explicit sort while resetting pagination", () => {
  const filters = parseHeaderSearchParams("/", {
    q: "laptops", region: "Gauteng", buyer: "Education", industry: "ict", type: "rfp",
    sort: "closing_at_desc", page: "4",
  })
  assert.equal(buildListingHref(filters), "/?q=laptops&region=Gauteng&buyer=Education&industry=ict&type=rfp&sort=closing_at_desc")
  assert.equal(filters.page, 1)
  assert.equal(filters.sortExplicit, true)
  const implicit = parseHeaderSearchParams("/", { q: "laptops", page: "3" })
  assert.equal(implicit.sortExplicit, false)
  assert.equal(buildListingHref(implicit, { q: undefined }), "/")
})

test("header search on a tender detail page restores the safe listing context", () => {
  const filters = parseHeaderSearchParams("/tenders/example", {
    from: "/?q=software&region=Gauteng&buyer=Education&industry=ict&type=rfp&sort=published_at_desc&page=2#tender-result-3",
  })
  assert.equal(buildListingHref(filters), "/?q=software&region=Gauteng&buyer=Education&industry=ict&type=rfp&sort=published_at_desc")
  assert.equal(filters.page, 1)
})

test("header search rejects unsafe return links and ignores unrelated page parameters", () => {
  for (const from of ["https://example.test/?q=secret", "//example.test/?q=secret", "/account?q=secret"]) {
    assert.equal(buildListingHref(parseHeaderSearchParams("/tenders/example", { from })), "/")
  }
  assert.equal(buildListingHref(parseHeaderSearchParams("/account", { q: "secret", region: "Gauteng" })), "/")
  assert.equal(buildListingHref(parseHeaderSearchParams("/tenders/example", { from: "/?q=lap%2Atops%25&sort=invalid&page=99" })), "/?q=lap+tops")
})

test("implicit sorts adapt to keywords while explicit default-valued sorts persist", () => {
  const implicit = parseListingSearchParams({ sort: "" })
  assert.equal(implicit.sortExplicit, false)
  const keywordHref = buildListingHref(implicit, { q: "laptop" })
  assert.equal(keywordHref, "/?q=laptop")
  assert.equal(parseListingSearchParams({ q: "laptop", sort: "" }).sort, "relevance")

  for (const [q, sort] of [[undefined, "closing_at_asc"], ["laptop", "relevance"]]) {
    const explicit = parseListingSearchParams({ q, sort })
    assert.equal(explicit.sortExplicit, true)
    const href = buildListingHref(explicit)
    assert.equal(new URL(href, "https://example.test").searchParams.get("sort"), sort)
    const changedQuery = new URL(buildListingHref(explicit, { q: "chairs" }), "https://example.test")
    assert.equal(parseListingSearchParams(Object.fromEntries(changedQuery.searchParams)).sort, sort)
  }
})

test("selecting and resetting sort changes sort intent and preserves the other filters", () => {
  const params = parseListingSearchParams({ q: "laptop", region: "Gauteng", page: "2" })
  const selected = buildListingHref(params, { sort: "closing_at_asc", page: 1 })
  assert.equal(selected, "/?q=laptop&region=Gauteng&sort=closing_at_asc")
  const reset = buildListingHref(parseListingSearchParams({ q: "laptop", region: "Gauteng", sort: "closing_at_asc", page: "2" }), { sortExplicit: false, page: 1 })
  assert.equal(reset, "/?q=laptop&region=Gauteng")
  assert.equal(buildListingHref(parseListingSearchParams({ q: "laptop" }), { q: undefined }), "/")
})

test("explicit sorts survive pagination and tender return links", () => {
  const params = parseListingSearchParams({ sort: "closing_at_asc" })
  assert.equal(buildListingHref(params, { page: 2 }), "/?sort=closing_at_asc&page=2")
  const detail = new URL(buildTenderDetailHref("/tenders/example", params, 3), "https://example.test")
  assert.equal(parseListingReturnHref(detail.searchParams.get("from") ?? undefined), "/?sort=closing_at_asc#tender-result-3")
})

test("search sort, pagination and return state round trip", () => {
  const filters = parseListingSearchParams({
    q: "software development",
    region: "Gauteng",
    industry: "ict",
    type: "rfp",
    buyer: "Acme",
    page: "2",
  })

  assert.equal(
    buildListingHref(filters),
    "/?q=software+development&region=Gauteng&buyer=Acme&industry=ict&type=rfp&page=2"
  )

  const detailHref = buildTenderDetailHref("/tenders/example", filters, 3)
  const returnValue = new URL(detailHref, "https://example.test").searchParams.get("from")
  assert.equal(parseListingReturnHref(returnValue ?? undefined), `${buildListingHref(filters)}#tender-result-3`)
})
