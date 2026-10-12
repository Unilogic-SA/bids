"use client"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <Alert>
        <AlertDescription>
          Your workspace could not be opened. Please retry.
          <Button size="sm" variant="outline" className="ml-3" onClick={reset}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
