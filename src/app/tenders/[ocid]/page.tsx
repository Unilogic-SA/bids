import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache, type ReactNode } from "react"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconDatabaseOff,
  IconExternalLink,
} from "@tabler/icons-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TenderBookmarkButton } from "@/components/tender-bookmark-button"
import { TenderCalendarAction } from "@/components/tender-calendar-action"
import {
  TenderConditionsDisclosure,
  type TenderConditionItem,
} from "@/components/tender-conditions-disclosure"
import { TenderDocuments } from "@/components/tender-documents"
import {
  formatDate,
  formatDateTime,
  formatTenderStatus,
  summarizeTender,
} from "@/lib/tenders/format"
import {
  absoluteUrl,
  cleanText,
  getTenderDescription,
  getTenderLastModified,
  getTenderTitle,
  stringifyJsonLd,
} from "@/lib/seo"
import { parseListingReturnHref } from "@/lib/tenders/navigation"
import { getTenderDetail } from "@/lib/tenders/query"
import type { TenderDetail, TenderDocument } from "@/lib/tenders/types"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type TenderPageProps = {
  params: Promise<{ ocid: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const getCachedTenderDetail = cache((ocid: string) => getTenderDetail(ocid))

export async function generateMetadata({
  params,
}: TenderPageProps): Promise<Metadata> {
  const { ocid } = await params
  const { tender, documents, configMissing } = await getCachedTenderDetail(
    decodeURIComponent(ocid)
  )

  if (!tender && !configMissing) notFound()

  if (!tender) {
    return {
      title: configMissing ? "Tender data unavailable" : "Tender not found",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const title = getTenderTitle(tender)
  const description = getTenderDescription(tender)
  const canonicalPath =
    tender.detail_path || `/tenders/${encodeURIComponent(tender.ocid)}`
  const lastModified = getTenderLastModified(tender, documents)

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "article",
      publishedTime: tender.published_at || undefined,
      modifiedTime: lastModified?.toISOString(),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  }
}

export default async function TenderPage({
  params,
  searchParams,
}: TenderPageProps) {
  const { ocid } = await params
  const listingHref = parseListingReturnHref((await searchParams).from)
  const { tender, documents, configMissing } = await getCachedTenderDetail(
    decodeURIComponent(ocid)
  )

  if (!tender && !configMissing) notFound()

  if (!tender) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-4 md:px-6">
        <Button asChild className="min-h-11 w-fit" variant="outline">
          <Link href={listingHref}>
            <IconArrowLeft data-icon="inline-start" />
            Tenders
          </Link>
        </Button>
        <Alert>
          <IconDatabaseOff />
          <AlertTitle>Tender data unavailable</AlertTitle>
          <AlertDescription>Supabase env vars are missing.</AlertDescription>
        </Alert>
      </main>
    )
  }

  const description = getPrimaryDescription(tender)
  const buyer = getPrimaryBuyer(tender)
  const canonicalPath =
    tender.detail_path || `/tenders/${encodeURIComponent(tender.ocid)}`
  const canonicalUrl = absoluteUrl(canonicalPath)
  const hasCriticalFacts = hasMeaningfulCriticalFacts(tender)
  const hasBriefing = hasMeaningfulBriefing(tender)
  const conditionItems = getConditionItems(tender)
  const hasContact = hasMeaningfulContact(tender)
  const originalTenderUrl = getVerifiedOriginalTenderUrl(
    tender.original_source_url
  )
  const hasRemainingContent =
    conditionItems.length > 0 || hasContact || Boolean(originalTenderUrl)
  const jsonLd = buildTenderJsonLd(tender, documents)

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
      />
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:py-5 md:px-6">
          <Button
            asChild
            className="min-h-11 w-fit sm:min-h-7"
            size="sm"
            variant="ghost"
          >
            <Link href={listingHref}>
              <IconArrowLeft data-icon="inline-start" />
              Tenders
            </Link>
          </Button>

          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 max-w-5xl flex-col gap-2">
              <TenderReference tender={tender} />
              <h1 className="break-words text-2xl font-semibold leading-tight tracking-normal sm:text-3xl">
                {description}
              </h1>
              {buyer ? (
                <p className="break-words text-sm font-medium leading-6 sm:text-base">
                  {buyer}
                </p>
              ) : null}
              <TenderBadges tender={tender} />
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <TenderBookmarkButton ocid={tender.ocid} />
              <TenderCalendarAction
                tender={{
                  ocid: tender.ocid,
                  tenderNumber:
                    getMeaningfulText(tender.tender_no) || "Tender notice",
                  description,
                  buyer,
                  canonicalUrl,
                  closingAt: tender.closing_at,
                  briefingAt: hasBriefing
                    ? tender.briefing_datetime
                    : null,
                  briefingVenue: getMeaningfulText(tender.briefing_venue),
                  briefingCompulsory: tender.compulsory_briefing,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="order-1 flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
          {hasCriticalFacts ? <TenderCriticalFacts tender={tender} /> : null}
          {hasBriefing ? (
            <>
              {hasCriticalFacts ? <Separator /> : null}
              <TenderBriefing tender={tender} />
            </>
          ) : null}
        </div>

        <aside className="order-2 min-w-0 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <TenderDocuments documents={documents} tender={tender} />
        </aside>

        {hasRemainingContent ? (
          <div className="order-3 flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2">
            <Separator />
            {conditionItems.length > 0 ? (
              <TenderConditions items={conditionItems} />
            ) : null}
            {conditionItems.length > 0 && hasContact ? <Separator /> : null}
            {hasContact ? <TenderContact tender={tender} /> : null}
            {(conditionItems.length > 0 || hasContact) && originalTenderUrl ? (
              <Separator />
            ) : null}
            {originalTenderUrl ? (
              <Button
                asChild
                className="min-h-11 w-full sm:min-h-7 sm:w-fit"
                size="sm"
                variant="outline"
              >
                <a
                  data-umami-event="tender_source_open"
                  data-umami-event-location="detail_page"
                  data-umami-event-ocid={tender.ocid}
                  href={originalTenderUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <IconExternalLink data-icon="inline-start" />
                  View original tender on eTenders
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  )
}

function buildTenderJsonLd(tender: TenderDetail, documents: TenderDocument[]) {
  const canonicalUrl = absoluteUrl(
    tender.detail_path || `/tenders/${encodeURIComponent(tender.ocid)}`
  )
  const title = getTenderTitle(tender)
  const description = getTenderDescription(tender)
  const lastModified = getTenderLastModified(tender, documents)
  const buyer = cleanText(tender.buyer_name || tender.department)

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: "en-ZA",
        datePublished: tender.published_at || undefined,
        dateModified: lastModified?.toISOString(),
        isPartOf: {
          "@type": "WebSite",
          name: "Bids ZA",
          url: absoluteUrl("/"),
        },
      },
      {
        "@type": "CreativeWork",
        "@id": `${canonicalUrl}#tender-notice`,
        name: title,
        headline: tender.tender_no || title,
        description: summarizeTender(tender),
        identifier: tender.tender_no || tender.ocid,
        datePublished: tender.published_at || undefined,
        dateModified: lastModified?.toISOString(),
        expires: tender.closing_at || undefined,
        about: [
          tender.industry,
          tender.procurement_category,
          tender.procurement_method_details,
        ].filter(Boolean),
        provider: buyer
          ? {
              "@type": "GovernmentOrganization",
              name: buyer,
            }
          : undefined,
        spatialCoverage: tender.province
          ? {
              "@type": "Place",
              name: tender.province,
              address: [tender.address_line, tender.city, tender.postal_code]
                .filter(Boolean)
                .join(", "),
            }
          : undefined,
        mainEntityOfPage: canonicalUrl,
      },
      documents.length
        ? {
            "@type": "ItemList",
            "@id": `${canonicalUrl}#documents`,
            name: `${title} documents`,
            itemListElement: documents.map((document, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "DigitalDocument",
                name:
                  document.document_title ||
                  document.file_name ||
                  "Tender document",
                url: document.document_url,
                encodingFormat: document.file_extension || undefined,
                datePublished: document.date_published || undefined,
                dateModified: document.date_modified || undefined,
              },
            })),
          }
        : undefined,
    ].filter(Boolean),
  }
}

function TenderReference({ tender }: { tender: TenderDetail }) {
  const reference = [
    getMeaningfulText(tender.tender_type),
    getMeaningfulText(tender.tender_no),
  ].filter(Boolean)

  if (reference.length === 0) return null

  return (
    <p className="text-sm font-medium text-muted-foreground">
      {reference.join(" · ")}
    </p>
  )
}

function TenderBadges({ tender }: { tender: TenderDetail }) {
  const province = getMeaningfulText(tender.province)
  const industry = getMeaningfulText(tender.industry)

  if (!province && !industry) return null

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {province ? <Badge variant="secondary">{province}</Badge> : null}
      {industry ? <Badge variant="outline">{industry}</Badge> : null}
    </div>
  )
}

function TenderCriticalFacts({ tender }: { tender: TenderDetail }) {
  const isClosed = formatTenderStatus(tender) === "closed"
  const closing = formatAvailableDate(tender.closing_at, true)
  const opening = formatAvailableDate(tender.opening_at)
  const published = formatAvailableDate(tender.published_at)
  const location = buildTenderLocation(tender)
  const lastUpdated = formatAvailableDate(tender.modified_at)
  const facts = [
    closing
      ? {
          label: isClosed ? "Closed" : "Closing",
          value: closing,
          emphasis: !isClosed,
          strong: true,
        }
      : null,
    opening
      ? { label: "Opening date", value: opening }
      : published
        ? { label: "Published", value: published }
        : null,
    location ? { label: "Required at", value: location } : null,
    lastUpdated
      ? { label: "Last updated", value: lastUpdated, quiet: true }
      : null,
  ].filter((fact) => fact !== null)

  return (
    <section aria-label="Critical tender facts" className="flex flex-col gap-4">
      {facts.length > 0 ? (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {facts.map((fact) => (
            <DetailItem
              emphasis={fact.emphasis}
              key={fact.label}
              label={fact.label}
              quiet={fact.quiet}
              strong={fact.strong}
              value={fact.value}
            />
          ))}
        </dl>
      ) : null}

      {isClosed ? (
        <Alert variant="destructive">
          <AlertTitle>Closed</AlertTitle>
          <AlertDescription>
            This opportunity has closed. Its details and documents remain
            available for reference.
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

function TenderBriefing({ tender }: { tender: TenderDetail }) {
  const date = formatAvailableDate(tender.briefing_datetime, true)
  const venue = getMeaningfulText(tender.briefing_venue)
  const facts = [
    date ? { label: "Date and time", value: date } : null,
    venue ? { label: "Venue", value: venue } : null,
  ].filter((fact) => fact !== null)
  const content = facts.length ? (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {facts.map((fact) => (
        <DetailItem key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </dl>
  ) : (
    <p className="text-sm text-muted-foreground">
      A briefing session applies. Date and venue were not supplied.
    </p>
  )

  if (tender.compulsory_briefing) {
    return (
      <Alert>
        <IconAlertTriangle />
        <AlertTitle>Compulsory briefing</AlertTitle>
        <AlertDescription>{content}</AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-medium">Briefing</h2>
        {tender.compulsory_briefing === false ? (
          <Badge variant="outline">Non-compulsory</Badge>
        ) : null}
      </div>
      {content}
    </section>
  )
}

function TenderConditions({ items }: { items: TenderConditionItem[] }) {
  const isLong =
    items.reduce((length, item) => length + item.value.length, 0) > 900 ||
    items.some(
      (item) => item.value.length > 700 || item.value.split("\n").length > 8
    )

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-base font-medium">Conditions</h2>
      {isLong ? (
        <TenderConditionsDisclosure items={items} />
      ) : (
        <ConditionItems items={items} />
      )}
    </section>
  )
}

function ConditionItems({ items }: { items: TenderConditionItem[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {items.map((item) => (
        <div className="flex min-w-0 flex-col gap-1" key={item.label}>
          <dt className="text-xs font-medium text-muted-foreground">
            {item.label}
          </dt>
          <dd className="whitespace-pre-line break-words text-sm leading-6">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function TenderContact({ tender }: { tender: TenderDetail }) {
  const person = getMeaningfulText(tender.contact_person)
  const role = getMeaningfulText(tender.contact_role)
  const email = getMeaningfulText(tender.contact_email)
  const emailTarget = getEmailTarget(email)
  const telephone = getMeaningfulText(tender.contact_tel)
  const telephoneTarget = getTelephoneTarget(telephone)

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-base font-medium">Contact</h2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {person ? <DetailItem label="Contact person" value={person} /> : null}
        {role && !areEquivalent(role, person) ? (
          <DetailItem label="Role" value={role} />
        ) : null}
        {emailTarget ? (
          <DetailItem
            label="Email"
            value={
              <a
                className="break-all underline underline-offset-4"
                data-umami-event="tender_contact_email_click"
                data-umami-event-context="contact"
                data-umami-event-ocid={tender.ocid}
                href={`mailto:${emailTarget}`}
              >
                {email}
              </a>
            }
          />
        ) : null}
        {telephoneTarget ? (
          <DetailItem
            label="Telephone"
            value={
              <a
                className="underline underline-offset-4"
                data-umami-event="tender_contact_tel_click"
                data-umami-event-context="contact"
                data-umami-event-ocid={tender.ocid}
                href={`tel:${telephoneTarget}`}
              >
                {telephone}
              </a>
            }
          />
        ) : null}
      </dl>
    </section>
  )
}

function DetailItem({
  emphasis,
  label,
  quiet,
  strong,
  value,
}: {
  emphasis?: boolean
  label: string
  quiet?: boolean
  strong?: boolean
  value: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        emphasis && "rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
      )}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "break-words text-sm leading-5",
          emphasis && "text-primary",
          strong && "font-semibold",
          quiet && "text-muted-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function getPrimaryDescription(tender: TenderDetail) {
  return (
    getMeaningfulText(tender.bid_description) ||
    getMeaningfulText(tender.title) ||
    getMeaningfulText(tender.title_snippet) ||
    "Tender notice"
  )
}

function getPrimaryBuyer(tender: TenderDetail) {
  const buyer = getMeaningfulText(tender.buyer_name)
  const department = getMeaningfulText(tender.department)

  if (!buyer) return department
  if (!department) return buyer
  if (areEquivalent(buyer, department)) {
    return buyer.length >= department.length ? buyer : department
  }

  return department
}

function getConditionItems(tender: TenderDetail) {
  const specialConditions = getMeaningfulText(tender.special_conditions)
  const eligibilityNotes = getMeaningfulText(tender.eligibility_notes)

  if (!specialConditions && !eligibilityNotes) return []
  if (!specialConditions) {
    return [{ label: "Eligibility", value: eligibilityNotes }]
  }
  if (!eligibilityNotes) {
    return [{ label: "Special conditions", value: specialConditions }]
  }

  const normalizedSpecial = normalizeForComparison(specialConditions)
  const normalizedEligibility = normalizeForComparison(eligibilityNotes)

  if (normalizedSpecial.includes(normalizedEligibility)) {
    return [{ label: "Special conditions", value: specialConditions }]
  }
  if (normalizedEligibility.includes(normalizedSpecial)) {
    return [{ label: "Eligibility", value: eligibilityNotes }]
  }

  return [
    { label: "Special conditions", value: specialConditions },
    { label: "Eligibility", value: eligibilityNotes },
  ]
}

function hasMeaningfulBriefing(tender: TenderDetail) {
  return Boolean(
    tender.briefing_session === true ||
      tender.compulsory_briefing === true ||
      getMeaningfulText(tender.briefing_datetime) ||
      getMeaningfulText(tender.briefing_venue)
  )
}

function hasMeaningfulCriticalFacts(tender: TenderDetail) {
  return Boolean(
    formatTenderStatus(tender) === "closed" ||
      formatAvailableDate(tender.closing_at, true) ||
      formatAvailableDate(tender.opening_at) ||
      formatAvailableDate(tender.published_at) ||
      buildTenderLocation(tender) ||
      formatAvailableDate(tender.modified_at)
  )
}

function hasMeaningfulContact(tender: TenderDetail) {
  const person = getMeaningfulText(tender.contact_person)
  const role = getMeaningfulText(tender.contact_role)
  const emailTarget = getEmailTarget(getMeaningfulText(tender.contact_email))
  const telephoneTarget = getTelephoneTarget(
    getMeaningfulText(tender.contact_tel)
  )

  return Boolean(
    person ||
      (role && !areEquivalent(role, person)) ||
      emailTarget ||
      telephoneTarget
  )
}

function buildTenderLocation(tender: TenderDetail) {
  const structuredParts = [
    tender.address_line,
    tender.suburb_or_area,
    tender.city,
    tender.province,
    tender.postal_code,
  ]
    .map(normalizeLocationPart)
    .filter(Boolean)
  const structuredKeys = new Set(structuredParts.map(normalizeForComparison))
  const placeParts = normalizeLocationPart(tender.place_raw)
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) => part && !structuredKeys.has(normalizeForComparison(part))
    )
  const orderedParts = [...placeParts, ...structuredParts]

  return orderedParts.filter(
    (part, index) =>
      orderedParts.findIndex(
        (candidate) =>
          normalizeForComparison(candidate) === normalizeForComparison(part)
      ) === index
  ).join(", ")
}

function normalizeLocationPart(value?: string | null) {
  return getMeaningfulText(value)
    .replace(/\s*[|;]+\s*/g, ", ")
    .replace(/(?:\s*,\s*){2,}/g, ", ")
    .replace(/^[\s,|;]+|[\s,|;]+$/g, "")
}

function formatAvailableDate(value?: string | null, includeTime = false) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return includeTime ? formatDateTime(value) : formatDate(value)
}

function getVerifiedOriginalTenderUrl(value?: string | null) {
  const candidate = getMeaningfulText(value)
  if (!candidate) return ""

  try {
    const url = new URL(candidate)
    const isEtendersHost =
      url.hostname === "etenders.gov.za" ||
      url.hostname.endsWith(".etenders.gov.za")

    return ["http:", "https:"].includes(url.protocol) && isEtendersHost
      ? url.toString()
      : ""
  } catch {
    return ""
  }
}

function getEmailTarget(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ""
}

function getTelephoneTarget(value: string) {
  const candidate = value.match(/\+?\d(?:[\d\s().-]{5,}\d)?/)?.[0] || ""
  let normalized = candidate.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "")

  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`

  return normalized.replace(/\D/g, "").length >= 7 ? normalized : ""
}

function getMeaningfulText(value?: string | null) {
  const candidate = cleanText(value)

  return ["not supplied", "not applicable", "n/a", "none", "-"].includes(
    candidate.toLocaleLowerCase("en-ZA")
  )
    ? ""
    : candidate
}

function areEquivalent(first: string, second: string) {
  if (!first || !second) return false
  return normalizeForComparison(first) === normalizeForComparison(second)
}

function normalizeForComparison(value: string) {
  return value
    .toLocaleLowerCase("en-ZA")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
