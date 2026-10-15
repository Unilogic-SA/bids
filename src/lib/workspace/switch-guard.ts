/** Drains edits and mutations before selection changes. All writes retain their original company. */
export class WorkspaceSwitchGuard {
  private guards = new Set<() => Promise<boolean>>()
  private operations = new Set<Promise<unknown>>()
  private locked = false
  private preparing = false
  private listeners = new Set<() => void>()
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.preparing || this.locked
  private notify() { for (const listener of this.listeners) listener() }
  register(guard: () => Promise<boolean>) { this.guards.add(guard); return () => { this.guards.delete(guard) } }
  track<T>(operation: Promise<T>) { this.operations.add(operation); void operation.finally(() => this.operations.delete(operation)).catch(() => {}); return operation }
  canMutate() { return !this.locked }
  async prepare() {
    if (this.locked || this.preparing) return false
    this.preparing = true; this.notify()
    try {
      for (const guard of this.guards) if (!await guard()) return false
      while (this.operations.size) await Promise.allSettled([...this.operations])
      // A draft can have changed while another operation was settling.
      for (const guard of this.guards) if (!await guard()) return false
      while (this.operations.size) await Promise.allSettled([...this.operations])
      this.locked = true
      return true
    } catch { return false } finally { this.preparing = false; this.notify() }
  }
  release() { this.locked = false; this.notify() }
}
