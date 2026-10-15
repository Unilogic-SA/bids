"use server";
import { z } from "zod";
import { verifiedWorkspaceActor } from "@/lib/workspace/membership-service";
import { selectWorkspaceCookie } from "./workspace-selection";
import { workspaceClient } from "@/lib/workspace/query";
export type SettingsResult = { ok: boolean; message: string };
export async function updateCustomerName(
  expectedUserId: string,
  name: string,
): Promise<SettingsResult> {
  const parsed = z.string().trim().max(100).safeParse(name);
  if (!parsed.success)
    return { ok: false, message: "Use a name of up to 100 characters." };
  try {
    const { user, supabase } = await verifiedWorkspaceActor();
    if (user.id !== expectedUserId)
      return {
        ok: false,
        message: "Your account changed. Reopen account settings.",
      };
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: parsed.data || null })
      .eq("user_id", user.id)
      .select("user_id")
      .single();
    return error || !data
      ? { ok: false, message: "Your name could not be saved. Retry." }
      : { ok: true, message: "Name saved." };
  } catch {
    return { ok: false, message: "Your name could not be saved. Retry." };
  }
}
export async function renameWorkspace(
  companyId: string,
  name: string,
): Promise<SettingsResult> {
  const parsed = z.string().trim().min(1).max(100).safeParse(name);
  if (!z.uuid().safeParse(companyId).success || !parsed.success)
    return {
      ok: false,
      message: "Enter a workspace name of up to 100 characters.",
    };
  try {
    const { user, supabase } = await verifiedWorkspaceActor();
    const { data, error } = await supabase
      .from("companies")
      .update({ name: parsed.data })
      .eq("id", companyId)
      .eq("owner_user_id", user.id)
      .select("id")
      .single();
    return error || !data
      ? { ok: false, message: "Only the owner can rename this workspace." }
      : { ok: true, message: "Workspace renamed." };
  } catch {
    return { ok: false, message: "Workspace could not be renamed. Retry." };
  }
}
export async function switchCustomerWorkspace(
  companyId: string,
): Promise<SettingsResult> {
  if (!z.uuid().safeParse(companyId).success)
    return { ok: false, message: "Select a valid workspace." };
  try {
    if (!(await workspaceClient(companyId)))
      return {
        ok: false,
        message: "You no longer have access to this workspace.",
      };
    await selectWorkspaceCookie(companyId);
    return { ok: true, message: "Workspace selected." };
  } catch {
    return { ok: false, message: "Workspace could not be switched. Retry." };
  }
}
