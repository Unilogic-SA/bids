import { Skeleton } from "@/components/ui/skeleton"

export function WorkspaceRowsSkeleton() {
  return <div className="space-y-3" aria-label="Loading bids" aria-busy="true">
    <span className="sr-only" role="status">Loading bids…</span>
    {[1, 2, 3].map(value => <Skeleton key={value} className="h-20 w-full" />)}
  </div>
}
export function WorkspaceBoardSkeleton() {
  return <div className="flex gap-3 overflow-hidden" aria-label="Loading board" aria-busy="true">
    <span className="sr-only" role="status">Loading board…</span>
    {[1, 2, 3, 4, 5].map(value => <div key={value} className="min-w-60 flex-1 space-y-3" aria-hidden="true">
      <Skeleton className="h-8 w-full" />
      {[1, 2, 3].map(row => <Skeleton key={row} className="h-36 w-full" />)}
    </div>)}
  </div>
}
export function WorkspaceSkeleton() {
  return <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 md:px-6">
    <Skeleton className="h-8 w-44" /><Skeleton className="h-8 w-full max-w-72" /><WorkspaceRowsSkeleton />
  </main>
}
