"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { trackUmamiEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

const NEW_BADGE_WINDOW_MS = 48 * 60 * 60 * 1_000

const dayFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
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
  publishedAt?: string | null
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
  publishedAt,
  detailUrl,
  analytics,
}: TenderListItemProps) {
  const displayTitle =
    normalizeTenderTitle(cleanText(title)) || "Tender title not supplied"
  const displayBuyer = cleanText(buyer) || "Buyer not supplied"
  const displayProvince = cleanText(province)
  const displayIndustry = cleanText(industry)
  const displayTenderNumber = cleanText(tenderNumber) || "Reference not supplied"
  const closing = formatClosingUrgency(closingDate)
  const showNewBadge = Boolean(isNew && isRecentlyPublished(publishedAt))

  return (
    <Link
      aria-label={`${displayTitle}. ${closing.label}.`}
      className="group relative flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 text-card-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
      {showNewBadge ? (
        <Badge
          className="absolute -top-3 left-4 isolate h-5 rounded-md border-primary/35 bg-background px-2 text-[0.68rem] font-medium text-primary shadow-sm ring-2 ring-background before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-primary/10 before:content-['']"
          variant="outline"
        >
          New
        </Badge>
      ) : null}

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <p
            className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground"
          >
            {displayBuyer}
          </p>
          <p className="max-w-[42%] shrink-0 truncate text-xs font-medium text-muted-foreground">
            {displayTenderNumber}
          </p>
        </div>
        <h2 className="line-clamp-2 text-[0.95rem] font-semibold leading-snug tracking-normal text-foreground sm:text-base">
          {displayTitle}
        </h2>
        <PillLine province={displayProvince} industry={displayIndustry} />
      </div>

      <p className={cn("text-sm font-semibold", closing.className)}>
        {closing.label}
      </p>
    </Link>
  )
}

function PillLine({
  province,
  industry,
}: {
  province?: string | null
  industry?: string | null
}) {
  const items = compact([province, industry])
  if (!items.length) return null

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          className={cn(
            "max-w-full rounded-md border-border bg-secondary/70 px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          )}
          key={item}
          variant="secondary"
        >
          <span className="truncate">{item}</span>
        </Badge>
      ))}
    </div>
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

function formatClosingUrgency(value?: string | null) {
  if (!value) {
    return {
      className: "text-muted-foreground",
      label: "Closing date TBC",
    }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return {
      className: "text-muted-foreground",
      label: "Closing date TBC",
    }
  }

  const diffMs = date.getTime() - Date.now()
  if (diffMs <= 0) {
    return {
      className: "text-muted-foreground",
      label: "Closed",
    }
  }

  const dayMs = 24 * 60 * 60 * 1_000
  const hourMs = 60 * 60 * 1_000
  const minuteMs = 60 * 1_000

  if (diffMs < hourMs) {
    const minutesLeft = Math.max(1, Math.ceil(diffMs / minuteMs))
    return {
      className: "text-primary",
      label: `Closing in ${minutesLeft} ${
        minutesLeft === 1 ? "minute" : "minutes"
      }`,
    }
  }

  if (diffMs < dayMs) {
    const hoursLeft = Math.max(1, Math.ceil(diffMs / hourMs))
    return {
      className: "text-primary",
      label: `Closing in ${hoursLeft} ${hoursLeft === 1 ? "hour" : "hours"}`,
    }
  }

  const today = startOfDay(new Date())
  const closingDay = startOfDay(date)
  const calendarDaysLeft = Math.round(
    (closingDay.getTime() - today.getTime()) / dayMs
  )

  if (calendarDaysLeft === 1) {
    return {
      className: "text-primary",
      label: "Closes tomorrow",
    }
  }

  if (calendarDaysLeft >= 2 && calendarDaysLeft <= 5) {
    return {
      className: "text-primary",
      label: `Closes in ${calendarDaysLeft} days`,
    }
  }

  return {
    className: "text-muted-foreground",
    label: `Closes ${dayFormatter.format(date)}`,
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isRecentlyPublished(value?: string | null) {
  if (!value) return false

  const publishedAt = new Date(value)
  if (Number.isNaN(publishedAt.getTime())) return false

  const ageMs = Date.now() - publishedAt.getTime()
  return ageMs >= 0 && ageMs <= NEW_BADGE_WINDOW_MS
}
