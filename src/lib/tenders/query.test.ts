import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key"

type ListingRequest = { url: URL; body: Record<string, unknown> | null }

async function mockListing(
  t: TestContext,
  respond: (request: ListingRequest, index: number) => Response
) {
  const originalFetch = globalThis.fetch
  const requests: ListingRequest[] = []
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const captured = {
      url: new URL(request.url),
      body: request.method === "POST" ? await request.json() : null,
    }
    requests.push(captured)
    return respond(captured, requests.length)
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const { getTenderListing } = await import("./query")
  const { parseListingSearchParams } = await import("./navigation")
  return { requests, getTenderListing, parseListingSearchParams }
}

test("saved unfiltered pages recover to page one and include closing-today tenders", async t => {
  const { requests, getTenderListing, parseListingSearchParams } = await mockListing(t, (_, index) => {
    if (index === 1) return Response.json({ code: "PGRST103", message: "Requested range not satisfiable" }, { status: 416 })
    return Response.json([{ ocid: "one" }], { headers: { "content-range": "0-0/1" } })
  })
  const result = await getTenderListing(parseListingSearchParams({ page: "500", region: "Gauteng" }))
  assert.equal(result.resolvedPage, 1)
  assert.equal(result.totalCount, 1)
  assert.equal(result.items.length, 1)
  assert.equal(requests.length, 2)
  for (const { url } of requests) {
    assert.equal(url.pathname, "/rest/v1/tenders")
    assert.equal(url.searchParams.get("derived_status"), "in.(open,closing_today)")
    assert.equal(url.searchParams.get("province"), "eq.Gauteng")
    assert.equal(url.searchParams.has("or"), false)
    assert.match(url.searchParams.get("closing_at")!, /^gte\./)
  }
})

test("keyword RPC receives filters, explicit sorting and bounded pagination", async t => {
  const { requests, getTenderListing, parseListingSearchParams } = await mockListing(t, () =>
    Response.json({ items: [{ ocid: "one" }], totalCount: 25 })
  )
  const result = await getTenderListing(parseListingSearchParams({ q: "hardware", region: "Gauteng", buyer: "Acme", industry: "ict", type: "rfp", sort: "closing_at_desc", page: "2" }))
  assert.equal(result.resolvedPage, 2)
  assert.equal(result.pageCount, 3)
  assert.equal(result.totalCount, 25)
  assert.deepEqual(result.items, [{ ocid: "one" }])
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url.pathname, "/rest/v1/rpc/search_open_tenders")
  const body = requests[0].body!
  assert.equal(body.p_query, "hardware")
  assert.equal(body.p_province, "Gauteng")
  assert.equal(body.p_buyer, "Acme")
  assert.ok(Array.isArray(body.p_industries) && body.p_industries.includes("Information and communication"))
  assert.deepEqual(body.p_tender_types, ["Request for Proposal"])
  assert.equal(body.p_sort, "closing_at_desc")
  assert.equal(body.p_limit, 12)
  assert.equal(body.p_offset, 12)
})

test("out-of-range RPC pages recover to page one including empty results", async t => {
  const { requests, getTenderListing, parseListingSearchParams } = await mockListing(t, (_, index) =>
    Response.json({ items: index === 2 ? [{ ocid: "one" }] : [], totalCount: index <= 2 ? 1 : 0 })
  )
  const params = parseListingSearchParams({ q: "hardware", page: "500" })
  const result = await getTenderListing(params)
  assert.equal(result.resolvedPage, 1)
  assert.deepEqual(result.items, [{ ocid: "one" }])
  assert.deepEqual(requests.map(request => request.body?.p_offset), [5988, 0])
  const empty = await getTenderListing(params)
  assert.equal(empty.resolvedPage, 1)
  assert.equal(empty.totalCount, 0)
  assert.deepEqual(empty.items, [])
})

test("missing RPC uses the existing public search and preserves filters, sorts and page recovery", async t => {
  const { requests, getTenderListing, parseListingSearchParams } = await mockListing(t, ({ url }, index) => {
    if (url.pathname.includes("/rpc/")) return Response.json({ code: "PGRST202", message: "Could not find the function" }, { status: 404 })
    if (index === 2) return Response.json({ code: "PGRST103", message: "Requested range not satisfiable" }, { status: 416 })
    return Response.json([{ ocid: "one" }], { headers: { "content-range": "0-0/1" } })
  })
  const result = await getTenderListing(parseListingSearchParams({ q: "hardware*,()", region: "Gauteng", buyer: "Acme", industry: "ict", type: "rfp", sort: "closing_at_desc", page: "500" }))
  assert.equal(result.resolvedPage, 1)
  assert.equal(result.totalCount, 1)
  assert.equal(result.items.length, 1)
  assert.equal(requests.length, 3)
  for (const { url } of requests.slice(1)) {
    assert.equal(url.pathname, "/rest/v1/tenders")
    assert.equal(url.searchParams.get("derived_status"), "in.(open,closing_today)")
    assert.equal(url.searchParams.get("province"), "eq.Gauteng")
    assert.equal(url.searchParams.get("buyer_name"), "ilike.%Acme%")
    assert.match(url.searchParams.get("industry")!, /Information and communication/)
    assert.match(url.searchParams.get("tender_type")!, /Request for Proposal/)
    assert.equal(url.searchParams.get("order"), "closing_at.desc.nullslast,ocid.asc")
    assert.match(url.searchParams.get("closing_at")!, /^gte\./)
    const search = url.searchParams.get("or")!
    for (const column of ["tender_no", "title", "bid_description", "buyer_name", "department", "industry", "province", "tender_type"]) {
      assert.ok(search.includes(`${column}.ilike.%hardware%`))
    }
  }
})

test("missing RPC with implicit relevance falls back to closing order", async t => {
  const { requests, getTenderListing, parseListingSearchParams } = await mockListing(t, ({ url }) => {
    if (url.pathname.includes("/rpc/")) return Response.json({ code: "PGRST202", message: "Could not find the function" }, { status: 404 })
    return Response.json([], { headers: { "content-range": "*/0" } })
  })
  const result = await getTenderListing(parseListingSearchParams({ q: "hardware" }))
  assert.equal(result.resolvedPage, 1)
  assert.equal(requests[0].body?.p_sort, "relevance")
  assert.equal(requests[1].url.searchParams.get("order"), "closing_at.asc.nullslast,ocid.asc")
})

test("permission and operational RPC errors remain visible without fallback", async t => {
  let errorCode = "42501"
  const { requests, getTenderListing, parseListingSearchParams } = await mockListing(t, () =>
    Response.json({ code: errorCode, message: "Search unavailable" }, { status: 400 })
  )
  for (const code of ["42501", "22023", "57014", "42883"]) {
    errorCode = code
    await assert.rejects(getTenderListing(parseListingSearchParams({ q: "hardware" })), /Search unavailable/)
  }
  assert.equal(requests.length, 4)
  assert.ok(requests.every(request => request.url.pathname.includes("/rpc/")))
})
