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
import { IconGripVertical } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { attentionSignals, workspaceDate } from "@/lib/workspace/presentation"
import { BidStageMenu } from "./bid-stage-menu"
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
  const [mobileStage, setMobileStage] = useState<BidStage>("saved")
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
          onValueChange={(value) => setMobileStage(value as BidStage)}
        >
          <SelectTrigger className="w-full" aria-label="Board stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BID_STAGES.map((stage) => (
              <SelectItem value={stage} key={stage}>
                {STAGE_LABELS[stage]} ({props.counts[stage]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={move}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Press space to pick up a bid. Use left and right arrows to change stages, space to drop, or escape to cancel. The stage menu is also available."
          }
        }}
      >
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-3">
          {BID_STAGES.filter((stage) => !mobile || stage === mobileStage).map(
            (stage) => (
              <Column key={stage} stage={stage} {...props} />
            )
          )}
        </div>
      </DndContext>
    </div>
  )
}
function Column({ stage, ...props }: Props & { stage: BidStage }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const items = props.items.filter((item) => item.stage === stage)
  return (
    <section
      ref={setNodeRef}
      aria-label={STAGE_LABELS[stage]}
      className={cn(
        "min-w-0 w-full shrink-0 rounded-lg border bg-muted/30 p-3 md:w-64",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">{STAGE_LABELS[stage]}</h2>
        <Badge variant="secondary">{props.counts[stage] || 0}</Badge>
      </header>
      <div className="min-h-32 space-y-2">
        {items.map((bid) => (
          <BidCard key={bid.id} bid={bid} {...props} />
        ))}
        {!items.length ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No bids in this stage
          </p>
        ) : null}
      </div>
      {items.length < props.counts[stage] ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          onClick={() => props.onMore(stage)}
        >
          Load more ({props.counts[stage] - items.length})
        </Button>
      ) : null}
    </section>
  )
}
function BidCard({ bid, ...props }: Props & { bid: WorkspaceEntry }) {
  const disabled = props.pending.has(bid.id)
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: bid.id, data: { stage: bid.stage }, disabled })
  const signal = attentionSignals(bid, props.now)[0]
  return (
    <Card
      ref={setNodeRef}
      className={cn("gap-0 py-0", isDragging && "z-20 opacity-70")}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-1">
          <Button
            type="button"
            variant="link"
            className="h-auto min-w-0 flex-1 justify-start whitespace-normal p-0 text-left text-sm font-medium leading-snug text-foreground hover:text-primary"
            onClick={() => props.onOpen(bid)}
          >
            {bid.tender.title || bid.tender.tender_no || "Saved tender"}
          </Button>
          <Button
            {...attributes}
            {...listeners}
            variant="ghost"
            size="icon-sm"
            className="touch-none shrink-0"
            disabled={disabled}
            aria-label={`Move ${bid.tender.tender_no || bid.tender.title}`}
          >
            <IconGripVertical />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {bid.tender.buyer_name || "Buyer not supplied"}
        </p>
        <p className="text-xs">{workspaceDate(bid.tender.closing_at)}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {bid.checklist.filter((item) => item.completed).length}/
            {bid.checklist.length} prepared
          </span>
          <BidStageMenu
            bid={bid}
            disabled={disabled}
            onStage={props.onStage}
            onOutcome={props.onOutcome}
          />
        </div>
        {signal ? <p className="text-xs text-primary">{signal.text}</p> : null}
        {disabled ? (
          <p role="status" className="text-xs text-muted-foreground">
            Saving…
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
