import type { ReactNode } from "react"

import { AppSidebar } from "@/components/admin/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  return (
    <SidebarProvider>
      <AppSidebar email={email} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
