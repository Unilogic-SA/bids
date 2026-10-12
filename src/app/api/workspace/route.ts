import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_CACHE_HEADERS } from "@/lib/auth/session"
import { readWorkspace, readWorkspaceEntry } from "@/lib/workspace/query"
import { parseWorkspaceFilters } from "@/lib/workspace/validation"
import { z } from "zod"
export const dynamic = "force-dynamic"
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("bid")
    if (id && !z.uuid().safeParse(id).success)
      return NextResponse.json(
        { message: "Invalid bid." },
        { status: 400, headers: ACCOUNT_CACHE_HEADERS }
      )
    const data = id
      ? await readWorkspaceEntry(id)
      : await readWorkspace(parseWorkspaceFilters(request.nextUrl.searchParams))
    return NextResponse.json(data, {
      status: data ? 200 : 401,
      headers: ACCOUNT_CACHE_HEADERS
    })
  } catch {
    return NextResponse.json(
      { message: "Your workspace could not be loaded. Please retry." },
      { status: 503, headers: ACCOUNT_CACHE_HEADERS }
    )
  }
}
