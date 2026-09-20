"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { AdminSyncRun } from "@/lib/admin/monitoring"

const chartConfig = {
  fetched: { label: "Fetched", color: "var(--chart-2)" },
  tenders: { label: "Tenders", color: "var(--chart-4)" },
  documents: { label: "Documents", color: "var(--chart-1)" },
} satisfies ChartConfig

const RUN_LABEL_FORMAT = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Johannesburg",
})

export function SyncActivityChart({ runs }: { runs: AdminSyncRun[] }) {
  const data = runs
    .slice(0, 10)
    .reverse()
    .map((run) => ({
      run: RUN_LABEL_FORMAT.format(new Date(run.started_at)),
      fetched: run.fetched_count,
      tenders: run.upserted_tender_count,
      documents: run.upserted_document_count,
    }))

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="run" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
        <YAxis tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="fetched" fill="var(--color-fetched)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="tenders" fill="var(--color-tenders)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="documents" fill="var(--color-documents)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
