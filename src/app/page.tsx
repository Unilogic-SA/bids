import {
  AlertTriangleIcon,
  DatabaseIcon,
  FileSearchIcon,
} from "lucide-react"
import type { Metadata } from "next"

import {
  ListingFilterIsland,
  MobileListingControls,
} from "@/components/listing-filter-island"
import { TenderListItem } from "@/components/tender-list-item"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  buildListingHref,
  getLatestRecentFailedSyncRun,
  getLatestSyncRun,
  getLatestSuccessfulSyncRun,
  getTenderListing,
  parseListingSearchParams,
} from "@/lib/tenders/query"
import {
  absoluteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
  stringifyJsonLd,
} from "@/lib/seo"
import { TENDER_TYPE_FILTERS } from "@/lib/tenders/filters"
import { buildTenderPath } from "@/lib/tenders/format"
import type { TenderListingItem } from "@/lib/tenders/types"

export const dynamic = "force-dynamic"

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  searchParams,
}: HomeProps): Promise<Metadata> {
  const filters = parseListingSearchParams(await searchParams)
  const hasListingModifiers = countActiveListingFilters(filters) > 0 || filters.page > 1

  return {
    title: hasListingModifiers
      ? "Tender search results"
      : "South African public tenders",
    description: SITE_DESCRIPTION,
    alternates: {
      canonical: "/",
    },
    robots: hasListingModifiers
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
          },
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      title: `${SITE_NAME} - South African public tenders`,
      description: SITE_DESCRIPTION,
      url: "/",
      type: "website",
    },
  }
}

export default async function Home({ searchParams }: HomeProps) {
  const rawSearchParams = await searchParams
  const filters = parseListingSearchParams(rawSearchParams)
  const page = filters.page
  const [
    listing,
    latestSync,
    latestSuccessfulSync,
    latestRecentFailedSync,
  ] = await Promise.all([
    getTenderListing(filters),
    getLatestSyncRun(),
    getLatestSuccessfulSyncRun(),
    getLatestRecentFailedSyncRun(),
  ])
  const syncHealth = getSyncHealth(
    latestSync,
    latestSuccessfulSync,
    latestRecentFailedSync
  )
  const activeFilterCount = countActiveListingFilters(filters)
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en-ZA",
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(websiteJsonLd) }}
      />
      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 md:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        {listing.configMissing ? (
          <Alert className="lg:col-span-2">
            <DatabaseIcon />
            <AlertTitle>Tender data unavailable</AlertTitle>
            <AlertDescription>Supabase env vars are missing.</AlertDescription>
          </Alert>
        ) : null}

        {syncHealth ? (
          <Alert className="lg:col-span-2" variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>{syncHealth.title}</AlertTitle>
            <AlertDescription>{syncHealth.description}</AlertDescription>
          </Alert>
        ) : null}

        <div className="lg:hidden">
          <MobileListingControls filters={filters} />
        </div>

        <aside aria-label="Tender filters" className="hidden lg:block">
          <ListingFilterIsland filters={filters} />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2" aria-label="Tender results">
            {listing.items.length > 0 ? (
              listing.items.map((tender, index) => (
                <TenderListItem
                  key={tender.ocid}
                  analytics={{
                    activeFilterCount,
                    page,
                    position: index + 1,
                  }}
                  buyer={tender.buyer_name || tender.department}
                  closingDate={tender.closing_at}
                  detailUrl={tender.detail_path || buildTenderPath(tender.ocid)}
                  documentsCount={tender.documents_count}
                  industry={tender.industry}
                  isNew={tender.is_new}
                  procurementType={formatProcurementType(tender)}
                  province={tender.province}
                  tenderNumber={tender.tender_no}
                  title={
                    tender.bid_description || tender.title_snippet || tender.title
                  }
                />
              ))
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileSearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>No tenders found</EmptyTitle>
                  <EmptyDescription>
                    No open tenders match the current filters.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>

          {listing.pageCount > 1 ? (
            <TenderPagination
              currentPage={page}
              filters={filters}
              pageCount={listing.pageCount}
            />
          ) : null}
        </div>
      </main>
    </div>
  )
}

function formatProcurementType(tender: TenderListingItem) {
  const tenderType = tender.tender_type?.trim()
  if (!tenderType) return null

  return (
    TENDER_TYPE_FILTERS.find((option) =>
      option.rawValues.some((value) => value === tenderType)
    )?.label || tenderType
  )
}

