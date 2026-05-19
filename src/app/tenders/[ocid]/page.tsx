import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  FileDownIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
            <ArrowLeftIcon data-icon="inline-start" />
            Tenders
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Tender data unavailable</CardTitle>
            <CardDescription>Supabase env vars are missing.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const status = formatTenderStatus(tender)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6">
          <Button asChild className="w-fit" size="sm" variant="ghost">
            <Link href="/">
              <ArrowLeftIcon data-icon="inline-start" />
              Tenders
            </Link>
          </Button>
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
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

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-6">
        <Tabs className="gap-5" defaultValue="details">
          <div className="flex flex-col gap-3">
            <TabsList
              className="max-w-full justify-start overflow-x-auto"
              variant="line"
            >
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger id="documents-tab" value="documents">
                Documents ({documents.length})
              </TabsTrigger>
              <TabsTrigger value="source">Source</TabsTrigger>
            </TabsList>
            <Separator />
          </div>

          <TabsContent className="mt-0" value="details">
            <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_1px_minmax(18rem,22rem)]">
              <div className="order-2 min-w-0 lg:order-1">
                <TenderDetailSections tender={tender} />
              </div>
              <Separator
                className="order-2 hidden lg:block"
                orientation="vertical"
              />
              <TenderActionSidebar
                documentsCount={documents.length}
                tender={tender}
              />
            </section>
          </TabsContent>

          <TabsContent value="documents">
            <TenderDocuments documents={documents} />
          </TabsContent>

          <TabsContent value="source">
            <TenderSource tender={tender} />
          </TabsContent>
        </Tabs>
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
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-medium">Tender details</h2>

      <TenderSection title="Bid">
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          <DetailItem label="Type" value={cleanValue(tender.tender_type)} />
          <DetailItem label="Tender number" value={cleanValue(tender.tender_no)} />
          <DetailItem label="Department" value={cleanValue(tender.department)} />
          <DetailItem label="Industry" value={cleanValue(tender.industry)} />
          <DetailItem
            label="Procurement category"
            value={cleanValue(tender.procurement_category)}
          />
        </dl>
      </TenderSection>

      <Separator />

      <TenderSection title="Dates">
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
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

      <TenderSection title="Location">
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          <DetailItem label="Place" value={cleanValue(tender.place_raw)} />
          <DetailItem label="Address" value={cleanValue(tender.address_line)} />
          <DetailItem label="Area" value={cleanValue(tender.suburb_or_area)} />
          <DetailItem label="City" value={cleanValue(tender.city)} />
          <DetailItem label="Postal code" value={cleanValue(tender.postal_code)} />
        </dl>
      </TenderSection>

      <Separator />

      <TenderSection title="Briefing">
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
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

      <Separator />

      <TenderSection title="Conditions">
        <dl className="flex flex-col gap-4">
          <DetailItem
            label="Status"
            value={
              tender.has_special_conditions
                ? "Special conditions supplied"
                : "None supplied"
            }
          />
          <DetailItem
            label="Special conditions"
            value={cleanValue(tender.special_conditions)}
          />
          <DetailItem
            label="Eligibility notes"
            value={cleanValue(tender.eligibility_notes)}
          />
        </dl>
      </TenderSection>
    </div>
  )
}

function TenderActionSidebar({
  documentsCount,
  tender,
}: {
  documentsCount: number
  tender: TenderDetail
}) {
  return (
    <aside className="order-1 flex min-w-0 flex-col gap-5 lg:order-3 lg:sticky lg:top-6 lg:self-start">
      <SidebarSection title="Contact">
        <div className="flex flex-col gap-3">
          <p className="break-words text-sm font-medium">
            {cleanValue(tender.contact_person)}
          </p>
          <dl className="flex flex-col gap-3">
            <DetailItem
              label="Email"
              value={<EmailLink email={tender.contact_email} />}
            />
            <DetailItem label="Telephone" value={cleanValue(tender.contact_tel)} />
            <DetailItem label="Role" value={cleanValue(tender.contact_role)} />
            <DetailItem label="Raw contact" value={cleanValue(tender.contact_raw)} />
          </dl>
        </div>
      </SidebarSection>

      <Separator />

      <SidebarSection title="Submission">
        <dl className="flex flex-col gap-3">
          <DetailItem
            label="Email"
            value={<EmailLink email={tender.contact_email} />}
          />
        </dl>
      </SidebarSection>

      <Separator />

      <SidebarSection title="Documents">
        <div className="flex flex-col items-start gap-3">
          <dl className="w-full">
            <DetailItem
              label="Linked documents"
              value={String(documentsCount)}
            />
          </dl>
          <Button asChild size="sm" variant="outline">
            <a href="#documents-tab">Documents tab</a>
          </Button>
        </div>
      </SidebarSection>

      <Separator />

      <SidebarSection title="Source">
        <div className="flex flex-col items-start gap-3">
          <dl className="w-full">
            <DetailItem
              label="Reference"
              value={cleanValue(tender.source_label || tender.source_site)}
            />
          </dl>
          {tender.original_source_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={tender.original_source_url} rel="noreferrer" target="_blank">
                <ExternalLinkIcon data-icon="inline-start" />
                Original
              </a>
            </Button>
          ) : null}
        </div>
      </SidebarSection>
    </aside>
  )
}

function TenderDocuments({ documents }: { documents: TenderDocument[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>{documents.length} linked document(s)</CardDescription>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>{document.document_index}</TableCell>
                  <TableCell className="min-w-80 whitespace-normal">
                    {document.document_title || document.file_name || "Document"}
                  </TableCell>
                  <TableCell>{cleanValue(document.file_extension)}</TableCell>
                  <TableCell>{cleanValue(document.file_size_text)}</TableCell>
                  <TableCell>{formatDate(document.date_published)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={document.document_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <FileDownIcon data-icon="inline-start" />
                        Open
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileDownIcon />
              </EmptyMedia>
              <EmptyTitle>No documents linked</EmptyTitle>
              <EmptyDescription>
                The source record does not include document links.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}

function TenderSource({ tender }: { tender: TenderDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source</CardTitle>
        <CardDescription>{cleanValue(tender.source_label)}</CardDescription>
        {tender.original_source_url ? (
          <CardAction>
            <Button asChild size="sm" variant="outline">
              <a href={tender.original_source_url} rel="noreferrer" target="_blank">
                <ExternalLinkIcon data-icon="inline-start" />
                Original
              </a>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 md:grid-cols-2">
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
      </CardContent>
    </Card>
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
    <section className="flex flex-col gap-3">
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
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  )
}

function EmailLink({ email }: { email?: string | null }) {
  if (!email) return "Not supplied"

  return (
    <a className="break-all underline underline-offset-4" href={`mailto:${email}`}>
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
      <dd className="mt-1 break-words text-sm leading-6">{value}</dd>
    </div>
  )
}
