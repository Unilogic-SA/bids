"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workspaceLabel } from "@/lib/auth/account-state";
import { switchCustomerWorkspace } from "@/lib/auth/settings-actions";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { useAccount } from "./account-provider";
export function WorkspaceSelector({ onSwitched }: { onSwitched?: () => void }) {
  const { account, refreshAccount } = useAccount();
  const workspace = useWorkspace();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (account.status !== "signed-in" || account.workspaces.length < 2)
    return null;
  return (
    <div className="space-y-2">
      <Label htmlFor="active-workspace">Active workspace</Label>
      <Select
        value={account.workspace.id}
        disabled={pending}
        onValueChange={(id) => {
          if (id === account.workspace.id) return;
          setError("");
          startTransition(async () => {
            if (!(await workspace.prepareToLeave())) {
              setError(
                "Your checklist could not be saved. Review it before switching workspace.",
              );
              return;
            }
            try {
              const result = await switchCustomerWorkspace(id);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              if (window.location.pathname === "/workspace")
                router.replace("/workspace", { scroll: true });
              refreshAccount();
              router.refresh();
              onSwitched?.();
            } catch {
              setError("Workspace could not be switched. Retry.");
            } finally {
              workspace.releaseSwitch();
            }
          });
        }}
      >
        <SelectTrigger id="active-workspace" className="h-10 w-full sm:h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {account.workspaces.map((item) => (
            <SelectItem
              key={item.id}
              value={item.id}
              className="max-w-80 wrap-anywhere"
            >
              {workspaceLabel(item.name)}
              {item.role === "owner" ? " (owner)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : pending ? (
        <p role="status" className="text-xs text-muted-foreground">
          Switching workspace…
        </p>
      ) : null}
    </div>
  );
}
