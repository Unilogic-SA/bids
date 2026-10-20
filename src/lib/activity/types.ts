export type ActivityReason = {
  key: string
  kind: "deadline" | "cancelled" | "closing"
  payload: { previous?: string; current?: string; status?: string; closingAt?: string; passed?: boolean }
  unread: boolean
  detectedAt: string
  snoozedUntil: string | null
}
export type ActivityItem = {
  bidId: string
  title: string
  reference: string | null
  unread: boolean
  reasons: ActivityReason[]
}
export type ActivityPreferences = { changes: boolean; reminders: boolean }
export type ActivityPage = {
  items: ActivityItem[]
  total: number
  unread: number
  page: number
  preferences: ActivityPreferences
}
export type ActivityAction = "read" | "dismiss" | "snooze" | "unsnooze"

function date(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not supplied"
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value)) + " SAST"
}
export function activityMessage(reason: ActivityReason) {
  if (reason.kind === "cancelled") return {
    title: reason.payload.status === "withdrawn" ? "Tender withdrawn" : "Tender cancelled",
    detail: "The official source reports this tender is no longer proceeding. Review before continuing.",
  }
  if (reason.kind === "deadline") return {
    title: Date.parse(reason.payload.current || "") < Date.parse(reason.payload.previous || "") ? "Closing date moved earlier" : "Closing date changed",
    detail: date(reason.payload.previous) + " → " + date(reason.payload.current) + ". Review your plan and any exported calendar event.",
  }
  return reason.payload.passed ? {
    title: "Closing time passed",
    detail: "Closed " + date(reason.payload.closingAt) + ". Record submission or review this bid.",
  } : {
    title: "Submission due within 24 hours",
    detail: "Closes " + date(reason.payload.closingAt) + ". Check your preparation and submit to the buyer.",
  }
}
export function activityBidHref(bidId: string) {
  return "/workspace?bid=" + encodeURIComponent(bidId)
}
