"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getTrustedAuthOrigin } from "@/lib/auth/redirects";
import {
  selectWorkspaceCookie,
  SELECTED_WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/auth/workspace-selection";
import { sendWorkspaceInvitation } from "@/lib/email/workspace-invitation";
import {
  verifiedWorkspaceActor,
  readWorkspaceMembers,
  type WorkspaceMembers,
} from "./membership-service";
import { invitationsEnabled } from "./invitation-configuration";
import {
  invitationEmailSchema,
  invitationIdSchema,
  invitationToken,
  hashInvitationToken,
} from "./invitation-validation";
import {
  pendingInvitation,
  PENDING_INVITATION_COOKIE,
  pendingInvitationCookieOptions,
} from "./invitations";
export type InvitationActionResult = { ok: boolean; message: string };
function failure(
  message = "This change could not be completed. Refresh and retry.",
): InvitationActionResult {
  return { ok: false, message };
}
export async function loadWorkspaceMembers(
  companyId: string,
  offset = 0,
): Promise<WorkspaceMembers | null> {
  try {
    return await readWorkspaceMembers(companyId, offset);
  } catch {
    return null;
  }
}
export async function inviteWorkspaceMember(
  companyId: string,
  email: string,
  invitationId?: string,
): Promise<InvitationActionResult> {
  if (!invitationsEnabled())
    return failure(
      "Workspace invitations are temporarily unavailable. Your account and existing workspace access are unchanged.",
    );
  const parsed = invitationEmailSchema.safeParse(email);
  if (
    !invitationIdSchema.safeParse(companyId).success ||
    !parsed.success ||
    (invitationId && !invitationIdSchema.safeParse(invitationId).success)
  )
    return failure("Enter a valid email address.");
  try {
    const { user } = await verifiedWorkspaceActor();
    const origin = getTrustedAuthOrigin();
    const { token, hash } = invitationToken();
    const service = createServiceRoleClient();
    const { data, error } = await service.rpc("prepare_workspace_invitation", {
      p_actor_id: user.id,
      p_company_id: companyId,
      p_email: parsed.data,
      p_token_hash: hash,
      p_invitation_id: invitationId || null,
    });
    if (error) {
      const message =
        error.code === "23505"
          ? "This person is already a member."
          : error.code === "54000"
            ? "This workspace has reached its invitation limit. Cancel an invitation or try later."
            : error.code === "P0001"
              ? "Wait one minute before sending another invitation to this email."
              : error.code === "42501"
                ? "Only the workspace owner can invite people."
                : "Invitation could not be created. Refresh and retry.";
      return failure(message);
    }
    const invite = data as {
      id: string;
      email: string;
      sendVersion: number;
      workspaceName: string;
      inviterName: string;
    };
    const outcome = await sendWorkspaceInvitation({
      ...invite,
      url: `${origin}/join/${invite.id}#token=${token}`,
    });
    const recorded = await service.rpc("record_workspace_invitation_send", {
      p_id: invite.id,
      p_send_version: invite.sendVersion,
      p_status: outcome.status,
      p_provider_id: outcome.providerId || null,
      p_error_code: outcome.code || null,
    });
    if (recorded.error || !recorded.data)
      return failure(
        "The send could not be confirmed. Refresh invitations before resending after one minute.",
      );
    return outcome.status === "sent"
      ? {
          ok: true,
          message:
            "Invitation sent. They can review and accept it from their email.",
        }
      : failure(
          outcome.status === "unknown"
            ? "The send could not be confirmed. Resend after one minute if needed."
            : "The invitation email could not be sent. Resend after one minute.",
        );
  } catch {
    return failure(
      "Invitation could not be sent. Refresh invitations before retrying.",
    );
  }
}
export async function cancelWorkspaceInvitation(
  companyId: string,
  invitationId: string,
): Promise<InvitationActionResult> {
  if (
    ![companyId, invitationId].every(
      (id) => invitationIdSchema.safeParse(id).success,
    )
  )
    return failure();
  try {
    const { user } = await verifiedWorkspaceActor();
    const { error } = await createServiceRoleClient().rpc(
      "revoke_workspace_invitation",
      { p_actor_id: user.id, p_company_id: companyId, p_id: invitationId },
    );
    return error ? failure() : { ok: true, message: "Invitation cancelled." };
  } catch {
    return failure();
  }
}
export async function removeWorkspaceMember(
  companyId: string,
  userId: string,
): Promise<InvitationActionResult> {
  if (
    ![companyId, userId].every((id) => invitationIdSchema.safeParse(id).success)
  )
    return failure();
  try {
    const { user } = await verifiedWorkspaceActor();
    const { error } = await createServiceRoleClient().rpc(
      "remove_workspace_member",
      { p_actor_id: user.id, p_company_id: companyId, p_user_id: userId },
    );
    if (error)
      return failure("This member could not be removed. Refresh and retry.");
    if (user.id === userId)
      (await cookies()).set(SELECTED_WORKSPACE_COOKIE, "", {
        ...workspaceCookieOptions,
        maxAge: 0,
      });
    return {
      ok: true,
      message:
        user.id === userId
          ? "You left the workspace. Your other workspaces are unchanged."
          : "Member removed. Their other workspaces are unchanged.",
    };
  } catch {
    return failure();
  }
}
export async function acceptWorkspaceInvitation(
  _state: InvitationActionResult,
  form: FormData,
): Promise<InvitationActionResult> {
  const id = String(form.get("invitationId") || "");
  if (!invitationIdSchema.safeParse(id).success)
    return failure("Reopen the invitation from your email.");
  let companyId: string;
  try {
    const pending = await pendingInvitation(id);
    if (!pending)
      return failure("Reopen the invitation from your email to continue.");
    const { user } = await verifiedWorkspaceActor();
    const { data, error } = await createServiceRoleClient().rpc(
      "accept_workspace_invitation",
      {
        p_actor_id: user.id,
        p_id: id,
        p_token_hash: hashInvitationToken(pending.token),
      },
    );
    if (error || typeof data !== "string")
      return failure(
        error?.code === "42501"
          ? "Sign in with the invited verified email address."
          : "This invitation is no longer available. Ask the workspace owner for a new invitation.",
      );
    companyId = data;
    await selectWorkspaceCookie(companyId);
    (await cookies()).set(PENDING_INVITATION_COOKIE, "", {
      ...pendingInvitationCookieOptions,
      maxAge: 0,
    });
  } catch {
    return failure(
      "Invitation could not be accepted. Retry or reopen the email.",
    );
  }
  // Let the invitation surface acknowledge confirmed membership before navigation.
  return { ok: true, message: "Invitation accepted." };
}
export async function changeInvitationAccount(
  _state: InvitationActionResult,
  form: FormData,
): Promise<InvitationActionResult> {
  const id = String(form.get("invitationId") || "");
  if (
    !invitationIdSchema.safeParse(id).success ||
    !(await pendingInvitation(id))
  )
    return failure("Reopen the original invitation from your email.");
  try {
    const { supabase } = await verifiedWorkspaceActor();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return failure("Sign out failed. Retry to change account.");
    (await cookies()).set(SELECTED_WORKSPACE_COOKIE, "", {
      ...workspaceCookieOptions,
      maxAge: 0,
    });
  } catch {
    return failure("Sign out failed. Retry to change account.");
  }
  redirect(`/sign-in?next=${encodeURIComponent(`/invitations/${id}`)}`);
}
