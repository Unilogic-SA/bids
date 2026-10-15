"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  IconExternalLink,
  IconPlus,
  IconTrash,
  IconArchive,
  IconDots,
  IconRefresh
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import { signalClass, SignalIcon } from "./bid-summary"
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
import { useWorkspace } from "./workspace-provider"
import { ChecklistAutosave, type ChecklistSnapshot } from "@/lib/workspace/checklist-autosave"

type Props = {
  opener?: HTMLElement | null
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
  const { registerLeaveGuard, switching } = useWorkspace()
  const mobile = useIsMobile()
  const router = useRouter()
  const { bid: currentBid, onPatch: patchBid } = props
  const leavingLock = useRef(false)
  const [leaving, setLeaving] = useState(false)
  const [autosave] = useState(() => new ChecklistAutosave(props.bid,
    (items, version) => props.onPatch(props.bid, { checklist: items }, version)))
  const checklistState = useSyncExternalStore(autosave.subscribe, autosave.getSnapshot, autosave.getSnapshot)
  useEffect(() => {
    autosave.setSave((items, version) => patchBid(currentBid, { checklist: items }, version))
    autosave.observe(currentBid)
  }, [currentBid, patchBid, autosave, checklistState.status])
  useEffect(() => {
    autosave.activate()
    return autosave.dispose
  }, [autosave])
  useEffect(() => registerLeaveGuard(() => autosave.flush()), [registerLeaveGuard, autosave])
  const [expanded, setExpanded] = useState(false)
  const [opener] = useState(
    () =>
      props.opener ??
      (typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null)
  )
  const restoreFocus = (event: Event) => {
    if (opener?.isConnected) {
      event.preventDefault()
      opener.focus()
    }
  }
  async function leave(action: () => void) {
    if (leavingLock.current) return
    leavingLock.current = true
    setLeaving(true)
    try {
      if (await autosave.flush()) action()
    } finally {
      leavingLock.current = false
      setLeaving(false)
    }
  }
  const close = () => { void leave(props.onClose) }
  useEffect(() => {
    if (!checklistState.dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [checklistState.dirty])
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
        <span className="block text-xs">{reference}</span>
      ) : null}
    </>
  )
  const header = (
    <>
      <div className="pr-7">
        {mobile ? (
          <DrawerTitle
            title={title}
            className={cn(
              !expanded && "line-clamp-3",
              "break-words text-left text-lg font-semibold leading-snug"
            )}
          >
            {title}
          </DrawerTitle>
        ) : (
          <DialogTitle
            title={title}
            className={cn(
              !expanded && "line-clamp-3",
              "break-words text-lg font-semibold leading-snug"
            )}
          >
            {title}
          </DialogTitle>
        )}
        {title.length > 100 ? (
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 h-6 px-0 text-xs"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show less" : "Show full title"}
          </Button>
        ) : null}
      </div>
      {mobile ? (
        <DrawerDescription className="text-left text-xs leading-relaxed">
          {description}
        </DrawerDescription>
      ) : (
        <DialogDescription className="text-xs leading-relaxed">
          {description}
        </DialogDescription>
      )}
    </>
  )
  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <Preparation
        key={props.bid.id}
        {...props}
        autosave={autosave}
        checklistState={checklistState}
        leaving={leaving || switching}
        onNavigate={() => { void leave(() => router.push(tenderHref(props.bid.tender))) }}
        onStage={(bid, stage) => { void autosave.flush().then(saved => {
          if (saved) props.onStage({ ...bid, version: autosave.getSnapshot().version }, stage)
        }) }}
        onOutcome={(bid, outcome) => { void autosave.flush().then(saved => {
          if (saved) props.onOutcome({ ...bid, version: autosave.getSnapshot().version }, outcome)
        }) }}
        onDelete={(bid) => { void autosave.flush().then(saved => {
          if (saved) props.onDelete({ ...bid, version: autosave.getSnapshot().version })
        }) }}
        onPatch={async (bid, patch) => {
          if (!await autosave.flush()) return { ok: false, code: "unavailable", message: "Save your checklist before continuing." }
          return props.onPatch({ ...bid, version: autosave.getSnapshot().version }, patch, autosave.getSnapshot().version)
        }}
      />
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
          onCloseAutoFocus={restoreFocus}
        >
          <DrawerHeader className="max-h-[30dvh] shrink-0 overflow-y-auto gap-1.5 border-b px-4 pb-3 text-left">
            {header}
          </DrawerHeader>
          {body}
          <DrawerClose asChild>
            <Button
              variant="outline"
              className="mx-4 mb-4"
              onClick={(event) => {
                event.preventDefault()
                close()
              }}
            >
              Close
            </Button>
          </DrawerClose>
        </DrawerContent>
      </Drawer>
    )
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed"
        onCloseAutoFocus={restoreFocus}
      >
        <DialogHeader className="max-h-[30dvh] shrink-0 overflow-y-auto gap-1.5 border-b px-6 py-4">
          {header}
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
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
  autosave,
  checklistState,
  leaving,
  onNavigate
}: Props & {
  autosave: ChecklistAutosave
  checklistState: ChecklistSnapshot
  leaving: boolean
  onNavigate: () => void
}) {
  const newItem = useRef<string | null>(null)
  const { items: shownChecklist, status } = checklistState
  const editDisabled = leaving || (pending && status !== "saving")
  const signals = attentionSignals(bid, now)
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
              event.preventDefault()
              onNavigate()
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
            <Alert
              key={signal.kind}
              className={cn(
                "py-2",
                signal.kind === "source" && "rounded-none border-0 bg-transparent px-0",
                signalClass(signal.kind)
              )}
            >
              <SignalIcon kind={signal.kind} />
              <AlertDescription className={cn("text-xs", signalClass(signal.kind))}>
                {signal.text}
                {signal.kind === "deadline" ? (
                  <div className="mt-1 space-y-1">
                    <p>
                      Previous: {workspaceDate(bid.acknowledged_closing_at)}
                      <br />
                      Current: {workspaceDate(bid.tender.closing_at)}
                    </p>
                    <p>
                      Update any calendar event you exported.
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
            Recorded by you. OpenBids does not submit bids.
          </p>
        </div>
      ) : null}
      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Checklist</h3>
          {shownChecklist.length ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {shownChecklist.filter((item) => item.completed).length}/
              {shownChecklist.length}
            </span>
          ) : null}
        </div>
        <div className="space-y-2">
          {shownChecklist.map((item, index) => (
            <div key={item.id} className="group flex items-center gap-2">
              <Checkbox
                aria-label={`Complete ${item.label}`}
                checked={item.completed}
                disabled={editDisabled}
                onCheckedChange={(completed) => {
                  const updated = shownChecklist.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, completed: completed === true }
                      : entry
                  )
                  autosave.edit(() => updated)
                }}
              />
              <Input
                ref={(node) => {
                  if (node && newItem.current === item.id) {
                    node.focus()
                    node.select()
                    newItem.current = null
                  }
                }}
                aria-label={`Checklist item ${index + 1}`}
                aria-invalid={!item.label.trim()}
                value={item.label}
                maxLength={200}
                className={cn(
                  "h-10 border-transparent sm:h-8 bg-transparent px-2 shadow-none hover:border-input hover:bg-muted/40 focus-visible:border-ring focus-visible:bg-background focus-visible:text-foreground focus-visible:no-underline dark:bg-transparent",
                  item.completed && "text-muted-foreground line-through"
                )}
                disabled={editDisabled}
                onChange={(event) => {
                  autosave.edit(items =>
                    items.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, label: event.target.value }
                        : entry
                    )
                  )
                }}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={editDisabled}
                className="size-10 shrink-0 text-muted-foreground hover:text-destructive sm:size-8"
                aria-label={`Remove ${item.label}`}
                onClick={() => {
                  autosave.edit(items =>
                    items.filter((entry) => entry.id !== item.id)
                  )
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
            className="h-10 sm:h-8"
            variant="ghost"
            disabled={editDisabled || shownChecklist.length >= 50}
            onClick={() => {
              const id = crypto.randomUUID()
              newItem.current = id
              autosave.edit(items => [
                ...items,
                {
                  id,
                  label: "New checklist item",
                  completed: false
                }
              ])
            }}
          >
            <IconPlus data-icon="inline-start" />
            Add item
          </Button>
          {status === "failed" || status === "conflict" ? (
            <Button size="sm" variant="outline" disabled={pending || leaving}
              onClick={() => void autosave.flush(status === "conflict")}>
              Retry save
            </Button>
          ) : null}
          <span
            role="status"
            className={cn(
              "text-xs",
              status === "failed" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {status === "saving"
              ? "Saving…"
              : status === "failed"
                ? "Save failed"
                : status === "conflict"
                  ? "Review latest version"
                  : status === "invalid"
                    ? "Enter an item name"
                  : checklistState.dirty
                    ? "Saving…"
                    : "Saved"}
          </span>
        </div>
        {status === "failed" ? (
          <p role="alert" className="text-xs text-destructive">
            Couldn’t save. Your changes are kept here. Retry before closing.
          </p>
        ) : null}
        {status === "conflict" ? (
          <Alert>
            <AlertDescription className="text-xs">
              The checklist changed. Your draft is kept. Latest saved items:{" "}
              {checklistState.latest
                .map((item) => `${item.completed ? "Done: " : ""}${item.label}`)
                .join("; ") || "No items"}
              . Review before retrying.
            </AlertDescription>
          </Alert>
        ) : null}
      </section>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" disabled={pending}>
              <IconDots data-icon="inline-start" />
              More actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => void onPatch(bid, { archive: !bid.archived_at })}
            >
              {bid.archived_at ? <IconRefresh /> : <IconArchive />}
              {bid.archived_at ? "Restore to workspace" : "Archive bid"}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={() => onDelete(bid)}
            >
              <IconTrash />
              Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
