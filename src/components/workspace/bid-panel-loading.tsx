"use client"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription
} from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"

export function BidPanelLoading() {
  const mobile = useIsMobile()
  const router = useRouter()
  const search = useSearchParams()
  function change(open: boolean) {
    if (!open) {
      const params = new URLSearchParams(search.toString())
      params.delete("bid")
      router.replace(`/workspace?${params}`, { scroll: false })
    }
  }
  const body = (
    <div
      aria-busy="true"
      className="space-y-6 overflow-y-auto px-4 py-5 sm:px-6"
    >
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
  if (mobile)
    return (
      <Drawer open onOpenChange={change}>
        <DrawerContent
          className="h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DrawerHeader>
            <DrawerTitle>Loading bid…</DrawerTitle>
            <DrawerDescription>Preparing your bid details.</DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    )
  return (
    <Dialog open onOpenChange={change}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Loading bid…</DialogTitle>
          <DialogDescription>Preparing your bid details.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
