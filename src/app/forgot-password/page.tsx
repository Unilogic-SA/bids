import type { Metadata } from "next"
import { ForgotPasswordForm } from "@/components/account/recovery-form"
import { getSafePublicNextPath } from "@/lib/auth/redirects"
import { hasCustomerAuthConfiguration } from "@/lib/auth/configuration"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } }
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const configured = hasCustomerAuthConfiguration() && Boolean(process.env.CUSTOMER_AUTH_RECOVERY_SECRET && Buffer.byteLength(process.env.CUSTOMER_AUTH_RECOVERY_SECRET) >= 32)
  return <main className="flex min-h-[calc(100svh-3.0625rem)] items-center justify-center p-6 md:min-h-[calc(100svh-5.625rem)] md:p-10"><div className="w-full max-w-sm"><ForgotPasswordForm next={getSafePublicNextPath(next)} configured={configured} expired={error === "expired"} /></div></main>
}
