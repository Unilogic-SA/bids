"use server"
import { z } from "zod"
import { workspaceClient } from "./query"
import { importSchema, mutationSchema, ocidSchema } from "./validation"
import type {
  BidPatch,
  ImportResult,
  MutationResult,
  WorkspaceBid
} from "./types"
const unavailable = (): MutationResult => ({
  ok: false,
  code: "unavailable",
  message: "Your bid could not be saved. Please retry."
})
export async function saveBid(companyId: string, ocid: string): Promise<MutationResult> {
  if (!ocidSchema.safeParse(ocid).success)
    return { ok: false, code: "invalid", message: "Invalid tender reference." }
  try {
    const client = await workspaceClient(companyId)
    if (!client)
      return {
        ok: false,
        code: "unauthorized",
        message: "Sign in to save this tender to your workspace."
      }
    const { data, error } = await client.supabase.rpc("save_workspace_bid", {
      p_company_id: client.companyId,
      p_ocid: ocid
    })
    if (error) return unavailable()
    return { ok: true, bid: data as WorkspaceBid }
  } catch {
    return unavailable()
  }
}
export async function updateBid(
  companyId: string, id: string,
  version: number,
  patch: BidPatch
): Promise<MutationResult> {
  const parsed = mutationSchema.safeParse({ id, version, patch })
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      message: parsed.error.issues[0].message
    }
  try {
    const client = await workspaceClient(companyId)
    if (!client)
      return {
        ok: false,
        code: "unauthorized",
        message: "Your account changed. Sign in and try again."
      }
    const { data, error } = await client.supabase.rpc("update_workspace_bid", {
      p_company_id: client.companyId,
      p_id: id,
      p_version: version,
      p_patch: parsed.data.patch
    })
    if (error?.code === "40001") {
      const { data: current } = await client.supabase
        .from("workspace_bids")
        .select("*")
        .eq("company_id", client.companyId)
        .eq("id", id)
        .maybeSingle()
      return {
        ok: false,
        code: "conflict",
        message:
          "Someone else updated this bid. Your draft is kept; review the latest version and retry.",
        bid: current as WorkspaceBid | undefined
      }
    }
    if (error) return unavailable()
    return { ok: true, bid: data as WorkspaceBid }
  } catch {
    return unavailable()
  }
}
export async function deleteBid(
  companyId: string, id: string,
  version: number
): Promise<MutationResult> {
  if (
    !z.uuid().safeParse(id).success ||
    !Number.isInteger(version) ||
    version < 1
  )
    return { ok: false, code: "invalid", message: "Invalid bid." }
  try {
    const client = await workspaceClient(companyId)
    if (!client)
      return {
        ok: false,
        code: "unauthorized",
        message: "Sign in and try again."
      }
    const { error } = await client.supabase.rpc("delete_workspace_bid", {
      p_company_id: client.companyId,
      p_id: id,
      p_version: version
    })
    if (error?.code === "40001")
      return {
        ok: false,
        code: "conflict",
        message: "This bid changed. Refresh before removing it."
      }
    return error ? unavailable() : { ok: true, bid: null }
  } catch {
    return unavailable()
  }
}
export async function importGuestBids(
  companyId: string, ocids: string[]
): Promise<ImportResult[]> {
  const parsed = importSchema.safeParse(ocids)
  if (!parsed.success)
    return ocids.slice(0, 50).map((ocid) => ({ ocid, status: "failed" }))
  try {
    const client = await workspaceClient(companyId)
    if (!client) return ocids.map((ocid) => ({ ocid, status: "failed" }))
    const { data, error } = await client.supabase.rpc("import_workspace_bids", {
      p_company_id: client.companyId,
      p_ocids: parsed.data
    })
    return error
      ? ocids.map((ocid) => ({ ocid, status: "failed" }))
      : (data as ImportResult[])
  } catch {
    return ocids.map((ocid) => ({ ocid, status: "failed" }))
  }
}
