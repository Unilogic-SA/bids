"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  IconActivity,
  IconBookmark,
  IconCompass,
  IconMenu2,
  IconSearch,
  IconX,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { AccountMenu } from "@/components/account/account-menu"
import { useAccount } from "@/components/account/account-provider"
import { authPageHref, getSafePublicNextPath } from "@/lib/auth/redirects"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// One root-layout island persists across Discover/detail navigation, without
// adding the public shell to the independently managed admin surfaces.
export function PublicAppHeader() {
  const pathname = usePathname()
  const { account } = useAccount()
  const signedIn = account.status === "signed-in" || (account.status === "unavailable" && Boolean(account.user))
  if (pathname !== "/" && !pathname.startsWith("/tenders/") && !pathname.startsWith("/account/") && pathname !== "/forgot-password") return null
  return <AppHeader key={signedIn ? "signed-in" : "public"} pathname={pathname} signedIn={signedIn} />
}

function AppHeader({ pathname, signedIn }: { pathname: string; signedIn: boolean }) {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const desktopSearch = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!signedIn) return
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== "/" ||
        !(event.metaKey || event.ctrlKey)
      ) return
      event.preventDefault()
      if (window.matchMedia("(min-width: 768px)").matches) {
        desktopSearch.current?.focus()
      } else {
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [signedIn])

  const navigation = (
    <nav aria-label="App navigation" className="flex flex-col gap-1 py-2 md:h-10 md:flex-row md:items-center md:gap-3 md:py-0">
      <Button asChild size="sm" variant="ghost" className="h-9 justify-start text-primary hover:text-primary md:h-7">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={() => setNavigationOpen(false)}>
          <IconCompass className="md:hidden" data-icon="inline-start" />
          Discover
        </Link>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button aria-disabled="true" size="sm" variant="ghost" className="h-9 justify-start md:h-7">
            <IconBookmark className="md:hidden" data-icon="inline-start" />
            Workspace
            <span className="sr-only"> — coming soon</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Coming soon</TooltipContent>
      </Tooltip>
    </nav>
  )

  return (
    <TooltipProvider delayDuration={300}>
      <Collapsible open={navigationOpen} onOpenChange={setNavigationOpen} className="contents">
        <header aria-label="OpenBids app header" className="sticky top-0 z-40 w-full shrink-0 border-b bg-background">
          <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-4 px-4 md:gap-8 md:px-6">
            <Button asChild variant="link" className="h-8 px-0 text-base font-semibold tracking-tight hover:no-underline">
              <Link href="/" aria-label="OpenBids home" onClick={() => setNavigationOpen(false)}>OpenBids</Link>
            </Button>

            {signedIn ? <div className="hidden w-72 md:block">
              <InputGroup>
                <InputGroupAddon><IconSearch aria-hidden="true" /></InputGroupAddon>
                <InputGroupInput
                  ref={desktopSearch}
                  aria-label="App search"
                  aria-describedby="app-search-note"
                  autoComplete="off"
                  placeholder="Search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <InputGroupAddon align="inline-end"><Kbd aria-label="Control or Command plus slash">⌘ /</Kbd></InputGroupAddon>
              </InputGroup>
              <span className="sr-only" id="app-search-note">App search is coming soon. Use Discover filters to search tenders.</span>
            </div> : null}

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {signedIn ? <>
                <CollapsibleTrigger asChild>
                  <Button aria-label="Toggle navigation" variant="ghost" size="icon" className="rounded-full md:hidden">
                    {navigationOpen ? <IconX /> : <IconMenu2 />}
                  </Button>
                </CollapsibleTrigger>
                <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                  <DialogTrigger asChild>
                    <Button aria-label="Open app search" variant="ghost" size="icon" className="rounded-full md:hidden"><IconSearch /></Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Search</DialogTitle>
                      <DialogDescription>App search is coming soon. Use Discover filters to search tenders.</DialogDescription>
                    </DialogHeader>
                    <InputGroup>
                      <InputGroupAddon><IconSearch aria-hidden="true" /></InputGroupAddon>
                      <InputGroupInput aria-label="App search preview" placeholder="Search" type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
                    </InputGroup>
                  </DialogContent>
                </Dialog>
                <HeaderPanel label="Activity" icon={<IconActivity aria-hidden="true" />} description="Your recent activity will appear here." />
                <AccountMenu />
              </> : <div className="flex items-center gap-2">
                {([
                  { path: "/sign-up", label: "Sign up", variant: "default" },
                  { path: "/sign-in", label: "Log in", variant: "outline" },
                ] as const).map(({ path, label, variant }) => (
                  <Button key={path} asChild size="sm" variant={variant}>
                    <a
                      href={authPageHref(path, pathname)}
                      onClick={event => {
                        // Document navigation captures current filters/hash at the
                        // moment of entry, including same-path Discover updates.
                        event.currentTarget.href = authPageHref(path, getSafePublicNextPath(`${window.location.pathname}${window.location.search}${window.location.hash}`))
                      }}
                    >{label}</a>
                  </Button>
                ))}
              </div>}
            </div>
          </div>
          {signedIn ? <CollapsibleContent className="absolute top-full w-full border-b bg-background md:hidden">
            <div className="mx-auto w-full max-w-7xl px-4">{navigation}</div>
          </CollapsibleContent> : null}
        </header>
        {signedIn ? <div className="hidden shrink-0 border-b bg-background md:block">
          <div className="mx-auto w-full max-w-7xl px-4 md:px-6">{navigation}</div>
        </div> : null}
      </Collapsible>
    </TooltipProvider>
  )
}

function HeaderPanel({ label, icon, description }: { label: string; icon: ReactNode; description: string }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button aria-label={label} variant="ghost" size="icon" className="rounded-full">{icon}</Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent aria-label={label} align="end" className="w-72 max-w-[calc(100vw-2rem)] p-0">
        <Empty className="gap-2 p-5">
          <EmptyHeader>
            <EmptyMedia variant="icon">{icon}</EmptyMedia>
            <EmptyTitle className="text-sm">{label}</EmptyTitle>
            <EmptyDescription className="text-xs">{description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PopoverContent>
    </Popover>
  )
}
