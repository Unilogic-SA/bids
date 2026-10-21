import assert from "node:assert/strict"
import { test } from "node:test"
import { collectSitemapBatches } from "./sitemap-batches"

test("sitemap reads more than 1000 notices despite a lower API batch cap", async () => {
  const records = Array.from({ length: 2252 }, (_, i) => ({
    ocid: `ocid-${String(i).padStart(5, "0")}`,
  }))
  let reads = 0
  const result = await collectSitemapBatches(async (after) => {
    reads++
    return records.filter((item) => !after || item.ocid > after).slice(0, 237)
  })
  assert.equal(result.length, 2252)
  assert.equal(new Set(result.map((x) => x.ocid)).size, 2252)
  assert.equal(reads, 11)
})
test("sitemap fails on partial failures, non-advancing batches and overflow", async () => {
  await assert.rejects(
    collectSitemapBatches(async (after) => {
      if (after) throw new Error("upstream failed")
      return [{ ocid: "one" }]
    }),
    /upstream failed/
  )
  await assert.rejects(
    collectSitemapBatches(async () => [{ ocid: "one" }]),
    /did not advance/
  )
  await assert.rejects(
    collectSitemapBatches(async () => [{ ocid: "a" }, { ocid: "b" }], 1),
    /sharding/
  )
})
