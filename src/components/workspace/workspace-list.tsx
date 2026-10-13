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
import {
  attentionSignals,
  workspaceDate,
  DEFAULT_ACTIONS
} from "@/lib/workspace/presentation"
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
  const eligible = props.items.filter(bid => !props.pending.has(bid.id))
  const selectedItems = props.items.filter(bid => selected.has(bid.id))
  const allSelected = eligible.length > 0 && eligible.every(bid => selected.has(bid.id))
  const [busy, setBusy] = useState(false)
  return (
    <div className={selectedItems.length ? "pb-32" : ""}>
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox className="cursor-pointer" aria-label="Select all tenders on this page" disabled={busy || props.selectionDisabled || !eligible.length}
                checked={allSelected ? true : selectedItems.length ? "indeterminate" : false}
                onCheckedChange={checked => setSelected(checked ? new Set(eligible.map(bid => bid.id)) : new Set())} />
            </TableHead>
            <TableHead className="min-w-56 md:w-2/5">Tender</TableHead>
            <TableHead>Bid stage</TableHead>
            <TableHead>Closing</TableHead>
            <TableHead>Next action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.items.map((bid) => {
            const signal = attentionSignals(bid, props.now)[0]
            return (
              <TableRow
                key={bid.id}
                data-state={selected.has(bid.id) ? "selected" : undefined}
              >
                <TableCell>
                  <Checkbox className="cursor-pointer" aria-label={`Select ${bid.tender.title || bid.tender.tender_no || "saved tender"}`}
                    checked={selected.has(bid.id)} disabled={busy || props.selectionDisabled || props.pending.has(bid.id)}
                    onCheckedChange={checked => setSelected(previous => {
                      const next = new Set(previous)
                      if (checked) next.add(bid.id)
                      else next.delete(bid.id)
                      return next
                    })} />
                </TableCell>
                <TableCell className="min-w-0 whitespace-normal px-3 py-3">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto w-full justify-start whitespace-normal p-0 text-left text-sm font-medium leading-snug text-foreground hover:text-primary"
                    onClick={() => props.onOpen(bid)}
                  >
                    {bid.tender.title || bid.tender.tender_no || "Saved tender"}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bid.tender.tender_no} ·{" "}
                    {bid.tender.buyer_name || "Buyer not supplied"}
                  </p>
                  {signal ? (
                    <p className="mt-1 text-xs text-primary">{signal.text}</p>
                  ) : null}
                </TableCell>
                <TableCell className="px-3 py-3">
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
                <TableCell className="whitespace-normal px-3 py-3 text-xs">
                  {workspaceDate(bid.tender.closing_at)}
                </TableCell>
                <TableCell className="whitespace-normal px-3 py-3 text-xs">
                  {bid.next_action || DEFAULT_ACTIONS[bid.stage]}
                  {bid.next_action_due_at ? (
                    <p className="mt-1 text-muted-foreground">
                      Target: {workspaceDate(bid.next_action_due_at)}
                    </p>
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    {selectedItems.length > 0 ? <WorkspaceBulkBar items={selectedItems} disabled={props.selectionDisabled}
      onBusy={setBusy} onClear={() => setSelected(new Set())} onComplete={ids => {
        setSelected(previous => new Set([...previous].filter(id => !ids.has(id))))
        props.onBulkComplete()
      }} /> : null}
    </div>
  )
}
