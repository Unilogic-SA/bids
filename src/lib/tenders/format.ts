import type { TenderDetail, TenderListingItem } from "@/lib/tenders/types"

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const dateTimeFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatDate(value?: string | null) {
  if (!value) return "Not supplied"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not supplied"

  return dateFormatter.format(date)
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not supplied"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not supplied"

  return dateTimeFormatter.format(date)
}

export function formatTenderStatus(
  tender: Pick<TenderListingItem, "closing_at" | "derived_status" | "status">
) {
  if (tender.closing_at) {
    const closing = new Date(tender.closing_at)
    if (!Number.isNaN(closing.getTime())) {
      const now = new Date()
      if (closing.getTime() < now.getTime()) return "closed"
      if (closing.toDateString() === now.toDateString()) return "closing_today"
      return "open"
    }
  }

  return tender.derived_status || tender.status || "open"
}

export function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

export function summarizeTender(tender: TenderListingItem | TenderDetail) {
  return (
    tender.title_snippet ||
    tender.bid_description ||
    tender.title ||
    "Tender description not supplied"
  )
}

export function cleanValue(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === "") return "Not supplied"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

export function buildTenderPath(ocid: string) {
  return `/tenders/${encodeURIComponent(ocid)}`
}
