import { createPublicClient, hasSupabasePublicConfig } from "@/lib/supabase/server"

export const SYNC_FRESHNESS_WINDOW_HOURS = 26
export const STUCK_SYNC_AFTER_MINUTES = 10

const SYNC_RUN_COLUMNS = [
  "id",
  "mode",
  "status",
  "date_from",
  "date_to",
  "page_size",
  "fetched_count",
  "open_count",
  "upserted_tender_count",
  "upserted_document_count",
  "started_at",
  "completed_at",
  "message",
].join(",")

export type AdminSyncRun = {
  id: string
  mode: string
  status: string
  date_from: string | null
  date_to: string | null
  page_size: number | null
  fetched_count: number
  open_count: number
  upserted_tender_count: number
  upserted_document_count: number
  started_at: string
  completed_at: string | null
  message: string | null
}

export type AdminMonitoringSnapshot = {
  checkedAt: string
  configMissing: boolean
  queryErrors: string[]
  latestRuns: AdminSyncRun[]
  latestSuccessfulRun: AdminSyncRun | null
  latestRun: AdminSyncRun | null
  metrics: {
    availableOpenTenderCount: number
    availableOpenTenderWithDocumentCount: number
    totalDocumentCount: number
    runningSyncCount: number
    stuckRunningSyncCount: number
    completedSyncCountLastWindow: number
    failedSyncCountLastWindow: number
  }
}

export async function getAdminMonitoringSnapshot(): Promise<AdminMonitoringSnapshot> {
  const checkedAtDate = new Date()
  const checkedAt = checkedAtDate.toISOString()

  if (!hasSupabasePublicConfig()) {
    return emptySnapshot({
      checkedAt,
      configMissing: true,
      queryErrors: [],
    })
  }

  const supabase = createPublicClient()
  const freshnessCutoff = new Date(
    checkedAtDate.getTime() - SYNC_FRESHNESS_WINDOW_HOURS * 60 * 60 * 1_000
  ).toISOString()
  const stuckCutoff = new Date(
    checkedAtDate.getTime() - STUCK_SYNC_AFTER_MINUTES * 60 * 1_000
  ).toISOString()

  const [
    latestRunsResult,
    latestSuccessfulRunResult,
    openTenderCountResult,
    openTenderWithDocumentCountResult,
    documentCountResult,
    runningSyncCountResult,
    stuckRunningSyncCountResult,
    completedSyncCountResult,
    failedSyncCountResult,
  ] = await Promise.all([
    supabase
      .from("tender_sync_runs")
      .select(SYNC_RUN_COLUMNS)
      .order("started_at", { ascending: false })
      .limit(15),
    supabase
      .from("tender_sync_runs")
      .select(SYNC_RUN_COLUMNS)
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tenders")
      .select("ocid", { count: "exact", head: true })
      .eq("derived_status", "open")
      .gte("closing_at", checkedAt),
    supabase
      .from("tenders")
      .select("ocid", { count: "exact", head: true })
      .eq("derived_status", "open")
      .gte("closing_at", checkedAt)
      .gt("documents_count", 0),
    supabase
      .from("tender_documents")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("tender_sync_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    supabase
      .from("tender_sync_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running")
      .lt("started_at", stuckCutoff),
    supabase
      .from("tender_sync_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", freshnessCutoff),
    supabase
      .from("tender_sync_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("completed_at", freshnessCutoff),
  ])

  const queryErrors = [
    latestRunsResult.error,
    latestSuccessfulRunResult.error,
    openTenderCountResult.error,
    openTenderWithDocumentCountResult.error,
    documentCountResult.error,
    runningSyncCountResult.error,
    stuckRunningSyncCountResult.error,
    completedSyncCountResult.error,
    failedSyncCountResult.error,
  ].flatMap((error) => (error ? [error.message] : []))

  const latestRuns = (latestRunsResult.data || []) as unknown as AdminSyncRun[]

  return {
    checkedAt,
    configMissing: false,
    queryErrors,
    latestRuns,
    latestSuccessfulRun:
      (latestSuccessfulRunResult.data as unknown as AdminSyncRun | null) || null,
    latestRun: latestRuns[0] || null,
    metrics: {
      availableOpenTenderCount: openTenderCountResult.count || 0,
      availableOpenTenderWithDocumentCount:
        openTenderWithDocumentCountResult.count || 0,
      totalDocumentCount: documentCountResult.count || 0,
      runningSyncCount: runningSyncCountResult.count || 0,
      stuckRunningSyncCount: stuckRunningSyncCountResult.count || 0,
      completedSyncCountLastWindow: completedSyncCountResult.count || 0,
      failedSyncCountLastWindow: failedSyncCountResult.count || 0,
    },
  }
}

function emptySnapshot({
  checkedAt,
  configMissing,
  queryErrors,
}: {
  checkedAt: string
  configMissing: boolean
  queryErrors: string[]
}): AdminMonitoringSnapshot {
  return {
    checkedAt,
    configMissing,
    queryErrors,
    latestRuns: [],
    latestSuccessfulRun: null,
    latestRun: null,
    metrics: {
      availableOpenTenderCount: 0,
      availableOpenTenderWithDocumentCount: 0,
      totalDocumentCount: 0,
      runningSyncCount: 0,
      stuckRunningSyncCount: 0,
      completedSyncCountLastWindow: 0,
      failedSyncCountLastWindow: 0,
    },
  }
}
