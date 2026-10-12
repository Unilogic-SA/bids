import {
  createServerAuthClient,
  hasSupabasePublicConfig
} from "@/lib/supabase/server"
import { isVerifiedCustomer } from "@/lib/auth/workspace"
import type {
  WorkspaceEntry,
  WorkspaceFilters,
  WorkspacePage,
  SavedBid
} from "./types"
export async function workspaceClient() {
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
    .maybeSingle()
  if (membershipError || !membership || membership.role !== "owner") return null
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", membership.company_id)
    .eq("owner_user_id", user.id)
    .maybeSingle()
  return company && !companyError
    ? { supabase, companyId: company.id as string }
    : null
}
export async function readWorkspace(
  filters: WorkspaceFilters
): Promise<WorkspacePage | null> {
  const client = await workspaceClient()
  if (!client) return null
  const { data, error } = await client.supabase.rpc("list_workspace_bids", {
    p_q: filters.q,
    p_state: filters.state,
    p_stage: filters.stage,
    p_week: filters.week,
    p_view: filters.view,
    p_page: filters.page,
    p_offsets: filters.offsets
  })
  if (error) throw new Error("Workspace could not be loaded")
  return data as WorkspacePage
}
export async function readWorkspaceEntry(
  id: string
): Promise<WorkspaceEntry | null> {
  const client = await workspaceClient()
  if (!client) return null
  const { data, error } = await client.supabase
    .from("workspace_bid_entries")
    .select("*")
    .eq("company_id", client.companyId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("Bid could not be loaded")
  return data as WorkspaceEntry | null
}
export async function readSavedBids(
  ocids: string[]
): Promise<SavedBid[] | null> {
  const client = await workspaceClient()
  if (!client) return null
  const { data, error } = await client.supabase
    .from("workspace_bids")
    .select(
      "id,tender_ocid,stage,outcome,archived_at,version,notes,next_action,checklist_initialized,submitted_at,submission_reference"
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
        bid.checklist_initialized ||
        bid.submitted_at ||
        bid.submission_reference
      )
  }))
}
