"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  IconExternalLink,
  IconPlus,
  IconTrash,
  IconArchive,
  IconRefresh
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  attentionSignals,
  workspaceDate,
  tenderHref
} from "@/lib/workspace/presentation"
import type {
  BidOutcome,
  BidPatch,
  BidStage,
  MutationResult,
  WorkspaceEntry
} from "@/lib/workspace/types"
import { cn } from "@/lib/utils"
import { BidStageMenu } from "./bid-stage-menu"

type Props = {
  bid: WorkspaceEntry
  pending: boolean
  now: number
  onClose: () => void
  onPatch: (
    bid: WorkspaceEntry,
    patch: BidPatch,
    version?: number
  ) => Promise<MutationResult>
  onStage: (bid: WorkspaceEntry, stage: BidStage) => void
  onOutcome: (bid: WorkspaceEntry, outcome: BidOutcome | null) => void
  onDelete: (bid: WorkspaceEntry) => void
}
export function BidPanel(props: Props) {
  const mobile = useIsMobile()
  const router = useRouter()
  const [navigateAfterDiscard, setNavigateAfterDiscard] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [dirty, setDirty] = useState(false)
  const close = () => {
    setNavigateAfterDiscard(false)
    if (dirty) setDiscard(true)
    else props.onClose()
  }
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const discardDialog = (
    <Dialog open={discard} onOpenChange={setDiscard}>
      <DialogContent className="[&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
        <DialogHeader>
          <DialogTitle>Discard unsaved preparation?</DialogTitle>
          <DialogDescription>
            Your unsaved draft will be lost. Saved preparation stays in your
            workspace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDiscard(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              props.onClose()
              if (navigateAfterDiscard)
                router.push(tenderHref(props.bid.tender))
            }}
          >
            Discard draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  const title =
    props.bid.tender.title || props.bid.tender.tender_no || "Saved tender"
  const reference = props.bid.tender.tender_no
  const showReference = Boolean(
    reference && reference.trim().toLowerCase() !== title.trim().toLowerCase()
  )
  const description = (
    <>
      <span className="block">
        {props.bid.tender.buyer_name || "Buyer not supplied"}
      </span>
      {showReference ? (
        <span className="mt-1 block text-xs">{reference}</span>
      ) : null}
    </>
  )
  const header = (
    <>
      <div className="pr-7">
        {mobile ? (
          <DrawerTitle
            title={title}
            className="line-clamp-3 break-words text-left text-base font-semibold leading-snug"
          >
            {title}
          </DrawerTitle>
        ) : (
          <SheetTitle
            title={title}
            className="line-clamp-3 break-words text-base font-semibold leading-snug"
          >
            {title}
          </SheetTitle>
        )}
      </div>
      {mobile ? (
        <DrawerDescription className="mt-2 text-left text-xs leading-relaxed">
          {description}
        </DrawerDescription>
      ) : (
        <SheetDescription className="mt-2 text-xs leading-relaxed">
          {description}
        </SheetDescription>
      )}
    </>
  )
  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
      <Preparation
        key={props.bid.id}
        {...props}
        onDirty={setDirty}
        dirty={dirty}
        onNavigate={() => {
          setNavigateAfterDiscard(true)
          setDiscard(true)
        }}
      />
      {discardDialog}
    </div>
  )
  if (mobile)
    return (
      <Drawer
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DrawerContent
          className="h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh] [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DrawerHeader className="shrink-0 border-b px-4 pb-4 text-left">
            {header}
          </DrawerHeader>
          {body}
          <DrawerClose asChild>
            <Button
              variant="outline"
              className="mx-4 mb-4"
              onClick={(event) => {
                if (dirty) {
                  event.preventDefault()
                  close()
                }
              }}
            >
              Close
            </Button>
          </DrawerClose>
        </DrawerContent>
      </Drawer>
    )
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-5">
          {header}
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}
function Preparation({
  bid,
  pending,
  now,
  onPatch,
  onStage,
  onOutcome,
  onDelete,
  onDirty,
  dirty: hasDraft,
  onNavigate
}: Props & {
  onDirty: (dirty: boolean) => void
  dirty: boolean
  onNavigate: () => void
}) {
  const [draft, setDraft] = useState({
    notes: bid.notes,
    baseNotes: bid.notes,
    version: bid.version
  })
  const [checklist, setChecklist] = useState(bid.checklist)
  const [checklistVersion, setChecklistVersion] = useState(bid.version)
  const [checklistConflict, setChecklistConflict] = useState(false)
  const [checklistBase, setChecklistBase] = useState(
    JSON.stringify(bid.checklist)
  )
  const [status, setStatus] = useState<
    "saved" | "saving" | "failed" | "conflict"
  >("saved")
  const notesDirty = draft.notes !== draft.baseNotes
  const notes = notesDirty ? draft.notes : bid.notes
  const checklistDirty = JSON.stringify(checklist) !== checklistBase
  const shownChecklist = checklistDirty ? checklist : bid.checklist
  useEffect(
    () => onDirty(notesDirty || checklistDirty),
    [onDirty, notesDirty, checklistDirty]
  )
  const signals = attentionSignals(bid, now)
  function dirty(notesChanged = notesDirty, checkChanged = checklistDirty) {
    onDirty(notesChanged || checkChanged)
  }
  async function saveNotes() {
    setStatus("saving")
    const result = await onPatch(
      bid,
      { notes },
      notesDirty ? draft.version : bid.version
    )
    if (result.ok && result.bid) {
      setDraft({
        notes: result.bid.notes,
        baseNotes: result.bid.notes,
        version: result.bid.version
      })
      setStatus("saved")
      dirty(false)
    } else if (!result.ok) {
      setStatus(result.code === "conflict" ? "conflict" : "failed")
      if (result.bid)
        setDraft((previous) => ({ ...previous, version: result.bid!.version }))
    }
  }
  async function saveChecklist() {
    const result = await onPatch(
      bid,
      { checklist: shownChecklist },
      checklistVersion
    )
    if (result.ok && result.bid) {
      setChecklist(result.bid.checklist)
      setChecklistBase(JSON.stringify(result.bid.checklist))
      setChecklistVersion(result.bid.version)
      setChecklistConflict(false)
      dirty(notesDirty, false)
    } else if (!result.ok && result.code === "conflict") {
      setChecklistConflict(true)
      if (result.bid) setChecklistVersion(result.bid.version)
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BidStageMenu
          bid={bid}
          disabled={pending}
          onStage={onStage}
          onOutcome={onOutcome}
        />
        <Button asChild size="sm" variant="ghost">
          <Link
            href={tenderHref(bid.tender)}
            onClick={(event) => {
              if (hasDraft) {
                event.preventDefault()
                onNavigate()
              }
            }}
          >
            Open tender
            <IconExternalLink data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      {signals.length ? (
        <div className="space-y-2">
          {signals.map((signal) => (
            <Alert key={signal.kind} className="py-2">
              <AlertDescription className="text-xs">
                {signal.text}
                {signal.kind === "deadline" ? (
                  <div className="mt-1 space-y-1">
                    <p>
                      Previous: {workspaceDate(bid.acknowledged_closing_at)}
                      <br />
                      Current: {workspaceDate(bid.tender.closing_at)}
                    </p>
                    <p>
                      Re-add or update any calendar event you previously
                      exported.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        void onPatch(bid, { acknowledge_deadline: true })
                      }
                    >
                      Acknowledge change
                    </Button>
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}
      <dl className="grid gap-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Official closing time</dt>
          <dd className="mt-1 leading-relaxed">
            {workspaceDate(bid.tender.closing_at)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Briefing</dt>
          <dd className="mt-1 leading-relaxed">
            {workspaceDate(bid.tender.briefing_datetime)}
            {bid.tender.compulsory_briefing ? (
              <Badge variant="secondary" className="ml-1 align-middle">
                Compulsory
              </Badge>
            ) : null}
          </dd>
        </div>
      </dl>
      {bid.submitted_at ? (
        <div className="text-xs">
          <p className="font-medium">
            Submitted {workspaceDate(bid.submitted_at)}
          </p>
          {bid.submission_reference ? (
            <p className="mt-1 break-words text-muted-foreground">
              Reference: {bid.submission_reference}
            </p>
          ) : null}
          <p className="mt-1 text-muted-foreground">
            Submission recorded by you. OpenBids does not deliver your bid.
          </p>
        </div>
      ) : null}
      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Preparation checklist</h3>
          {shownChecklist.length ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {shownChecklist.filter((item) => item.completed).length}/
              {shownChecklist.length}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Editable prompts to help you prepare. Check the tender’s full
          requirements.
        </p>
        {!bid.checklist_initialized && !shownChecklist.length ? (
          <Button
            size="sm"
            disabled={pending || Boolean(bid.outcome)}
            onClick={() => onStage(bid, "preparing")}
          >
            Prepare bid
          </Button>
        ) : null}
        <div className="space-y-2">
          {shownChecklist.map((item, index) => (
            <div key={item.id} className="group flex items-center gap-2">
              <Checkbox
                aria-label={`Complete ${item.label}`}
                checked={item.completed}
                disabled={pending}
                onCheckedChange={(completed) => {
                  const updated = shownChecklist.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, completed: completed === true }
                      : entry
                  )
                  setChecklist(updated)
                  if (!checklistDirty) setChecklistVersion(bid.version)
                  setChecklistBase(
                    checklistDirty
                      ? checklistBase
                      : JSON.stringify(bid.checklist)
                  )
                  dirty(notesDirty, true)
                }}
              />
              <Input
                aria-label={`Checklist item ${index + 1}`}
                value={item.label}
                maxLength={200}
                className={cn(
                  "h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input hover:bg-muted/40 focus-visible:border-ring focus-visible:bg-background focus-visible:text-foreground focus-visible:no-underline dark:bg-transparent",
                  item.completed && "text-muted-foreground line-through"
                )}
                disabled={pending}
                onChange={(event) => {
                  setChecklist(
                    shownChecklist.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, label: event.target.value }
                        : entry
                    )
                  )
                  if (!checklistDirty) setChecklistVersion(bid.version)
                  setChecklistBase(
                    checklistDirty
                      ? checklistBase
                      : JSON.stringify(bid.checklist)
                  )
                  dirty(notesDirty, true)
                }}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                className="shrink-0 text-muted-foreground opacity-60 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                aria-label={`Remove ${item.label}`}
                onClick={() => {
                  setChecklist(
                    shownChecklist.filter((entry) => entry.id !== item.id)
                  )
                  if (!checklistDirty) setChecklistVersion(bid.version)
                  setChecklistBase(
                    checklistDirty
                      ? checklistBase
                      : JSON.stringify(bid.checklist)
                  )
                  dirty(notesDirty, true)
                }}
              >
                <IconTrash />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={pending || shownChecklist.length >= 50}
            onClick={() => {
              setChecklist([
                ...shownChecklist,
                {
                  id: crypto.randomUUID(),
                  label: "New preparation item",
                  completed: false
                }
              ])
              if (!checklistDirty) setChecklistVersion(bid.version)
              setChecklistBase(
                checklistDirty ? checklistBase : JSON.stringify(bid.checklist)
              )
              dirty(notesDirty, true)
            }}
          >
            <IconPlus data-icon="inline-start" />
            Add item
          </Button>
          {checklistDirty || checklistConflict ? (
            <Button
              size="sm"
              variant="outline"
              disabled={
                pending ||
                !checklistDirty ||
                shownChecklist.some((item) => !item.label.trim())
              }
              onClick={() => void saveChecklist()}
            >
              Save checklist
            </Button>
          ) : null}
        </div>
        {checklistConflict ? (
          <Alert>
            <AlertDescription className="text-xs">
              The checklist changed. Your draft is kept. Latest saved items:{" "}
              {bid.checklist
                .map((item) => `${item.completed ? "Done: " : ""}${item.label}`)
                .join("; ") || "No items"}
              . Review before retrying.
            </AlertDescription>
          </Alert>
        ) : null}
      </section>
      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between">
          <Label htmlFor="bid-notes" className="text-sm font-medium">
            Private notes
          </Label>
          <span role="status" className="text-xs text-muted-foreground">
            {status === "saving"
              ? "Saving…"
              : status === "failed"
                ? "Save failed"
                : status === "conflict"
                  ? "Review latest version"
                  : notesDirty
                    ? "Unsaved"
                    : "Saved"}
          </span>
        </div>
        <Textarea
          id="bid-notes"
          rows={5}
          maxLength={10000}
          value={notes}
          placeholder="Pricing, questions, requirements or reminders…"
          onChange={(event) => {
            const value = event.target.value
            setDraft((previous) => ({
              notes: value,
              baseNotes: notesDirty ? previous.baseNotes : bid.notes,
              version: notesDirty ? previous.version : bid.version
            }))
            setStatus("saved")
            dirty(true)
          }}
        />
        <div className="flex items-center justify-between">
          {notesDirty || status !== "saved" ? (
            <Button
              size="sm"
              disabled={pending || !notesDirty}
              onClick={() => void saveNotes()}
            >
              {status === "failed" || status === "conflict"
                ? "Retry save notes"
                : "Save notes"}
            </Button>
          ) : null}
          {notesDirty || status !== "saved" ? (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {notes.length}/10,000
            </span>
          ) : null}
        </div>
        {status === "conflict" ? (
          <Alert>
            <AlertDescription className="text-xs">
              The bid changed in another tab. Your draft is kept. Review the
              latest saved notes below before retrying.
              <p className="mt-2 whitespace-pre-wrap break-words">
                {bid.notes || "No saved notes."}
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => void onPatch(bid, { archive: !bid.archived_at })}
        >
          {bid.archived_at ? (
            <IconRefresh data-icon="inline-start" />
          ) : (
            <IconArchive data-icon="inline-start" />
          )}
          {bid.archived_at ? "Restore to workspace" : "Archive bid"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          className="text-destructive"
          onClick={() => onDelete(bid)}
        >
          Delete permanently
        </Button>
      </div>
    </div>
  )
}
