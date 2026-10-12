import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LISTING_PAGE_SIZE } from "@/lib/tenders/navigation"

export function DiscoverResultsSkeleton() {
  return <div className="flex min-w-0 flex-col gap-4" aria-busy="true" aria-label="Loading tenders">
    <span className="sr-only" role="status">Loading tender results…</span>
    <Skeleton className="h-5 w-40" />
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: LISTING_PAGE_SIZE }, (_, index) => <Card key={index} size="sm" className="shadow-none">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-3 w-20" /></div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center justify-between gap-4"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-28" /></div>
        </CardContent>
      </Card>)}
    </div>
  </div>
}

export function DiscoverSkeleton() {
  return <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 md:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
    <Skeleton className="h-8 w-full lg:hidden" />
    <Card size="sm" className="hidden lg:block" aria-hidden="true">
      <CardContent className="space-y-5">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-8 w-full" /></div>)}
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
    <DiscoverResultsSkeleton />
  </main>
}
