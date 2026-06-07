import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache, type ReactNode } from "react"
import {
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { TenderDocuments } from "@/components/tender-documents"
import {
  cleanValue,
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
import { getTenderDetail } from "@/lib/tenders/query"
import type { TenderDetail, TenderDocument } from "@/lib/tenders/types"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type TenderPageProps = {
  params: Promise<{ ocid: string }>
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
      title: "Tender data unavailable",
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

export default async function TenderPage({ params }: TenderPageProps) {
  const { ocid } = await params
  const { tender, documents, configMissing } = await getCachedTenderDetail(
    decodeURIComponent(ocid)
  )

  if (!tender && !configMissing) notFound()

  if (!tender) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-4 md:px-6">
        <Button asChild className="min-h-11 w-fit" variant="outline">
          <Link href="/">
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

  const status = formatTenderStatus(tender)
  const jsonLd = buildTenderJsonLd(tender, documents)
  const description =
    tender.bid_description || tender.title || "No description supplied"

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
      />
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:py-5 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Button
              asChild
              className="min-h-11 w-fit sm:min-h-7"
              size="sm"
              variant="ghost"
            >
              <Link href="/">
                <IconArrowLeft data-icon="inline-start" />
                Tenders
              </Link>
            </Button>

            <div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:justify-end">
              <Badge
                variant={
                  status === "closed"
                    ? "secondary"
                    : status === "closing_today"
                      ? "destructive"
                      : "default"
                }
              >
                {statusLabel(status)}
              </Badge>
              {tender.is_new ? <Badge variant="outline">New</Badge> : null}
              <Badge variant="outline">{tender.source_site || "eTenders"}</Badge>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-3">
              <h1 className="max-w-5xl break-words text-2xl font-semibold leading-tight tracking-normal sm:text-3xl">
                {tender.tender_no || "Tender notice"}
              </h1>
              <p className="max-w-4xl break-words text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            </div>

            <TenderSummaryStrip tender={tender} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="order-2 min-w-0 lg:order-1">
          <TenderDetailTabs tender={tender} />
        </section>

        <TenderActionColumn
          className="order-1 lg:order-2"
          documents={documents}
          tender={tender}
        />
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

function TenderSummaryStrip({ tender }: { tender: TenderDetail }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <SummaryItem label="Closing" value={formatDateTime(tender.closing_at)} />
      <SummaryItem label="Buyer" value={cleanValue(tender.buyer_name)} />
      <SummaryItem label="Province" value={cleanValue(tender.province)} />
    </dl>
  )
}

function TenderDetailTabs({ tender }: { tender: TenderDetail }) {
  return (
    <Tabs className="min-w-0 gap-5" defaultValue="bid">
      <div className="overflow-x-auto">
        <TabsList className="min-w-max" variant="line">
          <TabsTrigger value="bid">Bid</TabsTrigger>
          <TabsTrigger value="logistics">Logistics</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className="mt-0" value="bid">
        <div className="grid gap-6">
          <TenderSection title="Bid details">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailItem label="Type" value={cleanValue(tender.tender_type)} />
              <DetailItem
                label="Tender number"
                value={cleanValue(tender.tender_no)}
              />
              <DetailItem label="Department" value={cleanValue(tender.department)} />
              <DetailItem label="Industry" value={cleanValue(tender.industry)} />
              <DetailItem
                label="Procurement category"
                value={cleanValue(tender.procurement_category)}
              />
              <DetailItem
                label="Procurement method"
                value={cleanValue(tender.procurement_method_details)}
              />
            </dl>
          </TenderSection>

          <Separator />

          <TenderSection title="Dates">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailItem
                label="Opening date"
                value={formatDate(tender.opening_at)}
              />
              <DetailItem
                label="Closing date"
                value={formatDateTime(tender.closing_at)}
              />
              <DetailItem
                label="Published"
                value={formatDateTime(tender.published_at)}
              />
              <DetailItem
                label="Modified"
                value={formatDateTime(tender.modified_at)}
              />
            </dl>
          </TenderSection>

          <Separator />

          <TenderSection title="Conditions">
            <div className="flex flex-col gap-4">
              {tender.has_special_conditions ? (
                <Alert>
                  <AlertTitle>Special conditions supplied</AlertTitle>
                  <AlertDescription>
                    {cleanValue(tender.special_conditions)}
                  </AlertDescription>
                </Alert>
              ) : null}

              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <DetailItem
                  label="Special conditions"
                  value={cleanValue(tender.special_conditions)}
                />
                <DetailItem
                  label="Eligibility notes"
                  value={cleanValue(tender.eligibility_notes)}
                />
              </dl>
            </div>
          </TenderSection>
        </div>
      </TabsContent>

      <TabsContent className="mt-0" value="logistics">
        <div className="grid gap-6">
          <TenderSection title="Location">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailItem label="Place" value={cleanValue(tender.place_raw)} />
              <DetailItem
                label="Address"
                value={cleanValue(tender.address_line)}
              />
              <DetailItem label="Area" value={cleanValue(tender.suburb_or_area)} />
              <DetailItem label="City" value={cleanValue(tender.city)} />
              <DetailItem
                label="Postal code"
                value={cleanValue(tender.postal_code)}
              />
            </dl>
          </TenderSection>

          <Separator />

          <TenderSection title="Briefing">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailItem
                label="Status"
                value={
                  tender.briefing_session
                    ? "Session scheduled"
                    : "No briefing session"
                }
              />
              <DetailItem
                label="Compulsory"
                value={cleanValue(tender.compulsory_briefing)}
              />
              <DetailItem
                label="Date"
                value={formatDateTime(tender.briefing_datetime)}
              />
              <DetailItem label="Venue" value={cleanValue(tender.briefing_venue)} />
            </dl>
          </TenderSection>
        </div>
      </TabsContent>

      <TabsContent className="mt-0" value="contact">
        <TenderContact tender={tender} />
      </TabsContent>

      <TabsContent className="mt-0" value="source">
        <TenderSource tender={tender} />
      </TabsContent>
    </Tabs>
  )
}

function TenderActionColumn({
  className,
  documents,
  tender,
}: {
  className?: string
  documents: TenderDocument[]
  tender: TenderDetail
}) {
  return (
    <aside className={cn("min-w-0 lg:sticky lg:top-4", className)}>
      <TenderDocuments documents={documents} tender={tender} />
    </aside>
  )
}

function TenderContact({ tender }: { tender: TenderDetail }) {
  return (
    <div className="grid gap-6">
      <TenderSection title="Contact">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <DetailItem
            label="Contact person"
            value={cleanValue(tender.contact_person)}
          />
          <DetailItem
            label="Email"
            value={
              <EmailLink
                context="contact"
                email={tender.contact_email}
                tender={tender}
              />
            }
          />
          <DetailItem label="Telephone" value={cleanValue(tender.contact_tel)} />
          <DetailItem label="Role" value={cleanValue(tender.contact_role)} />
        </dl>
      </TenderSection>
    </div>
  )
}

function TenderSource({ tender }: { tender: TenderDetail }) {
  return (
    <div className="grid gap-6">
      <TenderSection title="Source">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <DetailItem
            label="Reference"
            value={cleanValue(tender.source_label || tender.source_site)}
          />
          <DetailItem label="Source site" value={cleanValue(tender.source_site)} />
          <DetailItem label="Release ID" value={cleanValue(tender.release_id)} />
          <DetailItem label="OCDS ID" value={cleanValue(tender.ocid)} />
          <DetailItem
            label="Imported"
            value={formatDateTime(tender.imported_at)}
          />
          <DetailItem
            label="Captured"
            value={formatDateTime(tender.captured_at)}
          />
          <DetailItem
            label="Documents"
            value={String(tender.documents_count || 0)}
          />
        </dl>
      </TenderSection>

      {tender.original_source_url ? (
        <>
          <Separator />
          <TenderSection title="Original record">
            <p className="text-sm text-muted-foreground">
              Open the source tender page on eTenders.
            </p>
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
                href={tender.original_source_url}
                rel="noreferrer"
                target="_blank"
              >
                <IconExternalLink data-icon="inline-start" />
                Original
              </a>
            </Button>
          </TenderSection>
        </>
      ) : null}
    </div>
  )
}

function TenderSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-base font-medium">{title}</h2>
      {children}
    </section>
  )
}

function SummaryItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium leading-5">
        {value}
      </dd>
    </div>
  )
}

function EmailLink({
  context,
  email,
  tender,
}: {
  context: string
  email?: string | null
  tender: TenderDetail
}) {
  if (!email) return "Not supplied"

  return (
    <a
      className="break-all underline underline-offset-4"
      data-umami-event="tender_contact_email_click"
      data-umami-event-context={context}
      data-umami-event-ocid={tender.ocid}
      href={`mailto:${email}`}
    >
      {email}
    </a>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm leading-5">{value}</dd>
    </div>
  )
}
