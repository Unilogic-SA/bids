"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

export function BidPanelLoading() {
  const router = useRouter()
  const search = useSearchParams()
  return <Sheet open onOpenChange={open => {
    if (!open) {
      const params = new URLSearchParams(search.toString())
      params.delete("bid")
      router.replace(`/workspace?${params}`, { scroll: false })
    }
  }}><SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
    <SheetHeader><SheetTitle>Loading bid…</SheetTitle><SheetDescription className="sr-only">Preparing your bid details.</SheetDescription></SheetHeader>
    <div aria-busy="true" className="space-y-6 px-4 pb-6"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-20 w-full" /><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full" /></div>
  </SheetContent></Sheet>
}
