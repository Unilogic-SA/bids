import {
  createServerAuthClient,
  hasSupabasePublicConfig
} from "@/lib/supabase/server"
import { withWorkspaceTitles, type WorkspaceTitleSource } from "./titles"
import { isVerifiedCustomer } from "@/lib/auth/workspace"
import type {
  WorkspaceEntry,
  WorkspaceFilters,
  WorkspacePage,
  SavedBid
} from "./types"
export async function workspaceClient(companyId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return null
  if (!hasSupabasePublicConfig()) return null
  const supabase = await createServerAuthClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error || !isVerifiedCustomer(user)) return null
  const { data: membership, error: membershipError } = await supabase
    .from("company_memberships")
    .select("company_id,role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle()
  return !membershipError && membership && ["owner", "member"].includes(membership.role)
    ? { supabase, companyId, user }
    : null
}
export async function readWorkspace(
  companyId: string, filters: WorkspaceFilters
): Promise<WorkspacePage | null> {
  const client = await workspaceClient(companyId)
  if (!client) return null
  const { data, error } = await client.supabase.rpc("list_workspace_bids", {
    p_company_id: client.companyId,
    p_q: filters.q,
    p_state: filters.state,
    p_stage: filters.stage,
    p_week: filters.week,
    p_view: filters.view,
    p_page: filters.page,
    p_offsets: filters.offsets
  })
  if (error) throw new Error("Workspace could not be loaded")
  const page = data as WorkspacePage
  return {
    ...page,
    items: await enrichWorkspaceTitles(client.supabase, page.items)
  }
}
export async function readWorkspaceEntry(
  companyId: string, id: string
): Promise<WorkspaceEntry | null> {
  const client = await workspaceClient(companyId)
  if (!client) return null
  const { data, error } = await client.supabase
    .from("workspace_bid_entries")
    .select("*")
    .eq("company_id", client.companyId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("Bid could not be loaded")
  return data
    ? (
        await enrichWorkspaceTitles(client.supabase, [data as WorkspaceEntry])
      )[0]
    : null
}
export async function readSavedBids(
  companyId: string, ocids: string[]
): Promise<SavedBid[] | null> {
  const client = await workspaceClient(companyId)
  if (!client) return null
  const { data, error } = await client.supabase
    .from("workspace_bids")
    .select(
      "id,tender_ocid,stage,outcome,archived_at,version,notes,next_action,next_action_due_at,checklist_initialized,submitted_at,submission_reference"
    )
    .eq("company_id", client.companyId)
    .in("tender_ocid", ocids)
  if (error) throw new Error("Saved tenders could not be loaded")
  return (data || []).map((bid) => ({
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
  }))
}

export async function enrichWorkspaceTitles(
  client: NonNullable<Awaited<ReturnType<typeof workspaceClient>>>["supabase"],
  entries: WorkspaceEntry[]
) {
  const ids = Array.from(
    new Set(
      entries
        .filter((entry) => entry.source_available)
        .map((entry) => entry.tender_ocid)
    )
  ).slice(0, 150)
  if (!ids.length) return withWorkspaceTitles(entries, [])
  try {
    const { data, error } = await client
      .from("tenders")
      .select("ocid,bid_description,title_snippet,title")
      .in("ocid", ids)
      .limit(150)
    if (error) {
      console.warn("Workspace tender descriptions could not be loaded")
      return withWorkspaceTitles(entries, [])
    }
    return withWorkspaceTitles(entries, (data || []) as WorkspaceTitleSource[])
  } catch {
    console.warn("Workspace tender descriptions could not be loaded")
    return withWorkspaceTitles(entries, [])
  }
}
