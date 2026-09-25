import type {
  AdminMonitoringSnapshot,
  AdminSyncRun,
} from "@/lib/admin/monitoring"
import {
  STUCK_SYNC_AFTER_MINUTES,
  SYNC_FRESHNESS_WINDOW_HOURS,
} from "@/lib/admin/monitoring"

const DATE_FORMAT = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
})

const NUMBER_FORMAT = new Intl.NumberFormat("en-ZA")

export type AdminHealthState = {
  label: string
  tone: "operational" | "syncing" | "attention" | "offline"
  title: string
  description: string
}

export type AdminSectionCards = {
  health: AdminHealthState
  checkedAt: string
  freshness: string
  freshnessDescription: string
  availableTenders: string
  availableTendersDescription: string
  totalDocuments: string
  documentCoverage: number
}

export type AdminDashboardRow = {
  id: string
  name: string
  category: "Sync run" | "System check" | "Runner"
  status: string
  observedAt: string
  duration: string
  volume: string
  documents: string
  detail: string
  reference: string
  metrics: {
    fetched: number
    tenders: number
    documents: number
  }
}

export function createAdminDashboard(snapshot: AdminMonitoringSnapshot) {
  const health = getHealthState(snapshot)
  const documentCoverage = getDocumentCoverage(snapshot)

  const cards: AdminSectionCards = {
    health,
    checkedAt: formatDate(snapshot.checkedAt),
    freshness: getLatestSuccessfulAge(snapshot) || "No success",
    freshnessDescription: snapshot.latestSuccessfulRun?.completed_at
      ? `Last success ${formatDate(snapshot.latestSuccessfulRun.completed_at)}`
      : "No completed sync run is available.",
    availableTenders: formatNumber(snapshot.metrics.availableOpenTenderCount),
    availableTendersDescription: `${formatNumber(
      snapshot.metrics.availableOpenTenderWithDocumentCount
    )} have documents attached.`,
    totalDocuments: formatNumber(snapshot.metrics.totalDocumentCount),
    documentCoverage,
  }

  const rows: AdminDashboardRow[] = [
    ...snapshot.latestRuns.map((run) => toSyncRunRow(run, snapshot.checkedAt)),
    ...getSystemCheckRows(snapshot),
    ...getRunnerRows(snapshot),
  ]

  return { cards, health, rows }
}

function toSyncRunRow(run: AdminSyncRun, checkedAt: string): AdminDashboardRow {
  return {
    id: `sync-${run.id}`,
    name: `${formatStatus(run.mode)} sync`,
    category: "Sync run",
    status: formatStatus(run.status),
    observedAt: formatDate(run.started_at),
    duration: formatRunDuration(run, checkedAt),
    volume: `${formatNumber(run.fetched_count)} fetched · ${formatNumber(
      run.upserted_tender_count
    )} tenders`,
    documents: formatNumber(run.upserted_document_count),
    detail: `${formatSyncWindow(run)}. ${run.message || "No run message."}`,
    reference: run.id,
    metrics: {
      fetched: run.fetched_count,
      tenders: run.upserted_tender_count,
      documents: run.upserted_document_count,
    },
  }
}

