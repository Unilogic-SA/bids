import { TENDER_COLLECTIONS, collectionPath } from "@/lib/tenders/directory"

const publicCollectionPaths = new Set([
  "/tenders",
  "/guides",
  "/guides/tender-response-checklist",
  "/guides/reading-a-tender-notice",
  "/guides/rfq-vs-rfp",
  "/guides/closing-dates-and-briefings",
  ...TENDER_COLLECTIONS.map(collectionPath),
])

// Only public discovery and tender pages participate in campaign measurement.
export function isMeasurementPage(pathname: string) {
  return (
    publicCollectionPaths.has(pathname) ||
    pathname === "/" ||
    /^\/tenders\/[^/]+\/?$/.test(pathname)
  )
}

export function googleMeasurementId(value: string | undefined) {
  return value && /^G-[A-Z0-9]+$/.test(value) ? value : null
}

export function isMeasurementHost(hostname: string) {
  return hostname === "www.openbid.co.za" || hostname === "openbid.co.za"
}

export function analyticsAllowed() {
  return (
    typeof window !== "undefined" &&
    isMeasurementHost(window.location.hostname) &&
    analyticsChoice() === "allowed"
  )
}

const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content"] as const
const campaignStorageKey = "openbids_campaign"
const consentStorageKey = "openbids_google_analytics_v1"
export type AnalyticsChoice = "allowed" | "declined" | null
let temporaryChoice: AnalyticsChoice = null

export function analyticsChoice(): AnalyticsChoice {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(consentStorageKey)
    return value === "allowed" || value === "declined" ? value : temporaryChoice
  } catch {
    return temporaryChoice
  }
}

export function setAnalyticsChoice(choice: Exclude<AnalyticsChoice, null>) {
  temporaryChoice = choice
  try {
    window.localStorage.setItem(consentStorageKey, choice)
  } catch {
    /* Keep the choice for this tab if storage is blocked. */
  }
  window.dispatchEvent(new Event("openbids-analytics-choice"))
}

export function subscribeAnalyticsChoice(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener("openbids-analytics-choice", callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener("openbids-analytics-choice", callback)
  }
}

export type MeasurementContext = { location: string; referrer: string; path: string }
const eventFields = new Set([
  "active_filters",
  "buyer_present",
  "query_length",
  "query_present",
  "surface",
  "documents_count",
  "has_closing_date",
  "is_new",
  "page",
  "position",
  "extension",
  "index",
  "source",
  "location",
  "panel",
  "direction",
  "from_page",
  "to_page",
  "context",
  "ocid",
])

type EventData = Record<string, string | number | boolean | null | undefined>
type GoogleCommand = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GoogleCommand
    openbidsMeasurementContext?: MeasurementContext
  }
}

export function safeGoogleEventData(data: EventData) {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) =>
        eventFields.has(key) &&
        value !== undefined &&
        value !== null &&
        (typeof value !== "string" || /^[a-zA-Z0-9_. /-]{1,100}$/.test(value))
    )
  )
}

export function campaignAttribution(url: URL) {
  return Object.fromEntries(
    campaignKeys.flatMap((key) => {
      const value = url.searchParams.get(key)
      return value && /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? [[key, value]] : []
    })
  ) as Record<string, string>
}

export function rememberCampaign(url: URL) {
  const campaign = campaignAttribution(url)
  if (Object.keys(campaign).length) {
    try {
      window.sessionStorage.setItem(campaignStorageKey, JSON.stringify(campaign))
    } catch {
      /* Storage may be unavailable. */
    }
  }
  return campaign
}

export function currentCampaign() {
  if (typeof window === "undefined") return {}
  const campaign = rememberCampaign(new URL(window.location.href))
  if (Object.keys(campaign).length) return campaign
  try {
    const saved: Record<string, unknown> = JSON.parse(
      window.sessionStorage.getItem(campaignStorageKey) || "{}"
    )
    const url = new URL(window.location.origin)
    for (const key of campaignKeys)
      if (typeof saved?.[key] === "string") url.searchParams.set(key, saved[key])
    return campaignAttribution(url)
  } catch {
    return {}
  }
}

export function measurementUrl(url: URL) {
  // The dynamic segment is user-controlled even when it results in a 404.
  // Use a generic tender path instead of exporting arbitrary IDs or encoded text.
  const clean = new URL(
    url.pathname === "/" || publicCollectionPaths.has(url.pathname)
      ? url.pathname
      : "/tenders/detail",
    url.origin
  )
  // Keep attribution and Google's click IDs, never search text, buyer or auth parameters.
  for (const [key, value] of Object.entries(campaignAttribution(url)))
    clean.searchParams.set(key, value)
  for (const key of ["gclid", "gbraid", "wbraid"]) {
    const value = url.searchParams.get(key)
    if (value && /^[a-zA-Z0-9_-]{1,250}$/.test(value)) clean.searchParams.set(key, value)
  }
  return clean.href
}

export function measurementReferrer(value: string) {
  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return ""
  }
}

export function nextMeasurementContext(
  url: URL,
  previous: MeasurementContext | undefined,
  referrer: string
): MeasurementContext {
  const location = measurementUrl(url)
  return {
    location,
    path: url.pathname,
    referrer:
      previous?.path === url.pathname
        ? previous.referrer
        : previous?.location || measurementReferrer(referrer),
  }
}

export function trackGoogleEvent(eventName: string, data: EventData = {}) {
  const id = googleMeasurementId(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID)
  if (
    !id ||
    typeof window === "undefined" ||
    !analyticsAllowed() ||
    !isMeasurementPage(window.location.pathname)
  )
    return
  // Existing tender events only. Do not forward arbitrary account events to Google.
  if (!/^tender_[a-z_]+$/.test(eventName)) return
  window.gtag?.("event", eventName, {
    ...safeGoogleEventData(data),
    ...currentCampaign(),
    send_to: id,
    page_location: measurementUrl(new URL(window.location.href)),
    page_referrer:
      window.openbidsMeasurementContext?.referrer || measurementReferrer(document.referrer),
    page_title: measurementTitle(window.location.pathname),
  })
}

export function measurementTitle(pathname: string) {
  return pathname === "/"
    ? "OpenBids tender search"
    : publicCollectionPaths.has(pathname)
      ? "OpenBids public resources"
      : "OpenBids tender detail"
}
