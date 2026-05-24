import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import {
  IconArrowLeft,
  IconExternalLink,
  IconFileDownload,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  cleanValue,
  formatDate,
  formatDateTime,
  formatTenderStatus,
  statusLabel,
} from "@/lib/tenders/format"
import { getTenderDetail } from "@/lib/tenders/query"
import type { TenderDetail, TenderDocument } from "@/lib/tenders/types"

export const dynamic = "force-dynamic"

type TenderPageProps = {
  params: Promise<{ ocid: string }>
}

export default async function TenderPage({ params }: TenderPageProps) {
  const { ocid } = await params
  const { tender, documents, configMissing } = await getTenderDetail(
    decodeURIComponent(ocid)
  )

  if (!tender && !configMissing) notFound()

  if (!tender) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
        <Button asChild className="w-fit" variant="outline">
          <Link href="/">
            <IconArrowLeft data-icon="inline-start" />
            Tenders
          </Link>
        </Button>
        <section className="flex flex-col gap-2 border-l-2 border-primary pl-4">
          <h1 className="text-lg font-medium">Tender data unavailable</h1>
          <p className="text-sm text-muted-foreground">
            Supabase env vars are missing.
          </p>
        </section>
      </main>
    )
  }

  const status = formatTenderStatus(tender)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
          <Button asChild className="w-fit" size="sm" variant="ghost">
            <Link href="/">
              <IconArrowLeft data-icon="inline-start" />
              Tenders
            </Link>
          </Button>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-normal md:text-[1.7rem]">
                {tender.tender_no || "Tender"}
              </h1>
              <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                {tender.bid_description || tender.title || "No description supplied"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
            <TenderSummaryStrip tender={tender} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-4 md:px-6 lg:min-h-[34rem] lg:grid-cols-[minmax(0,1.15fr)_1px_minmax(17rem,0.78fr)_1px_minmax(18rem,0.86fr)]">
        <section className="min-w-0">
          <TenderDetailSections tender={tender} />
        </section>

        <Separator className="hidden lg:block" orientation="vertical" />

        <section className="min-w-0">
          <TenderLogistics tender={tender} />
        </section>

        <Separator className="hidden lg:block" orientation="vertical" />

        <TenderActionColumn documents={documents} tender={tender} />
      </main>
    </div>
  )
}

function TenderSummaryStrip({ tender }: { tender: TenderDetail }) {
  return (
    <dl className="flex flex-col gap-2 text-sm md:flex-row md:flex-wrap md:gap-0">
      <SummaryItem label="Closing" value={formatDateTime(tender.closing_at)} />
      <SummaryItem label="Province" value={cleanValue(tender.province)} />
      <SummaryItem label="Buyer" value={cleanValue(tender.buyer_name)} />
    </dl>
  )
}

function TenderDetailSections({ tender }: { tender: TenderDetail }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-3">
      <h2 className="text-base font-medium">Tender details</h2>

      <TenderSection title="Bid">
        <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          <DetailItem label="Type" value={cleanValue(tender.tender_type)} />
          <DetailItem label="Tender number" value={cleanValue(tender.tender_no)} />
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
        <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          <DetailItem label="Opening date" value={formatDate(tender.opening_at)} />
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
        <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          <DetailItem
            label="Status"
            value={
              tender.has_special_conditions
                ? "Special conditions supplied"
                : "None supplied"
            }
          />
          <DetailItem
            label="Eligibility notes"
            value={cleanValue(tender.eligibility_notes)}
          />
          <DetailItem
            label="Special conditions"
            value={cleanValue(tender.special_conditions)}
          />
        </dl>
      </TenderSection>
    </div>
  )
}

