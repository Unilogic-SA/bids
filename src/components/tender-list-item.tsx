"use client"

import Link from "next/link"
import { IconChevronRight } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { trackUmamiEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

const dateTimeFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

type TenderListItemProps = {
  title?: string | null
  buyer?: string | null
  province?: string | null
  industry?: string | null
  procurementType?: string | null
  documentsCount?: number | null
  tenderNumber?: string | null
  closingDate?: string | null
  isNew?: boolean | null
  detailUrl: string
  analytics?: {
    activeFilterCount: number
    page: number
    position: number
  }
}

export function TenderListItem({
  title,
  buyer,
  province,
  industry,
  procurementType,
  documentsCount,
  tenderNumber,
  closingDate,
  isNew,
  detailUrl,
  analytics,
}: TenderListItemProps) {
  const displayTitle =
    normalizeTenderTitle(cleanText(title)) || "Tender title not supplied"
  const displayBuyer = cleanText(buyer)
  const closingLabel = formatClosingDate(closingDate)
  const desktopMetadata = compact([
    province,
    displayBuyer,
    tenderNumber,
  ])

  return (
    <Link
      aria-label={`${displayTitle}. Closes ${closingLabel}.`}
      className="group grid min-w-0 gap-2.5 rounded-md border bg-card p-2.5 text-card-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-3 sm:py-2.5"
      href={detailUrl}
      onClick={() =>
        trackUmamiEvent("tender_result_open", {
          active_filters: analytics?.activeFilterCount,
          documents_count: documentsCount || 0,
          has_closing_date: Boolean(closingDate),
          industry: cleanText(industry) || "unknown",
          is_new: Boolean(isNew),
          page: analytics?.page,
          position: analytics?.position,
          procurement_type: cleanText(procurementType) || "unknown",
          province: cleanText(province) || "unknown",
        })
      }
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          {isNew ? (
            <Badge className="shrink-0" variant="outline">
              New
            </Badge>
          ) : null}
          <h2 className="truncate text-sm font-semibold leading-5 tracking-normal">
            {displayTitle}
          </h2>
        </div>

        <MetadataLine items={desktopMetadata} />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
        <div className="flex min-w-0 items-baseline gap-2 text-sm sm:block sm:min-w-40">
          <span className="shrink-0 text-muted-foreground">Closes</span>
          <span className="truncate font-medium text-foreground sm:block">
            {closingLabel}
          </span>
        </div>
        <IconChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        />
      </div>
    </Link>
  )
}

function MetadataLine({
  className,
  items,
}: {
  className?: string
  items: string[]
}) {
  if (!items.length) return null

  return (
    <p
      className={cn(
        "min-w-0 truncate text-sm text-muted-foreground",
        className
      )}
    >
      {items.join(" · ")}
    </p>
  )
}

function cleanText(value?: string | null) {
  const text = value?.trim()
  return text || null
}

function normalizeTenderTitle(value?: string | null) {
  if (!value) return null

  const title = value.replace(/\s+/g, " ").trim()
  const letters = title.match(/\p{L}/gu) || []
  if (!letters.length) return title

  const uppercaseLetters = letters.filter(
    (letter) => letter === letter.toLocaleUpperCase("en-ZA")
  )
  const isMostlyUppercase = uppercaseLetters.length / letters.length > 0.75

  if (!isMostlyUppercase) return title

  const sentenceCase = title
    .toLocaleLowerCase("en-ZA")
    .replace(/(^|[.!?]\s+)(\p{L})/gu, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase("en-ZA")}`
    })

  return sentenceCase.replace(
    /\b(rfq|rfp|rfi|eoi|ict|sita|scm|cidb|vat|bbbee|b-bbee|csd|ppe|hvac|ups|cctv|nersa|soc|ltd|pty)\b/giu,
    (match) => match.toLocaleUpperCase("en-ZA")
  )
}

function compact(values: Array<string | null | undefined>) {
  return values
    .map((value) => cleanText(value))
    .filter((value): value is string => Boolean(value))
}

function formatClosingDate(value?: string | null) {
  if (!value) return "Not supplied"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not supplied"

  return dateTimeFormatter.format(date)
}
