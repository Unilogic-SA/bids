import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const ALLOWED_DOCUMENT_HOSTS = new Set(["etenders.gov.za", "www.etenders.gov.za"])
const FETCH_TIMEOUT_MS = 15_000

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const sourceUrl = parseSourceUrl(url.searchParams.get("url"))

  if (!sourceUrl || !isAllowedDocumentUrl(sourceUrl)) {
    return NextResponse.json(
      { error: "Unsupported document preview URL." },
      { status: 400 }
    )
  }

  if (!isLikelyPdf(sourceUrl)) {
    return NextResponse.json(
      { error: "Only PDF previews are supported by this endpoint." },
      { status: 415 }
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(sourceUrl, {
      headers: getUpstreamHeaders(request),
      signal: controller.signal,
    })

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return NextResponse.json(
        { error: "Unable to fetch document preview." },
        { status: 502 }
      )
    }

    return new Response(upstreamResponse.body, {
      headers: getPreviewHeaders(sourceUrl, upstreamResponse),
      status: upstreamResponse.status === 206 ? 206 : 200,
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"

    return NextResponse.json(
      { error: aborted ? "Document preview timed out." : "Preview failed." },
      { status: aborted ? 504 : 502 }
    )
  } finally {
    clearTimeout(timeout)
  }
}

function parseSourceUrl(value: string | null) {
  if (!value) return null

  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isAllowedDocumentUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    ALLOWED_DOCUMENT_HOSTS.has(url.hostname.toLowerCase()) &&
    url.pathname.toLowerCase() === "/home/download"
  )
}

function isLikelyPdf(url: URL) {
  const candidates = [
    url.pathname,
    url.searchParams.get("blobName"),
    url.searchParams.get("downloadedFileName"),
  ]

  return candidates.some((value) => value?.toLowerCase().includes(".pdf"))
}

function getUpstreamHeaders(request: NextRequest) {
  const headers = new Headers({
    "User-Agent": "Bids ZA document preview",
  })
  const range = request.headers.get("range")

  if (range) {
    headers.set("Range", range)
  }

  return headers
}

function getPreviewHeaders(sourceUrl: URL, upstreamResponse: Response) {
  const headers = new Headers({
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "Content-Disposition": `inline; filename="${getPdfFileName(sourceUrl)}"`,
    "Content-Type": "application/pdf",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  })

  copyHeader(upstreamResponse, headers, "accept-ranges")
  copyHeader(upstreamResponse, headers, "content-length")
  copyHeader(upstreamResponse, headers, "content-range")

  return headers
}

function copyHeader(source: Response, target: Headers, name: string) {
  const value = source.headers.get(name)

  if (value) {
    target.set(name, value)
  }
}

function getPdfFileName(url: URL) {
  const fileName =
    url.searchParams.get("downloadedFileName") ||
    url.searchParams.get("blobName") ||
    "document.pdf"

  return fileName.replace(/["\r\n]/g, "").replace(/\s+/g, " ")
}
