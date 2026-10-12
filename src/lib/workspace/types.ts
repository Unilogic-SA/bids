export const BID_STAGES = [
  "saved",
  "reviewing",
  "preparing",
  "ready",
  "submitted"
] as const
export type BidStage = (typeof BID_STAGES)[number]
export const BID_OUTCOMES = [
  "won",
  "unsuccessful",
  "not_bidding",
  "withdrawn"
] as const
export type BidOutcome = (typeof BID_OUTCOMES)[number]
export const STAGE_LABELS: Record<BidStage, string> = {
  saved: "Saved",
  reviewing: "Reviewing",
  preparing: "Preparing",
  ready: "Ready to submit",
  submitted: "Submitted"
}
export const OUTCOME_LABELS: Record<BidOutcome, string> = {
  won: "Won",
  unsuccessful: "Unsuccessful",
  not_bidding: "Not bidding",
  withdrawn: "Withdrawn"
}
export type ChecklistItem = {
  id: string
  label: string
  completed: boolean
  kind?: "compulsory_briefing"
}
export type WorkspaceTender = {
  ocid: string
  tender_no: string | null
  title: string | null
  buyer_name: string | null
  closing_at: string | null
  briefing_datetime: string | null
  compulsory_briefing: boolean | null
  detail_path: string | null
  source_url: string | null
  derived_status?: string | null
}
export type WorkspaceBid = {
  id: string
  company_id: string
  tender_ocid: string
  stage: BidStage
  outcome: BidOutcome | null
  notes: string
  next_action: string | null
  next_action_due_at: string | null
  checklist: ChecklistItem[]
  checklist_initialized: boolean
  submitted_at: string | null
  submission_reference: string | null
  tender_snapshot: WorkspaceTender
  acknowledged_closing_at: string | null
  archived_at: string | null
  version: number
  created_at: string
  updated_at: string
}
export type WorkspaceEntry = WorkspaceBid & {
  tender: WorkspaceTender
  source_available: boolean
}
export type SavedBid = Pick<
  WorkspaceBid,
  "id" | "tender_ocid" | "stage" | "outcome" | "archived_at" | "version"
> & { has_work: boolean }
export type BidPatch = Partial<
  Pick<
    WorkspaceBid,
    | "stage"
    | "outcome"
    | "notes"
    | "next_action"
    | "next_action_due_at"
    | "checklist"
    | "submitted_at"
    | "submission_reference"
  >
> & { archive?: boolean; acknowledge_deadline?: boolean }
export type WorkspaceFilters = {
  q: string
  state: "active" | "completed" | "archived"
  stage: BidStage | "all"
  week: boolean
  view: "list" | "board"
  page: number
  offsets: Partial<Record<BidStage, number>>
}
export type WorkspacePage = {
  items: WorkspaceEntry[]
  total: number
  counts: Record<BidStage, number>
}
export type MutationResult =
  | { ok: true; bid: WorkspaceBid | null }
  | {
      ok: false
      code: "invalid" | "unavailable" | "conflict" | "unauthorized"
      message: string
      bid?: WorkspaceBid
    }
export type ImportResult = {
  ocid: string
  status: "inserted" | "already_exists" | "unavailable" | "failed"
}