function getSystemCheckRows(
  snapshot: AdminMonitoringSnapshot
): AdminDashboardRow[] {
  const checkedAt = formatDate(snapshot.checkedAt)
  const latestSuccessAgeMs = snapshot.latestSuccessfulRun?.completed_at
    ? new Date(snapshot.checkedAt).getTime() -
      new Date(snapshot.latestSuccessfulRun.completed_at).getTime()
    : null
  const staleAfterMs = SYNC_FRESHNESS_WINDOW_HOURS * 60 * 60 * 1_000

  return [
    {
      id: "check-supabase-reads",
      name: "Supabase reads",
      status:
        snapshot.configMissing || snapshot.queryErrors.length > 0
          ? "Attention"
          : "OK",
      detail: snapshot.configMissing
        ? "Public Supabase configuration is missing."
        : snapshot.queryErrors.length > 0
          ? snapshot.queryErrors.slice(0, 3).join(" ")
          : "Public read queries are returning data.",
      volume: `${formatNumber(snapshot.queryErrors.length)} query errors`,
    },
    {
      id: "check-successful-sync-freshness",
      name: "Successful sync freshness",
      status:
        latestSuccessAgeMs === null || latestSuccessAgeMs > staleAfterMs
          ? "Attention"
          : "OK",
      detail: snapshot.latestSuccessfulRun?.completed_at
        ? `Latest success completed ${formatDate(
            snapshot.latestSuccessfulRun.completed_at
          )}.`
        : "No successful sync run has been recorded.",
      volume: getLatestSuccessfulAge(snapshot) || "No success",
    },
    {
      id: "check-stuck-running-rows",
      name: "Stuck running rows",
      status:
        snapshot.metrics.stuckRunningSyncCount > 0 ? "Attention" : "OK",
      detail: `${formatNumber(
        snapshot.metrics.stuckRunningSyncCount
      )} running sync rows are older than ${STUCK_SYNC_AFTER_MINUTES} minutes.`,
      volume: formatNumber(snapshot.metrics.stuckRunningSyncCount),
    },
    {
      id: "check-recent-failures",
      name: "Recent failures",
      status:
        snapshot.metrics.failedSyncCountLastWindow > 0 ? "Attention" : "OK",
      detail: `${formatNumber(
        snapshot.metrics.failedSyncCountLastWindow
      )} failures in the last ${SYNC_FRESHNESS_WINDOW_HOURS} hours.`,
      volume: formatNumber(snapshot.metrics.failedSyncCountLastWindow),
    },
  ].map((row) => ({
    ...row,
    category: "System check" as const,
    observedAt: checkedAt,
    duration: "—",
    documents: "—",
    reference: row.id,
    metrics: {
      fetched: 0,
      tenders: 0,
      documents: 0,
    },
  }))
}

function getRunnerRows(snapshot: AdminMonitoringSnapshot): AdminDashboardRow[] {
  const observedAt = formatDate(snapshot.checkedAt)
  const latestStartedAt = snapshot.latestRun?.started_at
    ? formatDate(snapshot.latestRun.started_at)
    : "not available"

  return [
    {
      id: "runner-running",
      name: "Running syncs",
      status: snapshot.metrics.runningSyncCount > 0 ? "Running" : "Idle",
      volume: formatNumber(snapshot.metrics.runningSyncCount),
      detail: `The latest run started ${latestStartedAt}.`,
    },
    {
      id: "runner-stuck",
      name: `Older than ${STUCK_SYNC_AFTER_MINUTES} minutes`,
      status:
        snapshot.metrics.stuckRunningSyncCount > 0 ? "Attention" : "OK",
      volume: formatNumber(snapshot.metrics.stuckRunningSyncCount),
      detail: "Running rows beyond the stuck-run threshold.",
    },
    {
      id: "runner-completed",
      name: `Completed in ${SYNC_FRESHNESS_WINDOW_HOURS} hours`,
      status: "Completed",
      volume: formatNumber(snapshot.metrics.completedSyncCountLastWindow),
      detail: "Successful sync runs inside the freshness window.",
    },
    {
      id: "runner-failed",
      name: `Failed in ${SYNC_FRESHNESS_WINDOW_HOURS} hours`,
      status:
        snapshot.metrics.failedSyncCountLastWindow > 0 ? "Failed" : "OK",
      volume: formatNumber(snapshot.metrics.failedSyncCountLastWindow),
      detail: "Failed sync runs inside the freshness window.",
    },
  ].map((row) => ({
    ...row,
    category: "Runner" as const,
    observedAt,
    duration: "—",
    documents: "—",
    reference: row.id,
    metrics: {
      fetched: 0,
      tenders: 0,
      documents: 0,
    },
  }))
}

