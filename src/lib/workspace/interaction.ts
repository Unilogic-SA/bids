const CONTROL_SELECTOR =
  "button,a,input,textarea,select,[role='button'],[role='menuitem'],[contenteditable='true'],[data-workspace-control]"
type ClosestTarget = {
  closest: (selector: string) => unknown
  parentElement?: ClosestTarget | null
}
function closestTarget(target: EventTarget | null): ClosestTarget | null {
  if (!target) return null
  const node = target as unknown as Partial<ClosestTarget>
  return typeof node.closest === "function"
    ? (node as ClosestTarget)
    : node.parentElement || null
}
export function isWorkspaceControl(target: EventTarget | null) {
  return Boolean(closestTarget(target)?.closest(CONTROL_SELECTOR))
}
export function canStartWorkspaceDrag(target: EventTarget | null) {
  const element = closestTarget(target)
  if (element?.closest("[data-workspace-control]")) return false
  return (
    !isWorkspaceControl(target) ||
    Boolean(element?.closest("[data-workspace-open]"))
  )
}
/** The drag flag deliberately outlives isDragging and a moved card's remount. */
export class WorkspaceGesture {
  private draggedId: string | null = null
  pointerStarted() {
    this.draggedId = null
  }
  dragStarted(id: string) {
    this.draggedId = id
  }
  canOpen(clickDetail: number) {
    return clickDetail === 0 || this.draggedId === null
  }
}
