import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildListingHref,
  buildTenderDetailHref,
  parseListingReturnHref,
  parseListingSearchParams,
} from "./navigation"

test("keyword searches default to relevance without changing the normal default", () => {
  assert.equal(parseListingSearchParams({}).sort, "closing_at_asc")
  assert.equal(parseListingSearchParams({ q: "laptop" }).sort, "relevance")
  assert.equal(
    parseListingSearchParams({ q: "laptop", sort: "closing_at_asc" }).sort,
    "closing_at_asc"
  )
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
