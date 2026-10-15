import "server-only";
import {
  createServerAuthClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { isVerifiedCustomer } from "@/lib/auth/workspace";
import { invitationIdSchema } from "./invitation-validation";

export type WorkspaceMember = {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: "owner" | "member";
};
export type WorkspaceInvitation = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  lastSendAttemptAt: string;
  sendStatus: "sending" | "sent" | "failed" | "unknown";
};
export type WorkspaceMembers = {
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  nextOffset: number | null;
  capacity: number;
};
export async function verifiedWorkspaceActor() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !isVerifiedCustomer(user))
    throw new Error("Sign in to manage your workspace.");
  return { user, supabase };
}
export async function readWorkspaceMembers(
  companyId: string,
  offset = 0,
): Promise<WorkspaceMembers | null> {
  if (
    !invitationIdSchema.safeParse(companyId).success ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    return null;
  const { user } = await verifiedWorkspaceActor();
  const { data, error } = await createServiceRoleClient().rpc(
    "read_workspace_members",
    { p_actor_id: user.id, p_company_id: companyId, p_offset: offset },
  );
  if (error) return null;
  return data as WorkspaceMembers;
}
