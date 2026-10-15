"use client"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type KeyboardCoordinateGetter
} from "@dnd-kit/core"
import {
  IconCalendar,
  IconChecklist,
  IconGripVertical
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { useState } from "react"
import {
  BID_STAGES,
  STAGE_LABELS,
  type BidStage,
  type BidOutcome,
  type WorkspaceEntry
} from "@/lib/workspace/types"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { BidDeadline, BidSignals } from "./bid-summary"
import { useWorkspace } from "./workspace-provider"
import { preferredBoardStage } from "@/lib/workspace/client-state"
import { BidStateLabel, bidStateTriggerClass } from "./stage-presentation"
import { BidStageMenu } from "./bid-stage-menu"
import {
  WorkspaceGesture,
  canStartWorkspaceDrag,
  isWorkspaceControl
} from "@/lib/workspace/interaction"
import { cn } from "@/lib/utils"
const keyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates }
) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.code))
    return currentCoordinates
  event.preventDefault()
  const stage = (context.over?.id ||
    context.active?.data.current?.stage) as BidStage
  const index = BID_STAGES.indexOf(stage)
  const next =
    BID_STAGES[
      Math.max(
        0,
        Math.min(
          BID_STAGES.length - 1,
          index + (event.code === "ArrowRight" ? 1 : -1)
        )
      )
    ]
  const rect = context.droppableRects.get(next)
  return rect ? { x: rect.left + 20, y: rect.top + 60 } : currentCoordinates
}
type Props = {
  mobile?: boolean
  stageFilter: BidStage | "all"
  items: WorkspaceEntry[]
  counts: Record<BidStage, number>
  pending: Set<string>
  now: number
  onOpen: (bid: WorkspaceEntry) => void
  onStage: (bid: WorkspaceEntry, stage: BidStage) => void
  onOutcome: (bid: WorkspaceEntry, outcome: BidOutcome | null) => void
  onMore: (stage: BidStage) => void
}
export function WorkspaceBoard(props: Props) {
  const mobile = useIsMobile()
  const [gesture] = useState(() => new WorkspaceGesture())
  const { identity } = useWorkspace()
  const [preferredStage, setPreferredStage] = useState<BidStage>(() => {
    try {
      return preferredBoardStage(
        typeof window === "undefined"
          ? null
          : localStorage.getItem(`openbids:workspace-stage:${identity}`)
      )
    } catch {
      return "saved"
    }
  })
  const mobileStage =
    props.stageFilter === "all" ? preferredStage : props.stageFilter
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates })
  )
  function move(event: DragEndEvent) {
    const bid = props.items.find((item) => item.id === event.active.id)
    const stage = event.over?.id
    if (bid && BID_STAGES.includes(stage as BidStage) && stage !== bid.stage)
      props.onStage(bid, stage as BidStage)
  }
  return (
    <div className="min-w-0 space-y-3">
      {mobile ? (
        <Select
          value={mobileStage}
          onValueChange={(value) => {
            const stage = preferredBoardStage(value)
            setPreferredStage(stage)
            try {
              localStorage.setItem(
                `openbids:workspace-stage:${identity}`,
                stage
              )
            } catch {}
          }}
        >
          <SelectTrigger
            className={cn(
              "w-full cursor-pointer",
              bidStateTriggerClass(mobileStage)
            )}
            aria-label="Board stage"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BID_STAGES.filter(
              (stage) =>
                props.stageFilter === "all" || stage === props.stageFilter
            ).map((stage) => (
              <SelectItem className="cursor-pointer" value={stage} key={stage}>
                <BidStateLabel state={stage} />{" "}
                <span className="text-muted-foreground">
                  ({props.counts[stage]})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event) => gesture.dragStarted(String(event.active.id))}
        onDragEnd={move}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Press space to pick up a bid. Use left and right arrows to change stages, space to drop, or escape to cancel. The stage menu is also available."
          }
        }}
      >
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-3">
          {BID_STAGES.filter(
            (stage) =>
              (props.stageFilter === "all" || stage === props.stageFilter) &&
              (!mobile || stage === mobileStage)
          ).map((stage) => (
            <Column
              key={stage}
              stage={stage}
              gesture={gesture}
              {...props}
              mobile={mobile}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
function Column({
  stage,
  ...props
}: Props & { stage: BidStage; gesture: WorkspaceGesture }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const items = props.items.filter((item) => item.stage === stage)
  return (
    <section
      ref={setNodeRef}
      aria-label={STAGE_LABELS[stage]}
      className={cn(
        "min-w-0 w-full shrink-0 rounded-lg bg-muted/10 p-2 md:w-56 xl:flex-1",
        isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40"
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2 px-1 py-1">
        <h2 className="text-sm font-medium">
          <BidStateLabel state={stage} />
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {props.counts[stage] || 0}
        </span>
      </header>
      <div className="min-h-32 space-y-2">
        {items.map((bid) => (
          <BidCard key={bid.id} bid={bid} {...props} />
        ))}
        {!items.length ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {
              {
                saved: "Save a tender to start.",
                reviewing:
                  "Assess tender requirements here.",
                preparing: "Prepare your response here.",
                ready: "Ready for submission.",
                submitted: "Track bids submitted outside OpenBids."
              }[stage]
            }
          </p>
        ) : null}
      </div>
      {items.length < props.counts[stage] ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full cursor-pointer"
          onClick={() => props.onMore(stage)}
        >
          Load more ({props.counts[stage] - items.length})
        </Button>
      ) : null}
    </section>
  )
}
function BidCard({
  bid,
  ...props
}: Props & { bid: WorkspaceEntry; gesture: WorkspaceGesture }) {
  const disabled = props.pending.has(bid.id)
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging
  } = useDraggable({ id: bid.id, data: { stage: bid.stage }, disabled })
  return (
    <Card
      ref={setNodeRef}
      onPointerDownCapture={() => props.gesture.pointerStarted()}
      onPointerDown={(event) => {
        if (!disabled && canStartWorkspaceDrag(event.target))
          listeners?.onPointerDown?.(event)
      }}
      onClick={(event) => {
        if (
          !isWorkspaceControl(event.target) &&
          props.gesture.canOpen(event.detail)
        ) {
          event.currentTarget
            .querySelector<HTMLButtonElement>("[data-workspace-open]")
            ?.focus()
          props.onOpen(bid)
        }
      }}
      className={cn(
        "touch-pan-y cursor-pointer gap-0 border-border/70 py-0 shadow-none transition-colors hover:border-primary/30 hover:bg-muted/20 motion-reduce:transition-none",
        isDragging && "z-20 cursor-grabbing opacity-70"
      )}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
    >
      <CardContent className="space-y-2.5 p-2.5">
        <div className="flex items-start gap-1">
          <Tooltip open={props.mobile ? false : undefined}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="link"
                data-workspace-open
                className={cn(
                  "h-auto min-w-0 cursor-pointer flex-1 justify-start whitespace-normal break-words p-0 text-left text-sm font-medium leading-snug text-foreground hover:text-primary dark:hover:text-chart-1",
                  isDragging && "cursor-grabbing"
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  if (props.gesture.canOpen(event.detail)) props.onOpen(bid)
                }}
              >
                <span
                  className="line-clamp-2 min-w-0 break-words"
                  title={
                    bid.tender.title || bid.tender.tender_no || "Saved tender"
                  }
                >
                  {bid.tender.title || bid.tender.tender_no || "Saved tender"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6} className="pointer-events-none">
              {bid.tender.title || bid.tender.tender_no || "Saved tender"}
            </TooltipContent>
          </Tooltip>
          <Button
            ref={setActivatorNodeRef}
            data-workspace-control
            {...attributes}
            {...listeners}
            onPointerDown={(event) => {
              event.stopPropagation()
              listeners?.onPointerDown?.(event)
            }}
            onClick={(event) => event.stopPropagation()}
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-10 touch-none shrink-0 cursor-grab sm:size-8 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed",
              isDragging && "cursor-grabbing"
            )}
            disabled={disabled}
            aria-label={`Move ${bid.tender.tender_no || bid.tender.title}`}
          >
            <IconGripVertical />
          </Button>
        </div>
        <div className="flex items-start gap-1.5 text-xs leading-relaxed">
          <IconCalendar
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
          />
          <BidDeadline bid={bid} now={props.now} mobile={props.mobile} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {bid.checklist.length ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconChecklist aria-hidden="true" className="size-3.5" />
              {bid.checklist.filter((item) => item.completed).length}/
              {bid.checklist.length}
              <span className="sr-only"> checklist items complete</span>
            </span>
          ) : null}
          <BidStageMenu
            bid={bid}
            compact
            disabled={disabled}
            onStage={props.onStage}
            onOutcome={props.onOutcome}
          />
        </div>
        <BidSignals bid={bid} now={props.now} />
        {disabled ? (
          <p role="status" className="text-xs text-muted-foreground">
            Saving…
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
