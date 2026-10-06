import { absoluteUrl } from "@/lib/seo"
import {
  buildTenderCalendar,
  getTenderCalendarFilename,
  getUpcomingTenderEvents,
} from "@/lib/tenders/calendar"
import { getTenderDetail } from "@/lib/tenders/query"

export const dynamic = "force-dynamic"

// A real same-origin calendar file avoids blob/new-window handling on mobile.
// Uses the same public, RLS-bound read as the tender detail page.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ocid: string }> }
) {
  const selection = new URL(request.url).searchParams.get("event")
  if (selection !== "closing" && selection !== "briefing")
    return new Response("Choose a closing deadline or briefing.", {
      status: 400,
    })
  const { ocid } = await params
  try {
    const { tender, configMissing } = await getTenderDetail(ocid)
    if (configMissing)
      return new Response("Calendar temporarily unavailable.", { status: 503 })
    if (!tender) return new Response("Tender not found.", { status: 404 })
    const details = {
      ocid: tender.ocid,
      tenderNumber: tender.tender_no || "Tender notice",
      description: tender.bid_description || tender.title || "Tender notice",
      buyer: tender.buyer_name || tender.department || "",
      canonicalUrl: absoluteUrl(
        tender.detail_path || `/tenders/${encodeURIComponent(tender.ocid)}`
      ),
      closingAt: tender.closing_at,
      briefingAt: tender.briefing_datetime,
      briefingVenue: tender.briefing_venue,
      briefingCompulsory: tender.compulsory_briefing,
    }
    if (!getUpcomingTenderEvents(details).includes(selection))
      return new Response("This event has ended or its date is unavailable.", {
        status: 410,
      })
    const calendar = buildTenderCalendar(details, selection)
    if (!calendar)
      return new Response("Calendar date unavailable.", { status: 410 })
    return new Response(calendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getTenderCalendarFilename(details.tenderNumber, selection)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response("Calendar temporarily unavailable. Please try again.", {
      status: 503,
    })
  }
}
