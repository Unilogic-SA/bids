"use client"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  IconLayoutKanban,
  IconList,
  IconSearch,
  IconBookmark,
  IconRefresh
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia
} from "@/components/ui/empty"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/sonner"
import { useAccount } from "@/components/account/account-provider"
import { useWorkspace } from "./workspace-provider"
import { GuestImportPrompt } from "./guest-import-prompt"
import { WorkspaceList } from "./workspace-list"
import { BidPanelLoading } from "./bid-panel-loading"
import {
  WorkspaceSkeleton,
  WorkspaceRowsSkeleton,
  WorkspaceBoardSkeleton
} from "./workspace-skeleton"

import {
  BID_STAGES,
  OUTCOME_LABELS,
  type BidStage,
  type BidOutcome,
  type BidPatch,
  type MutationResult,
  type WorkspaceEntry,
  type WorkspacePage
} from "@/lib/workspace/types"
import { cn } from "@/lib/utils"
import { BidStateLabel, bidStateTriggerClass } from "./stage-presentation"
import {
  clearWorkspaceFilters,
  workspacePagination,
  workspaceListQuery
} from "@/lib/workspace/client-state"
import { parseWorkspaceFilters } from "@/lib/workspace/validation"
import { boardRounds, mergeBoardPages } from "@/lib/workspace/board"
import {
  fromSastInput,
  sastInput,
  workspaceMutationMessage
} from "@/lib/workspace/presentation"
const WorkspaceBoard = dynamic(
  () => import("./workspace-board").then((module) => module.WorkspaceBoard),
  { loading: () => <WorkspaceBoardSkeleton /> }
)
const BidPanel = dynamic(
  () => import("./bid-panel").then((module) => module.BidPanel),
  { loading: () => <BidPanelLoading /> }
)
type Confirmation = {
  bid: WorkspaceEntry
  kind: "submit" | "backward" | "outcome" | "delete"
  stage?: BidStage
  outcome?: BidOutcome | null
}
const emptyPage: WorkspacePage = {
  items: [],
  total: 0,
  counts: { saved: 0, reviewing: 0, preparing: 0, ready: 0, submitted: 0 }
}
export function WorkspaceClient() {
  const mobile = useIsMobile()
  const { account, refreshAccount } = useAccount()
  const workspace = useWorkspace()
  const search = useSearchParams()
  const router = useRouter()
  const query = search.toString()
  const listQuery = workspaceListQuery(query)
  const filters = useMemo(
    () => parseWorkspaceFilters(new URLSearchParams(listQuery)),
    [listQuery]
  )
  const [page, setPage] = useState<WorkspacePage>(emptyPage)
  const [loading, setLoading] = useState(true)
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<WorkspaceEntry | null>(null)
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState(false)
  const [pending, setPending] = useState(new Set<string>())
  const [optimistic, setOptimistic] = useState<Record<string, BidStage>>({})
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [submitted, setSubmitted] = useState(() => sastInput())
  const [reference, setReference] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const [searchDraft, setSearchDraft] = useState({
    query: filters.q,
    value: filters.q
  })
  const draftSearch =
    searchDraft.query === filters.q ? searchDraft.value : filters.q
  const patchLocks = useRef(new Set<string>())
  const confirmationLock = useRef(false)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const selectedRequest = useRef(0)
  const selectedRef = useRef<WorkspaceEntry | null>(null)
  const viewApplied = useRef(false)
  const { identity, revision, accountGuard } = workspace
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(clock)
  }, [])
  useEffect(() => {
    if (!identity) return
    if (!viewApplied.current) {
      viewApplied.current = true
      try {
        const preferred = localStorage.getItem(
          `openbids:workspace-view:${identity}`
        )
        if (
          !new URLSearchParams(listQuery).has("view") &&
          preferred === "board"
        ) {
          const params = new URLSearchParams(window.location.search)
          params.set("view", "board")
          router.replace(`/workspace?${params}`, { scroll: false })
          return
        }
      } catch {}
    }
    const controller = new AbortController()
    const current = accountGuard()
    const load = async () => {
      setLoading(true)
      setError(false)
      try {
        const params = new URLSearchParams(listQuery)
        params.delete("bid")
        const isBoard = filters.view === "board" && filters.state === "active"
        if (isBoard)
          for (const stage of BID_STAGES) params.delete(`offset_${stage}`)
        const fetchPage = async () => {
          const response = await fetch(`/api/workspace?${params}`, {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal
          })
          if (!response.ok) throw new Error("Workspace unavailable")
          return (await response.json()) as WorkspacePage
        }
        const pages = [await fetchPage()]
        if (isBoard) {
          const rounds = boardRounds(filters.offsets, pages[0].counts)
          for (let round = 1; round <= rounds; round++) {
            if (!current() || controller.signal.aborted) return
            for (const stage of BID_STAGES)
              params.set(
                `offset_${stage}`,
                String(Math.min(round * 30, filters.offsets[stage] || 0))
              )
            pages.push(await fetchPage())
          }
        }
        const data = isBoard ? mergeBoardPages(pages) : pages[0]
        const lastPage = Math.max(1, Math.ceil(data.total / 50))
        if (
          !isBoard &&
          filters.page > lastPage &&
          current() &&
          !controller.signal.aborted
        ) {
          const corrected = new URLSearchParams(window.location.search)
          corrected.set("page", String(lastPage))
          router.replace(`/workspace?${corrected}`, { scroll: false })
          return
        }
        if (!controller.signal.aborted && current()) {
          setPage(data)
          setLoadedQuery(listQuery)
          setLoading(false)
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        if (current()) {
          setError(true)
          setLoading(false)
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [listQuery, identity, revision, refresh, accountGuard, router, filters])
  const selectedId = search.get("bid")
  if (dismissedId && selectedId !== dismissedId) setDismissedId(null)
  useEffect(() => {
    if (!identity || !selectedId || dismissedId === selectedId) return
    const request = ++selectedRequest.current
    const controller = new AbortController()
    const current = accountGuard()
    const load = async () => {
      setSelectionError(false)
      try {
        const response = await fetch(
          `/api/workspace?bid=${encodeURIComponent(selectedId)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal
          }
        )
        if (!response.ok) throw new Error("Bid unavailable")
        const bid = (await response.json()) as WorkspaceEntry
        if (
          current() &&
          !controller.signal.aborted &&
          request === selectedRequest.current
        ) {
          selectedRef.current = bid
          setSelected(bid)
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        if (current() && request === selectedRequest.current)
          setSelectionError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [selectedId, dismissedId, identity, revision, refresh, accountGuard])
  function changeFilter(name: string, value: string) {
    const params = new URLSearchParams(query)
    if (value) params.set(name, value)
    else params.delete(name)
    params.delete("page")
    for (const stage of BID_STAGES) params.delete(`offset_${stage}`)
    router.replace(`/workspace?${params}`, { scroll: false })
  }
  function openBid(bid: WorkspaceEntry) {
    selectedRequest.current++
    setDismissedId(null)
    setOpener(document.activeElement as HTMLElement | null)
    selectedRef.current = bid
    setSelected(bid)
    const params = new URLSearchParams(query)
    params.set("bid", bid.id)
    router.replace(`/workspace?${params}`, { scroll: false })
  }
  function closeBid() {
    selectedRequest.current++
    setDismissedId(selectedId)
    selectedRef.current = null
    setSelected(null)
    const params = new URLSearchParams(query)
    params.delete("bid")
    router.replace(`/workspace?${params}`, { scroll: false })
  }
  async function patch(
    bid: WorkspaceEntry,
    changes: BidPatch,
    version = bid.version
  ): Promise<MutationResult> {
    if (patchLocks.current.has(bid.id))
      return {
        ok: false,
        code: "unavailable",
        message: "This bid is already being updated."
      }
    patchLocks.current.add(bid.id)
    const current = accountGuard()
    setPending((previous) => new Set(previous).add(bid.id))
    if (changes.stage && changes.stage !== "submitted")
      setOptimistic((previous) => ({ ...previous, [bid.id]: changes.stage! }))
    let result: MutationResult
    try {
      result = await workspace.update(bid.id, version, changes)
    } catch {
      result = {
        ok: false,
        code: "unavailable",
        message: "Your change could not be saved. Please retry."
      }
    } finally {
      patchLocks.current.delete(bid.id)
    }
    if (current()) {
      setPending((previous) => {
        const next = new Set(previous)
        next.delete(bid.id)
        return next
      })
      setOptimistic((previous) => {
        const next = { ...previous }
        delete next[bid.id]
        return next
      })
      const updated = result.ok ? result.bid : result.bid
      if (updated) {
        const entry = { ...bid, ...updated }
        setPage((previous) => ({
          ...previous,
          items: previous.items.map((item) =>
            item.id === bid.id ? entry : item
          )
        }))
        if (selectedRef.current?.id === bid.id) {
          selectedRef.current = entry
          setSelected(entry)
        }
      }
      if (!result.ok) {
        toast.error(result.message)
        setRefresh((previous) => previous + 1)
      } else {
        toast.success(workspaceMutationMessage(changes))
      }
    }
    return result
  }
  function stage(bid: WorkspaceEntry, next: BidStage) {
    if (next === "submitted") {
      setSubmitted(sastInput())
      setReference("")
      setConfirmation({ bid, kind: "submit" })
      return
    }
    if (bid.stage === "submitted") {
      setConfirmation({ bid, kind: "backward", stage: next })
      return
    }
    void patch(bid, { stage: next })
  }
  function outcome(bid: WorkspaceEntry, value: BidOutcome | null) {
    setConfirmation({ bid, kind: "outcome", outcome: value })
  }
  async function confirm() {
    if (!confirmation || confirmationLock.current) return
    confirmationLock.current = true
    try {
      const { bid, kind } = confirmation
      const current = accountGuard()
      if (kind === "delete") {
        setPending((previous) => new Set(previous).add(bid.id))
        const result = await workspace.remove(bid.id, bid.version)
        if (!current()) return
        setPending((previous) => {
          const next = new Set(previous)
          next.delete(bid.id)
          return next
        })
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        setConfirmation(null)
        closeBid()
        toast.success("Bid permanently deleted")
        return
      }
      const changes: BidPatch =
        kind === "submit"
          ? {
              stage: "submitted",
              submitted_at: fromSastInput(submitted),
              submission_reference: reference || null
            }
          : kind === "backward"
            ? { stage: confirmation.stage }
            : { outcome: confirmation.outcome ?? null }
      const result = await patch(bid, changes)
      if (result.ok && current()) setConfirmation(null)
    } finally {
      confirmationLock.current = false
    }
  }
  function more(stage: BidStage) {
    const params = new URLSearchParams(query)
    params.set(`offset_${stage}`, String((filters.offsets[stage] || 0) + 30))
    router.replace(`/workspace?${params}`, { scroll: false })
  }
  function clearFilters() {
    setSearchDraft({ query: "", value: "" })
    router.replace(`/workspace?${clearWorkspaceFilters(query)}`, {
      scroll: false
    })
  }
  const pagination = workspacePagination(
    page.total,
    filters.page,
    page.items.length
  )
  const confirmationPending = Boolean(
    confirmation && pending.has(confirmation.bid.id)
  )
  const items = page.items.map((bid) =>
    optimistic[bid.id] ? { ...bid, stage: optimistic[bid.id] } : bid
  )
  if (account.status === "loading") return <WorkspaceSkeleton />
  if (account.status === "unavailable")
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <Alert>
          <AlertDescription>
            {account.message}
            <Button
              className="ml-3"
              size="sm"
              variant="outline"
              onClick={refreshAccount}
            >
              Retry account
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    )
  if (account.status === "signed-out")
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconBookmark />
            </EmptyMedia>
            <EmptyTitle>Your bid workspace</EmptyTitle>
            <EmptyDescription>
              Save opportunities, prepare responses and track your bids from
              review to outcome. Sign in to keep your work connected across
              devices.
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link href="/sign-in?next=%2Fworkspace">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Discover tenders</Link>
          </Button>
        </Empty>
      </main>
    )
  return (
    <TooltipProvider delayDuration={250}>
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 px-4 py-6 md:px-6 [&_button:not([data-workspace-control]):not([data-workspace-open]):not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
        <Toaster position="top-center" duration={2000} visibleToasts={1} />
        <GuestImportPrompt />
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            changeFilter("q", draftSearch)
          }}
        >
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <IconSearch className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
            <Input
              value={draftSearch}
              onChange={(event) =>
                setSearchDraft({ query: filters.q, value: event.target.value })
              }
              aria-label="Search your workspace"
              placeholder="Search your workspace"
              className="h-8 pl-8"
              maxLength={200}
            />
          </div>
          <Button size="sm" variant="outline" className="h-8" type="submit">
            Search
          </Button>
          <Select
            value={filters.state}
            onValueChange={(value) =>
              changeFilter("state", value === "active" ? "" : value)
            }
          >
            <SelectTrigger
              className="h-8 w-36"
              aria-label="Filter workspace records"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active bids</SelectItem>
              <SelectItem value="completed">Completed bids</SelectItem>
              <SelectItem value="archived">Archived bids</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.stage}
            onValueChange={(value) =>
              changeFilter("stage", value === "all" ? "" : value)
            }
          >
            <SelectTrigger
              className={cn(
                "h-8 w-40 cursor-pointer",
                filters.stage !== "all" && bidStateTriggerClass(filters.stage)
              )}
              aria-label="Filter by bid stage"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="cursor-pointer" value="all">
                All stages
              </SelectItem>
              {BID_STAGES.map((value) => (
                <SelectItem
                  className="cursor-pointer"
                  key={value}
                  value={value}
                >
                  <BidStateLabel state={value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox
              id="workspace-week"
              checked={filters.week}
              onCheckedChange={(checked) =>
                changeFilter("week", checked ? "1" : "")
              }
            />
            <Label htmlFor="workspace-week" className="text-xs">
              Closing this week
            </Label>
          </div>
          {filters.q || filters.stage !== "all" || filters.week ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <span
              role="status"
              className="flex min-w-20 items-center gap-1 text-xs text-muted-foreground"
            >
              {loading && loadedQuery === listQuery ? (
                <>
                  <Spinner className="size-3" />
                  Updating…
                </>
              ) : null}
            </span>
            <div className="flex gap-1">
              <Tooltip open={mobile ? false : undefined}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Refresh workspace"
                    disabled={loading}
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    <IconRefresh
                      className={loading ? "animate-spin" : undefined}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6} className="pointer-events-none">
                  Refresh workspace
                </TooltipContent>
              </Tooltip>
              {filters.state === "active" ? (
                <>
                  <Tooltip open={mobile ? false : undefined}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant={
                          filters.view === "list" ? "secondary" : "ghost"
                        }
                        aria-label="List view"
                        aria-pressed={filters.view === "list"}
                        onClick={() => {
                          try {
                            localStorage.setItem(
                              `openbids:workspace-view:${identity}`,
                              "list"
                            )
                          } catch {}
                          changeFilter("view", "list")
                        }}
                      >
                        <IconList />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      sideOffset={6}
                      className="pointer-events-none"
                    >
                      List view
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip open={mobile ? false : undefined}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant={
                          filters.view === "board" ? "secondary" : "ghost"
                        }
                        aria-label="Board view"
                        aria-pressed={filters.view === "board"}
                        onClick={() => {
                          try {
                            localStorage.setItem(
                              `openbids:workspace-view:${identity}`,
                              "board"
                            )
                          } catch {}
                          changeFilter("view", "board")
                        }}
                      >
                        <IconLayoutKanban />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      sideOffset={6}
                      className="pointer-events-none"
                    >
                      Board view
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : null}
            </div>
            <Button asChild size="sm">
              <Link href="/">Browse Tenders</Link>
            </Button>
          </div>
        </form>
        {error ? (
          <Alert>
            <AlertDescription>
              Your workspace could not be loaded. Your saved work is kept.
              <Button
                size="sm"
                variant="outline"
                className="ml-2"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {!error && loadedQuery !== listQuery ? (
          filters.view === "board" && filters.state === "active" ? (
            <WorkspaceBoardSkeleton />
          ) : (
            <WorkspaceRowsSkeleton />
          )
        ) : error && loadedQuery !== listQuery ? null : !error &&
          !items.length ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconBookmark />
              </EmptyMedia>
              <EmptyTitle>
                {filters.q || filters.stage !== "all" || filters.week
                  ? "No matching bids"
                  : filters.state === "active"
                    ? "Save a tender to get started"
                    : filters.state === "completed"
                      ? "No completed bids yet"
                      : "No archived bids"}
              </EmptyTitle>
              <EmptyDescription>
                {filters.q || filters.stage !== "all" || filters.week
                  ? "Adjust your search or clear the filters."
                  : filters.state === "active"
                    ? "Find an opportunity, save it and prepare your response here."
                    : "Your records will stay available here after leaving the active pipeline."}
              </EmptyDescription>
            </EmptyHeader>
            {filters.q || filters.stage !== "all" || filters.week ? (
              <Button size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : filters.state === "active" ? (
              <Button asChild size="sm">
                <Link href="/">Discover tenders</Link>
              </Button>
            ) : null}
          </Empty>
        ) : filters.view === "board" && filters.state === "active" ? (
          <WorkspaceBoard
            key={identity}
            stageFilter={filters.stage}
            items={items}
            counts={page.counts}
            pending={pending}
            now={now}
            onOpen={openBid}
            onStage={stage}
            onOutcome={outcome}
            onMore={more}
          />
        ) : (
          <WorkspaceList
            key={`${identity}:${listQuery}`}
            selectionDisabled={loading || error}
            onBulkComplete={() => setRefresh((value) => value + 1)}
            items={items}
            pending={pending}
            now={now}
            onOpen={openBid}
            onStage={stage}
            onOutcome={outcome}
          />
        )}
        {(filters.view !== "board" || filters.state !== "active") &&
        loadedQuery === listQuery &&
        !error ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {pagination.start}–{pagination.end} of {page.total} bid
              {page.total === 1 ? "" : "s"}
              {loading ? " · Updating…" : ""}
            </span>
            {page.total > 50 ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filters.page === 1 || loading}
                  onClick={() => {
                    const params = new URLSearchParams(query)
                    params.set("page", String(filters.page - 1))
                    router.replace(`/workspace?${params}`, { scroll: false })
                  }}
                >
                  Previous
                </Button>
                <span>
                  Page {filters.page} of {pagination.pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filters.page * 50 >= page.total || loading}
                  onClick={() => {
                    const params = new URLSearchParams(query)
                    params.set("page", String(filters.page + 1))
                    router.replace(`/workspace?${params}`, { scroll: false })
                  }}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {selectedId &&
        dismissedId !== selectedId &&
        selected?.id === selectedId ? (
          <BidPanel
            key={selected.id}
            bid={selected}
            opener={opener}
            pending={pending.has(selected.id)}
            now={now}
            onClose={closeBid}
            onPatch={patch}
            onStage={stage}
            onOutcome={outcome}
            onDelete={(bid) => setConfirmation({ bid, kind: "delete" })}
          />
        ) : selectedId && dismissedId !== selectedId && selectionError ? (
          <Alert>
            <AlertDescription>
              This bid could not be opened.
              <Button
                size="sm"
                variant="outline"
                className="ml-2"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={closeBid}>
                Close
              </Button>
            </AlertDescription>
          </Alert>
        ) : selectedId && dismissedId !== selectedId ? (
          <BidPanelLoading />
        ) : null}
        <Dialog
          open={Boolean(confirmation)}
          onOpenChange={(open) => {
            if (!open && !confirmationPending) setConfirmation(null)
          }}
        >
          <DialogContent
            showCloseButton={!confirmationPending}
            onEscapeKeyDown={(event) => {
              if (confirmationPending) event.preventDefault()
            }}
            onInteractOutside={(event) => {
              if (confirmationPending) event.preventDefault()
            }}
            className="[&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed"
          >
            <DialogHeader>
              <DialogTitle>
                {confirmation?.kind === "submit"
                  ? "Already submitted this bid?"
                  : confirmation?.kind === "backward"
                    ? "Move this bid back?"
                    : confirmation?.kind === "delete"
                      ? "Permanently delete this bid?"
                      : confirmation?.outcome
                        ? `Record ${OUTCOME_LABELS[confirmation.outcome].toLowerCase()}?`
                        : "Reopen this bid?"}
              </DialogTitle>
              <DialogDescription>
                {confirmation?.kind === "submit"
                  ? "Record the submission you made outside OpenBids. OpenBids does not submit your tender."
                  : confirmation?.kind === "backward"
                    ? "The current submission date and reference will be cleared. Your preparation stays available."
                    : confirmation?.kind === "delete"
                      ? "This permanently deletes the saved bid and all its preparation data. This cannot be undone."
                      : "Your tender details and preparation will be kept."}
              </DialogDescription>
            </DialogHeader>
            {confirmation?.kind === "submit" ? (
              <div className="space-y-3">
                <Label htmlFor="submitted-at">
                  Actual submission time (SAST)
                </Label>
                <Input
                  id="submitted-at"
                  type="datetime-local"
                  value={submitted}
                  onChange={(event) => setSubmitted(event.target.value)}
                />
                <Label htmlFor="submission-reference">
                  Reference or link (optional)
                </Label>
                <Input
                  id="submission-reference"
                  maxLength={500}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
                {confirmation.bid.checklist.some((item) => !item.completed) ? (
                  <p className="text-xs text-muted-foreground">
                    Some checklist items are incomplete. You can still record a
                    submission if preparation happened elsewhere.
                  </p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={confirmationPending}
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </Button>
              <Button
                variant={
                  confirmation?.kind === "delete" ? "destructive" : "default"
                }
                disabled={
                  Boolean(confirmation && pending.has(confirmation.bid.id)) ||
                  (confirmation?.kind === "submit" && !submitted)
                }
                onClick={() => void confirm()}
              >
                {confirmation?.kind === "submit"
                  ? "Mark submitted"
                  : confirmation?.kind === "delete"
                    ? "Delete permanently"
                    : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </TooltipProvider>
  )
}
