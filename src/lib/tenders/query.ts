import { createPublicClient, hasSupabasePublicConfig } from "@/lib/supabase/server"
import {
  DEFAULT_LISTING_SORT,
  getIndustryRawValues,
  getTenderTypeRawValues,
  isIndustryFilter,
  isListingSort,
  isRegion,
  isTenderTypeFilter,
} from "@/lib/tenders/filters"
import type {
  ListingSearchParams,
  ListingSort,
  TenderDetail,
  TenderDocument,
  TenderListingItem,
} from "@/lib/tenders/types"

export const LISTING_PAGE_SIZE = 12

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

const SEARCH_COLUMNS = [
  "tender_no",
  "bid_description",
  "buyer_name",
  "industry",
  "province",
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

export function parseListingSearchParams(
  input: Record<string, string | string[] | undefined>
): ListingSearchParams {
  const region = readParam(input.region)
  const industry = readParam(input.industry)
  const tenderType = readParam(input.tender_type)
  const sort = readParam(input.sort)

  return {
    q: sanitizeFreeText(readParam(input.q)),
    region: isRegion(region) ? region : undefined,
    buyer: sanitizeFreeText(readParam(input.buyer)),
    industry: isIndustryFilter(industry) ? industry : undefined,
    tenderType: isTenderTypeFilter(tenderType) ? tenderType : undefined,
    sort: isListingSort(sort) ? sort : DEFAULT_LISTING_SORT,
    page: parsePage(readParam(input.page)),
  }
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
    query = query.in("procurement_method_details", tenderTypeRawValues)
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
  const availabilityCutoff = getAvailabilityCutoff()
  const [{ data: tender, error }, { data: documents, error: documentsError }] =
    await Promise.all([
      supabase
        .from("tenders")
        .select(DETAIL_COLUMNS)
        .eq("ocid", ocid)
        .eq("derived_status", "open")
        .gte("closing_at", availabilityCutoff)
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

export async function getLatestSyncRun() {
  if (!hasSupabasePublicConfig()) return null

  const supabase = createPublicClient()
  const { data } = await supabase
    .from("tender_sync_runs")
    .select("mode,status,completed_at,open_count,upserted_tender_count,message")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getLatestSuccessfulSyncRun() {
  if (!hasSupabasePublicConfig()) return null

  const supabase = createPublicClient()
  const { data } = await supabase
    .from("tender_sync_runs")
    .select("mode,status,completed_at,open_count,upserted_tender_count,message")
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getLatestRecentFailedSyncRun() {
  if (!hasSupabasePublicConfig()) return null

  const supabase = createPublicClient()
  const recentCutoff = new Date(Date.now() - 26 * 60 * 60 * 1_000).toISOString()
  const { data } = await supabase
    .from("tender_sync_runs")
    .select("mode,status,completed_at,open_count,upserted_tender_count,message")
    .eq("status", "failed")
    .gte("completed_at", recentCutoff)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export function buildListingHref(
  params: ListingSearchParams,
  patch: Partial<ListingSearchParams> = {}
) {
  const next = new URLSearchParams()
  const merged = { ...params, ...patch }

  appendParam(next, "q", merged.q)
  appendParam(next, "region", merged.region)
  appendParam(next, "buyer", merged.buyer)
  appendParam(next, "industry", merged.industry)
  appendParam(next, "tender_type", merged.tenderType)
  appendParam(
    next,
    "sort",
    merged.sort !== DEFAULT_LISTING_SORT ? merged.sort : undefined
  )
  appendParam(
    next,
    "page",
    merged.page && merged.page > 1 ? String(merged.page) : undefined
  )

  const query = next.toString()
  return query ? `/?${query}` : "/"
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || undefined
  return value || undefined
}

function parsePage(value?: string) {
  const page = Number(value || "1")
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.floor(page)
}

function getAvailabilityCutoff() {
  return new Date().toISOString()
}

function sanitizeFreeText(value?: string) {
  return value?.replace(/[%*,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || undefined
}

function appendParam(
  params: URLSearchParams,
  key: string,
  value?: string | number
) {
  if (value === undefined || value === null || value === "") return
  params.set(key, String(value))
}
