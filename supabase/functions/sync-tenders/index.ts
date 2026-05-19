import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

const ETENDERS_BASE_URL = "https://ocds-api.etenders.gov.za/api/OCDSReleases"
const DEFAULT_PAGE_SIZE = 20_000
const DEFAULT_MAX_PAGES = 20
const DEFAULT_LOOKBACK_DAYS = 14
const RETRY_ATTEMPTS = 5
const RETRY_DELAY_MS = 3_000

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

type OcdsPayload = {
  releases?: OcdsRelease[]
  links?: {
    next?: string
  }
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
    const releases = await fetchAllReleasesForRange({
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      pageSize,
      maxPages,
    })
    const tenders = releases.map((release) =>
      mapReleaseToTender(release, startedAt)
    )
    const documents = releases.flatMap((release) =>
      mapReleaseToDocuments(release, startedAt)
    )
    const releaseOcids = releases
      .map((release) => release.ocid)
      .filter((ocid): ocid is string => Boolean(ocid))
    const openCount = releases.filter((release) =>
      isReleaseOpen(release, startedAt)
    ).length

    await upsertInChunks(service, "tenders", tenders, "ocid", 500)
    await deleteDocumentsInChunks(service, releaseOcids, 500)
    if (documents.length > 0) {
      await upsertInChunks(
        service,
        "tender_documents",
        documents,
        "tender_ocid,document_url",
        1_000
      )
    }
    await markExpiredTenders(service, startedAt)

    const completedAt = new Date()
    const result = {
      mode: window.mode,
      status: "completed",
      fetchedCount: releases.length,
      openCount,
      upsertedTenderCount: tenders.length,
      upsertedDocumentCount: documents.length,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      pageSize,
      maxPages,
      ...window,
    }

    await service
      .from("tender_sync_runs")
      .update({
        status: "completed",
        fetched_count: releases.length,
        open_count: openCount,
        upserted_tender_count: tenders.length,
        upserted_document_count: documents.length,
        completed_at: completedAt.toISOString(),
        raw_summary: result,
      })
      .eq("id", syncRun.id)

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

async function fetchAllReleasesForRange({
  dateFrom,
  dateTo,
  pageSize,
  maxPages,
}: {
  dateFrom: string
  dateTo: string
  pageSize: number
  maxPages: number
}) {
  const releases: OcdsRelease[] = []

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(ETENDERS_BASE_URL)
    url.searchParams.set("PageNumber", String(page))
    url.searchParams.set("PageSize", String(pageSize))
    url.searchParams.set("dateFrom", dateFrom)
    url.searchParams.set("dateTo", dateTo)

    const payload = await fetchJsonWithRetry(url)
    const pageReleases = Array.isArray(payload.releases)
      ? payload.releases
      : []

    releases.push(...pageReleases)
    if (!pageReleases.length || !payload.links?.next) break
  }

  return releases
}

async function fetchJsonWithRetry(url: URL): Promise<OcdsPayload> {
  let lastError: unknown

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json,text/plain",
        },
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
      }

      return (await response.json()) as OcdsPayload
    } catch (error) {
      lastError = error
      if (attempt < RETRY_ATTEMPTS) {
        await delay(RETRY_DELAY_MS * attempt)
      }
    }
  }

  throw lastError
}

function mapReleaseToTender(
  release: OcdsRelease,
  capturedAt: Date
): TenderUpsert {
  const tender = release.tender || {}
  const buyerName = release.buyer?.name || tender.procuringEntity?.name || null
  const documents = tender.documents || []
  const closingAt = normalizeDate(
    tender.tenderPeriod?.endDate || tender.tenderPeriod?.closingDate
  )
  const openingAt = normalizeDate(tender.tenderPeriod?.startDate)
  const publishedAt = normalizeDate(release.date)
  const modifiedAt = latestDate([
    release.date,
    ...documents.map((document) => document.dateModified),
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
    documents_count: documents.length,
    raw_release: release,
    raw_tender: tender,
    captured_at: capturedAt.toISOString(),
  }
}

function mapReleaseToDocuments(
  release: OcdsRelease,
  capturedAt: Date
): DocumentUpsert[] {
  const tender = release.tender || {}
  const tenderNo = tender.title || tender.id || release.ocid || "Unknown"
  const detailPath = release.ocid
    ? `/tenders/${encodeURIComponent(release.ocid)}`
    : null
  const documents = tender.documents || []
  const rows: DocumentUpsert[] = []

  documents.forEach((document, index) => {
    const documentUrl = document.url || document.downloadUrl
    if (!release.ocid || !documentUrl) return

    const fileName = parseFileName(documentUrl, document.title)
    const fileExtension =
      cleanText(document.format)?.toLowerCase() ||
      fileName?.split(".").pop()?.toLowerCase() ||
      null

    rows.push({
      tender_ocid: release.ocid,
      tender_no: tenderNo,
      detail_url: detailPath,
      document_index: index + 1,
      document_title: cleanText(document.title || document.description),
      document_url: documentUrl,
      file_name: fileName,
      file_extension: fileExtension,
      file_size_text: null,
      file_size_kb: null,
      document_source: parseHostname(documentUrl),
      date_published: normalizeDate(document.datePublished),
      date_modified: normalizeDate(document.dateModified),
      downloaded_at: null,
      document_hash: null,
      updated_at: capturedAt.toISOString(),
    })
  })

  return rows
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

async function deleteDocumentsInChunks(
  service: SupabaseClient,
  tenderOcids: string[],
  chunkSize: number
) {
  for (let index = 0; index < tenderOcids.length; index += chunkSize) {
    const chunk = tenderOcids.slice(index, index + chunkSize)
    const { error } = await service
      .from("tender_documents")
      .delete()
      .in("tender_ocid", chunk)

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
    return parsed.searchParams.get("downloadedFileName") || parsed.pathname.split("/").pop()
  } catch {
    return null
  }
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

  const sameUtcDay =
    closing.getUTCFullYear() === now.getUTCFullYear() &&
    closing.getUTCMonth() === now.getUTCMonth() &&
    closing.getUTCDate() === now.getUTCDate()

  return sameUtcDay ? "closing_today" : "open"
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
