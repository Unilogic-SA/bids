import type { AdminDashboardRow } from "./dashboard"

export type OperationStatusFilter =
  | "all"
  | "attention"
  | "completed"
  | "running"

export function isAttentionStatus(status: string) {
  return [
    "attention",
    "failed",
    "offline",
    "degraded",
    "stalled",
    "unavailable",
    "recovered · portal",
  ].includes(status.toLowerCase())
}

export function filterOperations(
  rows: AdminDashboardRow[],
  search: string,
  status: OperationStatusFilter
) {
  const query = search.trim().toLowerCase()
  return rows.filter((row) => {
    const normalized = row.status.toLowerCase()
    if (status === "attention" && !isAttentionStatus(normalized)) return false
    if (
      status === "completed" &&
      !["completed", "recovered · portal"].includes(normalized)
    )
      return false
    if (
      status === "running" &&
      !["running", "syncing", "stalled"].includes(normalized)
    )
      return false
    return (
      !query ||
      [row.name, row.status, row.detail, row.reference, row.observedAt].some(
        (value) => value.toLowerCase().includes(query)
      )
    )
  })
}

// Quoting protects commas/newlines; prefixing protects spreadsheet formula execution.
function csvCell(value: string) {
  const safe =
    /^[\s\uFEFF]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)
      ? `'${value}`
      : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function operationsCsv(rows: AdminDashboardRow[]) {
  const header = [
    "Activity",
    "Category",
    "Status",
    "Observed (SAST)",
    "Duration",
    "Volume",
    "Documents",
    "Reference",
    "Details",
  ]
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((row) => [
        row.name,
        row.category,
        row.status,
        row.observedAt,
        row.duration,
        row.volume,
        row.documents,
        row.reference,
        row.detail,
      ]),
    ]
      .map((cells) => cells.map(csvCell).join(","))
      .join("\r\n")
  )
}

export function boundedPageIndex(
  index: number,
  rowCount: number,
  pageSize: number
) {
  return Math.max(
    0,
    Math.min(index, Math.max(0, Math.ceil(rowCount / pageSize) - 1))
  )
}
