import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
export function AccountFormSkeleton() {
  return <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10" aria-busy="true">
    <span className="sr-only" role="status">Loading account form…</span>
    <Card className="w-full max-w-sm" aria-hidden="true"><CardContent className="space-y-5 pt-6">
      <Skeleton className="mx-auto h-7 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-full" />
      {[1, 2].map(value => <div key={value} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-full" /></div>)}
      <Skeleton className="h-8 w-full" />
    </CardContent></Card>
  </main>
}
