import { IconAlertCircle, IconShieldLock } from "@tabler/icons-react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { AdminLoginForm } from "@/components/admin-login-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getAdminSession, getSafeNextPath } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin Login",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

type AdminLoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = await searchParams
  const next = getSafeNextPath(getFirstParam(params.next))
  const session = await getAdminSession()

  if (session) {
    redirect(next)
  }

  const error = getFirstParam(params.error)

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconShieldLock />
              <CardTitle>Admin access</CardTitle>
            </div>
            <CardDescription>
              Sign in with an authorized email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error ? <LoginErrorAlert error={error} /> : null}
            <AdminLoginForm defaultEmail="" next={next} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function LoginErrorAlert({ error }: { error: string }) {
  const message =
    error === "not-authorized"
      ? "This session is not authorized for admin access."
      : "The sign-in link could not be verified."

  return (
    <Alert variant="destructive">
      <IconAlertCircle />
      <AlertTitle>Sign-in failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
