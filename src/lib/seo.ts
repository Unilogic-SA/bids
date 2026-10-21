import { normalizeTenderTitle } from "@/lib/tenders/presentation"
import type { TenderDetail, TenderDocument, TenderListingItem } from "@/lib/tenders/types"

export const SITE_NAME = "OpenBids"
export const SITE_DESCRIPTION =
  "Search current South African public tenders, RFQs, RFPs, bid documents, closing dates, buyers, and procurement opportunities."

const DEFAULT_SITE_URL = "https://www.openbid.co.za"

export function getSiteUrl() {
  // Canonicals identify the public product, never an ephemeral Vercel deployment.
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
  const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`)
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !["www.openbid.co.za", "openbid.co.za"].includes(url.hostname)
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be the OpenBids production origin")
  }
  return DEFAULT_SITE_URL
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

  const slice = value.slice(0, maxLength - 1)
  const boundary = slice.lastIndexOf(" ")
  const truncated = (boundary > maxLength * 0.6 ? slice.slice(0, boundary) : slice).trimEnd()
  return `${truncated}…`
}

export function getTenderTitle(
  tender: Pick<TenderListingItem, "tender_no" | "buyer_name" | "department"> &
    Partial<Pick<TenderListingItem, "bid_description" | "title_snippet" | "title">>
) {
  const reference = cleanText(tender.tender_no)
  const subject =
    normalizeTenderTitle(
      cleanText(tender.bid_description || tender.title_snippet || tender.title)
    ) || ""
  const buyer = cleanText(tender.buyer_name || tender.department)
  if (subject && subject.toLowerCase() !== reference.toLowerCase()) {
    const shortReference = truncateText(reference, 28)
    const concise = truncateText(subject, Math.max(35, 72 - shortReference.length - 3))
    return shortReference ? `${concise} – ${shortReference}` : concise
  }
  return [reference || "Tender opportunity", buyer].filter(Boolean).join(" – ")
}

export function getTenderDescription(
  tender: Pick<
    TenderListingItem,
    | "bid_description"
    | "title_snippet"
    | "title"
    | "buyer_name"
    | "department"
    | "province"
    | "closing_at"
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
    tender.closing_at
      ? `${new Date(tender.closing_at).getTime() <= Date.now() ? "closed" : "closes"} ${formatIsoDate(tender.closing_at)}`
      : "",
  ].filter(Boolean)

  const detail = truncateText(context.join(", "), 85)
  return [truncateText(summary, Math.max(65, 158 - detail.length - 2)), detail]
    .filter(Boolean)
    .join(". ")
}

export function getTenderLastModified(
  tender: Pick<TenderDetail, "modified_at" | "published_at">,
  documents: Pick<TenderDocument, "date_modified" | "date_published">[] = []
) {
  const timestamps = [
    tender.modified_at,
    tender.published_at,
    ...documents.flatMap((document) => [document.date_modified, document.date_published]),
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
  return getSastDateKey(value) || value
}
import { getSastDateKey } from "@/lib/sast-date"

/** Indexation defaults are explicit on every public page; previews stay excluded. */
export function publicRobots(index = true) {
  const allow = index && process.env.VERCEL_ENV !== "preview"
  return {
    index: allow,
    follow: true,
    googleBot: {
      index: allow,
      follow: true,
      "max-snippet": -1 as const,
      "max-image-preview": "large" as const,
    },
  }
}

export function pageMetadata(title: string, description: string, path: string, index = true) {
  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    alternates: { canonical: path },
    robots: publicRobots(index),
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website" as const,
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: "OpenBids — South African public tenders",
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [absoluteUrl("/opengraph-image")],
    },
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function isTenderIndexable(
  tender: Pick<
    TenderListingItem,
    "bid_description" | "title_snippet" | "title" | "buyer_name" | "department" | "tender_no"
  >
) {
  const subject = cleanText(tender.bid_description || tender.title_snippet || tender.title)
  return (
    subject.length >= 30 &&
    subject.toLowerCase() !== cleanText(tender.tender_no).toLowerCase() &&
    Boolean(cleanText(tender.buyer_name || tender.department))
  )
}

export function documentMimeType(extension?: string | null) {
  const types: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
  }
  return types[cleanText(extension).replace(/^\./, "").toLowerCase()]
}
