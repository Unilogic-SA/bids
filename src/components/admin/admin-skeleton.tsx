import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
export function AdminSkeleton() {
  return <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6" aria-label="Loading dashboard" aria-busy="true">
    <span className="sr-only" role="status">Loading dashboard…</span>
    <Skeleton className="h-8 w-40" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {[1, 2, 3, 4].map(value => <Card key={value}><CardContent className="space-y-3 pt-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></CardContent></Card>)}
    </div>
    <Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" />
  </div>
}
