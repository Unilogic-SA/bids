import Image from "next/image"
import type { Metadata } from "next"
import { SignupForm } from "@/components/account/signup-form"
import { getSafePublicNextPath } from "@/lib/auth/redirects"
import { hasCustomerAuthConfiguration } from "@/lib/auth/configuration"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } }

// Official signup-02 composition, with the existing shared header replacing its sample brand row.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <main className="grid min-h-[calc(100svh-3.0625rem)] md:min-h-[calc(100svh-5.625rem)] lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs"><SignupForm next={getSafePublicNextPath(next)} configured={hasCustomerAuthConfiguration()} /></div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <Image src="/file.svg" alt="" fill sizes="50vw" className="object-contain p-24 opacity-30 dark:brightness-150" priority />
        <div className="absolute inset-x-0 bottom-0 p-10"><p className="text-xl font-semibold">OpenBids</p><p className="mt-2 text-muted-foreground">South African public tenders.</p></div>
      </div>
    </main>
  )
}
