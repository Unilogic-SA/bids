"use client"
import {
  IconAlertTriangle,
  IconCalendar,
  IconClock,
  IconInfoCircle
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  attentionSignals,
  compactWorkspaceDate,
  closingUrgency,
  workspaceDate,
  type AttentionSignal
} from "@/lib/workspace/presentation"
import type { WorkspaceEntry } from "@/lib/workspace/types"
import { cn } from "@/lib/utils"

export function signalClass(kind: string) {
  return kind === "close" || kind === "briefing"
    ? "text-destructive"
    : kind === "deadline"
      ? "text-primary dark:text-chart-1"
      : "text-muted-foreground"
}
export function SignalIcon({ kind }: { kind: string }) {
  const Icon =
    kind === "close"
      ? IconClock
      : kind === "briefing"
        ? IconCalendar
        : kind === "deadline"
          ? IconAlertTriangle
          : IconInfoCircle
  return <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
}
function Signal({ signal }: { signal: AttentionSignal }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs leading-relaxed",
        signalClass(signal.kind)
      )}
    >
      <SignalIcon kind={signal.kind} />
      <span>{signal.text}</span>
    </p>
  )
}
export function BidSignals({ bid, now }: { bid: WorkspaceEntry; now: number }) {
  const signals = attentionSignals(bid, now)
  if (!signals.length) return null
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <div className="min-w-0 flex-1">
        <Signal signal={signals[0]} />
      </div>
      {signals.length > 1 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              data-workspace-control
              size="sm"
              variant="ghost"
              className="h-6 shrink-0 px-1.5 text-xs"
              aria-label={`Show all ${signals.length} alerts`}
            >
              +{signals.length - 1} alert{signals.length > 2 ? "s" : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            data-workspace-control
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            align="start"
            className="space-y-2 p-3"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            {signals.map((signal) => (
              <Signal key={signal.kind} signal={signal} />
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
export function BidDeadline({
  bid,
  now,
  mobile
}: {
  bid: WorkspaceEntry
  now: number
  mobile?: boolean
}) {
  const urgency = closingUrgency(bid, now)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
      <Tooltip open={mobile ? false : undefined}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="cursor-help"
            aria-label={`Closing time: ${workspaceDate(bid.tender.closing_at)}`}
          >
            {compactWorkspaceDate(bid.tender.closing_at)}
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={6} className="pointer-events-none">
          {workspaceDate(bid.tender.closing_at)}
        </TooltipContent>
      </Tooltip>
      {urgency ? (
        <Badge
          variant={urgency === "Deadline passed" ? "destructive" : "secondary"}
          className={cn(
            "text-xs",
            urgency !== "Deadline passed" && "bg-primary/10 text-primary dark:text-chart-1"
          )}
        >
          {urgency}
        </Badge>
      ) : null}
    </div>
  )
}
