import Link from "next/link"
import { notFound } from "next/navigation"
import { SeoBreadcrumbs } from "@/components/seo-breadcrumbs"
import { PublicFooter } from "@/components/public-footer"
import { TenderListItem } from "@/components/tender-list-item"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  findCollection,
  collectionPath,
  collectionPageHref,
  TENDER_COLLECTIONS,
} from "@/lib/tenders/directory"
import { getCollectionListing } from "@/lib/tenders/directory-query"
import { buildTenderPath } from "@/lib/tenders/format"
import { absoluteUrl, pageMetadata, stringifyJsonLd } from "@/lib/seo"

export type CollectionProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readPage(raw: string | string[] | undefined) {
  if (raw === undefined) return 1
  if (typeof raw !== "string" || !/^[1-9]\d{0,3}$/.test(raw) || Number(raw) > 4000) notFound()
  return Number(raw)
}

export async function collectionMetadata(kind: string, props: CollectionProps) {
  const { slug } = await props.params
  const collection = findCollection(kind, slug)
  if (!collection) notFound()
  const page = readPage((await props.searchParams).page)
  const listing = await getCollectionListing(kind, slug, page)
  if (page > 1 && page > listing.pageCount) notFound()
  return pageMetadata(
    `${collection.title}${page > 1 ? ` – Page ${page}` : ""}`,
    collection.description,
    collectionPageHref(collection, page)
  )
}

export async function TenderCollectionPage({ kind, ...props }: CollectionProps & { kind: string }) {
  const { slug } = await props.params
  const collection = findCollection(kind, slug)
  if (!collection) notFound()
  const page = readPage((await props.searchParams).page)
  const listing = await getCollectionListing(kind, slug, page)
  if (page > 1 && page > listing.pageCount) notFound()
  const path = collectionPath(collection)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl(collectionPageHref(collection, page)),
    name: collection.title,
    description: collection.description,
    url: absoluteUrl(collectionPageHref(collection, page)),
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: listing.items.map((tender, index) => ({
        "@type": "ListItem",
        position: (page - 1) * 12 + index + 1,
        url: absoluteUrl(tender.detail_path || buildTenderPath(tender.ocid)),
        name: tender.bid_description || tender.title_snippet || tender.title || tender.tender_no,
      })),
    },
  }
  const related = TENDER_COLLECTIONS.filter((item) => item.kind !== collection.kind).slice(0, 4)
  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 md:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
        />
        <SeoBreadcrumbs
          items={[
            { name: "Discover", path: "/" },
            { name: "Browse tenders", path: "/tenders" },
            { name: collection.name, path },
          ]}
        />
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{collection.title}</h1>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {collection.description}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {listing.totalCount.toLocaleString("en-ZA")}
              </span>{" "}
              open {listing.totalCount === 1 ? "notice" : "notices"}
              {collection.kind !== "buyer" ? ` · ${listing.buyerCount} buyers` : ""} · Closing
              soonest
            </p>
            <Button asChild size="sm" variant="outline">
              <Link
                href={
                  collection.province ? `/?region=${encodeURIComponent(collection.province)}` : "/"
                }
              >
                Search all tenders
              </Link>
            </Button>
          </div>
        </header>
        <section aria-label="Open tender notices" className="flex flex-col gap-3">
          {listing.items.length ? (
            listing.items.map((tender, index) => (
              <TenderListItem
                key={tender.ocid}
                detailUrl={tender.detail_path || buildTenderPath(tender.ocid)}
                title={tender.bid_description || tender.title_snippet || tender.title}
                buyer={tender.buyer_name || tender.department}
                province={tender.province}
                industry={tender.industry}
                tenderNumber={tender.tender_no}
                closingDate={tender.closing_at}
                documentsCount={tender.documents_count}
                analytics={{ activeFilterCount: 1, page, position: index + 1 }}
              />
            ))
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No current notices in this collection</EmptyTitle>
                <EmptyDescription>
                  New notices appear as the source is synchronized. Browse other collections or
                  search all open tenders.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
        {listing.pageCount > 1 ? (
          <Pagination>
            <PaginationContent>
              {page > 1 ? (
                <PaginationItem>
                  <PaginationPrevious href={collectionPageHref(collection, page - 1)} />
                </PaginationItem>
              ) : null}
              {Array.from(
                { length: Math.min(5, listing.pageCount) },
                (_, index) => Math.max(1, Math.min(page - 2, listing.pageCount - 4)) + index
              ).map((number) => (
                <PaginationItem key={number}>
                  <PaginationLink
                    href={collectionPageHref(collection, number)}
                    isActive={number === page}
                  >
                    {number}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {page < listing.pageCount ? (
                <PaginationItem>
                  <PaginationNext href={collectionPageHref(collection, page + 1)} />
                </PaginationItem>
              ) : null}
            </PaginationContent>
          </Pagination>
        ) : null}
        <section className="max-w-prose space-y-2 text-sm leading-6">
          <h2 className="font-semibold">Before you respond</h2>
          <p>{collection.guidance}</p>
          <p className="text-muted-foreground">
            OpenBids is independent of the buyer. The official tender documents and amendments
            control the requirements.{" "}
            <Link className="underline underline-offset-4" href="/about">
              Read about our sources and coverage
            </Link>
            .
          </p>
          {collection.officialUrl ? (
            <p>
              <a
                href={collection.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Visit {collection.name}’s official website
              </a>
            </p>
          ) : null}
          <p>
            <Link className="underline underline-offset-4" href="/guides/tender-response-checklist">
              Use the tender response checklist
            </Link>
          </p>
        </section>
        <nav aria-label="Related collections" className="flex flex-wrap gap-2">
          {related.map((item) => (
            <Button asChild size="sm" variant="ghost" key={collectionPath(item)}>
              <Link href={collectionPath(item)}>{item.name} tenders</Link>
            </Button>
          ))}
        </nav>
      </main>
      <PublicFooter />
    </>
  )
}
