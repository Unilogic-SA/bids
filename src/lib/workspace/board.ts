import {
  BID_STAGES,
  type WorkspaceEntry,
  type WorkspacePage,
  type BidStage
} from "./types"
/** Re-read expanded pages on refresh; stale cards never survive a remote stage/outcome change. */
export function boardRounds(
  offsets: Partial<Record<BidStage, number>>,
  counts: Record<BidStage, number>
) {
  return Math.max(
    0,
    ...BID_STAGES.map((stage) =>
      Math.ceil(
        Math.min(offsets[stage] || 0, Math.max(0, counts[stage] - 1)) / 30
      )
    )
  )
}
export function mergeBoardPages(pages: WorkspacePage[]): WorkspacePage {
  const last = pages[pages.length - 1]
  const byId = new Map<string, WorkspaceEntry>()
  for (const page of pages) for (const bid of page.items) byId.set(bid.id, bid)
  return {
    ...last,
    items: Array.from(byId.values()).sort(
      (a, b) =>
        BID_STAGES.indexOf(a.stage) - BID_STAGES.indexOf(b.stage) ||
        (a.tender.closing_at ? Date.parse(a.tender.closing_at) : Infinity) -
          (b.tender.closing_at ? Date.parse(b.tender.closing_at) : Infinity) ||
        a.id.localeCompare(b.id)
    )
  }
}
