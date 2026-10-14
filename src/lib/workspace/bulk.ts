import type {
  BidPatch,
  BidStage,
  MutationResult,
  WorkspaceEntry
} from "./types"

export async function updateBidStages(
  items: WorkspaceEntry[],
  stage: BidStage,
  submittedAt: string | null,
  current: () => boolean,
  update: (
    id: string,
    version: number,
    patch: BidPatch
  ) => Promise<MutationResult>
) {
  const succeeded = new Set<string>()
  let message = ""
  let updated = 0
  for (const bid of items) {
    if (!current()) return null
    if (bid.outcome || bid.archived_at) {
      message = "Reopen completed or archived bids first."
      continue
    }
    if (bid.stage === stage) {
      succeeded.add(bid.id)
      continue
    }
    const patch: BidPatch =
      stage === "submitted"
        ? { stage, submitted_at: submittedAt, submission_reference: null }
        : { stage }
    let result: MutationResult
    try {
      result = await update(bid.id, bid.version, patch)
    } catch {
      result = { ok: false, code: "unavailable", message: "Please retry." }
    }
    if (!current()) return null
    if (result.ok) {
      succeeded.add(bid.id)
      updated++
    } else message = result.message
  }
  return { succeeded, updated, failed: items.length - succeeded.size, message }
}

export function bulkStageSelection(
  items: WorkspaceEntry[],
  stage: BidStage | ""
) {
  return {
    blocked: items.filter((bid) => bid.outcome || bid.archived_at),
    changed: stage
      ? items.filter(
          (bid) => !bid.outcome && !bid.archived_at && bid.stage !== stage
        )
      : []
  }
}
