"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AdminSyncRun } from "@/lib/admin/monitoring"
import { ADMIN_CHART_COLORS } from "@/lib/admin/theme"

export const description = "An interactive sync activity area chart"

const chartConfig = {
  activity: {
    label: "Sync activity",
  },
  fetched: {
    label: "Fetched",
    color: ADMIN_CHART_COLORS.fetched,
  },
  tenders: {
    label: "Tenders",
    color: ADMIN_CHART_COLORS.tenders,
  },
  documents: {
    label: "Documents",
    color: ADMIN_CHART_COLORS.documents,
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ runs }: { runs: AdminSyncRun[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("15r")
  const effectiveTimeRange = isMobile && timeRange === "15r" ? "5r" : timeRange
  const runCount =
    effectiveTimeRange === "5r" ? 5 : effectiveTimeRange === "10r" ? 10 : 15
  const chartData = runs
    .slice(0, runCount)
    .reverse()
    .map((run) => ({
      date: run.started_at,
      fetched: run.fetched_count,
      tenders: run.upserted_tender_count,
      documents: run.upserted_document_count,
    }))

  return (
    <Card size="sm" className="@container/card">
      <CardHeader>
        <CardTitle>Recent sync activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Processed records per run; these are updates, not newly added
            tenders
          </span>
          <span className="@[540px]/card:hidden">Recent sync totals</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={effectiveTimeRange}
            onValueChange={(value) => value && setTimeRange(value)}
            variant="outline"
            size="sm"
            className="hidden @[767px]/card:flex"
          >
            <ToggleGroupItem value="15r">Last 15 runs</ToggleGroupItem>
            <ToggleGroupItem value="10r">Last 10 runs</ToggleGroupItem>
            <ToggleGroupItem value="5r">Last 5 runs</ToggleGroupItem>
          </ToggleGroup>
          <Select value={effectiveTimeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select sync run range"
            >
              <SelectValue placeholder="Last 15 runs" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectGroup>
                <SelectItem value="15r" className="rounded-lg">
                  Last 15 runs
                </SelectItem>
                <SelectItem value="10r" className="rounded-lg">
                  Last 10 runs
                </SelectItem>
                <SelectItem value="5r" className="rounded-lg">
                  Last 5 runs
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-3">
        {!chartData.length ? (
          <p className="px-3 py-8 text-sm text-muted-foreground">
            No sync runs are available yet.
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[180px] w-full md:h-[200px]"
          >
            <AreaChart accessibilityLayer data={chartData}>
              <defs>
                <linearGradient id="fillFetched" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={ADMIN_CHART_COLORS.fetched}
                    stopOpacity={1}
                  />
                  <stop
                    offset="95%"
                    stopColor={ADMIN_CHART_COLORS.fetched}
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillTenders" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={ADMIN_CHART_COLORS.tenders}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={ADMIN_CHART_COLORS.tenders}
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillDocuments" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={ADMIN_CHART_COLORS.documents}
                    stopOpacity={0.65}
                  />
                  <stop
                    offset="95%"
                    stopColor={ADMIN_CHART_COLORS.documents}
                    stopOpacity={0.08}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={formatRunDate}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      formatRunTimestamp(String(value))
                    }
                    indicator="dot"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="documents"
                type="linear"
                isAnimationActive={false}
                fill="url(#fillDocuments)"
                stroke={ADMIN_CHART_COLORS.documents}
              />
              <Area
                dataKey="tenders"
                type="linear"
                isAnimationActive={false}
                fill="url(#fillTenders)"
                stroke={ADMIN_CHART_COLORS.tenders}
              />
              <Area
                dataKey="fetched"
                type="linear"
                isAnimationActive={false}
                fill="url(#fillFetched)"
                stroke={ADMIN_CHART_COLORS.fetched}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function formatRunDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Johannesburg",
  })
}

function formatRunTimestamp(value: string) {
  return `${formatRunDate(value)} SAST`
}
