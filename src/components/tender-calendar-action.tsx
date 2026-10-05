"use client"

import { useEffect, useState } from "react"
import { IconCalendarEvent, IconChevronDown } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trackUmamiEvent } from "@/lib/analytics"
import {
  buildTenderCalendar,
  buildTenderCalendarProviderUrl,
  getTenderCalendarFilename,
  getUpcomingTenderEvents,
  type TenderCalendarDetails,
  type TenderCalendarEventType,
  type TenderCalendarProvider,
} from "@/lib/tenders/calendar"

const providers: Array<{ provider: TenderCalendarProvider; label: string }> = [
  { provider: "google", label: "Google Calendar" },
  { provider: "outlook", label: "Outlook.com — personal accounts" },
  { provider: "microsoft365", label: "Microsoft 365 — work/school accounts" },
]
const labels = { closing: "Closing deadline", briefing: "Briefing session" }

export function TenderCalendarAction({
  tender,
}: {
  tender: TenderCalendarDetails
}) {
  const [now, setNow] = useState<Date | null>(null)
  const [selected, setSelected] = useState<TenderCalendarEventType>("closing")
  // Avoid server/browser clock hydration differences and expire actions while
  // a tender page stays open. The click handlers also recheck the exact instant.
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
  const selection = events.includes(selected) ? selected : events[0]
  if (!selection) return null

  function downloadCalendar() {
    if (!getUpcomingTenderEvents(tender).includes(selection)) return
    const calendar = buildTenderCalendar(tender, selection)
    if (!calendar) return
    const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = getTenderCalendarFilename(tender.tenderNumber, selection)
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
    trackUmamiEvent("tender_calendar_download", {
      event_type: selection,
      ocid: tender.ocid,
    })
  }

  function trackProvider(
    provider: TenderCalendarProvider,
    event: React.MouseEvent<HTMLAnchorElement>
  ) {
    if (!getUpcomingTenderEvents(tender).includes(selection)) {
      event.preventDefault()
      return
    }
    trackUmamiEvent("tender_calendar_open", {
      provider,
      event_type: selection,
      ocid: tender.ocid,
    })
  }

  const trigger = (
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
  )

  if (events.length === 1)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuGroup>
            {providers.map(({ provider, label }) => {
              const href = buildTenderCalendarProviderUrl(
                tender,
                selection,
                provider,
                now!
              )
              return href ? (
                <DropdownMenuItem asChild key={provider}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => trackProvider(provider, event)}
                  >
                    {label}
                  </a>
                </DropdownMenuItem>
              ) : null
            })}
            <DropdownMenuItem onSelect={downloadCalendar}>
              Download calendar file (.ics)
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to calendar</DialogTitle>
          <DialogDescription>
            Choose an event, then review and save it in your calendar.
          </DialogDescription>
        </DialogHeader>
        <Select
          value={selection}
          onValueChange={(value) =>
            setSelected(value as TenderCalendarEventType)
          }
        >
          <SelectTrigger
            aria-label="Calendar event"
            className="min-h-11 w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {events.map((event) => (
              <SelectItem key={event} value={event}>
                {labels[event]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-2">
          {providers.map(({ provider, label }) => {
            const href = buildTenderCalendarProviderUrl(
              tender,
              selection,
              provider,
              now!
            )
            return href ? (
              <Button
                asChild
                key={provider}
                variant="outline"
                className="min-h-11 justify-start"
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => trackProvider(provider, event)}
                >
                  {label}
                </a>
              </Button>
            ) : null
          })}
          <Button
            variant="ghost"
            className="min-h-11 justify-start"
            onClick={downloadCalendar}
          >
            Download calendar file (.ics)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {selection === "closing"
            ? "The five-minute calendar placeholder does not extend the closing deadline."
            : "Briefing end time was not supplied; a thirty-minute calendar placeholder is used."}
        </p>
      </DialogContent>
    </Dialog>
  )
}
