"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { IconLogin, IconLogout, IconRefresh, IconUser, IconUserPlus } from "@tabler/icons-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { signOutCustomer } from "@/lib/auth/actions"
import { initialCustomerActionState, workspaceLabel } from "@/lib/auth/account-state"
import { authPageHref, getSafePublicNextPath } from "@/lib/auth/redirects"
import { useAccount } from "./account-provider"

export function AccountMenu() {
  const { account, refreshAccount } = useAccount()
  const router = useRouter()
  const [next, setNext] = useState("/")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const user = account.status === "signed-in" || account.status === "unavailable" ? account.user : undefined
  const displayName = account.status === "signed-in" ? account.profile.displayName : null

  function signOut() {
    setError("")
    startTransition(async () => {
      try {
        const form = new FormData()
        form.set("next", next)
        const result = await signOutCustomer(initialCustomerActionState, form)
        if (result.status !== "success") { setError(result.message); return }
        refreshAccount()
        router.refresh()
      } catch { setError("Sign out failed. Try again.") }
    })
  }

  return <DropdownMenu onOpenChange={open => {
    if (open) setNext(getSafePublicNextPath(`${window.location.pathname}${window.location.search}${window.location.hash}`))
  }}>
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Account menu" variant="ghost" size="icon" className="rounded-full">
            {account.status === "loading" ? <Skeleton className="size-7 rounded-full" aria-label="Loading account" /> : <Avatar className="size-7"><AvatarFallback className="bg-primary/10 text-primary">{displayName ? displayName.slice(0, 2).toUpperCase() : <IconUser className="size-4" aria-hidden="true" />}</AvatarFallback></Avatar>}
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>Account</TooltipContent>
    </Tooltip>
    <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
      <DropdownMenuLabel className="rounded-md bg-muted p-3">
        <p className="break-words text-sm font-medium">{displayName || "Your account"}</p>
        <p className="mt-1 break-words text-xs font-normal text-muted-foreground">{user?.email || (account.status === "loading" ? "Loading account…" : "Sign in or create an account.")}</p>
        {account.status === "signed-in" ? <p className="mt-1 break-words text-xs font-normal text-muted-foreground">{workspaceLabel(account.workspace.name)}</p> : null}
      </DropdownMenuLabel>
      {account.status === "unavailable" || error ? <p role="alert" className="px-3 py-2 text-xs text-destructive">{error || (account.status === "unavailable" ? account.message : "")}</p> : null}
      <DropdownMenuGroup>
        {account.status === "loading" ? <DropdownMenuItem disabled>Loading account…</DropdownMenuItem> : user ? <>
          {account.status === "unavailable" ? <DropdownMenuItem asChild><Link prefetch={false} href={`${authPageHref("/sign-in", next)}&error=workspace`}><IconRefresh />Retry account setup</Link></DropdownMenuItem> : null}
          <DropdownMenuItem disabled={pending} onSelect={event => { event.preventDefault(); signOut() }}><IconLogout />{pending ? "Signing out…" : "Sign out on this device"}</DropdownMenuItem>
        </> : account.status === "unavailable" ? <DropdownMenuItem onSelect={event => { event.preventDefault(); refreshAccount() }}><IconRefresh />Retry</DropdownMenuItem> : <>
          <DropdownMenuItem asChild><Link prefetch={false} href={authPageHref("/sign-in", next)}><IconLogin />Sign in</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link prefetch={false} href={authPageHref("/sign-up", next)}><IconUserPlus />Create account</Link></DropdownMenuItem>
        </>}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}
