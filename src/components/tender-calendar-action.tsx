"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { IconCalendarEvent, IconChevronDown } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { trackUmamiEvent } from "@/lib/analytics"
import {
  buildTenderCalendarProviderUrl,
  getUpcomingTenderEvents,
  type TenderCalendarDetails,
  type TenderCalendarEventType,
} from "@/lib/tenders/calendar"
import { detectCalendarDevice } from "@/lib/tenders/calendar-device"

const labels = { closing: "Closing date", briefing: "Briefing date" }

export function TenderCalendarAction({
  tender,
}: {
  tender: TenderCalendarDetails
}) {
  const [now, setNow] = useState<Date | null>(null)
  const compact = useSyncExternalStore(subscribeCompact, getCompact, () => false)

  useEffect(() => {
    const refresh = () => setNow(new Date())
    refresh()
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  const events = now ? getUpcomingTenderEvents(tender, now) : []
  if (!now)
    return <Skeleton aria-hidden="true" className="h-8 w-24 sm:h-7 sm:w-36" />
  if (!events.length) return null

  function openEvent(
    eventType: TenderCalendarEventType,
    event: React.MouseEvent<HTMLAnchorElement>
  ) {
    if (!getUpcomingTenderEvents(tender).includes(eventType)) {
      event.preventDefault()
      toast("This event has ended", { id: "calendar" })
      setNow(new Date())
      return
    }
    trackUmamiEvent("tender_calendar_open", {
      provider: "google",
      event_type: eventType,
      ocid: tender.ocid,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-8 sm:h-7"
          size="sm"
          type="button"
          aria-label="Add to calendar"
          variant="outline"
        >
          <IconCalendarEvent data-icon="inline-start" />
          <span className="sm:hidden">Calendar</span>
          <span className="hidden sm:inline">Add to calendar</span>
          <IconChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Google Calendar</DropdownMenuLabel>
        <DropdownMenuGroup>
          {events.map((eventType) => {
            const href = buildTenderCalendarProviderUrl(
              tender,
              eventType,
              "google",
              now
            )
            return href ? (
              <DropdownMenuItem asChild key={eventType} className="min-h-11 sm:min-h-8">
                <a
                  href={href}
                  target={compact ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  onClick={(event) => openEvent(eventType, event)}
                >
                  <IconCalendarEvent />
                  {labels[eventType]}
                </a>
              </DropdownMenuItem>
            ) : null
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Preserve the tested same-tab Google handoff on phones and desktop-mode iPads.
function getCompact() {
  const device = detectCalendarDevice(navigator)
  return (
    window.matchMedia("(max-width: 639px)").matches ||
    device === "ios" ||
    device === "android"
  )
}
function subscribeCompact(onChange: () => void) {
  const media = window.matchMedia("(max-width: 639px)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}
