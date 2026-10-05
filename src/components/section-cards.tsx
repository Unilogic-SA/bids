import {
  IconAlertTriangleFilled,
  IconChecks,
  IconClock,
  IconDatabase,
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
      ? "critical"
      : cards.health.tone === "syncing"
        ? "secondary"
        : "outline"

  return (
    <div className="grid grid-cols-1 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card size="sm" className="@container/card">
        <CardHeader>
          <CardDescription>System status</CardDescription>
          <CardTitle className="font-semibold tabular-nums group-data-[size=sm]/card:text-xl @[250px]/card:group-data-[size=sm]/card:text-2xl">
            {cards.health.label}
          </CardTitle>
          <CardAction>
            <Badge variant={healthVariant}>
              {cards.health.tone === "operational" ? (
                <IconChecks data-icon="inline-start" />
              ) : (
                <IconAlertTriangleFilled data-icon="inline-start" />
              )}
              {cards.health.title}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Checked {cards.checkedAt}
            <IconChecks data-icon="inline-end" />
          </div>
          <div className="text-muted-foreground">
            {cards.health.description}
          </div>
        </CardFooter>
      </Card>

      <Card size="sm" className="@container/card">
        <CardHeader>
          <CardDescription>Data freshness</CardDescription>
          <CardTitle className="font-semibold tabular-nums group-data-[size=sm]/card:text-xl @[250px]/card:group-data-[size=sm]/card:text-2xl">
            {cards.freshness}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconClock data-icon="inline-start" />
              Last import
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Successful sync freshness
            <IconClock data-icon="inline-end" />
          </div>
          <div className="text-muted-foreground">
            {cards.freshnessDescription}
          </div>
        </CardFooter>
      </Card>

      <Card size="sm" className="@container/card">
        <CardHeader>
          <CardDescription>Open tenders</CardDescription>
          <CardTitle className="font-semibold tabular-nums group-data-[size=sm]/card:text-xl @[250px]/card:group-data-[size=sm]/card:text-2xl">
            {cards.availableTenders}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconDatabase data-icon="inline-start" />
              Open now
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Current catalog availability
            <IconDatabase data-icon="inline-end" />
          </div>
          <div className="text-muted-foreground">
            {cards.availableTendersDescription} {cards.closingTenders} close in the next 24 hours.
          </div>
        </CardFooter>
      </Card>

      <Card size="sm" className="@container/card">
        <CardHeader>
          <CardDescription>Stored tenders</CardDescription>
          <CardTitle className="font-semibold tabular-nums group-data-[size=sm]/card:text-xl @[250px]/card:group-data-[size=sm]/card:text-2xl">{cards.totalTenders}</CardTitle>
          <CardAction><Badge variant="outline"><IconDatabase data-icon="inline-start" />Full catalog</Badge></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="font-medium">{cards.addedTenders} added in the last 24 hours</div>
          <div className="text-muted-foreground">{cards.expiredTenders} past deadline · {cards.totalDocuments} documents</div>
        </CardFooter>
      </Card>

    </div>
  )
}
