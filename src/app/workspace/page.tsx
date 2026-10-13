import type { Metadata } from "next"
import { Suspense } from "react"
import { WorkspaceClient } from "@/components/workspace/workspace-client"
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton"
export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
  alternates: { canonical: "/workspace" }
}
export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <WorkspaceClient />
    </Suspense>
  )
}