function TenderLogistics({ tender }: { tender: TenderDetail }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-3">
      <h2 className="text-base font-medium">Logistics</h2>

      <TenderSection title="Location">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
          <DetailItem label="Place" value={cleanValue(tender.place_raw)} />
          <DetailItem label="Address" value={cleanValue(tender.address_line)} />
          <DetailItem label="Area" value={cleanValue(tender.suburb_or_area)} />
          <DetailItem label="City" value={cleanValue(tender.city)} />
          <DetailItem label="Postal code" value={cleanValue(tender.postal_code)} />
        </dl>
      </TenderSection>

      <Separator />

      <TenderSection title="Briefing">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
          <DetailItem
            label="Status"
            value={
              tender.briefing_session ? "Session scheduled" : "No briefing session"
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
  )
}

function TenderActionColumn({
  documents,
  tender,
}: {
  documents: TenderDocument[]
  tender: TenderDetail
}) {
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <SidebarSection title="Contact">
        <div className="flex flex-col gap-2">
          <p className="break-words text-sm font-medium">
            {cleanValue(tender.contact_person)}
          </p>
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
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
            <DetailItem label="Raw contact" value={cleanValue(tender.contact_raw)} />
          </dl>
        </div>
      </SidebarSection>

      <Separator />

      <SidebarSection title="Submission">
        <DetailItem
          label="Email"
          value={
            <EmailLink
              context="submission"
              email={tender.contact_email}
              tender={tender}
            />
          }
        />
      </SidebarSection>

      <Separator />

      <TenderDocuments documents={documents} tender={tender} />

      <Separator />

      <TenderSource tender={tender} />
    </aside>
  )
}

function TenderDocuments({
  documents,
  tender,
}: {
  documents: TenderDocument[]
  tender: TenderDetail
}) {
  return (
    <SidebarSection title={`Documents (${documents.length})`}>
      {documents.length > 0 ? (
        <div className="flex flex-col gap-3">
          {documents.map((document) => (
            <div
              className="grid min-w-0 gap-2 border-l-2 border-primary/30 pl-3"
              key={document.id}
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">
                  {document.document_title || document.file_name || "Document"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    cleanValue(document.file_extension),
                    cleanValue(document.file_size_text),
                    formatDate(document.date_published),
                  ].join(" / ")}
                </p>
              </div>
              <Button asChild className="w-fit" size="sm">
                <a
                  data-umami-event="tender_document_open"
                  data-umami-event-extension={document.file_extension || "unknown"}
                  data-umami-event-index={String(document.document_index)}
                  data-umami-event-ocid={tender.ocid}
                  data-umami-event-source={document.document_source || "unknown"}
                  href={document.document_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <IconFileDownload data-icon="inline-start" />
                  Open document
                </a>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The source record does not include document links.
        </p>
      )}
    </SidebarSection>
  )
}

function TenderSource({ tender }: { tender: TenderDetail }) {
  return (
    <SidebarSection title="Source">
      <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
        <DetailItem
          label="Reference"
          value={cleanValue(tender.source_label || tender.source_site)}
        />
        <DetailItem label="Source site" value={cleanValue(tender.source_site)} />
        <DetailItem label="Release ID" value={cleanValue(tender.release_id)} />
        <DetailItem label="OCDS ID" value={cleanValue(tender.ocid)} />
        <DetailItem label="Imported" value={formatDateTime(tender.imported_at)} />
        <DetailItem label="Captured" value={formatDateTime(tender.captured_at)} />
        <DetailItem
          label="Documents"
          value={String(tender.documents_count || 0)}
        />
      </dl>
      {tender.original_source_url ? (
        <Button asChild className="w-fit" size="sm" variant="outline">
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
      ) : null}
    </SidebarSection>
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
    <div className="flex min-w-0 gap-1.5 md:border-l md:first:border-l-0 md:first:pl-0 md:pl-4 md:pr-4">
      <dt className="shrink-0 font-medium">{label}:</dt>
      <dd className="min-w-0 break-words text-muted-foreground">{value}</dd>
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
    <section className="flex flex-col gap-3 lg:gap-2.5">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

function SidebarSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="flex flex-col gap-3 lg:gap-2.5">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
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
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm leading-5">{value}</dd>
    </div>
  )
}
