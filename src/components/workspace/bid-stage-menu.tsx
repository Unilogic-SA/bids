"use client"
import { IconChevronDown } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  BID_STAGES,
  STAGE_LABELS,
  OUTCOME_LABELS,
  type BidStage,
  type BidOutcome,
  type WorkspaceEntry
} from "@/lib/workspace/types"
export function BidStageMenu({
  bid,
  disabled,
  onStage,
  onOutcome
}: {
  bid: WorkspaceEntry
  disabled?: boolean
  onStage: (bid: WorkspaceEntry, stage: BidStage) => void
  onOutcome: (bid: WorkspaceEntry, outcome: BidOutcome | null) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 max-w-full"
          disabled={disabled}
          aria-label={`Change stage for ${bid.tender.tender_no || bid.tender.title}`}
        >
          {bid.outcome ? OUTCOME_LABELS[bid.outcome] : STAGE_LABELS[bid.stage]}
          <IconChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {bid.outcome ? (
          <DropdownMenuItem onSelect={() => onOutcome(bid, null)}>
            Reopen bid
          </DropdownMenuItem>
        ) : (
          BID_STAGES.map((stage) => (
            <DropdownMenuItem
              key={stage}
              disabled={stage === bid.stage}
              onSelect={() => onStage(bid, stage)}
            >
              {STAGE_LABELS[stage]}
            </DropdownMenuItem>
          ))
        )}
        {!bid.outcome ? (
          <>
            <DropdownMenuSeparator />
            {bid.stage === "submitted" ? (
              <>
                <DropdownMenuItem onSelect={() => onOutcome(bid, "won")}>
                  Won
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onOutcome(bid, "unsuccessful")}
                >
                  Unsuccessful
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onSelect={() => onOutcome(bid, "not_bidding")}>
                Not bidding
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onOutcome(bid, "withdrawn")}>
              Withdrawn
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
