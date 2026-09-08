import { createPublicClient, hasSupabasePublicConfig } from "@/lib/supabase/server"
import {
  getIndustryRawValues,
  getTenderTypeRawValues,
} from "@/lib/tenders/filters"
import { LISTING_PAGE_SIZE } from "@/lib/tenders/navigation"
import type {
  ListingSearchParams,
  ListingSort,
  TenderDetail,
  TenderDocument,
  TenderListingItem,
  TenderSitemapItem,
} from "@/lib/tenders/types"

const LISTING_COLUMNS = [
  "ocid",
  "source_site",
  "detail_path",
  "tender_no",
  "tender_type",
  "department",
  "buyer_name",
  "title",
  "title_snippet",
  "bid_description",
  "province",
  "industry",
  "views_count",
  "published_at",
  "closing_at",
  "status",
  "derived_status",
  "is_new",
  "documents_count",
].join(",")

const DETAIL_COLUMNS = [
  LISTING_COLUMNS,
  "release_id",
  "tender_source_id",
  "source_listing_url",
  "detail_url",
  "listing_type",
  "procurement_category",
  "procurement_method",
  "procurement_method_details",
  "header_timestamp",
  "opening_at",
  "modified_at",
  "imported_at",
  "original_source_url",
  "source_label",
  "place_raw",
  "address_line",
  "suburb_or_area",
  "city",
  "postal_code",
  "delivery_location_confidence",
  "contact_person",
  "contact_email",
  "contact_tel",
  "contact_role",
  "contact_raw",
  "briefing_session",
  "compulsory_briefing",
  "briefing_datetime",
  "briefing_venue",
  "briefing_raw",
  "special_conditions",
  "has_special_conditions",
  "eligibility_notes",
  "captured_at",
].join(",")

const DOCUMENT_COLUMNS = [
  "id",
  "tender_ocid",
  "tender_no",
  "detail_url",
  "document_index",
  "document_title",
  "document_url",
  "file_name",
  "file_extension",
  "file_size_text",
  "file_size_kb",
  "document_source",
  "date_published",
  "date_modified",
  "downloaded_at",
  "document_hash",
].join(",")

const SITEMAP_COLUMNS = [
  "ocid",
  "detail_path",
  "published_at",
  "closing_at",
  "modified_at",
  "imported_at",
  "captured_at",
  "documents_count",
].join(",")

const SEARCH_COLUMNS = [
  "tender_no",
  "title",
  "bid_description",
  "buyer_name",
  "department",
  "industry",
  "province",
  "tender_type",
] as const

const SORT_CONFIG: Record<
  ListingSort,
  { column: "published_at" | "closing_at"; ascending: boolean }
> = {
  published_at_asc: { column: "published_at", ascending: true },
  published_at_desc: { column: "published_at", ascending: false },
  closing_at_asc: { column: "closing_at", ascending: true },
  closing_at_desc: { column: "closing_at", ascending: false },
}

export async function getTenderListing(params: ListingSearchParams) {
  if (!hasSupabasePublicConfig()) {
    return {
      items: [] as TenderListingItem[],
      totalCount: 0,
      pageCount: 0,
      configMissing: true,
    }
  }

  const page = params.page
  const from = (page - 1) * LISTING_PAGE_SIZE
  const to = from + LISTING_PAGE_SIZE - 1
  const supabase = createPublicClient()
  const availabilityCutoff = getAvailabilityCutoff()
  let query = supabase
    .from("tenders")
    .select(LISTING_COLUMNS, { count: "exact" })
    .eq("derived_status", "open")
    .gte("closing_at", availabilityCutoff)

  if (params.q) {
    const pattern = `%${params.q}%`
    query = query.or(
      SEARCH_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(",")
    )
  }

  if (params.region) {
    query = query.eq("province", params.region)
  }

  if (params.buyer) {
    query = query.ilike("buyer_name", `%${params.buyer}%`)
  }

  const industryRawValues = getIndustryRawValues(params.industry)
  if (industryRawValues?.length) {
    query = query.in("industry", industryRawValues)
  }

  const tenderTypeRawValues = getTenderTypeRawValues(params.tenderType)
  if (tenderTypeRawValues?.length) {
    query = query.in("tender_type", tenderTypeRawValues)
  }

  const sort = SORT_CONFIG[params.sort]
  const { data, error, count } = await query
    .order(sort.column, {
      ascending: sort.ascending,
      nullsFirst: false,
    })
    .order("ocid", { ascending: true })
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const totalCount = count || 0

  return {
    items: (data || []) as unknown as TenderListingItem[],
    totalCount,
    pageCount: Math.ceil(totalCount / LISTING_PAGE_SIZE),
    configMissing: false,
  }
}

export async function getTenderDetail(ocid: string) {
  if (!hasSupabasePublicConfig()) {
    return {
      tender: null,
      documents: [] as TenderDocument[],
      configMissing: true,
    }
  }

  const supabase = createPublicClient()
  const [{ data: tender, error }, { data: documents, error: documentsError }] =
    await Promise.all([
      supabase
        .from("tenders")
        .select(DETAIL_COLUMNS)
        .eq("ocid", ocid)
        .maybeSingle(),
      supabase
        .from("tender_documents")
        .select(DOCUMENT_COLUMNS)
        .eq("tender_ocid", ocid)
        .order("document_index", { ascending: true }),
    ])

  if (error) throw new Error(error.message)
  if (documentsError) throw new Error(documentsError.message)

  return {
    tender: tender as unknown as TenderDetail | null,
    documents: (documents || []) as unknown as TenderDocument[],
    configMissing: false,
  }
}

export async function getTenderSitemapItems(limit = 5000) {
  if (!hasSupabasePublicConfig()) return [] as TenderSitemapItem[]

  const supabase = createPublicClient()
  const availabilityCutoff = getAvailabilityCutoff()
  const { data, error } = await supabase
    .from("tenders")
    .select(SITEMAP_COLUMNS)
    .eq("derived_status", "open")
    .gte("closing_at", availabilityCutoff)
    .order("modified_at", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data || []) as unknown as TenderSitemapItem[]
}

export async function getLatestSuccessfulSyncRun() {
  if (!hasSupabasePublicConfig()) return null

  const supabase = createPublicClient()
  const { data } = await supabase
    .from("tender_sync_runs")
    .select("mode,status,completed_at,open_count,upserted_tender_count,message")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getRecentSyncRuns() {
  if (!hasSupabasePublicConfig()) return []

  const supabase = createPublicClient()
  const recentCutoff = new Date(Date.now() - 26 * 60 * 60 * 1_000).toISOString()
  const { data } = await supabase
    .from("tender_sync_runs")
    .select(
      "mode,status,date_from,date_to,completed_at,open_count,upserted_tender_count,message"
    )
    .in("status", ["completed", "failed"])
    .gte("completed_at", recentCutoff)
    .order("completed_at", { ascending: false })
    .limit(100)

  return data || []
}

function getAvailabilityCutoff() {
  return new Date().toISOString()
}
