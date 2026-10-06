import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { CatalogQualityCheck } from "@/lib/admin/quality"

export function CatalogQuality({
  checks,
  sourceDescription,
}: {
  checks: CatalogQualityCheck[]
  sourceDescription: string
}) {
  return (
    <section
      id="catalog-quality"
      className="scroll-mt-16 px-4 lg:px-6"
      aria-label="Data source and catalog quality"
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle>Data source & quality</CardTitle>
          <CardDescription className="break-words">
            {sourceDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {checks.map((check) => (
              <AccordionItem key={check.id} value={check.id}>
                <AccordionTrigger className="py-3 text-sm">
                  <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
                    <span>{check.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {check.scope}
                    </span>
                    <Badge
                      className="ml-auto tabular-nums"
                      variant={
                        check.count === null || check.count > 0
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {check.count === null
                        ? "Unavailable"
                        : check.count.toLocaleString("en-ZA")}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {check.count === null ? (
                    <p className="text-muted-foreground">
                      This check could not be loaded. Refresh data to try again.
                    </p>
                  ) : check.count === 0 ? (
                    <p className="text-muted-foreground">
                      No records with this issue at the last check.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Showing the latest {check.examples.length} of{" "}
                        {check.count} records. Missing fields may also be absent
                        from the original source.
                      </p>
                      <ul className="space-y-2">
                        {check.examples.map((tender) => (
                          <li key={tender.ocid}>
                            <Link
                              className="block break-words text-sm underline underline-offset-4 hover:text-primary"
                              href={`/tenders/${encodeURIComponent(tender.ocid)}`}
                            >
                              {tender.tender_no} ·{" "}
                              {tender.title || "Untitled tender"}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </section>
  )
}
