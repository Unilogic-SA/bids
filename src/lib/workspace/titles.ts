import { normalizeTenderTitle } from "@/lib/tenders/presentation"
import type { WorkspaceEntry } from "./types"
export type WorkspaceTitleSource = {
  ocid: string
  bid_description: string | null
  title_snippet: string | null
  title: string | null
}
export const MAX_WORKSPACE_TITLE_LENGTH = 2000
/** Match Discover's field order, skipping whitespace-only source values. */
export function descriptiveWorkspaceTitle(
  source: WorkspaceTitleSource | undefined,
  fallback: string | null
) {
  const first = [
    source?.bid_description,
    source?.title_snippet,
    source?.title,
    fallback
  ].find((value) => Boolean(value?.trim()))
  return normalizeTenderTitle(
    first?.trim().slice(0, MAX_WORKSPACE_TITLE_LENGTH)
  )
}
export function withWorkspaceTitles(
  entries: WorkspaceEntry[],
  sources: WorkspaceTitleSource[]
) {
  const byOcid = new Map(sources.map((source) => [source.ocid, source]))
  return entries.map((entry) => ({
    ...entry,
    tender: {
      ...entry.tender,
      title: descriptiveWorkspaceTitle(
        entry.source_available ? byOcid.get(entry.tender_ocid) : undefined,
        [entry.tender.title, entry.tender_snapshot.title].find((value) =>
          value?.trim()
        ) || null
      )
    }
  }))
}
