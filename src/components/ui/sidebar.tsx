"use client"

import * as React from "react"
import { IconLayoutSidebarLeftCollapse, IconMenu2 } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type SidebarContextValue = {
  open: boolean
  isMobile: boolean
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const [open, setOpen] = React.useState(true)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setMobileOpen((value) => !value)
    else setOpen((value) => !value)
  }, [isMobile])

  return (
    <SidebarContext.Provider value={{ open, isMobile, mobileOpen, setMobileOpen, toggleSidebar }}>
      <div
        data-slot="sidebar-wrapper"
        style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}
        className={cn("group/sidebar-wrapper flex min-h-svh w-full bg-sidebar", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function Sidebar({ className, children }: React.ComponentProps<"aside">) {
  const { open, isMobile, mobileOpen, setMobileOpen } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-(--sidebar-width) gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
            <SheetDescription>OpenBids Admin navigation and account actions.</SheetDescription>
          </SheetHeader>
          <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">{children}</aside>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      data-slot="sidebar"
      data-state={open ? "expanded" : "collapsed"}
      className={cn(
        "group/sidebar sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear md:flex",
        open ? "w-(--sidebar-width)" : "w-(--sidebar-width-icon)",
        className
      )}
    >
      {children}
    </aside>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2", className)} {...props} />
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 border-t p-2", className)} {...props} />
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return <main data-slot="sidebar-inset" className={cn("relative flex min-w-0 flex-1 flex-col bg-background", className)} {...props} />
}

function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, isMobile } = useSidebar()
  return (
    <Button
      {...props}
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={(event) => {
        props.onClick?.(event)
        toggleSidebar()
      }}
      aria-label="Toggle sidebar"
    >
      {isMobile ? <IconMenu2 /> : <IconLayoutSidebarLeftCollapse />}
    </Button>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Toggle sidebar"
      onClick={toggleSidebar}
      className={cn("absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-col-resize md:block", className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
}
