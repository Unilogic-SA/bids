"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import {
  IconCalendarEvent,
  IconChevronDown,
  IconDownload,
} from "@tabler/icons-react"
import { toast } from "sonner"
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
import { Skeleton } from "@/components/ui/skeleton"
import { trackUmamiEvent } from "@/lib/analytics"
import {
  buildTenderCalendarProviderUrl,
  getUpcomingTenderEvents,
  type TenderCalendarDetails,
  type TenderCalendarEventType,
} from "@/lib/tenders/calendar"
import {
  detectCalendarDevice,
  getCalendarChoices,
} from "@/lib/tenders/calendar-device"

const providerLabels = {
  google: "Google Calendar",
  outlook: "Outlook.com — personal",
  microsoft365: "Microsoft 365 — work/school",
  file: "Calendar file (.ics)",
}
const labels = { closing: "Closing deadline", briefing: "Briefing session" }

export function TenderCalendarAction({
  tender,
}: {
  tender: TenderCalendarDetails
}) {
  const [now, setNow] = useState<Date | null>(null)
  const [selected, setSelected] = useState<TenderCalendarEventType>("closing")
  const device = useSyncExternalStore(
    subscribeDevice,
    getDevice,
    () => "other" as const
  )
  const compact = useSyncExternalStore(
    subscribeCompact,
    getCompact,
    () => false
  )
  // No OS hint is sent to the server or analytics. It only orders the choices.
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
  if (!now)
    return <Skeleton aria-hidden="true" className="h-8 w-24 sm:h-7 sm:w-36" />
  if (!selection) return null

  const choices = getCalendarChoices(device).map((provider) => ({
    provider,
    label:
      provider === "file" && (device === "ios" || device === "mac")
        ? "Apple Calendar (.ics)"
        : providerLabels[provider],
    href:
      provider === "file"
        ? `/tenders/${encodeURIComponent(tender.ocid)}/calendar?event=${selection}`
        : buildTenderCalendarProviderUrl(tender, selection, provider, now),
  }))

  function trackChoice(
    provider: (typeof choices)[number]["provider"],
    event: React.MouseEvent<HTMLAnchorElement>
  ) {
    if (!getUpcomingTenderEvents(tender).includes(selection)) {
      event.preventDefault()
      toast("This event has ended", { id: "calendar" })
      setNow(new Date())
      return
    }
    if (provider === "file") toast("Opening calendar file", { id: "calendar" })
    trackUmamiEvent(
      provider === "file" ? "tender_calendar_download" : "tender_calendar_open",
      {
        ...(provider === "file" ? {} : { provider }),
        event_type: selection,
        ocid: tender.ocid,
      }
    )
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

  if (!compact && events.length === 1)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuGroup>
            {choices.map(({ provider, label, href }) =>
              href ? (
                <DropdownMenuItem asChild key={provider}>
                  <a
                    href={href}
                    target={provider === "file" ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    onClick={(event) => trackChoice(provider, event)}
                  >
                    {provider === "file" ? (
                      <IconDownload />
                    ) : (
                      <IconCalendarEvent />
                    )}
                    {label}
                  </a>
                </DropdownMenuItem>
              ) : null
            )}
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
            Choose a calendar, then review and save the event.
          </DialogDescription>
        </DialogHeader>
        {events.length > 1 ? (
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
        ) : null}
        <div className="flex flex-col gap-2">
          {choices.map(({ provider, label, href }) =>
            href ? (
              <Button
                asChild
                key={provider}
                variant="outline"
                className="min-h-11 justify-start"
              >
                <a
                  href={href}
                  target={compact || provider === "file" ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  onClick={(event) => trackChoice(provider, event)}
                >
                  {provider === "file" ? (
                    <IconDownload data-icon="inline-start" />
                  ) : (
                    <IconCalendarEvent data-icon="inline-start" />
                  )}
                  {label}
                </a>
              </Button>
            ) : null
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          If a calendar app doesn’t open, import the calendar file instead.
        </p>
        <p className="text-xs text-muted-foreground">
          {selection === "closing"
            ? "The closing deadline is the event’s start time."
            : "Briefing end time was not supplied; a thirty-minute placeholder is used."}
        </p>
      </DialogContent>
    </Dialog>
  )
}

function getDevice() {
  return detectCalendarDevice(navigator)
}
function subscribeDevice() {
  return () => {}
}
function getCompact() {
  const device = getDevice()
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
