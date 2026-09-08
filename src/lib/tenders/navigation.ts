import {
  DEFAULT_LISTING_SORT,
  isIndustryFilter,
  isListingSort,
  isRegion,
  isTenderTypeFilter,
} from "@/lib/tenders/filters"
import type { ListingSearchParams } from "@/lib/tenders/types"

export const LISTING_PAGE_SIZE = 12

export function parseListingSearchParams(
  input: Record<string, string | string[] | undefined>
): ListingSearchParams {
  const region = readParam(input.region)
  const industry = readParam(input.industry)
  const tenderType = readParam(input.type) || readParam(input.tender_type)
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
  appendParam(next, "type", merged.tenderType)
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

export function buildTenderDetailHref(
  detailPath: string,
  listingParams: ListingSearchParams,
  resultPosition: number
) {
  const returnTo = `${buildListingHref(listingParams)}#${buildTenderResultId(resultPosition)}`
  const separator = detailPath.includes("?") ? "&" : "?"

  return `${detailPath}${separator}from=${encodeURIComponent(returnTo)}`
}

export function buildTenderResultId(position: number) {
  return `tender-result-${position}`
}

export function parseListingReturnHref(value: string | string[] | undefined) {
  const returnTo = readParam(value)
  if (returnTo === "/") return returnTo
  if (!returnTo?.startsWith("/?") && !returnTo?.startsWith("/#")) return "/"

  const [pathAndQuery, hash] = returnTo.split("#", 2)
  const query = pathAndQuery === "/" ? "" : pathAndQuery.slice(2)
  const rawParams = Object.fromEntries(new URLSearchParams(query))
  const listingHref = buildListingHref(parseListingSearchParams(rawParams))

  if (!hash || !isTenderResultId(hash)) return listingHref

  return `${listingHref}#${hash}`
}

function isTenderResultId(value: string) {
  const match = /^tender-result-(\d+)$/.exec(value)
  if (!match) return false

  const position = Number(match[1])
  return position >= 1 && position <= LISTING_PAGE_SIZE
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
