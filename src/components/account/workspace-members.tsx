"use client";
import { useEffect, useState, useTransition } from "react";
import { IconArrowRight, IconCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { renameWorkspace } from "@/lib/auth/settings-actions";
import {
  cancelWorkspaceInvitation,
  inviteWorkspaceMember,
  loadWorkspaceMembers,
  removeWorkspaceMember,
  type InvitationActionResult,
} from "@/lib/workspace/invitation-actions";
import type { WorkspaceMembers as Members } from "@/lib/workspace/membership-service";
import { workspaceLabel } from "@/lib/auth/account-state";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { useAccount } from "./account-provider";
import { WorkspaceSelector } from "./workspace-selector";
export function WorkspaceMembers() {
  const { account, refreshAccount } = useAccount();
  const workspace = useWorkspace();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [members, setMembers] = useState<Members | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState(
    account.status === "signed-in" ? account.workspace.name || "" : "",
  );
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState("management");
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const companyId =
    account.status === "signed-in" ? account.workspace.id : null;
  useEffect(() => {
    let disposed = false;
    if (companyId)
      void loadWorkspaceMembers(companyId, offset)
        .then((value) => {
          if (!disposed) {
            setMembers((previous) =>
              value && offset > 0 && previous
                ? {
                    ...value,
                    invitations: Array.from(
                      new Map(
                        [...previous.invitations, ...value.invitations].map(
                          (invite) => [invite.id, invite],
                        ),
                      ).values(),
                    ),
                  }
                : value,
            );
            setNow(Date.now());
            setLoaded(true);
          }
        })
        .catch(() => {
          if (!disposed) {
            setMembers(null);
            setLoaded(true);
          }
        });
    return () => {
      disposed = true;
    };
  }, [companyId, revision, offset]);
  if (account.status !== "signed-in") return null;
  const owner = account.workspace.role === "owner";
  function run(
    operation: () => Promise<InvitationActionResult>,
    after?: () => void,
    target = "management",
  ) {
    const current = workspace.accountGuard();
    setMessage("");
    setFeedbackTarget(target);
    startTransition(async () => {
      try {
        const result = await operation();
        if (!current()) return;
        setMessage(result.message);
        setFailed(!result.ok);
        setOffset(0);
        setRevision((value) => value + 1);
        if (result.ok) after?.();
      } catch {
        if (current()) {
          setFailed(true);
          setMessage("This change could not be completed. Refresh and retry.");
        }
      }
    });
  }
  return (
    <div className="space-y-5">
      <WorkspaceSelector />
      {!owner ? (
        <div>
          <p className="wrap-anywhere font-medium">
            {workspaceLabel(account.workspace.name)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You’re a member of this workspace.
          </p>
        </div>
      ) : null}

      {owner ? (
        <section className="space-y-4" aria-labelledby="workspace-invite-heading">
          <div className="space-y-1">
            <h3 id="workspace-invite-heading" className="font-heading text-lg font-semibold">Invite a teammate</h3>
            <p className="text-sm text-muted-foreground">Work on saved bids together in this workspace.</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () => inviteWorkspaceMember(companyId!, email),
                () => setEmail(""),
                "invite",
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="workspace-invite-email">Email address</Label>
              <Input
                id="workspace-invite-email"
                type="email"
                autoComplete="email"
                aria-describedby="workspace-invite-help"
                maxLength={254}
                placeholder="colleague@example.com"
                disabled={pending || !account.invitationsEnabled}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <p id="workspace-invite-help" className="text-xs leading-relaxed text-muted-foreground">
              Members can see and edit all bids in this workspace. Invitations
              expire in seven days and reserve a place.
            </p>
            {!account.invitationsEnabled ? (
              <p className="text-xs text-muted-foreground">
                Invitations are temporarily unavailable. Existing workspace
                access is unchanged.
              </p>
            ) : null}
            <Button
              className="h-10 w-full gap-2"
              disabled={pending || !account.invitationsEnabled || !email.trim()}
              type="submit"
            >
              {pending ? "Working…" : "Send invitation"}
              <IconArrowRight aria-hidden="true" />
            </Button>
            {feedbackTarget === "invite" && message ? (
              <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-destructive" : "flex items-start gap-2 text-sm"}>
                {!failed ? <IconCheck className="mt-0.5 size-4 shrink-0 text-primary dark:text-chart-1" aria-hidden="true" /> : null}
                {message}
              </p>
            ) : null}
          </form>
          {members?.invitations.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Pending invitations</h3>
              <ul className="space-y-4">
                {members.invitations.map((invite) => {
                  const expired = Date.parse(invite.expiresAt) < now;
                  return (
                    <li key={invite.id} className="space-y-1">
                      <p className="wrap-anywhere text-sm">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {expired
                          ? "Expired"
                          : invite.sendStatus === "sent"
                            ? "Sent · awaiting acceptance"
                            : invite.sendStatus === "failed"
                              ? "Email not sent"
                              : "Send not confirmed; resend available after one minute"}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending || !account.invitationsEnabled}
                          onClick={() =>
                            run(() => inviteWorkspaceMember(companyId!, invite.email, invite.id), undefined, "invite")
                          }
                        >
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            run(() => cancelWorkspaceInvitation(companyId!, invite.id), undefined, "invite")
                          }
                        >
                          Cancel invitation
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {members.nextOffset !== null ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setOffset(members.nextOffset!)}
                >
                  Load more invitations
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {feedbackTarget === "management" && message ? (
        <p
          role={failed ? "alert" : "status"}
          className={
            failed
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}

      <section className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Members</h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {members ? `${members.members.length}/${members.capacity}` : ""}
          </span>
        </div>
        {!loaded ? (
          <Skeleton className="h-20 w-full" />
        ) : !members ? (
          <Alert>
            <AlertDescription className="text-xs">
              Members could not be loaded.
              <Button
                variant="link"
                size="sm"
                onClick={() => setRevision((value) => value + 1)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-3">
            {members.members.map((member) => (
              <li key={member.userId} className="flex items-center gap-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback>
                    {(member.displayName || member.email || "M")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="wrap-anywhere text-sm">
                    {member.displayName || member.email || "Workspace member"}
                    {member.userId === account.user.id ? " (you)" : ""}
                  </p>
                  {member.email && member.displayName ? (
                    <p className="wrap-anywhere text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  ) : null}
                </div>
                {owner && member.role === "member" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      setConfirm({
                        id: member.userId,
                        name:
                          member.displayName || member.email || "this member",
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : (
                  <Badge variant="secondary">
                    {member.role === "owner" ? "Owner" : "Member"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirm ? (
        <Alert>
          <AlertDescription className="space-y-3 text-xs">
            <p className="wrap-anywhere">
              {confirm.id === account.user.id
                ? "Leave this workspace? You’ll lose access to its bids. Your other workspaces stay private."
                : `Remove ${confirm.name}? They’ll lose access to this workspace’s bids.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    async () => {
                      if (!(await workspace.prepareToLeave()))
                        return {
                          ok: false,
                          message: "Save your checklist before continuing.",
                        };
                      try {
                        return await removeWorkspaceMember(
                          companyId!,
                          confirm.id,
                        );
                      } finally {
                        workspace.releaseSwitch();
                      }
                    },
                    () => {
                      setConfirm(null);
                      refreshAccount();
                      if (confirm.id === account.user.id) {
                        router.replace("/workspace");
                        router.refresh();
                      }
                    },
                  )
                }
              >
                {confirm.id === account.user.id
                  ? "Leave workspace"
                  : "Remove member"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {owner ? (
        <form
          className="space-y-2 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => renameWorkspace(companyId!, name), refreshAccount, "rename");
          }}
        >
          <Label htmlFor="workspace-name">Workspace name</Label>
          <div className="flex gap-2">
            <Input
              id="workspace-name"
              maxLength={100}
              value={name}
              placeholder="Your workspace"
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={pending || !name.trim()}
            >
              Save
            </Button>
          </div>
          {feedbackTarget === "rename" && message ? (
            <p role={failed ? "alert" : "status"} className={failed ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{message}</p>
          ) : null}
        </form>
      ) : null}
      {!owner ? (
        <div className="border-t pt-4">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setConfirm({ id: account.user.id, name: "you" })}
          >
            Leave workspace
          </Button>
        </div>
      ) : null}
    </div>
  );
}
