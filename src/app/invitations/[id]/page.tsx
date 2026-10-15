import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCustomerAccount } from "@/lib/auth/session";
import { authPageHref } from "@/lib/auth/redirects";
import {
  pendingInvitation,
  reviewInvitationToken,
} from "@/lib/workspace/invitations";
import {
  InvitationAcceptForm,
  InvitationChangeAccount,
} from "@/components/account/invitation-accept-form";
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
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-12 md:px-6">
      <h1 className="font-heading text-2xl font-semibold">
        {invitation
          ? `Join ${invitation.workspaceName}`
          : "Invitation unavailable"}
      </h1>
      {!invitation ? (
        <>
          <p className="text-sm text-muted-foreground">
            Reopen the original invitation from your email. If it has expired or
            been cancelled, ask the owner for a new invitation.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">Browse tenders</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="wrap-anywhere text-sm text-muted-foreground">
            {invitation.inviterName} invited {invitation.maskedEmail} to this
            workspace.
          </p>
          <p className="text-sm">
            You’ll share all saved bids, checklists and submission records in
            this workspace. Your other workspaces stay private.
          </p>
          {wrongEmail ? (
            <>
              <p role="alert" className="text-sm text-destructive">
                You’re signed in as {user!.email}. Sign in with the email
                address this invitation was sent to.
              </p>
              <InvitationChangeAccount id={id} />
            </>
          ) : user ? (
            <InvitationAcceptForm id={id} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={authPageHref("/sign-in", `/invitations/${id}`)}>
                  Sign in to review
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={authPageHref("/sign-up", `/invitations/${id}`)}>
                  Create account
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
