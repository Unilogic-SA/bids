"use client"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import {
  BID_STAGES,
  type BidStage,
  type WorkspaceEntry
} from "@/lib/workspace/types"
import { bulkStageSelection, updateBidStages } from "@/lib/workspace/bulk"
import { fromSastInput, sastInput } from "@/lib/workspace/presentation"
import { BidStateLabel } from "./stage-presentation"
import { useWorkspace } from "./workspace-provider"

type Props = {
  items: WorkspaceEntry[]
  disabled: boolean
  onBusy: (busy: boolean) => void
  onClear: () => void
  onDeselectUnavailable: () => void
  onComplete: (ids: Set<string>) => void
}
export function WorkspaceBulkBar({
  items,
  disabled,
  onBusy,
  onClear,
  onDeselectUnavailable,
  onComplete
}: Props) {
  const workspace = useWorkspace()
  const [stage, setStage] = useState<BidStage | "">("")
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const [submitted, setSubmitted] = useState(() => sastInput())
  const [failure, setFailure] = useState("")
  // Outcomes and archived records must be reopened deliberately before stage editing.
  const { blocked: blockedItems, changed } = bulkStageSelection(items, stage)
  const blocked = blockedItems.length > 0
  const submitting = stage === "submitted" && changed.length > 0
  const backward = changed.some((bid) => bid.stage === "submitted")
  async function apply() {
    if (!stage || locked.current || disabled || blocked) return
    locked.current = true
    setBusy(true)
    onBusy(true)
    setFailure("")
    const current = workspace.accountGuard()
    try {
      const result = await updateBidStages(
        items,
        stage,
        fromSastInput(submitted),
        current,
        workspace.update
      )
      if (!result || !current()) return
      const { succeeded, updated, failed, message } = result
      if (updated)
        toast.success(`${updated} bid${updated === 1 ? "" : "s"} updated`)
      if (failed) {
        const text = `${failed} tender${failed === 1 ? "" : "s"} could not be updated. ${message || "Please retry."}`
        setFailure(text)
        toast.error(text)
      }
      setConfirming(false)
      onComplete(succeeded)
    } finally {
      locked.current = false
      if (current()) {
        setBusy(false)
        onBusy(false)
      }
    }
  }
  return (
    <>
      <section
        aria-label="Edit selected tenders"
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl rounded-lg border bg-background p-3 shadow-lg"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium" role="status">
            {items.length} selected
          </span>
          <Select
            value={stage}
            disabled={busy || disabled || blocked}
            onValueChange={(value) => setStage(value as BidStage)}
          >
            <SelectTrigger
              className="h-8 w-44"
              aria-label="New stage for selected tenders"
            >
              <SelectValue placeholder="Change bid stage" />
            </SelectTrigger>
            <SelectContent>
              {BID_STAGES.map((value) => (
                <SelectItem key={value} value={value}>
                  <BidStateLabel state={value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={busy || disabled || blocked || !stage || !changed.length}
            onClick={() => {
              if (submitting || backward) {
                setSubmitted(sastInput())
                setConfirming(true)
              } else void apply()
            }}
          >
            {busy
              ? "Updating…"
              : `Update ${changed.length} bid${changed.length === 1 ? "" : "s"}`}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={busy}
            onClick={onClear}
          >
            Clear selection
          </Button>
        </div>
        {blocked ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {blockedItems.length} selected bid
              {blockedItems.length === 1 ? " needs" : "s need"} reopening before
              stage editing.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={busy}
              onClick={onDeselectUnavailable}
            >
              Deselect unavailable
            </Button>
          </div>
        ) : null}
        {failure ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {failure} Failed tenders remain selected.
          </p>
        ) : null}
      </section>
      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open)
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {submitting
                ? "Record submissions for selected bids?"
                : "Move submitted bids back?"}
            </DialogTitle>
            <DialogDescription>
              {submitting
                ? "Only confirm bids you have already submitted outside OpenBids. The selected submission time applies to every changed bid. Preparation and incomplete checklists are kept."
                : "Submission dates and references for bids moving back will be cleared. Your preparation stays available."}
            </DialogDescription>
          </DialogHeader>
          {submitting ? (
            <div className="space-y-2">
              <Label htmlFor="bulk-submitted-at">
                Actual submission time (SAST)
              </Label>
              <Input
                id="bulk-submitted-at"
                type="datetime-local"
                disabled={busy}
                value={submitted}
                onChange={(event) => setSubmitted(event.target.value)}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                disabled ||
                (submitting &&
                  (!submitted ||
                    !Number.isFinite(
                      Date.parse(fromSastInput(submitted) || "")
                    )))
              }
              onClick={() => void apply()}
            >
              {busy ? "Updating…" : `Update ${changed.length} bids`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
