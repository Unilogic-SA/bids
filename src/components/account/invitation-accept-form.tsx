"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  changeInvitationAccount,
} from "@/lib/workspace/invitation-actions";
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
      <Button disabled={pending} type="submit" variant="outline" className="h-11 w-full">
        {pending ? "Signing out…" : "Change account"}
      </Button>
    </form>
  );
}
