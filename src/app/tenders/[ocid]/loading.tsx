import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function TenderLoading() {
  return (
    <div aria-label="Loading tender" aria-busy="true" className="min-h-screen">
      <span className="sr-only" role="status">
        Loading tender details…
      </span>
      <div className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:py-6 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-8 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 sm:w-28" />
              <Skeleton className="h-8 w-24 sm:w-36" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-7 w-full max-w-4xl" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-5 w-56" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="col-span-2 h-12 sm:col-span-1" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <Skeleton className="h-8 w-32 lg:hidden" />
        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="flex flex-col gap-2" key={index}>
              <Skeleton className="h-5 w-36" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            </div>
          ))}
          <Skeleton className="h-8 w-40" />
        </div>
        <Card className="gap-0 self-start shadow-none lg:col-start-2 lg:row-start-1">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-5/6" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="flex gap-3" key={index}>
                <Skeleton className="size-5 shrink-0" />
                <div className="flex w-full flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
