import type { ChecklistItem, MutationResult, WorkspaceBid } from "./types"

type Status = "saved" | "unsaved" | "saving" | "failed" | "conflict" | "invalid"
export type ChecklistSnapshot = {
  items: ChecklistItem[]
  latest: ChecklistItem[]
  version: number
  dirty: boolean
  status: Status
}
const same = (a: ChecklistItem[], b: ChecklistItem[]) => JSON.stringify(a) === JSON.stringify(b)

/** One versioned write at a time; edits made during a request stay queued. */
export class ChecklistAutosave {
  private base: ChecklistItem[]
  private state: ChecklistSnapshot
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private flight: Promise<boolean> | null = null
  private disposed = false
  constructor(bid: Pick<WorkspaceBid, "checklist" | "version">,
    private save: (items: ChecklistItem[], version: number) => Promise<MutationResult>,
    private delay = 500) {
    this.base = bid.checklist
    this.state = { items: bid.checklist, latest: bid.checklist, version: bid.version, dirty: false, status: "saved" }
  }
  setSave(save: (items: ChecklistItem[], version: number) => Promise<MutationResult>) { this.save = save }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private emit(next: Partial<ChecklistSnapshot>) {
    this.state = { ...this.state, ...next }
    this.listeners.forEach(listener => listener())
  }
  activate = () => { this.disposed = false }
  dispose = () => { this.disposed = true; clearTimeout(this.timer) }
  observe(bid: Pick<WorkspaceBid, "checklist" | "version">) {
    if (this.flight || bid.version <= this.state.version) return
    if (this.state.dirty) {
      this.emit({ version: bid.version, latest: bid.checklist,
        ...(!same(bid.checklist, this.base) ? { status: "conflict" as const } : {}) })
    } else {
      this.base = bid.checklist
      this.emit({ items: bid.checklist, latest: bid.checklist, version: bid.version })
    }
  }
  edit(update: (items: ChecklistItem[]) => ChecklistItem[]) {
    if (this.disposed) return
    clearTimeout(this.timer)
    const items = update(this.state.items)
    const dirty = !same(items, this.base)
    const conflict = this.state.status === "conflict"
    this.emit({ items, dirty, status: conflict ? "conflict" : this.flight ? "saving" : dirty ? "unsaved" : "saved" })
    if (dirty && !conflict) this.timer = setTimeout(() => { void this.flush() }, this.delay)
  }
  async flush(reviewedConflict = false): Promise<boolean> {
    if (this.disposed) return false
    clearTimeout(this.timer)
    if (this.flight) return (await this.flight) && this.flush(reviewedConflict)
    if (!this.state.dirty) return true
    if (this.state.status === "conflict" && !reviewedConflict) return false
    if (this.state.items.some(item => !item.label.trim())) {
      this.emit({ status: "invalid" })
      return false
    }
    const sent = this.state.items
    const version = this.state.version
    this.emit({ status: "saving" })
    this.flight = (async () => {
      let result: MutationResult
      try { result = await this.save(sent, version) }
      catch { result = { ok: false, code: "unavailable", message: "Checklist could not be saved." } }
      if (result.ok && result.bid) {
        this.base = result.bid.checklist
        const items = same(this.state.items, sent) ? result.bid.checklist : this.state.items
        const dirty = !same(items, this.base)
        this.emit({ items, dirty, version: result.bid.version, latest: this.base, status: dirty ? "unsaved" : "saved" })
        return true
      }
      this.emit({ status: !result.ok && result.code === "conflict" ? "conflict" : "failed",
        ...(result.bid ? { version: result.bid.version, latest: result.bid.checklist } : {}) })
      return false
    })()
    let saved: boolean
    try { saved = await this.flight }
    finally { this.flight = null }
    return saved && this.flush()
  }
}
