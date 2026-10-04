// Runtime-neutral helpers used by both the manual importer and the Edge Function.
export type SourceRelease = { ocid?: string; id?: string; date?: string }
type JsonObject = Record<string, unknown>

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export async function fetchReleasePages<T extends SourceRelease>(options: {
  baseUrl: string
  dateFrom: string
  dateTo: string
  pageSize: number
  maxPages: number
  fetchJson: (url: URL) => Promise<unknown>
  onPage: (releases: T[], metadata: JsonObject, url: string) => Promise<void>
}): Promise<T[]> {
  const base = new URL(options.baseUrl)
  let url = new URL(base)
  url.searchParams.set("PageNumber", "1")
  url.searchParams.set("PageSize", String(options.pageSize))
  url.searchParams.set("dateFrom", options.dateFrom)
  url.searchParams.set("dateTo", options.dateTo)
  const visited = new Set<string>()
  const releases: T[] = []

  for (let page = 1; page <= options.maxPages; page++) {
    if (visited.has(url.href)) throw new Error("OCDS pagination repeated a URL")
    visited.add(url.href)
    const payload = await options.fetchJson(url)
    if (!object(payload) || !Array.isArray(payload.releases)) {
      throw new Error("Invalid OCDS response: expected releases array")
    }
    for (const release of payload.releases) {
      if (!object(release) || typeof release.ocid !== "string" || !release.ocid.trim()) {
        throw new Error("Invalid OCDS release: missing ocid")
      }
    }
    const { releases: pageReleases, ...metadata } = payload
    const items = pageReleases as T[]
    await options.onPage(items, metadata, url.href)
    releases.push(...items)
    if (payload.links != null && !object(payload.links)) {
      throw new Error("Invalid OCDS pagination links")
    }
    const next = object(payload.links) ? payload.links.next : null
    if (next == null || next === "") return releases
    if (typeof next !== "string") {
      throw new Error("Invalid OCDS next page")
    }
    const nextUrl = new URL(next, url)
    // Follow the supplied cursor, but never fetch arbitrary hosts or different windows.
    if (nextUrl.origin !== base.origin || nextUrl.pathname !== base.pathname ||
      nextUrl.username || nextUrl.password || nextUrl.hash ||
      ["dateFrom", "dateTo", "PageSize"].some(key => nextUrl.searchParams.get(key) !== url.searchParams.get(key))) {
      throw new Error("OCDS next page changed source or query window")
    }
    if (page === options.maxPages) throw new Error("OCDS page limit reached with more data available")
    url = nextUrl
  }
  throw new Error("Invalid OCDS page limit")
}

export function latestReleases<T extends SourceRelease>(releases: T[]): T[] {
  const latest = new Map<string, T>()
  for (const release of releases) {
    if (!release.ocid) throw new Error("Missing release ocid")
    const previous = latest.get(release.ocid)
    const time = (value?: string) => Date.parse(value || "") || 0
    if (!previous || time(release.date) >= time(previous.date)) latest.set(release.ocid, release)
  }
  return [...latest.values()]
}

// Key order is not a source change. Arrays keep their original order.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}

export async function sourceSnapshot(options: {
  ocid: string
  source: "ocds" | "portal"
  payload: unknown
  sourceUrl: string
  metadata?: JsonObject
  syncRunId: string
  capturedAt: string
}) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(options.payload)))
  return {
    tender_ocid: options.ocid,
    source: options.source,
    content_hash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join(""),
    payload: options.payload,
    source_url: options.sourceUrl,
    package_metadata: options.metadata || {},
    sync_run_id: options.syncRunId,
    captured_at: options.capturedAt,
  }
}

export async function fetchPortalPages<T extends { id?: number | string }>(options: {
  baseUrl: string
  pageSize: number
  maxPages: number
  fetchJson: (url: URL) => Promise<unknown>
}): Promise<Map<string, T>> {
  const result = new Map<string, T>()
  let start = 0
  for (let page = 0; page < options.maxPages; page++) {
    const url = new URL("/Home/PaginatedTenderOpportunities", options.baseUrl)
    url.search = new URLSearchParams({ draw: "1", start: String(start), length: String(options.pageSize), status: "1" }).toString()
    const payload = await options.fetchJson(url)
    const rows = Array.isArray(payload) ? payload : object(payload) ? payload.data : null
    if (!Array.isArray(rows)) throw new Error("Invalid portal response: expected data array")
    const total = object(payload) ? payload.recordsFiltered ?? payload.recordsTotal : undefined
    if (total !== undefined && (typeof total !== "number" || !Number.isInteger(total) || total < 0)) {
      throw new Error("Invalid portal pagination total")
    }
    const before = result.size
    for (const row of rows) {
      if (!object(row) || !["string", "number"].includes(typeof row.id) || !String(row.id).trim()) {
        throw new Error("Invalid portal tender id")
      }
      result.set(String(row.id), row as T)
    }
    start += rows.length
    if (typeof total === "number" ? result.size >= total : rows.length < options.pageSize) return result
    if (!rows.length || result.size === before) throw new Error("Portal pagination made no progress")
  }
  throw new Error("Portal page limit reached with more data available")
}

export function mergeDocuments<T extends { documentUrl: string | null }>(ocds: T[], portal: T[]): T[] {
  const documents = new Map<string, T>()
  for (const document of [...ocds, ...portal]) {
    if (!document.documentUrl) continue
    const url = new URL(document.documentUrl)
    // Portal and OCDS encode spaces differently in the same download URL.
    url.searchParams.sort()
    documents.set(url.href, document)
  }
  return [...documents.values()]
}

export async function fetchJsonWithRetry(url: URL, options: {
  attempts: number; timeoutMs: number; delayMs: number
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}): Promise<unknown> {
  const request = options.fetch || fetch
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)))
  let lastError: unknown = new Error("No fetch attempts configured")
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
    let retryable = true
    let waitMs = options.delayMs * attempt
    try {
      const response = await request(url, {
        headers: { accept: "application/json,text/plain" }, cache: "no-store", signal: controller.signal,
      })
      if (response.ok) return await response.json()
      retryable = response.status === 408 || response.status === 429 || response.status >= 500
      const retryAfter = response.headers.get("retry-after")
      if (retryAfter) {
        const seconds = Number(retryAfter)
        const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
        // Fail instead of violating a long Retry-After or sleeping beyond the worker lifetime.
        if (requested > 10_000) retryable = false
        else if (requested > 0) waitMs = Math.max(waitMs, requested)
      }
      throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timeout)
    }
    if (!retryable || attempt === options.attempts) break
    await sleep(waitMs)
  }
  throw lastError
}
