/** Generation gate prevents delayed requests from a previous identity entering private UI state. */
export class WorkspaceGeneration {
  private generation = 0
  private identity: string | null = null
  scope(identity: string | null) {
    if (identity !== this.identity) {
      this.identity = identity
      this.generation++
    }
    return this.generation
  }
  current(generation: number, identity: string | null) {
    return (
      generation === this.generation &&
      identity === this.identity &&
      identity !== null
    )
  }
  token() {
    return this.generation
  }
  invalidate() {
    this.generation++
  }
}