function getHealthState(snapshot: AdminMonitoringSnapshot): AdminHealthState {
  if (snapshot.configMissing) {
    return {
      label: "Offline",
      tone: "offline",
      title: "Supabase configuration is missing",
      description:
        "Monitoring cannot run without the public Supabase environment variables.",
    }
  }

  if (snapshot.queryErrors.length > 0) {
    return {
      label: "Attention",
      tone: "attention",
      title: "Monitoring queries failed",
      description: "Some dashboard checks could not read from Supabase.",
    }
  }

  if (snapshot.metrics.stuckRunningSyncCount > 0) {
    return {
      label: "Attention",
      tone: "attention",
      title: "Sync runs appear stuck",
      description: `${formatNumber(
        snapshot.metrics.stuckRunningSyncCount
      )} running sync rows are older than ${STUCK_SYNC_AFTER_MINUTES} minutes.`,
    }
  }

  if (!snapshot.latestSuccessfulRun?.completed_at) {
    return {
      label: "Attention",
      tone: "attention",
      title: "No successful sync yet",
      description: "Tender data has not completed its first refresh.",
    }
  }

  const latestSuccessAgeMs =
    new Date(snapshot.checkedAt).getTime() -
    new Date(snapshot.latestSuccessfulRun.completed_at).getTime()
  const staleAfterMs = SYNC_FRESHNESS_WINDOW_HOURS * 60 * 60 * 1_000

  if (latestSuccessAgeMs > staleAfterMs) {
    return {
      label: "Attention",
      tone: "attention",
      title: "Tender data is stale",
      description: `The latest successful refresh is older than ${SYNC_FRESHNESS_WINDOW_HOURS} hours.`,
    }
  }

  if (snapshot.metrics.failedSyncCountLastWindow > 0) {
    return {
      label: "Attention",
      tone: "attention",
      title: "Recent sync failures found",
      description: `${formatNumber(
        snapshot.metrics.failedSyncCountLastWindow
      )} syncs failed in the last ${SYNC_FRESHNESS_WINDOW_HOURS} hours.`,
    }
  }

  if (snapshot.metrics.runningSyncCount > 0) {
    return {
      label: "Syncing",
      tone: "syncing",
      title: "A sync is running",
      description: "The catalog is fresh and sync work is currently in progress.",
    }
  }

  return {
    label: "Operational",
    tone: "operational",
    title: "All systems operational",
    description: "Sync freshness and catalog checks are within expected ranges.",
  }
}

function getLatestSuccessfulAge(snapshot: AdminMonitoringSnapshot) {
  const completedAt = snapshot.latestSuccessfulRun?.completed_at
  if (!completedAt) return null

  const ageMs =
    new Date(snapshot.checkedAt).getTime() - new Date(completedAt).getTime()
  return `${formatDuration(Math.max(0, ageMs))} ago`
}

function getDocumentCoverage(snapshot: AdminMonitoringSnapshot) {
  if (snapshot.metrics.availableOpenTenderCount === 0) return 0

  return Math.round(
    (snapshot.metrics.availableOpenTenderWithDocumentCount /
      snapshot.metrics.availableOpenTenderCount) *
      100
  )
}

function formatSyncWindow(run: AdminSyncRun) {
  if (run.date_from && run.date_to) return `${run.date_from} to ${run.date_to}`
  if (run.date_from) return `From ${run.date_from}`
  if (run.date_to) return `Until ${run.date_to}`
  return "Window not set"
}

function formatRunDuration(run: AdminSyncRun, checkedAt: string) {
  const startedAt = new Date(run.started_at).getTime()
  const endedAt = run.completed_at
    ? new Date(run.completed_at).getTime()
    : new Date(checkedAt).getTime()

  return formatDuration(Math.max(0, endedAt - startedAt))
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function formatDate(value: string) {
  return `${DATE_FORMAT.format(new Date(value))} SAST`
}

function formatNumber(value: number) {
  return NUMBER_FORMAT.format(value)
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ")
}
