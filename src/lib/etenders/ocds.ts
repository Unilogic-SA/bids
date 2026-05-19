import { createServiceClient } from "@/lib/supabase/server"
import { buildTenderPath } from "@/lib/tenders/format"

const ETENDERS_BASE_URL =
  process.env.ETENDERS_OCDS_URL ||
  "https://ocds-api.etenders.gov.za/api/OCDSReleases"

const DEFAULT_PAGE_SIZE = Number(process.env.ETENDERS_PAGE_SIZE || "20000")
const DEFAULT_MAX_PAGES = Number(process.env.ETENDERS_MAX_PAGES || "20")
const DEFAULT_BACKFILL_MONTHS = Number(
  process.env.ETENDERS_BACKFILL_MONTHS || "36"
)
const DEFAULT_DAILY_LOOKBACK_DAYS = Number(
  process.env.ETENDERS_DAILY_LOOKBACK_DAYS || "14"
)
const RETRY_ATTEMPTS = Number(process.env.ETENDERS_RETRY_ATTEMPTS || "5")
const RETRY_DELAY_MS = Number(process.env.ETENDERS_RETRY_DELAY_MS || "3000")

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
    prev?: string
  }
}

type SyncMode = "backfill" | "daily" | "range"

type SyncOptions = {
  mode?: SyncMode
  pageSize?: number
  maxPages?: number
  months?: number
  days?: number
  dateFrom?: string
  dateTo?: string
}

type TenderUpsert = Record<string, unknown>

type DocumentUpsert = Record<string, unknown>

export async function runTenderSync(options: SyncOptions = {}) {
  const startedAt = new Date()
  const mode = options.mode || "backfill"
  const pageSize = clampNumber(options.pageSize, DEFAULT_PAGE_SIZE, 100, 50000)
  const maxPages = clampNumber(options.maxPages, DEFAULT_MAX_PAGES, 1, 100)
  const service = createServiceClient()

  const windows = buildDateWindows(options)
  const firstWindow = windows[0]
  const lastWindow = windows[windows.length - 1]

  const { data: syncRun, error: syncRunError } = await service
    .from("tender_sync_runs")
    .insert({
      mode,
      status: "running",
      date_from: firstWindow?.dateFrom,
      date_to: lastWindow?.dateTo,
      page_size: pageSize,
      started_at: startedAt.toISOString(),
      raw_summary: {
        windows,
      },
    })
    .select("id")
    .single()

  if (syncRunError) {
    throw new Error(syncRunError.message)
  }

  try {
    const releasesByOcid = new Map<string, OcdsRelease>()
    const windowSummaries = []
    let fetchedCount = 0

    for (const window of windows) {
      const releases = await fetchAllReleasesForRange({
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
        pageSize,
        maxPages,
      })
      fetchedCount += releases.length
      windowSummaries.push({
        ...window,
        fetchedCount: releases.length,
      })

      for (const release of releases) {
        if (!release.ocid) continue
        releasesByOcid.set(release.ocid, release)
      }
    }

    const releases = Array.from(releasesByOcid.values())
    const tenders = releases.map((release) => mapReleaseToTender(release, startedAt))
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
        1000
      )
    }

    await markExpiredTenders(service, startedAt)

    const completedAt = new Date()
    const result = {
      mode,
      status: "completed",
      fetchedCount,
      openCount,
      upsertedTenderCount: tenders.length,
      upsertedDocumentCount: documents.length,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      pageSize,
      maxPages,
      windows: windowSummaries,
    }

    await service
      .from("tender_sync_runs")
      .update({
        status: "completed",
        fetched_count: fetchedCount,
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
        cache: "no-store",
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
  const detailPath = release.ocid ? buildTenderPath(release.ocid) : null
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
  const detailPath = release.ocid ? buildTenderPath(release.ocid) : null
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

function buildDateWindows(options: SyncOptions) {
  const today = new Date()

  if (options.mode === "range" && options.dateFrom && options.dateTo) {
    return [{ dateFrom: options.dateFrom, dateTo: options.dateTo }]
  }

  if (options.mode === "daily") {
    const from = new Date(today)
    from.setUTCDate(today.getUTCDate() - (options.days || DEFAULT_DAILY_LOOKBACK_DAYS))
    return [{ dateFrom: formatDateOnly(from), dateTo: formatDateOnly(today) }]
  }

  const months = clampNumber(
    options.months,
    DEFAULT_BACKFILL_MONTHS,
    1,
    120
  )
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  start.setUTCMonth(start.getUTCMonth() - months + 1)

  const windows: Array<{ dateFrom: string; dateTo: string }> = []
  const cursor = new Date(start)

  while (cursor <= today) {
    const windowStart = new Date(cursor)
    const windowEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)
    )
    if (windowEnd > today) windowEnd.setTime(today.getTime())

    windows.push({
      dateFrom: formatDateOnly(windowStart),
      dateTo: formatDateOnly(windowEnd),
    })

    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    cursor.setUTCDate(1)
  }

  return windows
}

