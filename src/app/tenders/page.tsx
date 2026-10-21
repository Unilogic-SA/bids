import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SeoBreadcrumbs } from "@/components/seo-breadcrumbs"
import { PublicFooter } from "@/components/public-footer"
import {
  INDUSTRY_COLLECTIONS,
  PROVINCE_COLLECTIONS,
  BUYER_COLLECTIONS,
  collectionPath,
} from "@/lib/tenders/directory"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata(
  "Browse South African government tenders",
  "Find South African public tenders by province, industry or issuing buyer. Open notice details, closing dates and available official documents.",
  "/tenders"
)
export default function BrowseTenders() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 md:px-6">
        <SeoBreadcrumbs
          items={[
            { name: "Discover", path: "/" },
            { name: "Browse tenders", path: "/tenders" },
          ]}
        />
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Browse tenders</h1>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            Choose a province, industry or buyer to find current public procurement notices. Use
            Discover for a keyword search and more filters.
          </p>
        </header>
        {[
          ["By industry", INDUSTRY_COLLECTIONS],
          ["By province", PROVINCE_COLLECTIONS],
          ["By buyer", BUYER_COLLECTIONS],
        ].map(([label, items]) => (
          <section key={label as string} className="space-y-2">
            <h2 className="text-base font-semibold">{label as string}</h2>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {(items as typeof INDUSTRY_COLLECTIONS).map((item) => (
                <li key={collectionPath(item)}>
                  <Button
                    asChild
                    variant="link"
                    className="h-auto min-h-10 justify-start px-0 text-sm"
                  >
                    <Link href={collectionPath(item)}>{item.name} tenders</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div>
          <Button asChild size="sm">
            <Link href="/">Search all tenders</Link>
          </Button>
        </div>
      </main>
      <PublicFooter />
    </>
  )
}
