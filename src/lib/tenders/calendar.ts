const DEFAULT_TIME_ZONE_OFFSET = "+02:00"
const ICS_DOMAIN = "openbids.co.za"

export type TenderCalendarSelection = "closing" | "briefing" | "combined"

export type TenderCalendarDetails = {
  ocid: string
  tenderNumber: string
  description: string
  buyer: string
  canonicalUrl: string
  closingAt?: string | null
  briefingAt?: string | null
  briefingVenue?: string | null
  briefingCompulsory?: boolean | null
}

export function isValidTenderTimestamp(value?: string | null) {
  return parseTenderTimestamp(value) !== null
}

export function buildTenderCalendar(
  tender: TenderCalendarDetails,
  selection: TenderCalendarSelection,
  generatedAt = new Date()
) {
  const eventTypes =
    selection === "combined"
      ? (["closing", "briefing"] as const)
      : ([selection] as const)
  const events = eventTypes.flatMap((eventType) => {
    const start = parseTenderTimestamp(
      eventType === "closing" ? tender.closingAt : tender.briefingAt
    )

    if (!start) return []

    return [buildCalendarEvent(tender, eventType, start, generatedAt)]
  })

  if (events.length === 0) return null

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenBids//Tender calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flat(),
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}

export function getTenderCalendarFilename(
  tenderNumber: string,
  selection: TenderCalendarSelection
) {
  const safeReference = tenderNumber
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase()
  const suffix = selection === "combined" ? "dates" : selection

  return `openbids-${safeReference || "tender"}-${suffix}.ics`
}

function buildCalendarEvent(
  tender: TenderCalendarDetails,
  eventType: "closing" | "briefing",
  start: Date,
  generatedAt: Date
) {
  const reference = cleanText(tender.tenderNumber) || "Tender notice"
  const summary =
    eventType === "closing"
      ? `Tender closes — ${reference}`
      : `Tender briefing — ${reference}`
  const descriptionLines = [
    cleanText(tender.description),
    cleanText(tender.buyer) ? `Issued by: ${cleanText(tender.buyer)}` : "",
    eventType === "briefing"
      ? `Compulsory: ${
          tender.briefingCompulsory === null ||
          tender.briefingCompulsory === undefined
            ? "Not specified"
            : tender.briefingCompulsory
              ? "Yes"
              : "No"
        }`
      : "",
    cleanText(tender.canonicalUrl),
  ].filter(Boolean)
  const lines = [
    "BEGIN:VEVENT",
    formatProperty("UID", `${eventType}-${stableHash(tender.ocid)}@${ICS_DOMAIN}`),
    formatProperty(
      "DTSTAMP",
      formatUtcTimestamp(
        Number.isNaN(generatedAt.getTime()) ? new Date(0) : generatedAt
      ),
      false
    ),
    formatProperty("DTSTART", formatUtcTimestamp(start), false),
    formatProperty("SUMMARY", summary),
    formatProperty("DESCRIPTION", descriptionLines.join("\n")),
  ]

  if (eventType === "briefing" && cleanText(tender.briefingVenue)) {
    lines.push(formatProperty("LOCATION", cleanText(tender.briefingVenue)))
  }

  if (cleanText(tender.canonicalUrl)) {
    lines.push(formatProperty("URL", cleanText(tender.canonicalUrl), false))
  }

  lines.push("END:VEVENT")
  return lines
}

function parseTenderTimestamp(value?: string | null) {
  const candidate = cleanText(value)
  const match = candidate.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/i
  )

  if (!match) return null

  const [, year, month, day, hour, minute, second = "00", fraction, zone] =
    match
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const hourNumber = Number(hour)
  const minuteNumber = Number(minute)
  const secondNumber = Number(second)
  const millisecondNumber = Number(
    (fraction || "").padEnd(3, "0").slice(0, 3) || "0"
  )
  const calendarCheck = new Date(
    Date.UTC(
      yearNumber,
      monthNumber - 1,
      dayNumber,
      hourNumber,
      minuteNumber,
      secondNumber,
      millisecondNumber
    )
  )

  if (
    yearNumber < 1000 ||
    calendarCheck.getUTCFullYear() !== yearNumber ||
    calendarCheck.getUTCMonth() !== monthNumber - 1 ||
    calendarCheck.getUTCDate() !== dayNumber ||
    calendarCheck.getUTCHours() !== hourNumber ||
    calendarCheck.getUTCMinutes() !== minuteNumber ||
    calendarCheck.getUTCSeconds() !== secondNumber
  ) {
    return null
  }

  const offset = getTimeZoneOffset(zone || DEFAULT_TIME_ZONE_OFFSET)
  if (offset === null) return null

  const date = new Date(calendarCheck.getTime() - offset * 60_000)

  return Number.isNaN(date.getTime()) ? null : date
}

function getTimeZoneOffset(value: string) {
  if (value.toUpperCase() === "Z") return 0

  const match = value.match(/^([+-])(\d{2}):?(\d{2})$/)
  if (!match) return null

  const [, sign, hours, minutes] = match
  const hourNumber = Number(hours)
  const minuteNumber = Number(minutes)
  if (hourNumber > 23 || minuteNumber > 59) return null

  const offset = hourNumber * 60 + minuteNumber
  return sign === "+" ? offset : -offset
}

function formatUtcTimestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function formatProperty(name: string, value: string, escape = true) {
  return foldIcsLine(`${name}:${escape ? escapeIcsText(value) : value}`)
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

function foldIcsLine(value: string) {
  const encoder = new TextEncoder()
  const lines: string[] = []
  let current = ""
  let currentBytes = 0
  let limit = 75

  for (const character of value) {
    const characterBytes = encoder.encode(character).length

    if (current && currentBytes + characterBytes > limit) {
      lines.push(current)
      current = character
      currentBytes = characterBytes
      limit = 74
      continue
    }

    current += character
    currentBytes += characterBytes
  }

  lines.push(current)
  return lines.join("\r\n ")
}

function stableHash(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || ""
}
