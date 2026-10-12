import { differenceInSastCalendarDays } from "@/lib/sast-date"
import type { WorkspaceEntry, WorkspaceTender, BidStage } from "./types"
export function workspaceDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not supplied"
  return (
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(new Date(value)) + " SAST"
  )
}
export function sastInput(value: string | null = new Date().toISOString()) {
  return value
    ? new Date(Date.parse(value) + 7200000).toISOString().slice(0, 16)
    : ""
}
export function fromSastInput(value: string) {
  return value ? new Date(`${value}:00+02:00`).toISOString() : null
}
export function tenderHref(tender: WorkspaceTender) {
  return `/tenders/${encodeURIComponent(tender.ocid)}`
}
export const DEFAULT_ACTIONS: Record<BidStage, string> = {
  saved: "Review opportunity",
  reviewing: "Decide whether to bid",
  preparing: "Complete preparation",
  ready: "Mark submitted",
  submitted: "Record outcome"
}
export type AttentionSignal = { kind: string; text: string }
export function attentionSignals(
  bid: WorkspaceEntry,
  now = Date.now()
): AttentionSignal[] {
  const signals: AttentionSignal[] = []
  const tender = bid.tender
  if (!bid.source_available)
    signals.push({
      kind: "source",
      text: "Tender source unavailable — showing saved details"
    })
  else if (
    tender.derived_status === "cancelled" ||
    tender.derived_status === "withdrawn"
  )
    signals.push({
      kind: "source",
      text: "Tender marked cancelled by its source — review before continuing"
    })
  if (
    bid.source_available &&
    (tender.closing_at ? Date.parse(tender.closing_at) : null) !==
      (bid.acknowledged_closing_at
        ? Date.parse(bid.acknowledged_closing_at)
        : null)
  )
    signals.push({
      kind: "deadline",
      text: "Deadline changed — review the new closing time"
    })
  const active = !bid.archived_at && !bid.outcome
  const briefingDone = bid.checklist.some(
    (item) => item.kind === "compulsory_briefing" && item.completed
  )
  if (
    active &&
    tender.compulsory_briefing &&
    tender.briefing_datetime &&
    !briefingDone
  ) {
    const days = differenceInSastCalendarDays(tender.briefing_datetime, now)
    if (Date.parse(tender.briefing_datetime) < now)
      signals.push({
        kind: "briefing",
        text: "Compulsory briefing passed — confirm attendance"
      })
    else if (days !== null && days <= 1)
      signals.push({
        kind: "briefing",
        text: `Compulsory briefing ${days === 0 ? "today" : "tomorrow"} — not checked off`
      })
  }
  if (
    active &&
    bid.next_action_due_at &&
    Date.parse(bid.next_action_due_at) < now
  )
    signals.push({ kind: "action", text: "Next action overdue" })
  if (active && bid.stage !== "submitted" && tender.closing_at) {
    const days = differenceInSastCalendarDays(tender.closing_at, now)
    if (Date.parse(tender.closing_at) < now)
      signals.push({
        kind: "close",
        text: "Submission deadline passed — confirm submission or archive"
      })
    else if (days !== null && days <= 2)
      signals.push({
        kind: "close",
        text: `Closes ${days === 0 ? "today" : days === 1 ? "tomorrow" : "in 2 days"} — ${bid.stage === "preparing" ? "still preparing" : "not submitted"}`
      })
  }
  return signals
}
export function summarizeBid(
  bid: import("./types").WorkspaceBid
): import("./types").SavedBid {
  return {
    id: bid.id,
    tender_ocid: bid.tender_ocid,
    stage: bid.stage,
    outcome: bid.outcome,
    archived_at: bid.archived_at,
    version: bid.version,
    has_work:
      bid.stage !== "saved" ||
      Boolean(
        bid.outcome ||
        bid.notes ||
        bid.next_action ||
        bid.checklist_initialized ||
        bid.submitted_at ||
        bid.submission_reference
      )
  }
}
