import type { BidOutcome, BidStage } from "@/lib/workspace/types"
import { OUTCOME_LABELS, STAGE_LABELS } from "@/lib/workspace/types"
import { cn } from "@/lib/utils"

type BidState = BidStage | BidOutcome
// State colour accompanies the label; it never replaces it.
const STATE_STYLES: Record<BidState, { trigger: string; dot: string }> = {
  saved: {
    trigger:
      "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
    dot: "bg-muted-foreground"
  },
  reviewing: {
    trigger:
      "border-transparent bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60",
    dot: "bg-amber-500"
  },
  preparing: {
    trigger:
      "border-transparent bg-primary/10 text-primary hover:bg-primary/15 dark:text-chart-1",
    dot: "bg-primary dark:bg-chart-1"
  },
  ready: {
    trigger:
      "border-transparent bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60",
    dot: "bg-sky-500"
  },
  submitted: {
    trigger:
      "border-transparent bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60",
    dot: "bg-emerald-500"
  },
  won: {
    trigger:
      "border-transparent bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60",
    dot: "bg-emerald-600"
  },
  unsuccessful: {
    trigger:
      "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/15",
    dot: "bg-destructive"
  },
  not_bidding: {
    trigger:
      "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
    dot: "bg-muted-foreground"
  },
  withdrawn: {
    trigger:
      "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
    dot: "bg-muted-foreground"
  }
}
export function bidStateTriggerClass(state: BidState) {
  return STATE_STYLES[state].trigger
}
export function BidStateLabel({
  state,
  className
}: {
  state: BidState
  className?: string
}) {
  const label =
    state in STAGE_LABELS
      ? STAGE_LABELS[state as BidStage]
      : OUTCOME_LABELS[state as BidOutcome]
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", STATE_STYLES[state].dot)}
      />
      <span>{label}</span>
    </span>
  )
}
