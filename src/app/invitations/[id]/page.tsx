import type { Metadata } from "next";
import { getCustomerAccount } from "@/lib/auth/session";
import { pendingInvitation, reviewInvitationToken } from "@/lib/workspace/invitations";
import { InvitationExperience } from "@/components/account/invitation-experience";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Workspace invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pending = await pendingInvitation(id);
  const invitation = pending
    ? await reviewInvitationToken(id, pending.token).catch(() => null)
    : null;
  const account = invitation ? await getCustomerAccount() : null;
  const signedIn =
    account?.status === "signed-in" ||
    (account?.status === "unavailable" && account.user);
  const user =
    signedIn && account && "user" in account ? account.user : undefined;
  const wrongEmail =
    user && user.email.trim().toLowerCase() !== invitation?.email;
  return (
    <InvitationExperience
      id={id}
      invitation={invitation ? {
        workspaceName: invitation.workspaceName,
        inviterName: invitation.inviterName,
        maskedEmail: invitation.maskedEmail,
      } : null}
      userEmail={user?.email}
      wrongEmail={Boolean(wrongEmail)}
    />
  );
}
