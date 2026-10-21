import type { MetadataRoute } from "next"
import { absoluteUrl, getTenderLastModified, isTenderIndexable } from "@/lib/seo"
import { buildTenderPath } from "@/lib/tenders/format"
import { getTenderSitemapItems } from "@/lib/tenders/query"
import { TENDER_COLLECTIONS, collectionPath } from "@/lib/tenders/directory"
import { GUIDES, guidePath } from "@/lib/tenders/guides"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fail visibly instead of returning a successful, almost-empty sitemap.
  const tenders = await getTenderSitemapItems()
  if (!tenders.length) console.warn("seo_sitemap_empty_active_catalog")
  const staticPaths = [
    "/",
    "/tenders",
    "/guides",
    "/about",
    "/privacy",
    "/terms",
    ...GUIDES.map((guide) => guidePath(guide.slug)),
    ...TENDER_COLLECTIONS.map(collectionPath),
  ]
  return [
    ...staticPaths.map((path) => ({ url: absoluteUrl(path) })),
    ...tenders.filter(isTenderIndexable).map((tender) => ({
      url: absoluteUrl(tender.detail_path || buildTenderPath(tender.ocid)),
      lastModified: getTenderLastModified(tender),
    })),
  ]
}
