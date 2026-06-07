import {
  IconAlertTriangle,
  IconArrowRight,
  IconChecks,
  IconClock,
  IconDatabase,
  IconFileText,
  IconLogout,
} from "@tabler/icons-react"
import type { TablerIcon } from "@tabler/icons-react"
import Link from "next/link"
import type { Metadata } from "next"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { signOutAdmin } from "@/lib/admin/actions"
import { requireAdminSession } from "@/lib/admin/auth"
import {
  type AdminMonitoringSnapshot,
  type AdminSyncRun,
  getAdminMonitoringSnapshot,
  STUCK_SYNC_AFTER_MINUTES,
  SYNC_FRESHNESS_WINDOW_HOURS,
} from "@/lib/admin/monitoring"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
})

const NUMBER_FORMAT = new Intl.NumberFormat("en-ZA")

type HealthState = {
  label: string
  tone: "operational" | "syncing" | "attention" | "offline"
  title: string
  description: string
}

export default async function AdminPage() {
  const { user } = await requireAdminSession()
  const snapshot = await getAdminMonitoringSnapshot()
  const health = getHealthState(snapshot)
  const documentCoverage = getDocumentCoverage(snapshot)
  const latestSuccessfulAge = getLatestSuccessfulAge(snapshot)
  const checks = getSystemChecks(snapshot)

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Admin</p>
            <h1 className="font-heading text-3xl font-medium tracking-normal">
              Operations
            </h1>
            <p className="text-sm text-muted-foreground">
              Last checked {formatDate(snapshot.checkedAt)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex items-center gap-2">
              <Badge variant={getHealthBadgeVariant(health.tone)}>
                {health.label}
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/">
                  View site
                  <IconArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <form action={signOutAdmin}>
                <Button type="submit" variant="outline" size="sm">
                  <IconLogout data-icon="inline-start" />
                  Sign out
                </Button>
              </form>
            </div>
            <p className="max-w-72 truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </header>

        {health.tone !== "operational" ? (
          <Alert variant={health.tone === "syncing" ? "default" : "destructive"}>
            <IconAlertTriangle />
            <AlertTitle>{health.title}</AlertTitle>
            <AlertDescription>{health.description}</AlertDescription>
          </Alert>
        ) : null}

        {snapshot.queryErrors.length > 0 ? (
          <Alert variant="destructive">
            <IconAlertTriangle />
            <AlertTitle>Some monitoring queries failed</AlertTitle>
            <AlertDescription>
              {snapshot.queryErrors.slice(0, 3).join(" ")}
            </AlertDescription>
          </Alert>
        ) : null}

        <section
          aria-label="Monitoring summary"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            title="System status"
            value={health.label}
            description={health.description}
            icon={IconChecks}
          />
          <MetricCard
            title="Data freshness"
            value={latestSuccessfulAge || "No success"}
            description={
              snapshot.latestSuccessfulRun?.completed_at
                ? `Last success ${formatDate(snapshot.latestSuccessfulRun.completed_at)}`
                : "No completed sync run is available."
            }
            icon={IconClock}
          />
          <MetricCard
            title="Available tenders"
            value={formatNumber(snapshot.metrics.availableOpenTenderCount)}
            description={`${formatNumber(
              snapshot.metrics.availableOpenTenderWithDocumentCount
            )} have documents attached.`}
            icon={IconDatabase}
          />
          <MetricCard
            title="Tender documents"
            value={formatNumber(snapshot.metrics.totalDocumentCount)}
            description={`${documentCoverage}% document coverage on available tenders.`}
            icon={IconFileText}
          />
        </section>

        <section
          aria-label="System checks"
          className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <Card>
            <CardHeader>
              <CardTitle>System checks</CardTitle>
              <CardDescription>
                Key conditions behind the overall status.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {checks.map((check, index) => (
                <div key={check.label} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-medium">{check.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {check.description}
                      </p>
                    </div>
                    <Badge variant={getCheckBadgeVariant(check.status)}>
                      {check.status}
                    </Badge>
                  </div>
                  {index < checks.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync runner</CardTitle>
              <CardDescription>
                Running, stuck, completed, and failed sync activity in the freshness window.
              </CardDescription>
              <CardAction>
                <Badge
                  variant={
                    snapshot.metrics.stuckRunningSyncCount > 0
                      ? "destructive"
                      : "outline"
                  }
                >
                  {formatNumber(snapshot.metrics.stuckRunningSyncCount)} stuck
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <StatBlock
                label="Running"
                value={formatNumber(snapshot.metrics.runningSyncCount)}
              />
              <StatBlock
                label={`Older than ${STUCK_SYNC_AFTER_MINUTES} min`}
                value={formatNumber(snapshot.metrics.stuckRunningSyncCount)}
              />
              <StatBlock
                label={`Completed in ${SYNC_FRESHNESS_WINDOW_HOURS}h`}
                value={formatNumber(snapshot.metrics.completedSyncCountLastWindow)}
              />
              <StatBlock
                label={`Failed in ${SYNC_FRESHNESS_WINDOW_HOURS}h`}
                value={formatNumber(snapshot.metrics.failedSyncCountLastWindow)}
              />
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                The latest run started {formatOptionalDate(snapshot.latestRun?.started_at)}.
              </p>
            </CardFooter>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Latest syncs</CardTitle>
            <CardDescription>
              Most recent sync run records from Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.latestRuns.length > 0 ? (
              <SyncRunsTable runs={snapshot.latestRuns} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No sync runs found</EmptyTitle>
                  <EmptyDescription>
                    Supabase has not returned any sync history yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: TablerIcon
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Icon />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="font-heading text-2xl font-medium tracking-normal">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-medium">{value}</p>
    </div>
  )
}

function SyncRunsTable({ runs }: { runs: AdminSyncRun[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>Window</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead className="text-right">Fetched</TableHead>
          <TableHead className="text-right">Tenders</TableHead>
          <TableHead className="text-right">Docs</TableHead>
          <TableHead>Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Badge variant={getRunBadgeVariant(run.status)}>
                {formatStatus(run.status)}
              </Badge>
            </TableCell>
            <TableCell>{run.mode}</TableCell>
            <TableCell>{formatSyncWindow(run)}</TableCell>
            <TableCell>{formatDate(run.started_at)}</TableCell>
            <TableCell>{formatRunDuration(run)}</TableCell>
            <TableCell className="text-right">
              {formatNumber(run.fetched_count)}
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(run.upserted_tender_count)}
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(run.upserted_document_count)}
            </TableCell>
            <TableCell className="max-w-96 whitespace-normal text-muted-foreground">
              {run.message || "None"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function getHealthState(snapshot: AdminMonitoringSnapshot): HealthState {
  if (snapshot.configMissing) {
    return {
      label: "Offline",
      tone: "offline",
      title: "Supabase configuration is missing",
      description: "Monitoring cannot run without the public Supabase environment variables.",
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
    Date.now() - new Date(snapshot.latestSuccessfulRun.completed_at).getTime()
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

function getSystemChecks(snapshot: AdminMonitoringSnapshot) {
  const latestSuccessAgeMs = snapshot.latestSuccessfulRun?.completed_at
    ? Date.now() - new Date(snapshot.latestSuccessfulRun.completed_at).getTime()
    : null
  const staleAfterMs = SYNC_FRESHNESS_WINDOW_HOURS * 60 * 60 * 1_000

  return [
    {
      label: "Supabase reads",
      description: snapshot.configMissing
        ? "Public Supabase configuration is missing."
        : snapshot.queryErrors.length > 0
          ? "At least one monitoring query failed."
          : "Public read queries are returning data.",
      status:
        snapshot.configMissing || snapshot.queryErrors.length > 0
          ? "attention"
          : "ok",
    },
    {
      label: "Successful sync freshness",
      description: snapshot.latestSuccessfulRun?.completed_at
        ? `Latest success completed ${formatDate(snapshot.latestSuccessfulRun.completed_at)}.`
        : "No successful sync run has been recorded.",
      status:
        latestSuccessAgeMs === null || latestSuccessAgeMs > staleAfterMs
          ? "attention"
          : "ok",
    },
    {
      label: "Stuck running rows",
      description: `${formatNumber(
        snapshot.metrics.stuckRunningSyncCount
      )} running sync rows are older than ${STUCK_SYNC_AFTER_MINUTES} minutes.`,
      status: snapshot.metrics.stuckRunningSyncCount > 0 ? "attention" : "ok",
    },
    {
      label: "Recent failures",
      description: `${formatNumber(
        snapshot.metrics.failedSyncCountLastWindow
      )} failures in the last ${SYNC_FRESHNESS_WINDOW_HOURS} hours.`,
      status: snapshot.metrics.failedSyncCountLastWindow > 0 ? "attention" : "ok",
    },
  ] as const
}

function getLatestSuccessfulAge(snapshot: AdminMonitoringSnapshot) {
  const completedAt = snapshot.latestSuccessfulRun?.completed_at
  if (!completedAt) return null

  const ageMs = Date.now() - new Date(completedAt).getTime()
  return `${formatDuration(ageMs)} ago`
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
  return "Not set"
}

function formatRunDuration(run: AdminSyncRun) {
  const startedAt = new Date(run.started_at).getTime()
  const endedAt = run.completed_at ? new Date(run.completed_at).getTime() : Date.now()

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
  return DATE_FORMAT.format(new Date(value))
}

function formatOptionalDate(value?: string) {
  return value ? formatDate(value) : "not available"
}

function formatNumber(value: number) {
  return NUMBER_FORMAT.format(value)
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ")
}

function getHealthBadgeVariant(tone: HealthState["tone"]) {
  if (tone === "attention" || tone === "offline") return "destructive"
  if (tone === "syncing") return "secondary"
  return "default"
}

function getRunBadgeVariant(status: string) {
  if (status === "failed") return "destructive"
  if (status === "running") return "secondary"
  if (status === "completed") return "outline"
  return "secondary"
}

function getCheckBadgeVariant(status: "ok" | "attention") {
  return status === "ok" ? "outline" : "destructive"
}
