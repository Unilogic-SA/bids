"use client";

import { useActionState, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { IconArrowRight, IconCheck, IconMail, IconUsersGroup } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authPageHref } from "@/lib/auth/redirects";
import { acceptWorkspaceInvitation } from "@/lib/workspace/invitation-actions";
import { InvitationChangeAccount } from "./invitation-accept-form";
import styles from "./invitation-experience.module.css";

type Invitation = { workspaceName: string; inviterName: string; maskedEmail: string };

function InvitationSurface({ children }: { children: ReactNode }) {
  return (
    <main className="flex w-full flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-md space-y-8 text-center">{children}</div>
    </main>
  );
}

export function InvitationJoined({ workspaceName }: { workspaceName: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <InvitationSurface>
      <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-chart-1">
        <IconCheck className="size-8" stroke={1.5} aria-hidden="true" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className={styles.confetti} style={{ "--piece": index } as CSSProperties} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <h1 ref={heading} tabIndex={-1} className="font-heading text-3xl font-semibold tracking-tight outline-none sm:text-4xl">You’re in. Welcome aboard.</h1>
        <p className="wrap-anywhere text-base leading-relaxed text-muted-foreground">
          You’ve joined <strong className="font-medium text-foreground">{workspaceName}</strong>.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">Your team’s saved bids, checklists and submission records are ready to work on together.</p>
      </div>
      <div className="space-y-3">
        {/* A fresh navigation resolves the selected workspace and resets account scope. */}
        <Button asChild className="h-11 w-full gap-2">
          <a href="/workspace">Open workspace<IconArrowRight aria-hidden="true" /></a>
        </Button>
        <p className="text-xs text-muted-foreground">Your other workspaces stay private.</p>
      </div>
    </InvitationSurface>
  );
}

export function InvitationExperience({ id, invitation, userEmail, wrongEmail }: {
  id: string; invitation: Invitation | null; userEmail?: string; wrongEmail: boolean;
}) {
  const [state, action, pending] = useActionState(acceptWorkspaceInvitation, { ok: false, message: "" });
  // Cookie changes re-render this route after acceptance. Keep only display copy,
  // never the token or invited email, for the confirmed completion state.
  const [workspaceName] = useState(invitation?.workspaceName || "your workspace");
  if (state.ok) return <InvitationJoined workspaceName={workspaceName} />;
  if (!invitation) return (
    <InvitationSurface>
      <IconMail className="mx-auto size-10 text-muted-foreground" stroke={1.5} aria-hidden="true" />
      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Let’s find your invitation</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Reopen the original invitation from your email. If it has expired or been cancelled, ask the owner for a new invitation.</p>
      </div>
      <Button asChild variant="outline" className="h-11"><Link href="/">Browse tenders</Link></Button>
    </InvitationSurface>
  );
  return (
    <InvitationSurface>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-chart-1">
        <IconUsersGroup className="size-8" stroke={1.5} aria-hidden="true" />
      </div>
      <div className="space-y-3">
        <p className="wrap-anywhere text-sm text-muted-foreground"><span className="font-medium text-foreground">{invitation.inviterName}</span> invited you to work together.</p>
        <h1 className="wrap-anywhere text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Join {invitation.workspaceName}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">One shared place for your team’s saved bids, checklists and submission records.</p>
      </div>
      <div className="space-y-4">
        {wrongEmail ? (
          <>
            <Alert variant="destructive"><AlertDescription className="wrap-anywhere">You’re signed in as {userEmail}. Sign in with the email address this invitation was sent to.</AlertDescription></Alert>
            <InvitationChangeAccount id={id} />
          </>
        ) : userEmail ? (
          <form action={action} className="space-y-3">
            <input type="hidden" name="invitationId" value={id} />
            {state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
            <Button disabled={pending} type="submit" className="h-11 w-full gap-2">
              {pending ? "Joining workspace…" : "Accept invitation"}
              {!pending ? <IconArrowRight aria-hidden="true" /> : null}
            </Button>
            <p className="wrap-anywhere text-xs text-muted-foreground">Joining as {userEmail}</p>
          </form>
        ) : (
          <div className="space-y-3">
            <Button asChild className="h-11 w-full"><Link href={authPageHref("/sign-in", `/invitations/${id}`)}>Sign in to review<IconArrowRight aria-hidden="true" /></Link></Button>
            <p className="text-sm text-muted-foreground">New to OpenBids? <Button asChild variant="link" className="h-auto p-0 text-foreground"><Link href={authPageHref("/sign-up", `/invitations/${id}`)}>Create an account</Link></Button></p>
          </div>
        )}
        <p className="wrap-anywhere text-xs leading-relaxed text-muted-foreground">Sent to {invitation.maskedEmail}. Invitations expire after seven days. You’ll join only when you accept.</p>
      </div>
      <p className="border-t pt-5 text-xs leading-relaxed text-muted-foreground">Everyone in this workspace can see and edit its bids.<br />Your other workspaces stay private.</p>
    </InvitationSurface>
  );
}
