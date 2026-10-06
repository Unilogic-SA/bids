import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache, type ReactNode } from "react"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconClock,
  IconDatabaseOff,
} from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  statusLabel,
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
import {
  formatClosingUrgency,
  normalizeTenderTitle,
} from "@/lib/tenders/presentation"
import { formatTenderLocation } from "@/lib/tenders/location"
import { isElapsedTenderTimestamp } from "@/lib/tenders/calendar"

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
          <AlertDescription>
            We couldn’t load this tender. Please try again shortly.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const description =
    normalizeTenderTitle(getPrimaryDescription(tender)) || "Tender notice"
  const buyer = getPrimaryBuyer(tender)
  const canonicalPath =
    tender.detail_path || `/tenders/${encodeURIComponent(tender.ocid)}`
  const canonicalUrl = absoluteUrl(canonicalPath)
  const location = formatTenderLocation(tender)
  const hasBriefing = hasMeaningfulBriefing(tender)
  const conditionItems = getConditionItems(tender)
  const hasContact = hasMeaningfulContact(tender)
  const originalTenderUrl = getVerifiedOriginalTenderUrl(
    tender.original_source_url
  )
  const sourceLabel =
    getMeaningfulText(tender.source_label).replace(/^source\s*:\s*/i, "") ||
    "National Treasury eTenders"
  const jsonLd = buildTenderJsonLd(tender, documents)

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
      />
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:py-6 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              asChild
              className="h-8 w-fit px-1 sm:h-7"
              size="sm"
              variant="ghost"
            >
              <Link href={listingHref}>
                <IconArrowLeft data-icon="inline-start" />
                Tenders
              </Link>
            </Button>
            <div className="flex shrink-0 items-center gap-1.5">
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
                  briefingAt: hasBriefing ? tender.briefing_datetime : null,
                  briefingVenue: getMeaningfulText(tender.briefing_venue),
                  briefingCompulsory: tender.compulsory_briefing,
                }}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 max-w-4xl flex-col gap-2">
              <TenderReference tender={tender} />
              <h1 className="break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                {description}
              </h1>
              {buyer ? (
                <p className="break-words text-sm leading-6 text-muted-foreground">
                  {buyer}
                </p>
              ) : null}
            </div>
          </div>
          <TenderCriticalFacts tender={tender} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="h-8 w-fit text-primary lg:hidden"
        >
          <a href="#tender-documents">Go to Documents</a>
        </Button>

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
          <TenderOverview tender={tender} />
          {location ? (
            <>
              <section
                aria-labelledby="delivery-heading"
                className="flex min-w-0 flex-col gap-2"
              >
                <h2 id="delivery-heading" className="text-base font-semibold">
                  Delivery location
                </h2>
                <p className="break-words text-sm leading-6">{location}</p>
              </section>
            </>
          ) : null}
          {hasBriefing ? (
            <>
           …2469 tokens truncated…ertDescription>{content}</AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">
          {ended ? "Briefing — ended" : "Briefing"}
        </h2>
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
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="text-base font-semibold">Conditions</h2>
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
    <dl className="flex flex-col gap-3">
      {items.map((item) => (
        <div className="flex min-w-0 flex-col gap-0.5" key={item.label}>
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
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="text-base font-semibold">Contact</h2>
      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
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

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm leading-6">{value}</dd>
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
    ? tender.special_conditions!.trim()
    : ""
  const eligibilityNotes = getMeaningfulText(tender.eligibility_notes)
    ? tender.eligibility_notes!.trim()
    : ""

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
    formatAvailableDate(tender.briefing_datetime, true) ||
    getMeaningfulText(tender.briefing_venue)
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

function formatAvailableDate(value?: string | null, includeTime = false) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return includeTime ? formatDateTime(value) : formatDate(value)
}

function getHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : ""
  } catch {
    return ""
  }
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

  const digits = normalized.replace(/\D/g, "")
  return digits.length >= 7 && !/^0+$/.test(digits) ? normalized : ""
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
