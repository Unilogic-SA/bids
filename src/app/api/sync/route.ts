import { NextResponse, type NextRequest } from "next/server"

import { runTenderSync } from "@/lib/etenders/ocds"
import { hasSupabaseServiceConfig } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}

async function handleSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL, publishable key, and ETENDERS_SYNC_SECRET.",
      },
      { status: 500 }
    )
  }

  const url = new URL(request.url)
  const body = request.method === "POST" ? await readJsonBody(request) : {}

  try {
    const result = await runTenderSync({
      mode: parseMode(readOption("mode", body, url) || "backfill"),
      pageSize: parseNumber(readOption("pageSize", body, url)),
      maxPages: parseNumber(readOption("maxPages", body, url)),
      months: parseNumber(readOption("months", body, url)),
      days: parseNumber(readOption("days", body, url)),
      dateFrom: readOption("dateFrom", body, url),
      dateTo: readOption("dateTo", body, url),
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.ETENDERS_SYNC_SECRET
  if (!secret) return false

  const url = new URL(request.url)
  const header = request.headers.get("authorization")

  return header === `Bearer ${secret}` || url.searchParams.get("secret") === secret
}

async function readJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readOption(
  key: string,
  body: Record<string, unknown>,
  url: URL
) {
  const bodyValue = body[key]
  if (typeof bodyValue === "string" || typeof bodyValue === "number") {
    return String(bodyValue)
  }

  return url.searchParams.get(key) || undefined
}

function parseNumber(value?: string) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseMode(value: string) {
  if (value === "daily" || value === "range") return value
  return "backfill"
}
