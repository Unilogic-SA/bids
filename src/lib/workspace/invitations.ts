import "server-only";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  hashInvitationToken,
  invitationIdSchema,
  invitationTokenSchema,
  readPendingInvitation,
} from "./invitation-validation";
export const PENDING_INVITATION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-openbids-invitation"
    : "openbids-invitation";
export const pendingInvitationCookieOptions = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 60,
};
export type InvitationReview = {
  id: string;
  workspaceName: string;
  inviterName: string;
  maskedEmail: string;
  email: string;
  acceptedBy: string | null;
  companyId: string;
};
export async function reviewInvitationToken(
  id: string,
  token: string,
): Promise<InvitationReview | null> {
  if (
    !invitationIdSchema.safeParse(id).success ||
    !invitationTokenSchema.safeParse(token).success
  )
    return null;
  const { data, error } = await createServiceRoleClient().rpc(
    "review_workspace_invitation",
    { p_id: id, p_token_hash: hashInvitationToken(token) },
  );
  return error ? null : (data as InvitationReview | null);
}
export async function pendingInvitation(id: string) {
  return readPendingInvitation(
    (await cookies()).get(PENDING_INVITATION_COOKIE)?.value,
    id,
  );
}
