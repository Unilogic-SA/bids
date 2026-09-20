"use client"

import { IconActivity, IconExternalLink, IconLogout, IconShieldLock } from "@tabler/icons-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { signOutAdmin } from "@/lib/admin/actions"
import { cn } from "@/lib/utils"

export function AppSidebar({ email }: { email: string }) {
  const { open, isMobile } = useSidebar()
  const showLabels = open || isMobile

  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center border-b">
        <Link href="/admin" className="flex items-center gap-2 overflow-hidden rounded-md px-2 py-1.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <IconShieldLock className="size-4" />
          </span>
          {showLabels ? (
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-heading font-medium">OpenBids</span>
              <span className="block truncate text-xs text-muted-foreground">Admin</span>
            </span>
          ) : null}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <p className={cn("px-2 pt-2 text-xs font-medium text-muted-foreground", !showLabels && "sr-only")}>Navigation</p>
        <Link
          href="/admin"
          aria-current="page"
          title="Operations"
          className="flex h-9 items-center gap-2 overflow-hidden rounded-md bg-sidebar-accent px-2 text-sm font-medium text-sidebar-accent-foreground"
        >
          <IconActivity className="size-4 shrink-0" />
          {showLabels ? <span>Operations</span> : <span className="sr-only">Operations</span>}
        </Link>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 overflow-hidden px-2 py-1">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {email.slice(0, 1).toUpperCase()}
          </span>
          {showLabels ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">Administrator</span>
              <span className="block truncate text-xs text-muted-foreground">{email}</span>
            </span>
          ) : null}
        </div>
        <Button asChild variant="ghost" size={showLabels ? "sm" : "icon-sm"} className={cn(showLabels && "justify-start")}>
          <Link href="/" title="View site">
            <IconExternalLink />
            {showLabels ? "View site" : <span className="sr-only">View site</span>}
          </Link>
        </Button>
        <form action={signOutAdmin}>
          <Button type="submit" variant="ghost" size={showLabels ? "sm" : "icon-sm"} className={cn("w-full", showLabels && "justify-start")} title="Sign out">
            <IconLogout />
            {showLabels ? "Sign out" : <span className="sr-only">Sign out</span>}
          </Button>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
