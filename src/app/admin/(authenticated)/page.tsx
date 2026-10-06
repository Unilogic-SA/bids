import type { Metadata } from "next"
import { AlertTriangleIcon } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

import { CatalogQuality } from "@/components/admin/catalog-quality"
import { getCatalogQualityChecks } from "@/lib/admin/quality"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { requireAdminSession } from "@/lib/admin/auth"
import { createAdminDashboard } from "@/lib/admin/dashboard"
import { getAdminMonitoringSnapshot } from "@/lib/admin/monitoring"

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

export default async function AdminPage() {
  await requireAdminSession()

  const checkedAtDate = new Date()
  const [snapshot, qualityChecks] = await Promise.all([
    getAdminMonitoringSnapshot(checkedAtDate),
    getCatalogQualityChecks(checkedAtDate.toISOString()),
  ])
  const dashboard = createAdminDashboard(snapshot)

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
            {dashboard.health.tone === "attention" ||
            dashboard.health.tone === "offline" ? (
              <div className="px-4 lg:px-6">
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>{dashboard.health.title}</AlertTitle>
                  <AlertDescription>
                    {dashboard.health.description} Open counts decrease as
                    deadlines pass; imports must replenish them.
                    {snapshot.latestRun?.status === "failed" && snapshot.latestRun.message
                      ? ` Latest failure: ${snapshot.latestRun.message}`
                      : ""}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            <SectionCards cards={dashboard.cards} />
            <CatalogQuality
              checks={qualityChecks}
              sourceDescription={
                dashboard.rows.find((row) => row.id === "check-source-coverage")
                  ?.detail || "Source coverage unavailable."
              }
            />
            <div id="sync-activity" className="scroll-mt-16 px-4 lg:px-6">
              <ChartAreaInteractive runs={snapshot.latestRuns} />
            </div>
            <div id="operations-data" className="scroll-mt-16">
              <DataTable data={dashboard.rows} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