function TenderPagination({
  currentPage,
  filters,
  pageCount,
}: {
  currentPage: number
  filters: ReturnType<typeof parseListingSearchParams>
  pageCount: number
}) {
  const pages = getVisiblePages(currentPage, pageCount)
  const activeFilterCount = countActiveListingFilters(filters)

  return (
    <Pagination>
      <PaginationContent>
        {currentPage > 1 ? (
          <PaginationItem>
            <PaginationPrevious
              data-umami-event="tender_listing_page_change"
              data-umami-event-active-filters={String(activeFilterCount)}
              data-umami-event-direction="previous"
              data-umami-event-from-page={String(currentPage)}
              data-umami-event-to-page={String(currentPage - 1)}
              href={buildListingHref(filters, { page: currentPage - 1 })}
            />
          </PaginationItem>
        ) : null}

        {pages[0] > 1 ? (
          <>
            <PaginationItem>
              <PaginationLink
                data-umami-event="tender_listing_page_change"
                data-umami-event-active-filters={String(activeFilterCount)}
                data-umami-event-direction="jump"
                data-umami-event-from-page={String(currentPage)}
                data-umami-event-to-page="1"
                href={buildListingHref(filters, { page: 1 })}
              >
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </>
        ) : null}

        {pages.map((pageNumber) => (
          <PaginationItem key={pageNumber}>
            <PaginationLink
              data-umami-event="tender_listing_page_change"
              data-umami-event-active-filters={String(activeFilterCount)}
              data-umami-event-direction={
                pageNumber > currentPage ? "forward" : "back"
              }
              data-umami-event-from-page={String(currentPage)}
              data-umami-event-to-page={String(pageNumber)}
              href={buildListingHref(filters, { page: pageNumber })}
              isActive={pageNumber === currentPage}
            >
              {pageNumber}
            </PaginationLink>
          </PaginationItem>
        ))}

        {pages[pages.length - 1] < pageCount ? (
          <>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                data-umami-event="tender_listing_page_change"
                data-umami-event-active-filters={String(activeFilterCount)}
                data-umami-event-direction="jump"
                data-umami-event-from-page={String(currentPage)}
                data-umami-event-to-page={String(pageCount)}
                href={buildListingHref(filters, { page: pageCount })}
              >
                {pageCount}
              </PaginationLink>
            </PaginationItem>
          </>
        ) : null}

        {currentPage < pageCount ? (
          <PaginationItem>
            <PaginationNext
              data-umami-event="tender_listing_page_change"
              data-umami-event-active-filters={String(activeFilterCount)}
              data-umami-event-direction="next"
              data-umami-event-from-page={String(currentPage)}
              data-umami-event-to-page={String(currentPage + 1)}
              href={buildListingHref(filters, { page: currentPage + 1 })}
            />
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  )
}

function getVisiblePages(currentPage: number, pageCount: number) {
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(pageCount, start + 4)
  const adjustedStart = Math.max(1, end - 4)

  return Array.from(
    { length: end - adjustedStart + 1 },
    (_, index) => adjustedStart + index
  )
}

function countActiveListingFilters(
  filters: ReturnType<typeof parseListingSearchParams>
) {
  return [
    filters.q,
    filters.region,
    filters.buyer,
    filters.industry,
    filters.tenderType,
  ].filter(Boolean).length
}

function getSyncHealth(
  latestSync: Awaited<ReturnType<typeof getLatestSyncRun>>,
  latestSuccessfulSync: Awaited<ReturnType<typeof getLatestSuccessfulSyncRun>>,
  latestRecentFailedSync: Awaited<
    ReturnType<typeof getLatestRecentFailedSyncRun>
  >
) {
  if (latestRecentFailedSync) {
    return {
      title: "A recent sync failed",
      description:
        "Tender data may be incomplete until the next full refresh completes.",
    }
  }

  if (latestSync?.status === "failed") {
    return {
      title: "Latest sync failed",
      description:
        "Tender data may be stale until the next successful refresh completes.",
    }
  }

  if (!latestSuccessfulSync?.completed_at) {
    return {
      title: "No successful sync yet",
      description: "Tender data has not completed its first refresh.",
    }
  }

  const ageMs =
    Date.now() - new Date(latestSuccessfulSync.completed_at).getTime()
  const staleAfterMs = 26 * 60 * 60 * 1_000

  if (ageMs > staleAfterMs) {
    return {
      title: "Tender data is stale",
      description:
        "The last successful refresh is more than 26 hours old.",
    }
  }

  return null
}
