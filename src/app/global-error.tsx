"use client"

import { useEffect } from "react"
import { AlertTriangleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 font-sans md:px-6">
          <section className="flex w-full flex-col items-center gap-4 rounded-xl border border-dashed p-6 text-center">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
              <AlertTriangleIcon />
            </div>
            <div className="grid max-w-sm gap-2">
              <h1 className="font-heading text-base font-medium">
                Something went wrong
              </h1>
              <p className="text-sm/relaxed text-muted-foreground">
                The app hit an unexpected error. Try again to reload the page.
              </p>
            </div>
            <Button onClick={() => unstable_retry()}>Try again</Button>
          </section>
        </main>
      </body>
    </html>
  )
}
