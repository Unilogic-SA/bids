import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/lib/seo"
import { buildTenderPath } from "@/lib/tenders/format"
import { getTenderSitemapItems } from "@/lib/tenders/query"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenders = await getSitemapTenders()
  const now = new Date()

  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...tenders.map((tender) => ({
      url: absoluteUrl(tender.detail_path || buildTenderPath(tender.ocid)),
      lastModified:
        getLastModified([
          tender.modified_at,
          tender.imported_at,
          tender.published_at,
          tender.captured_at,
        ]) || now,
      changeFrequency: "daily" as const,
      priority: tender.documents_count && tender.documents_count > 0 ? 0.9 : 0.8,
    })),
  ]
}

async function getSitemapTenders() {
  try {
    return await getTenderSitemapItems()
  } catch {
    return []
  }
}

function getLastModified(values: Array<string | null>) {
  const dates = values
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  return dates[0]
}
