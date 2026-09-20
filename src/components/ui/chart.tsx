"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"
import type { TooltipContentProps } from "recharts/types/component/Tooltip"

import { cn } from "@/lib/utils"

type ChartConfig = Record<string, { label: React.ReactNode; color?: string }>

const ChartContext = React.createContext<ChartConfig>({})

function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const chartId = React.useId().replace(/:/g, "")
  const variables = Object.entries(config).reduce(
    (values, [key, item]) => ({ ...values, [`--color-${key}`]: item.color }),
    {} as React.CSSProperties
  )

  return (
    <ChartContext.Provider value={config}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-auto h-64 justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50 [&_.recharts-surface]:outline-none",
          className
        )}
        style={variables}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({ active, payload, label }: Partial<TooltipContentProps<ValueType, NameType>>) {
  const config = React.useContext(ChartContext)
  if (!active || !payload?.length) return null

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border bg-background px-2.5 py-2 text-xs shadow-xl">
      <p className="font-medium">{String(label)}</p>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ backgroundColor: item.color }} />
            {config[String(item.dataKey)]?.label || String(item.name)}
          </span>
          <span className="font-mono font-medium tabular-nums text-foreground">{Number(item.value).toLocaleString("en-ZA")}</span>
        </div>
      ))}
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig }
