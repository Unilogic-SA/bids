/** Keyset reads stay complete even when PostgREST caps a requested batch. */
export async function collectSitemapBatches<T extends { ocid: string }>(
  read: (after: string | undefined) => Promise<T[]>,
  maximum = 45_000
): Promise<T[]> {
  const items: T[] = []
  let after: string | undefined
  for (;;) {
    const batch = await read(after)
    if (!batch.length) return items
    for (const item of batch) {
      if (after !== undefined && item.ocid <= after)
        throw new Error("Sitemap pagination did not advance")
      after = item.ocid
      items.push(item)
      if (items.length > maximum)
        throw new Error("Tender sitemap needs sharding before exceeding its URL budget")
    }
  }
}
