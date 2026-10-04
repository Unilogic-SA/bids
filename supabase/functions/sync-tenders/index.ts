import {
  fetchReleasePages,
  fetchPortalPages,
  latestReleases,
  sourceSnapshot,
  mergeDocuments,
  fetchJsonWithRetry as fetchSourceJson
} from "../_shared/ingestion.ts"
import "jsr:@supabase/functions-js@2.117.1/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.105.4"

const ETENDERS_BASE_URL = "https://ocds-api.etenders.gov.za/api/OCDSReleases"
const ETENDERS_PORTAL_BASE_URL = "https://www.etenders.gov.za"
const DEFAULT_PAGE_SIZE = 20_000
const DEFAULT_PORTAL_PAGE_SIZE = 20_000
const DEFAULT_MAX_PAGES = 20
const DEFAULT_LOOKBACK_DAYS = 14
const RETRY_ATTEMPTS = 2
const RETRY_DELAY_MS = 1_000
const FETCH_TIMEOUT_MS = 30_000

type OcdsDocument = {
  id?: string
  documentType?: string
  title?: string
  description?: string
  url?: string
  downloadUrl?: string
  datePublished?: string
  dateModified?: string
  format?: string
  language?: string
}

type OcdsContact = {
  name?: string
  email?: string
  telephoneNumber?: string
  faxNumber?: string
}

type OcdsRelease = {
  ocid?: string
  id?: string
  date?: string
  tender?: {
    id?: string
    title?: string
    status?: string
    category?: string
    province?: string
    deliveryLocation?: string
    specialConditions?: string
    mainProcurementCategory?: string
    additionalProcurementCategories?: string[]
    description?: string
    eligibilityCriteria?: string
    documents?: OcdsDocument[]
    tenderPeriod?: {
      startDate?: string
      endDate?: string
      closingDate?: string
    }
    procuringEntity?: {
      id?: string
      name?: string
    }
    procurementMethod?: string
    procurementMethodDetails?: string
    briefingSession?: {
      isSession?: boolean
      compulsory?: boolean
      date?: string
      venue?: string
    }
    contactPerson?: OcdsContact
  }
  buyer?: {
    id?: string
    name?: string
  }
}

type PortalDocument = {
  supportDocumentID?: string
  fileName?: string
  extension?: string
  tendersID?: number
  active?: boolean
  dateModified?: string
}

type PortalTender = {
  id?: number | string
  supportDocument?: PortalDocument[] | null
  sd?: PortalDocument[] | null
}

type NormalizedDocument = {
  title: string | null
  description: string | null
  documentUrl: string | null
  fileName: string | null
  fileExtension: string | null
  datePublished: string | null
  dateModified: string | null
}

type SyncPayload = {
  mode?: "daily" | "range"
  days?: number
  pageSize?: number
  maxPages?: number
  dateFrom?: string
  dateTo?: string
}

type TenderUpsert = Record<string, unknown>
type DocumentUpsert = Record<string, unknown>

const supabaseUrl = mustGetEnv("SUPABASE_URL")
const anonKey = mustGetEnv("SUPABASE_ANON_KEY")

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    const syncSecret = readSyncSecret(request)
    const supabase = createSyncClient(syncSecret)
    const body = await readJsonBody(request)
    const result = await runTenderSync(supabase, body)
    return json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === "Unauthorized" ? 401 : 500
    return json({ error: message }, status)
  }
})

function readSyncSecret(request: Request) {
  const secret = request.headers.get("x-sync-secret")
  if (!secret) throw new Error("Unauthorized")
  return secret
}

function createSyncClient(syncSecret: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "x-sync-secret": syncSecret,
      },
    },
  })
}

