"use client"
import { IconChevronDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { BidStateLabel, bidStateTriggerClass } from "./stage-presentation"
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
    <div
      className="inline-flex"
      data-workspace-control
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 max-w-full cursor-pointer gap-2 disabled:cursor-not-allowed",
              bidStateTriggerClass(bid.outcome || bid.stage)
            )}
            disabled={disabled}
            aria-label={`Change stage for ${bid.tender.tender_no || bid.tender.title}`}
          >
            <BidStateLabel state={bid.outcome || bid.stage} />
            <IconChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {bid.outcome ? (
            <DropdownMenuItem
              className="cursor-pointer data-disabled:cursor-default"
              onSelect={() => onOutcome(bid, null)}
            >
              Reopen bid
            </DropdownMenuItem>
          ) : (
            BID_STAGES.map((stage) => (
              <DropdownMenuItem
                className="cursor-pointer data-disabled:cursor-default"
                key={stage}
                disabled={stage === bid.stage}
                onSelect={() => onStage(bid, stage)}
              >
                <BidStateLabel state={stage} />
              </DropdownMenuItem>
            ))
          )}
          {!bid.outcome ? (
            <>
              <DropdownMenuSeparator />
              {bid.stage === "submitted" ? (
                <>
                  <DropdownMenuItem
                    className="cursor-pointer data-disabled:cursor-default"
                    onSelect={() => onOutcome(bid, "won")}
                  >
                    <BidStateLabel state="won" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer data-disabled:cursor-default"
                    onSelect={() => onOutcome(bid, "unsuccessful")}
                  >
                    <BidStateLabel state="unsuccessful" />
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  className="cursor-pointer data-disabled:cursor-default"
                  onSelect={() => onOutcome(bid, "not_bidding")}
                >
                  <BidStateLabel state="not_bidding" />
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer data-disabled:cursor-default"
                onSelect={() => onOutcome(bid, "withdrawn")}
              >
                <BidStateLabel state="withdrawn" />
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
