import assert from "node:assert/strict"
import { test } from "node:test"
import { fetchReleasePages, fetchPortalPages, latestReleases, sourceSnapshot, mergeDocuments, fetchJsonWithRetry } from "../../../supabase/functions/_shared/ingestion"

const baseUrl = "https://ocds-api.etenders.gov.za/api/OCDSReleases"
const next = (page: number) => `${baseUrl}?PageNumber=${page}&PageSize=2&dateFrom=2026-09-20&dateTo=2026-09-25`
const release = { ocid: "ocds-test-1", date: "2026-09-25" }
function pages(responses: unknown[], overrides = {}) {
  const requested: string[] = []
  const archived: unknown[] = []
  return { requested, archived, run: () => fetchReleasePages({
    baseUrl, dateFrom: "2026-09-20", dateTo: "2026-09-25", pageSize: 2, maxPages: 3,
    fetchJson: async url => { requested.push(url.href); return responses.shift() },
    onPage: async (items, metadata) => { archived.push({ items, metadata }) },
    ...overrides,
  }) }
}

test("short pages follow the API cursor and preserve package provenance", async () => {
  const p = pages([{ releases: [release], publisher: { name: "Treasury" }, links: { next: next(3) } }, { releases: [], links: {} }])
  assert.deepEqual(await p.run(), [release])
  assert.equal(p.requested[1], next(3))
  assert.equal(p.archived.length, 2)
  assert.deepEqual(p.archived[0], { items: [release], metadata: { publisher: { name: "Treasury" }, links: { next: next(3) } } })
})

test("page caps archive fetched releases but never report complete coverage", async () => {
  const p = pages([{ releases: [release], links: { next: next(2) } }], { maxPages: 1 })
  await assert.rejects(p.run, /page limit/)
  assert.equal(p.archived.length, 1)
})

test("archive failure prevents continuing the fetch or reporting success", async () => {
  const p = pages([{ releases: [release], links: { next: next(2) } }], {
    onPage: async () => { throw new Error("database unavailable") },
  })
  await assert.rejects(p.run, /database unavailable/)
  assert.equal(p.requested.length, 1)
})

test("malformed payloads and missing identifiers fail instead of becoming empty successes", async () => {
  for (const payload of [null, {}, { releases: null }, { releases: [{}] }, { releases: [null] }]) {
    await assert.rejects(pages([payload]).run, /Invalid OCDS/)
  }
  assert.deepEqual(await pages([{ releases: [], links: {} }]).run(), [])
})

test("empty intermediate pages still follow continuation links", async () => {
  assert.deepEqual(await pages([{ releases: [], links: { next: next(2) } }, { releases: [release], links: {} }]).run(), [release])
})

test("repeated URLs and changed origins or windows fail", async () => {
  await assert.rejects(pages([{ releases: [release], links: { next: next(1) } }]).run, /repeated/)
  for (const target of [next(2).replace("ocds-api.etenders.gov.za", "example.com"), next(2).replace("dateTo=2026-09-25", "dateTo=2025-01-01")]) {
    await assert.rejects(pages([{ releases: [release], links: { next: target } }]).run, /changed source/)
  }
})

test("all versions can be archived while the catalog selects the newest release", () => {
  const old = { ...release, date: "2020-01-01" }
  assert.deepEqual(latestReleases([release, old, release]), [release])
})

test("snapshots retain unmodeled fields and deduplicate by content, not release ID or fetch time", async () => {
  const options = { ocid: release.ocid, source: "ocds" as const, sourceUrl: baseUrl, syncRunId: "run", capturedAt: "today" }
  const payload = { ...release, awards: [{ value: { amount: 50 } }], futureField: "retained" }
  const first = await sourceSnapshot({ ...options, payload })
  const reordered = await sourceSnapshot({ ...options, capturedAt: "tomorrow", payload: { futureField: "retained", awards: payload.awards, date: release.date, ocid: release.ocid } })
  const changed = await sourceSnapshot({ ...options, payload: { ...payload, futureField: "changed" } })
  assert.equal(first.content_hash, reordered.content_hash)
  assert.notEqual(first.content_hash, changed.content_hash)
  assert.deepEqual(first.payload, payload)
})

test("portal pagination follows totals even when the server caps page size", async () => {
  const starts: string[] = []
  const result = await fetchPortalPages({ baseUrl: "https://www.etenders.gov.za", pageSize: 100, maxPages: 3,
    fetchJson: async url => { starts.push(url.searchParams.get("start")!); return { recordsFiltered: 3, data: [{ id: starts.length }] } },
  })
  assert.deepEqual(starts, ["0", "1", "2"])
  assert.equal(result.size, 3)
})

test("portal missing data, repeated rows and page caps are visible failures", async () => {
  for (const payload of [{}, { recordsTotal: 3, data: [] }, { recordsTotal: 3, data: [{ id: 1 }] }]) {
    await assert.rejects(fetchPortalPages({ baseUrl: "https://example.com", pageSize: 1, maxPages: 2, fetchJson: async () => payload }))
  }
})

test("documents merge both sources and recognize equivalent encoded URLs", () => {
  const a = { documentUrl: "https://example.com/home/Download?blobName=1&downloadedFileName=A%20B", title: "OCDS" }
  const b = { documentUrl: "https://example.com/home/Download?downloadedFileName=A+B&blobName=1", title: "Portal" }
  const extra = { documentUrl: "https://example.com/extra.pdf", title: "Extra" }
  assert.deepEqual(mergeDocuments([a, extra], [b]), [b, extra])
})

test("retry transient failures, honor short Retry-After, and do not retry permanent errors", async () => {
  let calls = 0
  const sleeps: number[] = []
  const result = await fetchJsonWithRetry(new URL(baseUrl), { attempts: 3, timeoutMs: 1000, delayMs: 1,
    fetch: async () => ++calls === 1 ? new Response("busy", { status: 429, headers: { "retry-after": "2" } }) : Response.json({ releases: [] }),
    sleep: async ms => { sleeps.push(ms) },
  })
  assert.deepEqual(result, { releases: [] })
  assert.deepEqual(sleeps, [2000])
  calls = 0
  await assert.rejects(fetchJsonWithRetry(new URL(baseUrl), { attempts: 3, timeoutMs: 1000, delayMs: 1,
    fetch: async () => { calls++; return new Response("bad query", { status: 400 }) },
  }), /HTTP 400/)
  assert.equal(calls, 1)
})

test("exhausted retries and long Retry-After fail visibly", async () => {
  let calls = 0
  const options = { attempts: 3, timeoutMs: 1000, delayMs: 1, sleep: async () => {} }
  await assert.rejects(fetchJsonWithRetry(new URL(baseUrl), { ...options,
    fetch: async () => { calls++; return new Response("unavailable", { status: 503 }) },
  }), /HTTP 503/)
  assert.equal(calls, 3)
  calls = 0
  await assert.rejects(fetchJsonWithRetry(new URL(baseUrl), { ...options,
    fetch: async () => { calls++; return new Response("busy", { status: 429, headers: { "retry-after": "120" } }) },
  }), /HTTP 429/)
  assert.equal(calls, 1)
})
