import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { SignupForm } from "@/components/account/signup-form"
import { getSafePublicNextPath } from "@/lib/auth/redirects"
import { hasCustomerAuthConfiguration } from "@/lib/auth/configuration"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } }

// Official signup-02 composition: standalone brand row, form and desktop cover.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="text-base font-semibold tracking-tight">OpenBids</Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs"><SignupForm next={getSafePublicNextPath(next)} configured={hasCustomerAuthConfiguration()} /></div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <Image src="/auth-signup-cover.jpg" alt="" fill sizes="50vw" className="object-cover" priority />
      </div>
    </main>
  )
}
