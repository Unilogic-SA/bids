import Link from "next/link"
import { Button } from "@/components/ui/button"

export function PublicFooter() {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-muted-foreground md:px-6">
      <span>OpenBids · Independent public tender discovery</span>
      <nav aria-label="Public resources" className="flex flex-wrap items-center gap-1">
        {[
          ["/tenders", "Browse tenders"],
          ["/guides", "Guides"],
          ["/about", "About & sources"],
          ["/privacy", "Privacy"],
          ["/terms", "Terms"],
        ].map(([href, label]) => (
          <Button
            asChild
            size="sm"
            variant="link"
            className="h-8 px-2 text-xs text-muted-foreground"
            key={href}
          >
            <Link href={href}>{label}</Link>
          </Button>
        ))}
      </nav>
    </footer>
  )
}
