import type { ReactNode } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminSession } from "@/lib/admin/auth"

export default async function AuthenticatedAdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdminSession()

  return <AdminShell email={user.email || "Admin"}>{children}</AdminShell>
}
