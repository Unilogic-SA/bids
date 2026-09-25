import type { Metadata } from "next"

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

  const snapshot = await getAdminMonitoringSnapshot()
  const dashboard = createAdminDashboard(snapshot)

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards cards={dashboard.cards} />
            <div id="sync-activity" className="scroll-mt-16 px-4 lg:px-6">
              <ChartAreaInteractive runs={snapshot.latestRuns} />
            </div>
            <div id="operations-data" className="scroll-mt-16">
              <DataTable key={snapshot.checkedAt} data={dashboard.rows} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
