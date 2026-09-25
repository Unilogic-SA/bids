import {
  IconAlertTriangleFilled,
  IconChecks,
  IconClock,
  IconDatabase,
  IconFileText,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AdminSectionCards } from "@/lib/admin/dashboard"

export function SectionCards({ cards }: { cards: AdminSectionCards }) {
  const healthVariant =
    cards.health.tone === "attention" || cards.health.tone === "offline"
      ? "destructive"
      : cards.health.tone === "syncing"
        ? "secondary"
        : "outline"

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>System status</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {cards.health.label}
          </CardTitle>
          <CardAction>
            <Badge
              variant={healthVariant}
              className={
                healthVariant === "destructive"
                  ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : undefined
              }
            >
              {cards.health.tone === "operational" ? (
                <IconChecks data-icon="inline-start" />
              ) : (
                <IconAlertTriangleFilled data-icon="inline-start" />
              )}
              {cards.health.title}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Checked {cards.checkedAt}
            <IconChecks data-icon="inline-end" />
          </div>
          <div className="text-muted-foreground">
            {cards.health.description}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Data freshness</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {cards.freshness}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconClock data-icon="inline-start" />
              Latest success
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Successful sync freshness
            <IconClock data-icon="inline-end" />
          </div>
          <div className="text-muted-foreground">
            {cards.freshnessDescription}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Available tenders</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {cards.availableTenders}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconDatabase data-icon="inline-start" />
              Open now
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Current catalog availability
            <IconDatabase data-icon="inline-end" />
          </div>
          <div className="text-muted-foreground">
            {cards.availableTendersDescription}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Tender documents</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {cards.totalDocuments}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconFileText data-icon="inline-start" />
              {cards.documentCoverage}% coverage
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Documents attached to open tenders
            <IconFileText data-icon="inline-end" />
          </div>
          <div className="text-muted-foreground">
            {cards.documentCoverage}% of available tenders include documents.
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
