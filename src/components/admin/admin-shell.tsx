import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 68)",
            "--header-height": "calc(var(--spacing) * 10)",
          } as CSSProperties
        }
      >
        <AppSidebar email={email} variant="inset" />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  )
}