async function runTenderSync(
  service: SupabaseClient,
  payload: SyncPayload
) {
  const startedAt = new Date()
  const pageSize = clampNumber(payload.pageSize, DEFAULT_PAGE_SIZE, 100, 20_000)
  const maxPages = clampNumber(payload.maxPages, DEFAULT_MAX_PAGES, 1, 100)
  const today = new Date()
  const window = resolveSyncWindow(payload, today)

  const { data: syncRun, error: syncRunError } = await service
    .from("tender_sync_runs")
    .insert({
      mode: window.mode,
      status: "running",
      date_from: window.dateFrom,
      date_to: window.dateTo,
      page_size: pageSize,
      started_at: startedAt.toISOString(),
      raw_summary: {
        ...window,
      },
    })
    .select("id")
    .single()

  if (syncRunError) throw new Error(syncRunError.message)

  try {
    const onPage = async (items: OcdsRelease[], metadata: Record<string, unknown>, url: string) => {
      // Archive every observed version before collapsing releases into the current catalog.
      for (let index = 0; index < items.length; index += 100) {
        await archiveSources(service, await Promise.all(items.slice(index, index + 100).map(release => sourceSnapshot({
          ocid: release.ocid!, source: "ocds", payload: release, sourceUrl: url,
          metadata, syncRunId: syncRun.id, capturedAt: startedAt.toISOString(),
        }))))
      }
    }
    const fetchedReleases = await fetchReleasePages<OcdsRelease>({
      baseUrl: ETENDERS_BASE_URL, fetchJson: fetchJsonWithRetry, onPage,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      pageSize,
      maxPages,
    })
    const releases = latestReleases(fetchedReleases)
    const portal = await fetchPortalTendersById()
    const portalTendersById = portal.tenders
    for (let index = 0; index < releases.length; index += 100) {
      const rows = await Promise.all(releases.slice(index, index + 100).flatMap(release => {
        const payload = portalTendersById.get(readTenderId(release) || "")
        return payload ? [sourceSnapshot({
          ocid: release.ocid!, source: "portal", payload,
          sourceUrl: new URL("/Home/PaginatedTenderOpportunities?status=1", ETENDERS_PORTAL_BASE_URL).href,
          syncRunId: syncRun.id, capturedAt: startedAt.toISOString(),
        })] : []
      }))
      await archiveSources(service, rows)
    }
    const tenders = releases.map((release) =>
      mapReleaseToTender(
        release,
        startedAt,
        portalTendersById.get(readTenderId(release) || "")
      )
    )
    const documents = releases.flatMap((release) =>
      mapReleaseToDocuments(
        release,
        startedAt,
        portalTendersById.get(readTenderId(release) || "")
      )
    )
    const releaseOcids = releases
      .map((release) => release.ocid)
      .filter((ocid): ocid is string => Boolean(ocid))
    const openCount = releases.filter((release) =>
      isReleaseOpen(release, startedAt)
    ).length

    await upsertInChunks(service, "tenders", tenders, "ocid", 500)
    for (let index = 0; index < releaseOcids.length; index += 100) {
      const ocids = releaseOcids.slice(index, index + 100)
      const selected = new Set(ocids)
      const { error } = await service.rpc("reconcile_tender_documents", {
        p_ocids: ocids,
        p_documents: documents.filter(document => selected.has(document.tender_ocid as string)),
        // The active portal does not cover closed or missing tenders: preserve their known documents.
        p_preserve_ocids: releases.filter(release => selected.has(release.ocid!) &&
          !portalTendersById.has(readTenderId(release) || "")).map(release => release.ocid),
        p_captured_at: startedAt.toISOString(),
      })
      if (error) throw new Error(error.message)
    }

    await markExpiredTenders(service, startedAt)

    const completedAt = new Date()
    const result = {
      status: "completed",
      fetchedCount: fetchedReleases.length,
      openCount,
      upsertedTenderCount: tenders.length,
      upsertedDocumentCount: documents.length,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      pageSize,
      maxPages,
      portalTenderCount: portalTendersById.size,
      warnings: portal.warning ? [portal.warning] : [],
      ...window,
    }

    const { error: completionError } = await service
      .from("tender_sync_runs")
      .update({
        status: "completed",
        fetched_count: fetchedReleases.length,
        open_count: openCount,
        upserted_tender_count: tenders.length,
        upserted_document_count: documents.length,
        completed_at: completedAt.toISOString(),
        raw_summary: result,
      })
      .eq("id", syncRun.id)

    if (completionError) throw new Error(completionError.message)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await service
      .from("tender_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        message,
      })
      .eq("id", syncRun.id)
    throw error
  }
}

async function fetchJsonWithRetry(url: URL): Promise<unknown> {
  return fetchSourceJson(url, { attempts: RETRY_ATTEMPTS, timeoutMs: FETCH_TIMEOUT_MS, delayMs: RETRY_DELAY_MS })
}

async function fetchPortalTendersById() {
  try {
    return { tenders: await fetchPortalPages<PortalTender>({
      baseUrl: ETENDERS_PORTAL_BASE_URL,
      pageSize: DEFAULT_PORTAL_PAGE_SIZE,
      maxPages: DEFAULT_MAX_PAGES,
      fetchJson: fetchJsonWithRetry,
    }), warning: null }
  } catch (error) {
    const warning = error instanceof Error ? error.message : String(error)
    console.warn("Unable to fetch eTenders portal: " + warning)
    return { tenders: new Map<string, PortalTender>(), warning }
  }
}

