"use client"

import { IconCalendarEvent, IconChevronDown } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trackUmamiEvent } from "@/lib/analytics"
import {
  buildTenderCalendar,
  getTenderCalendarFilename,
  isValidTenderTimestamp,
  type TenderCalendarDetails,
  type TenderCalendarSelection,
} from "@/lib/tenders/calendar"

export function TenderCalendarAction({
  tender,
}: {
  tender: TenderCalendarDetails
}) {
  const hasClosing = isValidTenderTimestamp(tender.closingAt)
  const hasBriefing = isValidTenderTimestamp(tender.briefingAt)
  const options: Array<{
    label: string
    selection: TenderCalendarSelection
  }> = []

  if (hasClosing) {
    options.push({ label: "Closing deadline", selection: "closing" })
  }

  if (hasBriefing) {
    options.push({ label: "Briefing session", selection: "briefing" })
  }

  if (hasClosing && hasBriefing) {
    options.push({
      label: "Closing deadline and briefing",
      selection: "combined",
    })
  }

  if (options.length === 0) return null

  function downloadCalendar(selection: TenderCalendarSelection) {
    const calendar = buildTenderCalendar(tender, selection)
    if (!calendar) return

    const blob = new Blob([calendar], {
      type: "text/calendar;charset=utf-8",
    })
    const objectUrl = URL.createObjectURL(blob)
    const downloadLink = document.createElement("a")

    downloadLink.href = objectUrl
    downloadLink.download = getTenderCalendarFilename(
      tender.tenderNumber,
      selection
    )
    downloadLink.hidden = true
    document.body.append(downloadLink)
    downloadLink.click()
    downloadLink.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)

    trackUmamiEvent("tender_calendar_download", {
      event_type: selection,
      ocid: tender.ocid,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="min-h-11 sm:min-h-7"
          size="sm"
          type="button"
          variant="outline"
        >
          <IconCalendarEvent data-icon="inline-start" />
          Add to calendar
          <IconChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          {options.map((option) => (
            <DropdownMenuItem
              key={option.selection}
              onSelect={() => downloadCalendar(option.selection)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
