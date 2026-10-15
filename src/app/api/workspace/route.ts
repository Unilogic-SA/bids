import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_CACHE_HEADERS } from "@/lib/auth/session"
import { readWorkspace, readWorkspaceEntry } from "@/lib/workspace/query"
import { parseWorkspaceFilters } from "@/lib/workspace/validation"
import { z } from "zod"
export const dynamic = "force-dynamic"
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("company") || ""
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) return NextResponse.json({ message: "Select a workspace." }, { status: 400, headers: ACCOUNT_CACHE_HEADERS })
    const id = request.nextUrl.searchParams.get("bid")
    if (id && !z.uuid().safeParse(id).success)
      return NextResponse.json(
        { message: "Invalid bid." },
        { status: 400, headers: ACCOUNT_CACHE_HEADERS }
      )
    const data = id
      ? await readWorkspaceEntry(companyId, id)
      : await readWorkspace(companyId, parseWorkspaceFilters(request.nextUrl.searchParams))
    return NextResponse.json(data, {
      status: data ? 200 : 403,
      headers: ACCOUNT_CACHE_HEADERS
    })
  } catch {
    return NextResponse.json(
      { message: "Your workspace could not be loaded. Please retry." },
      { status: 503, headers: ACCOUNT_CACHE_HEADERS }
    )
  }
}
