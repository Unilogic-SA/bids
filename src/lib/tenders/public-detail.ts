import { unstable_cache } from "next/cache"
import { getTenderDetail } from "./query"

// Only public notice data enters this cache. No cookies, accounts or workspaces.
// A short TTL avoids an auth/proxy rewrite; closing state is evaluated at render time.
export const getPublicTenderDetail = unstable_cache(
  async (ocid: string) => {
    const result = await getTenderDetail(ocid)
    if (result.configMissing) throw new Error("Public tender catalog unavailable")
    // Missing rows are retried after the same short TTL; errors are never returned as empty data.
    return result
  },
  ["public-tender-detail-v1"],
  { revalidate: 60, tags: ["public-tender-catalog"] }
)