async function upsertInChunks(
  service: ReturnType<typeof createServiceClient>,
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
  service: ReturnType<typeof createServiceClient>,
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
  service: ReturnType<typeof createServiceClient>,
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
    ? parts.pop() || null
    : null
  const city = parts.length > 0 ? parts.pop() || null : null
  const suburbOrArea = parts.length > 0 ? parts.pop() || null : null
  const addressLine = parts.length > 0 ? parts.join(" - ") : null
  const confidence = Number(
    Math.min(
      1,
      0.25 +
        (addressLine ? 0.25 : 0) +
        (suburbOrArea ? 0.15 : 0) +
        (city ? 0.2 : 0) +
        (postalCode ? 0.15 : 0)
    ).toFixed(2)
  )

  return {
    addressLine,
    suburbOrArea,
    city,
    postalCode,
    confidence,
  }
}

function buildContactRaw(contact?: OcdsContact) {
  if (!contact) return null

  return [
    cleanText(contact.name),
    cleanText(contact.email),
    cleanText(contact.telephoneNumber),
    cleanText(contact.faxNumber),
  ]
    .filter(Boolean)
    .join(" | ")
}

function buildBriefingRaw(briefing: NonNullable<OcdsRelease["tender"]>["briefingSession"]) {
  if (!briefing) return null

  return [
    `Session: ${briefing.isSession ? "Yes" : "No"}`,
    `Compulsory: ${briefing.compulsory ? "Yes" : "No"}`,
    normalizeDate(briefing.date),
    cleanText(briefing.venue),
  ]
    .filter(Boolean)
    .join(" | ")
}

function extractEligibilityNotes(value: string | null) {
  if (!value) return null
  const normalized = value.toLowerCase()
  const markers = ["eligible", "eligibility", "accredited", "sita", "cidb", "grading"]

  if (markers.some((marker) => normalized.includes(marker))) {
    return value
  }

  return null
}

function hasMeaningfulText(value: string | null) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return !["n/a", "na", "none", "no", "-", "not applicable"].includes(normalized)
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
  if (Number.isNaN(closing.getTime())) return "open"
  if (closing.getTime() < now.getTime()) return "closed"
  if (closing.toDateString() === now.toDateString()) return "closing_today"
  return "open"
}

function isNewTender(value: string | null, now: Date) {
  if (!value) return false
  const published = new Date(value)
  if (Number.isNaN(published.getTime())) return false
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  return now.getTime() - published.getTime() <= threeDaysMs
}

function latestDate(values: Array<string | undefined>) {
  const latest = values
    .map((value) => normalizeDate(value))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

  return latest || null
}

function normalizeDate(value?: string) {
  if (!value || value.startsWith("0001-01-01")) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function cleanText(value?: string | null) {
  if (!value) return null
  const cleaned = value.replace(/\s+/g, " ").trim()
  return cleaned || null
}

function truncate(value: string, length: number) {
  if (value.length <= length) return value
  return `${value.slice(0, length - 1).trim()}...`
}

function parseFileName(documentUrl: string, title?: string) {
  try {
    const url = new URL(documentUrl)
    const downloadedName = url.searchParams.get("downloadedFileName")
    if (downloadedName) return decodeURIComponent(downloadedName)
  } catch {
    return cleanText(title)
  }

  return cleanText(title)
}

function parseHostname(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value || fallback)))
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
