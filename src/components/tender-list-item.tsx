import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
}: TenderListItemProps) {
  const displayTitle = cleanText(title) || "Tender title not supplied"
  const displayBuyer = cleanText(buyer)
  const closingLabel = formatClosingDate(closingDate)
  const desktopMetadata = compact([
    displayBuyer,
    province,
    industry,
    procurementType,
    formatDocumentCount(documentsCount),
    tenderNumber,
  ])
  const mobileMetadata = compact([
    province,
    industry,
    procurementType,
    formatDocumentCount(documentsCount, true),
    tenderNumber,
  ])

  return (
    <Link
      aria-label={`${displayTitle}. Closes ${closingLabel}.`}
      className="group grid min-w-0 gap-3 rounded-md border bg-card p-3 text-card-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6 sm:p-4"
      href={detailUrl}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {isNew ? (
            <Badge className="shrink-0" variant="outline">
              New
            </Badge>
          ) : null}
          <h2 className="truncate text-sm font-semibold leading-5 tracking-normal sm:text-base">
            {displayTitle}
          </h2>
        </div>

        {displayBuyer ? (
          <p className="truncate text-sm text-muted-foreground sm:hidden">
            {displayBuyer}
          </p>
        ) : null}

        <MetadataLine className="hidden sm:block" items={desktopMetadata} />
        <MetadataLine className="sm:hidden" items={mobileMetadata} />
      </div>

      <div className="flex min-w-0 items-baseline gap-2 text-sm sm:block sm:min-w-44">
        <span className="shrink-0 text-muted-foreground">Closes</span>
        <span className="truncate font-medium text-foreground sm:block">
          {closingLabel}
        </span>
      </div>

      <ChevronRightIcon
        aria-hidden="true"
        className="hidden size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground sm:block"
      />
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

function compact(values: Array<string | null | undefined>) {
  return values
    .map((value) => cleanText(value))
    .filter((value): value is string => Boolean(value))
}

function formatDocumentCount(count?: number | null, compactLabel = false) {
  const value = count || 0
  const noun = compactLabel
    ? value === 1
      ? "doc"
      : "docs"
    : value === 1
      ? "document"
      : "documents"

  return `${value} ${noun}`
}

function formatClosingDate(value?: string | null) {
  if (!value) return "Not supplied"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not supplied"

  return dateTimeFormatter.format(date)
}
