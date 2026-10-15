import { Skeleton } from "@/components/ui/skeleton"

export function WorkspaceRowsSkeleton() {
  return (
    <div className="divide-y border-y md:rounded-lg md:border" aria-label="Loading bids" aria-busy="true">
      <span className="sr-only" role="status">Loading bids…</span>
      {[1, 2, 3].map(value => (
        <div key={value} className="space-y-3 px-3 py-4" aria-hidden="true">
          <Skeleton className="h-4 w-3/4 md:w-2/5" />
          <Skeleton className="h-3 w-1/2 md:w-1/4" />
          <div className="flex gap-4 md:hidden">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
export function WorkspaceBoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-label="Loading board" aria-busy="true">
      <span className="sr-only" role="status">Loading board…</span>
      {[1, 2, 3, 4, 5].map(value => (
        <div key={value} className="w-full min-w-0 shrink-0 space-y-3 md:w-56 xl:flex-1" aria-hidden="true">
          <Skeleton className="h-8 w-1/2" />
          {[1, 2, 3].map(row => <Skeleton key={row} className="h-48 w-full" />)}
        </div>
      ))}
    </div>
  )
}
export function WorkspaceSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 md:px-6">
      <div className="flex flex-wrap gap-3" aria-hidden="true">
        <Skeleton className="h-10 w-full sm:h-8 sm:w-72" />
        <Skeleton className="h-10 w-36 sm:h-8" />
        <Skeleton className="h-10 w-40 sm:h-8" />
      </div>
      <WorkspaceRowsSkeleton />
    </main>
  )
}
