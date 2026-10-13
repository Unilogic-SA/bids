import type { BidPatch, BidStage, MutationResult, WorkspaceEntry } from "./types"

export async function updateBidStages(
  items: WorkspaceEntry[],
  stage: BidStage,
  submittedAt: string | null,
  current: () => boolean,
  update: (id: string, version: number, patch: BidPatch) => Promise<MutationResult>
) {
  const succeeded = new Set<string>()
  let message = ""
  for (const bid of items) {
    if (!current()) return null
    if (bid.stage === stage) { succeeded.add(bid.id); continue }
    const patch: BidPatch = stage === "submitted"
      ? { stage, submitted_at: submittedAt, submission_reference: null }
      : { stage }
    let result: MutationResult
    try { result = await update(bid.id, bid.version, patch) }
    catch { result = { ok: false, code: "unavailable", message: "Please retry." } }
    if (!current()) return null
    if (result.ok) succeeded.add(bid.id)
    else message = result.message
  }
  return { succeeded, failed: items.length - succeeded.size, message }
}
