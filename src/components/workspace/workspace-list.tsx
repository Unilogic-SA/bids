"use client"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkspaceBulkBar } from "./workspace-bulk-bar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { attentionSignals, workspaceDate } from "@/lib/workspace/presentation"
import { isWorkspaceControl } from "@/lib/workspace/interaction"
import type {
  BidStage,
  BidOutcome,
  WorkspaceEntry
} from "@/lib/workspace/types"
import { BidStageMenu } from "./bid-stage-menu"
type Props = {
  selectionDisabled: boolean
  onBulkComplete: () => void
  items: WorkspaceEntry[]
  pending: Set<string>
  now: number
  onOpen: (bid: WorkspaceEntry) => void
  onStage: (bid: WorkspaceEntry, stage: BidStage) => void
  onOutcome: (bid: WorkspaceEntry, outcome: BidOutcome | null) => void
}
export function WorkspaceList(props: Props) {
  const [selected, setSelected] = useState(new Set<string>())
  const [busy, setBusy] = useState(false)
  const eligible = props.items.filter(bid => !props.pending.has(bid.id))
  const selectedItems = props.items.filter(bid => selected.has(bid.id))
  const allSelected = eligible.length > 0 && eligible.every(bid => selected.has(bid.id))
  return (
    <div className={selectedItems.length ? "pb-32" : ""}>
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="hidden md:table-header-group">
          <TableRow>
            <TableHead className="w-10"><Checkbox className="cursor-pointer" aria-label="Select all tenders on this page" disabled={busy || props.selectionDisabled || !eligible.length} checked={allSelected ? true : selectedItems.length ? "indeterminate" : false} onCheckedChange={checked => setSelected(checked ? new Set(eligible.map(bid => bid.id)) : new Set())} /></TableHead>
            <TableHead className="min-w-56 md:w-2/5">Tender</TableHead>
            <TableHead>Bid stage</TableHead>
            <TableHead>Closing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.items.map((bid) => {
            const signal = attentionSignals(bid, props.now)[0]
            return (
              <TableRow
                key={bid.id}
                data-state={selected.has(bid.id) ? "selected" : undefined}
                className="flex cursor-pointer flex-col gap-0 px-3 py-3 md:table-row md:p-0"
                onClick={(event) => {
                  if (!isWorkspaceControl(event.target)) props.onOpen(bid)
                }}
              >
                <TableCell className="px-0 py-1 md:px-3 md:py-3"><Checkbox className="cursor-pointer" aria-label={`Select ${bid.tender.title || bid.tender.tender_no || "saved tender"}`} checked={selected.has(bid.id)} disabled={busy || props.selectionDisabled || props.pending.has(bid.id)} onCheckedChange={checked => setSelected(previous => { const next = new Set(previous); if (checked) next.add(bid.id); else next.delete(bid.id); return next })} /></TableCell>
                <TableCell className="min-w-0 whitespace-normal px-0 py-1 md:px-3 md:py-3">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto w-full cursor-pointer justify-start whitespace-normal break-words p-0 text-left text-sm font-medium leading-snug text-foreground hover:text-primary"
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onOpen(bid)
                    }}
                  >
                    <span
                      className="line-clamp-2 min-w-0 break-words"
                      title={
                        bid.tender.title ||
                        bid.tender.tender_no ||
                        "Saved tender"
                      }
                    >
                      {bid.tender.title ||
                        bid.tender.tender_no ||
                        "Saved tender"}
                    </span>
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bid.tender.tender_no} ·{" "}
                    {bid.tender.buyer_name || "Buyer not supplied"}
                  </p>
                  {signal ? (
                    <p className="mt-1 text-xs text-primary">{signal.text}</p>
                  ) : null}
                </TableCell>
                <TableCell className="px-0 py-1 md:px-3 md:py-3">
                  <BidStageMenu
                    bid={bid}
                    disabled={busy || props.pending.has(bid.id)}
                    onStage={props.onStage}
                    onOutcome={props.onOutcome}
                  />
                  {bid.archived_at ? (
                    <Badge variant="secondary" className="ml-2">
                      Archived
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-normal px-0 py-1 text-xs md:px-3 md:py-3">
                  {workspaceDate(bid.tender.closing_at)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    {selectedItems.length > 0 ? <WorkspaceBulkBar items={selectedItems} disabled={props.selectionDisabled} onBusy={setBusy} onClear={() => setSelected(new Set())} onComplete={ids => { setSelected(previous => new Set([...previous].filter(id => !ids.has(id)))); props.onBulkComplete() }} /> : null}
    </div>
  )
}