async function archiveSources(
  service: SupabaseClient,
  rows: Awaited<ReturnType<typeof sourceSnapshot>>[]
) {
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await service.from("tender_source_snapshots").upsert(rows.slice(index, index + 100), {
      onConflict: "tender_ocid,source,content_hash", ignoreDuplicates: true,
    })
    if (error) throw new Error(error.message)
  }
}

function mapReleaseToTender(
  release: OcdsRelease,
  capturedAt: Date,
  portalTender?: PortalTender
): TenderUpsert {
  const tender = release.tender || {}
  const buyerName = release.buyer?.name || tender.procuringEntity?.name || null
  const documents = collectTenderDocuments(release, portalTender)
  const closingAt = normalizeDate(
    tender.tenderPeriod?.endDate || tender.tenderPeriod?.closingDate
  )
  const openingAt = normalizeDate(tender.tenderPeriod?.startDate)
  const publishedAt = normalizeDate(release.date)
  const modifiedAt = latestDate([
    release.date,
    ...documents.map((document) => document.dateModified || undefined),
  ])
  const tenderNo = tender.title || tender.id || release.ocid || "Unknown"
  const description = cleanText(tender.description)
  const specialConditions = cleanText(tender.specialConditions)
  const eligibilityNotes = extractEligibilityNotes(
    specialConditions || tender.eligibilityCriteria || null
  )
  const location = parseDeliveryLocation(tender.deliveryLocation || null)
  const detailPath = release.ocid
    ? `/tenders/${encodeURIComponent(release.ocid)}`
    : null
  const briefing = tender.briefingSession || {}
  const briefingDate = normalizeDate(briefing.date)
  const sourceStatus = cleanText(tender.status)

  return {
    ocid: release.ocid,
    release_id: release.id || release.ocid,
    source_site: "eTenders",
    source_listing_url: null,
    detail_url: detailPath,
    detail_path: detailPath,
    listing_type: "all_tenders",
    is_new: isNewTender(publishedAt, capturedAt),
    tender_source_id: tender.id || null,
    tender_no: tenderNo,
    tender_type: tender.procurementMethodDetails || tender.procurementMethod || null,
    department: tender.procuringEntity?.name || buyerName,
    buyer_name: buyerName,
    title: tender.title || description?.slice(0, 160) || tenderNo,
    title_snippet: truncate(description || tender.title || tenderNo, 220),
    bid_description: description,
    province: cleanText(tender.province),
    industry:
      cleanText(tender.category) ||
      cleanText(tender.mainProcurementCategory) ||
      cleanText(tender.additionalProcurementCategories?.join(", ")),
    procurement_category:
      cleanText(tender.mainProcurementCategory) || cleanText(tender.category),
    procurement_method: cleanText(tender.procurementMethod),
    procurement_method_details: cleanText(tender.procurementMethodDetails),
    views_count: null,
    header_timestamp: publishedAt,
    published_at: publishedAt,
    opening_at: openingAt,
    closing_at: closingAt,
    modified_at: modifiedAt,
    status: sourceStatus,
    derived_status: deriveStatus(sourceStatus, closingAt, capturedAt),
    imported_at: capturedAt.toISOString(),
    original_source_url: null,
    source_label: "source: etenders.gov.za",
    place_raw: cleanText(tender.deliveryLocation),
    address_line: location.addressLine,
    suburb_or_area: location.suburbOrArea,
    city: location.city,
    postal_code: location.postalCode,
    delivery_location_confidence: location.confidence,
    contact_person: cleanText(tender.contactPerson?.name),
    contact_email: cleanText(tender.contactPerson?.email),
    contact_tel: cleanText(tender.contactPerson?.telephoneNumber),
    contact_role: null,
    contact_raw: buildContactRaw(tender.contactPerson),
    briefing_session: Boolean(briefing.isSession),
    compulsory_briefing: Boolean(briefing.compulsory),
    briefing_datetime: briefingDate,
    briefing_venue: cleanText(briefing.venue),
    briefing_raw: buildBriefingRaw(briefing),
    special_conditions: specialConditions,
    has_special_conditions: hasMeaningfulText(specialConditions),
    eligibility_notes: eligibilityNotes,
    raw_release: release,
    raw_tender: tender,
    captured_at: capturedAt.toISOString(),
  }
}

