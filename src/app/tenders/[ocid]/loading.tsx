import { Skeleton } from "@/components/ui/skeleton"

export default function TenderLoading() {
  return (
    <div aria-label="Loading tender" aria-busy="true" className="min-h-screen">
      <span className="sr-only" role="status">
        Loading tender details…
      </span>
      <div className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-4 sm:py-6 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-7 w-full max-w-4xl" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-5 w-56" />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-3">
            <Skeleton className="col-span-2 h-12 sm:col-span-1" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <Skeleton className="h-48 lg:col-start-2 lg:row-start-1" />
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-12" key={index} />
            ))}
          </div>
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
