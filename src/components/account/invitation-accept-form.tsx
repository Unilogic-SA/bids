"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptWorkspaceInvitation,
  changeInvitationAccount,
} from "@/lib/workspace/invitation-actions";
export function InvitationAcceptForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(acceptWorkspaceInvitation, {
    ok: false,
    message: "",
  });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invitationId" value={id} />
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </form>
  );
}

export function InvitationChangeAccount({ id }: { id: string }) {
  const [state, action, pending] = useActionState(changeInvitationAccount, {
    ok: false,
    message: "",
  });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invitationId" value={id} />
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit" variant="outline">
        {pending ? "Signing out…" : "Change account"}
      </Button>
    </form>
  );
}
