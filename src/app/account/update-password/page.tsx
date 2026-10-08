import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { UpdatePasswordForm } from "@/components/account/recovery-form"
import { requireCustomerUser } from "@/lib/auth/session"
import { RECOVERY_COOKIE, readRecoveryProof } from "@/lib/auth/recovery"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Update password", robots: { index: false, follow: false } }
export default async function UpdatePasswordPage() {
  const { user, supabase } = await requireCustomerUser("/")
  const claims = await supabase.auth.getClaims()
  const proof = !claims.error && claims.data?.claims.sub === user.id ? readRecoveryProof((await cookies()).get(RECOVERY_COOKIE)?.value, user.id, claims.data.claims.session_id) : null
  if (!proof) redirect("/forgot-password?error=expired")
  return <main className="flex min-h-[calc(100svh-3.0625rem)] items-center justify-center p-6 md:min-h-[calc(100svh-5.625rem)] md:p-10"><div className="w-full max-w-sm"><UpdatePasswordForm next={proof.next} /></div></main>
}
