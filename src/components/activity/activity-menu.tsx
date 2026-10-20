"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { IconActivity, IconCheck, IconDots, IconSettings, IconX } from "@tabler/icons-react"
import { useAccount } from "@/components/account/account-provider"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { activityBidHref, activityMessage, type ActivityAction, type ActivityItem, type ActivityPage, type ActivityPreferences } from "@/lib/activity/types"

type Props = { open: boolean; onOpenChange: (open: boolean) => void }
export function ActivityMenu(props: Props) {
  const { account } = useAccount()
  if (account.status !== "signed-in") return <Button variant="ghost" size="icon" disabled aria-label="Activity unavailable"><IconActivity /></Button>
  return <ActivityInbox key={account.user.id + ":" + account.workspace.id} {...props} companyId={account.workspace.id} workspaceName={account.workspace.name || "Your workspace"} />
}

function ActivityInbox({ open, onOpenChange, companyId, workspaceName }: Props & { companyId: string; workspaceName: string }) {
  const mobile = useIsMobile()
  const router = useRouter()
  const workspace = useWorkspace()
  const { refreshAccount } = useAccount()
  const [page, setPage] = useState(1)
  const [view, setView] = useState<"inbox" | "snoozed">("inbox")
  const [settings, setSettings] = useState(false)
  const [result, setResult] = useState<{ key: string; data: ActivityPage } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const locked = useRef(false)
  const sequence = useRef(0)
  const readRequest = useRef<AbortController | null>(null)
  const writes = useRef(new Set<AbortController>())
  const trigger = useRef<HTMLButtonElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const key = view + ":" + page
  const data = result?.key === key ? result.data : null
  const error = failure?.key === key ? failure.message : null

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return
    readRequest.current?.abort()
    const controller = new AbortController()
    readRequest.current = controller
    const request = ++sequence.current
    try {
      const response = await fetch("/api/activity?company=" + companyId + "&page=" + page + "&view=" + view, {
        cache: "no-store", credentials: "same-origin", signal: controller.signal,
      })
      if (response.status === 403) refreshAccount()
      if (!response.ok) throw new Error("Activity is temporarily unavailable. Please retry.")
      const value = await response.json() as ActivityPage
      if (!alive.current || request !== sequence.current) return
      setResult({ key: view + ":" + page, data: value })
      setFailure(null)
    } catch (cause) {
      if (controller.signal.aborted || !alive.current || request !== sequence.current) return
      setFailure({ key: view + ":" + page, message: !navigator.onLine ? "You are offline. Reconnect to refresh activity." : cause instanceof Error ? cause.message : "Activity could not be loaded." })
    }
  }, [companyId, page, view, refreshAccount])

  useEffect(() => {
    alive.current = true
    const controllers = writes.current
    return () => {
      alive.current = false
      readRequest.current?.abort()
      for (const controller of controllers) controller.abort()
    }
  }, [])
  useEffect(() => {
    const refresh = () => { void load() }
    const initial = window.setTimeout(refresh, 0)
    const poll = window.setInterval(refresh, open ? 30000 : 60000)
    window.addEventListener("focus", refresh)
    window.addEventListener("online", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(poll)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("online", refresh)
      document.removeEventListener("visibilitychange", refresh)
      readRequest.current?.abort()
    }
  }, [load, open])

  async function mutate(body: object) {
    if (locked.current) return false
    locked.current = true
    setBusy(true)
    const controller = new AbortController()
    writes.current.add(controller)
    try {
      const response = await fetch("/api/activity", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, companyId }), signal: controller.signal,
      })
      if (response.status === 403) refreshAccount()
      if (!response.ok) throw new Error("Activity could not be updated. Please retry.")
      if (!alive.current) return false
      await load()
      return true
    } catch {
      if (alive.current && !controller.signal.aborted) setFailure({ key, message: "Activity could not be updated. Please retry." })
      return false
    } finally {
      writes.current.delete(controller)
      locked.current = false
      if (alive.current) setBusy(false)
    }
  }
  function update(item: ActivityItem, action: ActivityAction) {
    return mutate({ type: "item", bidId: item.bidId, keys: item.reasons.map(reason => reason.key), action })
  }
  async function review(item: ActivityItem) {
    const current = workspace.accountGuard()
    try {
      if (!await workspace.prepareToLeave()) {
        setFailure({ key, message: "Your checklist could not be saved. Retry saving it before opening another bid." })
        return
      }
      await update(item, "read")
      if (!alive.current || !current()) return
      onOpenChange(false)
      router.push(activityBidHref(item.bidId))
    } catch {
      if (alive.current) setFailure({ key, message: "This bid could not be opened. Please retry." })
    } finally { workspace.releaseSwitch() }
  }
  function preferences(patch: Partial<ActivityPreferences>) {
    if (data) void mutate({ type: "preferences", ...data.preferences, ...patch })
  }
  const count = result?.data.unread || 0
  const button = <Button ref={trigger} aria-label={count ? "Activity, " + count + " bids with unread updates" : "Activity"} variant="ghost" size="icon" className="relative size-11 rounded-full data-[state=open]:bg-accent md:size-8">
    <IconActivity aria-hidden="true" />
    {count > 0 ? <span aria-hidden="true" className="absolute top-2 right-2 size-1.5 rounded-full bg-primary md:top-1 md:right-1" /> : null}
  </Button>
  const content = <>
    <div className="flex items-center justify-between gap-2 px-4 pb-3">
      <div className="flex gap-1">
        <Button size="sm" variant={view === "inbox" ? "secondary" : "ghost"} aria-pressed={view === "inbox"} disabled={busy} onClick={() => { setView("inbox"); setPage(1) }}>For you</Button>
        <Button size="sm" variant={view === "snoozed" ? "secondary" : "ghost"} aria-pressed={view === "snoozed"} disabled={busy} onClick={() => { setView("snoozed"); setPage(1) }}>Snoozed</Button>
      </div>
      <Button size="icon-sm" variant="ghost" aria-label="Activity preferences" aria-expanded={settings} onClick={() => setSettings(value => !value)}><IconSettings /></Button>
    </div>
    {settings && data ? <fieldset className="space-y-3 border-y px-4 py-3 text-xs">
      <legend className="sr-only">Activity preferences for this workspace</legend>
      <label className="flex cursor-pointer items-center gap-2"><Checkbox checked={data.preferences.changes} disabled={busy} onCheckedChange={value => preferences({ changes: value === true })} />Material tender changes</label>
      <label className="flex cursor-pointer items-center gap-2"><Checkbox checked={data.preferences.reminders} disabled={busy} onCheckedChange={value => preferences({ reminders: value === true })} />24-hour submission reminders</label>
      <p className="text-muted-foreground">Applies to you in this workspace. In-app only.</p>
    </fieldset> : null}
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={busy || (!data && !error)}>
      {error ? <div role="alert" className="space-y-2 px-4 py-3 text-sm"><p>{error}</p><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div> : null}
      {!data && !error ? <div role="status" aria-label="Loading activity" className="space-y-5 p-4">{[1, 2, 3].map(value => <div key={value} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-1/2" /></div>)}</div> : null}
      {data?.items.length ? <ul className="divide-y">{data.items.map(item => <li key={item.bidId} className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 wrap-anywhere text-sm font-medium">
            {item.unread ? <span aria-label="Unread" className="mr-2 inline-block size-1.5 rounded-full bg-primary align-middle" /> : null}
            {item.reference || item.title}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={"Actions for " + (item.reference || item.title)} disabled={busy}><IconDots /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.unread ? <DropdownMenuItem onSelect={() => void update(item, "read")}><IconCheck />Mark as read</DropdownMenuItem> : null}
              <DropdownMenuItem onSelect={() => void update(item, view === "snoozed" ? "unsnooze" : "snooze")}>{view === "snoozed" ? "Return to inbox" : "Snooze for 1 hour"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void update(item, "dismiss")}><IconX />Dismiss this update</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {item.reference ? <p className="mt-1 wrap-anywhere text-xs text-muted-foreground">{item.title}</p> : null}
        <div className="mt-3 space-y-3">{item.reasons.map(reason => {
          const message = activityMessage(reason)
          return <div key={reason.key}>
            <p className="text-xs font-medium">{message.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{message.detail}</p>
            {view === "snoozed" && reason.snoozedUntil ? <p className="mt-1 text-xs text-muted-foreground">Returns {new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(reason.snoozedUntil))} SAST</p> : null}
          </div>
        })}</div>
        <Button size="sm" variant="outline" className="mt-3" disabled={busy || workspace.switching} onClick={() => void review(item)}>Review bid</Button>
      </li>)}</ul> : data && !error ? <Empty className="gap-2 px-5 py-8">
        <EmptyHeader><EmptyMedia variant="icon"><IconCheck /></EmptyMedia><EmptyTitle className="text-sm">{view === "snoozed" ? "No snoozed updates" : "Nothing needs your attention"}</EmptyTitle>
          <EmptyDescription className="text-xs">{view === "snoozed" ? "Updates you snooze will appear here until they return." : "Important tender changes and submission reminders will appear here."}</EmptyDescription>
        </EmptyHeader>
      </Empty> : null}
    </div>
    {data && (page > 1 || data.total > 20) ? <div className="flex shrink-0 items-center justify-between border-t px-4 py-3 text-xs">
      <Button size="sm" variant="ghost" disabled={page === 1 || busy} onClick={() => setPage(value => value - 1)}>Previous</Button>
      <span>Page {page}</span>
      <Button size="sm" variant="ghost" disabled={page * 20 >= data.total || busy} onClick={() => setPage(value => value + 1)}>Next</Button>
    </div> : null}
  </>
  if (mobile) return <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerTrigger asChild>{button}</DrawerTrigger>
    <DrawerContent className="max-h-[85dvh] data-[vaul-drawer-direction=bottom]:max-h-[85dvh] [&_button]:min-h-10" onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus() }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
      <DrawerHeader className="text-left"><DrawerTitle ref={title} tabIndex={-1}>Activity</DrawerTitle><DrawerDescription className="wrap-anywhere text-xs">{workspaceName}</DrawerDescription></DrawerHeader>
      {content}
      <Button variant="outline" className="mx-4 my-3 shrink-0" onClick={() => onOpenChange(false)}>Close</Button>
    </DrawerContent>
  </Drawer>
  return <Popover open={open} onOpenChange={onOpenChange}>
    <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>{button}</PopoverTrigger></TooltipTrigger><TooltipContent>Activity</TooltipContent></Tooltip>
    <PopoverContent align="end" sideOffset={8} collisionPadding={16} aria-label="Activity" className="flex max-h-[min(75dvh,40rem)] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0">
      <div className="px-4 pt-4 pb-3"><h2 className="font-heading text-base font-medium">Activity</h2><p className="mt-1 wrap-anywhere text-xs text-muted-foreground">{workspaceName}</p></div>
      {content}
    </PopoverContent>
  </Popover>
}
