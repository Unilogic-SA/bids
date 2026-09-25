"use client"

import {
  IconChartArea,
  IconDashboard,
  IconDatabase,
  IconExternalLink,
  IconGavel,
  IconListDetails,
} from "@tabler/icons-react"
import Link from "next/link"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navigation = {
  navMain: [
    {
      title: "Operations",
      url: "/admin",
      icon: <IconDashboard />,
      isActive: true,
    },
    {
      title: "Public tenders",
      url: "/",
      icon: <IconGavel />,
    },
  ],
  navSecondary: [
    {
      title: "View site",
      url: "/",
      icon: <IconExternalLink />,
    },
  ],
  documents: [
    {
      name: "Sync activity",
      url: "#sync-activity",
      icon: <IconChartArea />,
    },
    {
      name: "Operations data",
      url: "#operations-data",
      icon: <IconListDetails />,
    },
    {
      name: "Data source",
      url: "#operations-data",
      icon: <IconDatabase />,
    },
  ],
}

export function AppSidebar({
  email,
  ...props
}: React.ComponentProps<typeof Sidebar> & { email: string }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/admin" aria-label="OpenBids Admin">
                <IconGavel />
                <span className="text-base font-semibold">OpenBids Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navigation.navMain} />
        <NavDocuments items={navigation.documents} />
        <NavSecondary items={navigation.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: "Administrator",
            email,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
