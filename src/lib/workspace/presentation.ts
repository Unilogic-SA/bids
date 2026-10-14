import { differenceInSastCalendarDays } from "@/lib/sast-date"
import {
  OUTCOME_LABELS,
  STAGE_LABELS,
  type BidPatch,
  type WorkspaceEntry,
  type WorkspaceTender
} from "./types"
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
    validTimestamp(tender.closing_at) !==
      validTimestamp(bid.acknowledged_closing_at)
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
  return signals.sort((a, b) => signalPriority(a.kind) - signalPriority(b.kind))
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
        bid.next_action_due_at ||
        bid.checklist_initialized ||
        bid.submitted_at ||
        bid.submission_reference
      )
  }
}

function validTimestamp(value: string | null) {
  const timestamp = value ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? timestamp : null
}
function signalPriority(kind: string) {
  return ["close", "briefing", "deadline", "source"].indexOf(kind)
}
export function compactWorkspaceDate(value: string | null) {
  if (validTimestamp(value) === null) return "Not supplied"
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(value!))
}
export function closingUrgency(bid: WorkspaceEntry, now: number) {
  const timestamp = validTimestamp(bid.tender.closing_at)
  if (
    timestamp === null ||
    bid.stage === "submitted" ||
    bid.outcome ||
    bid.archived_at
  )
    return null
  if (timestamp < now) return "Deadline passed"
  const days = differenceInSastCalendarDays(timestamp, now)
  return days === 0
    ? "Today"
    : days === 1
      ? "Tomorrow"
      : days === 2
        ? "2 days left"
        : null
}
export function workspaceMutationMessage(changes: BidPatch) {
  if (changes.checklist) return "Checklist saved"
  if (changes.archive !== undefined)
    return changes.archive ? "Bid archived" : "Restored to workspace"
  if (changes.acknowledge_deadline) return "Deadline change acknowledged"
  if (changes.stage)
    return changes.stage === "submitted"
      ? "Submission recorded"
      : `Moved to ${STAGE_LABELS[changes.stage].toLowerCase()}`
  if ("outcome" in changes)
    return changes.outcome
      ? `Recorded as ${OUTCOME_LABELS[changes.outcome].toLowerCase()}`
      : "Bid reopened"
  return "Bid updated"
}
