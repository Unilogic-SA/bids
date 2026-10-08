import type { Metadata } from "next"
import { LoginForm } from "@/components/account/login-form"
import { getSafePublicNextPath } from "@/lib/auth/redirects"
import { hasCustomerAuthConfiguration } from "@/lib/auth/configuration"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } }

// Official login-01 centred Card composition.
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return <main className="flex min-h-[calc(100svh-3.0625rem)] w-full items-center justify-center p-6 md:min-h-[calc(100svh-5.625rem)] md:p-10"><div className="w-full max-w-sm"><LoginForm next={getSafePublicNextPath(next)} configured={hasCustomerAuthConfiguration()} error={error} /></div></main>
}
