import type { TenderDetail, TenderDocument, TenderListingItem } from "@/lib/tenders/types"

export const SITE_NAME = "Bids ZA"
export const SITE_DESCRIPTION =
  "Search current South African public tenders, RFQs, RFPs, bid documents, closing dates, buyers, and procurement opportunities."

const DEFAULT_SITE_URL = "https://bids-za.vercel.app"

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    DEFAULT_SITE_URL

  const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`
  return normalizedUrl.replace(/\/+$/, "")
}

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getSiteUrl()}${normalizedPath}`
}

export function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || ""
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value

  const truncated = value.slice(0, maxLength - 1).trimEnd()
  return `${truncated}...`
}

export function getTenderTitle(tender: Pick<TenderListingItem, "tender_no" | "buyer_name" | "department">) {
  const reference = cleanText(tender.tender_no) || "Tender opportunity"
  const buyer = cleanText(tender.buyer_name || tender.department)

  return buyer ? `${reference} - ${buyer}` : reference
}

export function getTenderDescription(
  tender: Pick<
    TenderListingItem,
    "bid_description" | "title_snippet" | "title" | "buyer_name" | "department" | "province" | "closing_at"
  >
) {
  const summary =
    cleanText(tender.bid_description) ||
    cleanText(tender.title_snippet) ||
    cleanText(tender.title) ||
    "View tender details, documents, buyer information, and closing dates."
  const context = [
    cleanText(tender.buyer_name || tender.department),
    cleanText(tender.province),
    tender.closing_at ? `closes ${formatIsoDate(tender.closing_at)}` : "",
  ].filter(Boolean)

  return truncateText([summary, context.join(", ")].filter(Boolean).join(" "), 160)
}

export function getTenderLastModified(
  tender: Pick<TenderDetail, "modified_at" | "imported_at" | "published_at" | "captured_at">,
  documents: Pick<TenderDocument, "date_modified" | "downloaded_at" | "date_published">[] = []
) {
  const timestamps = [
    tender.modified_at,
    tender.imported_at,
    tender.published_at,
    tender.captured_at,
    ...documents.flatMap((document) => [
      document.date_modified,
      document.downloaded_at,
      document.date_published,
    ]),
  ]

  const dates = timestamps
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  return dates[0]
}

export function stringifyJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

function formatIsoDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toISOString().slice(0, 10)
}
