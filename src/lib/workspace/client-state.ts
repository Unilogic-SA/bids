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

/** Sheet selection is presentation state, not a new list/filter request. */
export function workspaceListQuery(query: string, mobile = false) {
  const params = new URLSearchParams(query)
  params.delete("bid")
  if (mobile) {
    params.set("view", "list")
    for (const stage of ["saved", "reviewing", "preparing", "ready", "submitted"])
      params.delete(`offset_${stage}`)
  }
  return params.toString()
}

export function preferredBoardStage(
  value: string | null
): import("./types").BidStage {
  return ["saved", "reviewing", "preparing", "ready", "submitted"].includes(
    value || ""
  )
    ? (value as import("./types").BidStage)
    : "saved"
}
export function workspacePagination(
  total: number,
  page: number,
  itemCount: number,
  size = 50
) {
  const pages = Math.max(1, Math.ceil(total / size))
  const start = itemCount ? (page - 1) * size + 1 : 0
  return {
    start,
    end: itemCount ? Math.min(total, start + itemCount - 1) : 0,
    pages
  }
}
export function clearWorkspaceFilters(query: string) {
  const params = new URLSearchParams(query)
  for (const name of ["q", "stage", "week", "page"]) params.delete(name)
  for (const stage of ["saved", "reviewing", "preparing", "ready", "submitted"])
    params.delete(`offset_${stage}`)
  return params.toString()
}
