import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { ACCOUNT_CACHE_HEADERS } from "@/lib/auth/session"
import { workspaceClient } from "@/lib/workspace/query"

export const dynamic = "force-dynamic"
const scope = z.uuid()
const mutation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item"), companyId: scope, bidId: z.uuid(), keys: z.array(z.string().min(1).max(160)).min(1).max(5), action: z.enum(["read", "dismiss", "snooze", "unsnooze"]) }).strict(),
  z.object({ type: z.literal("preferences"), companyId: scope, changes: z.boolean(), reminders: z.boolean() }).strict(),
])
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: ACCOUNT_CACHE_HEADERS })
}
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company") || ""
  const page = z.coerce.number().int().min(1).max(10000).safeParse(request.nextUrl.searchParams.get("page") || "1")
  const view = z.enum(["inbox", "snoozed"]).safeParse(request.nextUrl.searchParams.get("view") || "inbox")
  if (!scope.safeParse(companyId).success || !page.success || !view.success) return reply({ message: "Invalid activity request." }, 400)
  try {
    const client = await workspaceClient(companyId)
    if (!client) return reply({ message: "Workspace unavailable." }, 403)
    const { data, error } = await client.supabase.rpc("list_workspace_activity", { p_company_id: companyId, p_page: page.data, p_view: view.data })
    if (error) {
      console.warn("Activity could not be loaded", { code: error.code })
      return reply({ message: "Activity is temporarily unavailable. Please retry." }, 503)
    }
    return reply(data)
  } catch {
    return reply({ message: "Activity is temporarily unavailable. Please retry." }, 503)
  }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ message: "Request not permitted." }, 403)
  if (Number(request.headers.get("content-length") || 0) > 4096) return reply({ message: "Request too large." }, 413)
  let input: z.infer<typeof mutation>
  try {
    const text = await request.text()
    if (text.length > 4096) return reply({ message: "Request too large." }, 413)
    const parsed = mutation.safeParse(JSON.parse(text))
    if (!parsed.success) return reply({ message: "Invalid activity update." }, 400)
    input = parsed.data
  } catch { return reply({ message: "Invalid activity update." }, 400) }
  try {
    const client = await workspaceClient(input.companyId)
    if (!client) return reply({ message: "Workspace unavailable." }, 403)
    const result = input.type === "preferences"
      ? await client.supabase.rpc("set_workspace_activity_preferences", { p_company_id: input.companyId, p_changes: input.changes, p_reminders: input.reminders })
      : await client.supabase.rpc("update_workspace_activity", { p_company_id: input.companyId, p_bid_id: input.bidId, p_keys: input.keys, p_action: input.action })
    if (result.error) return reply({ message: "Activity could not be updated. Please retry." }, result.error.code === "42501" ? 403 : 503)
    return reply({ ok: true })
  } catch { return reply({ message: "Activity could not be updated. Please retry." }, 503) }
}
