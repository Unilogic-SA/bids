"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCustomerName } from "@/lib/auth/settings-actions";
import { signOutCustomer } from "@/lib/auth/actions";
import { initialCustomerActionState } from "@/lib/auth/account-state";
import { useAccount } from "./account-provider";
import { useWorkspace } from "@/components/workspace/workspace-provider";
export function AccountProfileForm() {
  const { account, refreshAccount } = useAccount();
  const workspace = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState(
    account.status === "signed-in" ? account.profile.displayName || "" : "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  if (account.status !== "signed-in") return null;
  return (
    <div className="space-y-5">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const current = workspace.accountGuard();
          startTransition(async () => {
            try {
              const result = await updateCustomerName(account.user.id, name);
              if (!current()) return;
              setError(!result.ok);
              setMessage(result.message);
              if (result.ok) refreshAccount();
            } catch {
              if (current()) {
                setError(true);
                setMessage("Your name could not be saved. Retry.");
              }
            }
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="account-display-name">Display name</Label>
          <Input
            id="account-display-name"
            autoComplete="name"
            maxLength={100}
            value={name}
            disabled={pending || signingOut}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">Email</Label>
          <Input
            id="account-email"
            readOnly
            value={account.user.email}
            className="text-muted-foreground"
          />
        </div>
        {message ? (
          <p
            role={error ? "alert" : "status"}
            className={
              error
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {message}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || signingOut}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
      <div className="border-t pt-4">
        <Button
          variant="outline"
          disabled={pending || signingOut}
          onClick={() =>
            startSignOut(async () => {
              if (!(await workspace.prepareToLeave())) {
                setError(true);
                setMessage("Save your checklist before signing out.");
                return;
              }
              try {
                const form = new FormData();
                form.set("next", "/");
                const result = await signOutCustomer(
                  initialCustomerActionState,
                  form,
                );
                if (result.status !== "success") {
                  setError(true);
                  setMessage(result.message);
                  return;
                }
                refreshAccount({ foreground: true });
                router.refresh();
              } catch {
                setError(true);
                setMessage("Sign out failed. Retry.");
              } finally {
                workspace.releaseSwitch();
              }
            })
          }
        >
          {signingOut ? "Signing out…" : "Sign out on this device"}
        </Button>
      </div>
    </div>
  );
}
