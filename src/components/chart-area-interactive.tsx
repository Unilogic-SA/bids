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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AdminSyncRun } from "@/lib/admin/monitoring"

export const description = "An interactive sync activity area chart"

const chartConfig = {
  activity: {
    label: "Sync activity",
  },
  fetched: {
    label: "Fetched",
    color: "#8b5cf6",
  },
  tenders: {
    label: "Tenders",
    color: "#6d28d9",
  },
  documents: {
    label: "Documents",
    color: "#c4b5fd",
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
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Recent sync activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Fetched, tender, and document totals from recent sync runs
          </span>
          <span className="@[540px]/card:hidden">Recent sync totals</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={effectiveTimeRange}
            onValueChange={(value) => value && setTimeRange(value)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="15r">Last 15 runs</ToggleGroupItem>
            <ToggleGroupItem value="10r">Last 10 runs</ToggleGroupItem>
            <ToggleGroupItem value="5r">Last 5 runs</ToggleGroupItem>
          </ToggleGroup>
          <Select value={effectiveTimeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
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
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart accessibilityLayer data={chartData}>
            <defs>
              <linearGradient id="fillFetched" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-fetched)"
                  stopOpacity={1}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-fetched)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillTenders" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-tenders)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-tenders)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillDocuments" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-documents)"
                  stopOpacity={0.65}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-documents)"
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
                  labelFormatter={(value) => formatRunDate(String(value))}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="documents"
              type="natural"
              isAnimationActive={false}
              fill="url(#fillDocuments)"
              stroke="var(--color-documents)"
              stackId="a"
            />
            <Area
              dataKey="tenders"
              type="natural"
              isAnimationActive={false}
              fill="url(#fillTenders)"
              stroke="var(--color-tenders)"
              stackId="a"
            />
            <Area
              dataKey="fetched"
              type="natural"
              isAnimationActive={false}
              fill="url(#fillFetched)"
              stroke="var(--color-fetched)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function formatRunDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
  })
}
