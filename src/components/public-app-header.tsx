"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { IconBookmark, IconCompass, IconMenu2, IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountMenu } from "@/components/account/account-menu"
import { useAccount } from "@/components/account/account-provider"
import { authPageHref, getSafePublicNextPath } from "@/lib/auth/redirects"
import { ActivityMenu } from "@/components/activity/activity-menu"
import { TooltipProvider } from "@/components/ui/tooltip"

// One root-layout island persists across Discover/detail navigation, without
// adding the public shell to the independently managed admin surfaces.
export function PublicAppHeader() {
  const pathname = usePathname()
  const { account } = useAccount()
  const signedIn =
    account.status === "signed-in" || (account.status === "unavailable" && Boolean(account.user))
  if (
    pathname !== "/" &&
    pathname !== "/workspace" &&
    pathname !== "/tenders" &&
    !pathname.startsWith("/guides") &&
    !["/about", "/privacy", "/terms"].includes(pathname) &&
    !pathname.startsWith("/tenders/") &&
    !pathname.startsWith("/account/") &&
    pathname !== "/forgot-password"
  )
    return null
  return (
    <AppHeader
      key={`${pathname}:${signedIn}`}
      pathname={pathname}
      signedIn={signedIn}
      loading={account.status === "loading"}
    />
  )
}

function AppHeader({
  pathname,
  signedIn,
  loading,
}: {
  pathname: string
  signedIn: boolean
  loading: boolean
}) {
  const [openMenu, setOpenMenu] = useState<"navigation" | "account" | "activity" | null>(null)
  const navigationOpen = openMenu === "navigation"

  function changeMenu(menu: NonNullable<typeof openMenu>, open: boolean) {
    setOpenMenu((current) => (open ? menu : current === menu ? null : current))
  }

  useEffect(() => {
    // A portalled mobile menu must not remain open when its trigger is hidden.
    const breakpoint = window.matchMedia("(min-width: 768px)")
    const closeMenus = () => setOpenMenu(null)
    breakpoint.addEventListener("change", closeMenus)
    return () => breakpoint.removeEventListener("change", closeMenus)
  }, [])

  const navigation = (
    <nav
      aria-label="App navigation"
      className="flex flex-col gap-1 py-2 md:h-10 md:flex-row md:items-center md:gap-3 md:py-0"
    >
      <Button
        asChild
        size="sm"
        variant="ghost"
        className="h-9 justify-start text-muted-foreground hover:text-foreground aria-[current=page]:text-primary aria-[current=page]:hover:text-primary md:h-7"
      >
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          onClick={() => setOpenMenu(null)}
        >
          <IconCompass className="md:hidden" data-icon="inline-start" />
          Discover
        </Link>
      </Button>
      <Button
        asChild
        size="sm"
        variant="ghost"
        className="h-9 justify-start text-muted-foreground hover:text-foreground aria-[current=page]:text-primary aria-[current=page]:hover:text-primary md:h-7"
      >
        <Link
          href="/workspace"
          aria-current={pathname === "/workspace" ? "page" : undefined}
          onClick={() => setOpenMenu(null)}
        >
          <IconBookmark className="md:hidden" data-icon="inline-start" />
          Workspace
        </Link>
      </Button>
    </nav>
  )

  return (
    <TooltipProvider delayDuration={300}>
      <>
        <header
          aria-label="OpenBids app header"
          className="sticky top-0 z-40 w-full shrink-0 border-b bg-background"
        >
          <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-4 px-4 md:gap-8 md:px-6">
            <Button
              asChild
              variant="link"
              className="h-8 px-0 text-base font-semibold tracking-tight hover:no-underline"
            >
              <Link href="/" aria-label="OpenBids home" onClick={() => setOpenMenu(null)}>
                OpenBids
              </Link>
            </Button>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {loading ? (
                <div
                  role="status"
                  aria-label="Loading account"
                  className="flex h-8 items-center gap-2"
                >
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="size-8 rounded-full" />
                </div>
              ) : signedIn ? (
                <>
                  <DropdownMenu
                    modal={false}
                    open={navigationOpen}
                    onOpenChange={(open) => changeMenu("navigation", open)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
                        variant="ghost"
                        size="icon"
                        className="size-11 rounded-full data-[state=open]:bg-accent md:hidden"
                      >
                        {navigationOpen ? <IconX /> : <IconMenu2 />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      aria-labelledby={undefined}
                      aria-label="App navigation"
                      align="end"
                      sideOffset={8}
                      collisionPadding={16}
                      className="w-56 max-w-[calc(100vw-2rem)] md:hidden"
                    >
                      <DropdownMenuItem
                        asChild
                        className="min-h-11 gap-3 px-3 aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-primary"
                        onSelect={() => setOpenMenu(null)}
                      >
                        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
                          <IconCompass />
                          Discover
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className="min-h-11 gap-3 px-3 aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-primary"
                        onSelect={() => setOpenMenu(null)}
                      >
                        <Link
                          href="/workspace"
                          aria-current={pathname === "/workspace" ? "page" : undefined}
                        >
                          <IconBookmark />
                          Workspace
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ActivityMenu
                    open={openMenu === "activity"}
                    onOpenChange={(open) => changeMenu("activity", open)}
                  />
                  <AccountMenu
                    open={openMenu === "account"}
                    onOpenChange={(open) => changeMenu("account", open)}
                  />
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {(
                    [
                      { path: "/sign-in", label: "Log in", variant: "outline" },
                      { path: "/sign-up", label: "Sign up", variant: "default" },
                    ] as const
                  ).map(({ path, label, variant }) => (
                    <Button key={path} asChild size="sm" variant={variant}>
                      <a
                        href={authPageHref(path, pathname)}
                        onClick={(event) => {
                          // Document navigation captures current filters/hash at the
                          // moment of entry, including same-path Discover updates.
                          event.currentTarget.href = authPageHref(
                            path,
                            getSafePublicNextPath(
                              `${window.location.pathname}${window.location.search}${window.location.hash}`
                            )
                          )
                        }}
                      >
                        {label}
                      </a>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        {signedIn ? (
          <div className="hidden shrink-0 border-b bg-background md:block">
            <div className="mx-auto w-full max-w-7xl px-4 md:px-6">{navigation}</div>
          </div>
        ) : null}
      </>
    </TooltipProvider>
  )
}
