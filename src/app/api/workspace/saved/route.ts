import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_CACHE_HEADERS } from "@/lib/auth/session"
import { readSavedBids } from "@/lib/workspace/query"
import { importSchema } from "@/lib/workspace/validation"
export const dynamic = "force-dynamic"
export async function GET(request: NextRequest) {
  try {
    const parsed = importSchema.safeParse(
      JSON.parse(request.nextUrl.searchParams.get("ocids") || "[]")
    )
    if (!parsed.success)
      return NextResponse.json(
        { message: "Invalid tender references." },
        { status: 400, headers: ACCOUNT_CACHE_HEADERS }
      )
    const bids = await readSavedBids(parsed.data)
    return NextResponse.json(
      { bids },
      { status: bids ? 200 : 401, headers: ACCOUNT_CACHE_HEADERS }
    )
  } catch {
    return NextResponse.json(
      { message: "Saved tenders could not be loaded. Please retry." },
      { status: 503, headers: ACCOUNT_CACHE_HEADERS }
    )
  }
}