function mapReleaseToDocuments(
  release: OcdsRelease,
  capturedAt: Date,
  portalTender?: PortalTender
): DocumentUpsert[] {
  const tender = release.tender || {}
  const tenderNo = tender.title || tender.id || release.ocid || "Unknown"
  const detailPath = release.ocid
    ? `/tenders/${encodeURIComponent(release.ocid)}`
    : null
  const documents = collectTenderDocuments(release, portalTender)
  const rows: DocumentUpsert[] = []

  documents.forEach((document, index) => {
    if (!release.ocid || !document.documentUrl) return

    const fileName =
      document.fileName ||
      parseFileName(document.documentUrl, document.title || undefined)
    const fileExtension =
      document.fileExtension || fileName?.split(".").pop()?.toLowerCase() || null

    rows.push({
      tender_ocid: release.ocid,
      tender_no: tenderNo,
      detail_url: detailPath,
      document_index: index + 1,
      document_title: cleanText(document.title || document.description),
      document_url: document.documentUrl,
      file_name: fileName,
      file_extension: fileExtension,
      file_size_text: null,
      file_size_kb: null,
      document_source: parseHostname(document.documentUrl),
      date_published: normalizeDate(document.datePublished),
      date_modified: normalizeDate(document.dateModified),
      downloaded_at: null,
      document_hash: null,
      updated_at: capturedAt.toISOString(),
    })
  })

  return rows
}

function collectTenderDocuments(
  release: OcdsRelease,
  portalTender?: PortalTender
): NormalizedDocument[] {
  const portalDocuments = normalizePortalDocuments(portalTender)
  const ocdsDocuments = (release.tender?.documents || [])
    .map((document) => {
      const documentUrl = document.url || document.downloadUrl || null
      return {
        title: cleanText(document.title),
        description: cleanText(document.description),
        documentUrl,
        fileName: documentUrl ? parseFileName(documentUrl, document.title) : null,
        fileExtension: normalizeFileExtension(document.format),
        datePublished: normalizeDate(document.datePublished),
        dateModified: normalizeDate(document.dateModified),
      }
    })
    .filter((document) => Boolean(document.documentUrl))
  return mergeDocuments(ocdsDocuments, portalDocuments)
}

function normalizePortalDocuments(portalTender?: PortalTender) {
  const documents = portalTender?.supportDocument || portalTender?.sd || []
  const seenUrls = new Set<string>()
  const normalized: NormalizedDocument[] = []

  for (const document of documents) {
    if (document.active === false || !document.supportDocumentID) continue

    const fileName = cleanText(document.fileName) || "Document"
    const fileExtension = normalizeFileExtension(document.extension)
    const documentUrl = buildPortalDocumentUrl(
      document.supportDocumentID,
      fileExtension,
      fileName,
    )

    if (seenUrls.has(documentUrl)) continue
    seenUrls.add(documentUrl)

    normalized.push({
      title: fileName,
      description: fileName,
      documentUrl,
      fileName,
      fileExtension,
      datePublished: normalizeDate(document.dateModified),
      dateModified: normalizeDate(document.dateModified),
    })
  }

  return normalized
}

function buildPortalDocumentUrl(
  supportDocumentId: string,
  fileExtension: string | null,
  fileName: string,
) {
  const blobName = `${supportDocumentId}${fileExtension ? `.${fileExtension}` : ""}`
  const url = new URL("/home/Download", ETENDERS_PORTAL_BASE_URL)
  url.searchParams.set("blobName", blobName)
  url.searchParams.set("downloadedFileName", fileName)
  return url.toString()
}

function readTenderId(release: OcdsRelease) {
  return cleanText(release.tender?.id)
}

function isReleaseOpen(release: OcdsRelease, now: Date) {
  const tender = release.tender || {}
  const rawEnd = tender.tenderPeriod?.endDate || tender.tenderPeriod?.closingDate
  const status = (tender.status || "").toLowerCase()

  if (status && status !== "active" && status !== "open") {
    return false
  }

  if (!rawEnd) {
    return true
  }

  const closingAt = new Date(rawEnd)
  if (Number.isNaN(closingAt.getTime())) return true

  return closingAt.getTime() >= now.getTime()
}

async function upsertInChunks(
  service: SupabaseClient,
  table: "tenders" | "tender_documents",
  rows: TenderUpsert[] | DocumentUpsert[],
  onConflict: string,
  chunkSize: number
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    const { error } = await service.from(table).upsert(chunk, { onConflict })
    if (error) throw new Error(error.message)
  }
}

async function markExpiredTenders(
  service: SupabaseClient,
  now: Date
) {
  const { error } = await service
    .from("tenders")
    .update({ derived_status: "closed" })
    .lt("closing_at", now.toISOString())
    .neq("derived_status", "closed")

  if (error) throw new Error(error.message)
}

