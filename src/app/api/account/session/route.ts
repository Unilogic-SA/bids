import { NextResponse } from "next/server"
import { ACCOUNT_CACHE_HEADERS, getCustomerAccount } from "@/lib/auth/session"

export const dynamic = "force-dynamic"
export async function GET() {
  return NextResponse.json(await getCustomerAccount(), { headers: ACCOUNT_CACHE_HEADERS })
}