function parseDeliveryLocation(value: string | null) {
  const parts = (value || "")
    .split(/\s+-\s+/)
    .map((part) => cleanText(part))
    .filter((part): part is string => Boolean(part))

  if (!parts.length) {
    return {
      addressLine: null,
      suburbOrArea: null,
      city: null,
      postalCode: null,
      confidence: 0,
    }
  }

  const postalCode = parts[parts.length - 1]?.match(/^\d{4}$/)
  const trimmed = postalCode ? parts.slice(0, -1) : parts

  return {
    addressLine: trimmed[0] || null,
    suburbOrArea: trimmed[1] || null,
    city: trimmed[trimmed.length - 1] || null,
    postalCode: postalCode?.[0] || null,
    confidence: Math.min(1, trimmed.length / 4),
  }
}

function parseFileName(url: string, title?: string) {
  if (title) return title

  try {
    const parsed = new URL(url)
    return parsed.searchParams.get("downloadedFileName") || parsed.pathname.split("/").pop() || null
  } catch {
    return null
  }
}

function normalizeFileExtension(value?: string | null) {
  return cleanText(value)?.replace(/^\./, "").toLowerCase() || null
}

function parseHostname(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function buildContactRaw(contact?: OcdsContact) {
  if (!contact) return null
  return [contact.name, contact.email, contact.telephoneNumber]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" | ")
}

function buildBriefingRaw(briefing: {
  isSession?: boolean
  compulsory?: boolean
  date?: string
  venue?: string
}) {
  return [
    briefing.isSession ? "Yes" : "No",
    briefing.compulsory ? "Compulsory" : "Not compulsory",
    normalizeDate(briefing.date),
    cleanText(briefing.venue),
  ]
    .filter(Boolean)
    .join(" | ")
}

function extractEligibilityNotes(value: string | null) {
  if (!hasMeaningfulText(value)) return null
  return value
}

function deriveStatus(
  sourceStatus: string | null,
  closingAt: string | null,
  now: Date
) {
  const normalizedStatus = sourceStatus?.toLowerCase()
  if (normalizedStatus && !["active", "open"].includes(normalizedStatus)) {
    return "closed"
  }

  if (!closingAt) return "open"

  const closing = new Date(closingAt)
  if (closing.getTime() < now.getTime()) return "closed"

  const sastDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const sameSastDay = sastDate.format(closing) === sastDate.format(now)

  return sameSastDay ? "closing_today" : "open"
}

function latestDate(values: Array<string | undefined>) {
  const validDates = values
    .map((value) => normalizeDate(value))
    .filter((value): value is string => Boolean(value))

  if (!validDates.length) return null
  return validDates.sort().at(-1) || null
}

function normalizeDate(value?: string | null) {
  if (!value || value.startsWith("0001-01-01")) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function isNewTender(publishedAt: string | null, now: Date) {
  if (!publishedAt) return false
  const age = now.getTime() - new Date(publishedAt).getTime()
  return age >= 0 && age <= 48 * 60 * 60 * 1_000
}

function hasMeaningfulText(value: string | null | undefined) {
  const normalized = cleanText(value)?.toLowerCase()
  return Boolean(normalized && !["n/a", "na", "none"].includes(normalized))
}

function cleanText(value?: string | null) {
  if (!value) return null
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized || null
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Number(value)))
}

function resolveSyncWindow(payload: SyncPayload, today: Date) {
  if (payload.mode === "range" || payload.dateFrom || payload.dateTo) {
    const dateFrom = parseDateOnly(payload.dateFrom)
    const dateTo = parseDateOnly(payload.dateTo)

    if (!dateFrom || !dateTo) {
      throw new Error("Range sync requires valid dateFrom and dateTo values")
    }

    if (dateFrom > dateTo) {
      throw new Error("dateFrom must be on or before dateTo")
    }

    return {
      mode: "range" as const,
      dateFrom,
      dateTo,
    }
  }

  const days = clampNumber(payload.days, DEFAULT_LOOKBACK_DAYS, 1, 31)
  const from = new Date(today)
  from.setUTCDate(today.getUTCDate() - days)

  return {
    mode: "daily" as const,
    days,
    dateFrom: formatDateOnly(from),
    dateTo: formatDateOnly(today),
  }
}

function parseDateOnly(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return formatDateOnly(parsed) === value ? value : null
}

function formatDateOnly(date: Date) {
  return date.toISOString().split("T")[0]
}

async function readJsonBody(request: Request): Promise<SyncPayload> {
  try {
    return (await request.json()) as SyncPayload
  } catch {
    return {}
  }
}

function mustGetEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}
