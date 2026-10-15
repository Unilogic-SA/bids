"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { IconLogin, IconLogout, IconRefresh, IconUser, IconUserPlus, IconSettings } from "@tabler/icons-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { signOutCustomer } from "@/lib/auth/actions"
import { initialCustomerActionState, workspaceLabel } from "@/lib/auth/account-state"
import { authPageHref, getSafePublicNextPath } from "@/lib/auth/redirects"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { useAccount } from "./account-provider"

const AccountWorkspaceDialog = dynamic(() => import("./account-workspace-dialog").then(module => module.AccountWorkspaceDialog), { ssr: false, loading: () => <span role="status" className="sr-only">Opening account settings…</span> })

export function AccountMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { account, refreshAccount } = useAccount()
  const workspace = useWorkspace()
  const trigger = useRef<HTMLButtonElement>(null)
  const [settings, setSettings] = useState<HTMLElement | null>(null)
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
        if (!await workspace.prepareToLeave()) { setError("Save your checklist before signing out."); return }
        const form = new FormData()
        form.set("next", next)
        const result = await signOutCustomer(initialCustomerActionState, form)
        if (result.status !== "success") { setError(result.message); return }
        refreshAccount({ foreground: true })
        router.refresh()
      } catch { setError("Sign out failed. Try again.") } finally { workspace.releaseSwitch() }
    })
  }

  return <><DropdownMenu modal={false} open={open} onOpenChange={open => {
    onOpenChange(open)
    if (open) setNext(getSafePublicNextPath(`${window.location.pathname}${window.location.search}${window.location.hash}`))
  }}>
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>
          <Button ref={trigger} aria-label="Account menu" variant="ghost" size="icon" className="size-11 rounded-full data-[state=open]:bg-accent md:size-8">
            {account.status === "loading" ? <Skeleton className="size-7 rounded-full" aria-label="Loading account" /> : <Avatar className="size-7"><AvatarFallback className="bg-primary/10 text-primary">{displayName ? displayName.slice(0, 2).toUpperCase() : <IconUser className="size-4" aria-hidden="true" />}</AvatarFallback></Avatar>}
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>Account</TooltipContent>
    </Tooltip>
    <DropdownMenuContent aria-labelledby={undefined} aria-label="Account" align="end" sideOffset={8} collisionPadding={16} className="w-72 max-w-[calc(100vw-2rem)]">
      <DropdownMenuLabel className="px-3 py-2.5">
        <p className="wrap-anywhere text-sm font-medium text-foreground">{displayName || "Your account"}</p>
        <p className="mt-1 wrap-anywhere text-xs font-normal text-muted-foreground">{user?.email || (account.status === "loading" ? "Loading account…" : "Sign in or create an account.")}</p>
        {account.status === "signed-in" ? <p className="mt-1 wrap-anywhere text-xs font-normal text-muted-foreground">{workspaceLabel(account.workspace.name)}</p> : null}
      </DropdownMenuLabel>
      {account.status === "unavailable" || error ? <p role="alert" className="px-3 py-2 text-xs text-destructive">{error || (account.status === "unavailable" ? account.message : "")}</p> : null}
      <DropdownMenuSeparator />
      <DropdownMenuGroup className="[&_[data-slot=dropdown-menu-item]]:min-h-11 [&_[data-slot=dropdown-menu-item]]:gap-2 [&_[data-slot=dropdown-menu-item]]:px-3 md:[&_[data-slot=dropdown-menu-item]]:min-h-8">
        {account.status === "loading" ? <DropdownMenuItem disabled>Loading account…</DropdownMenuItem> : user ? <>
          {account.status === "signed-in" ? <DropdownMenuItem onSelect={() => { onOpenChange(false); setSettings(trigger.current) }}><IconSettings />Account & workspace</DropdownMenuItem> : null}
          {account.status === "unavailable" ? <DropdownMenuItem asChild><Link prefetch={false} href={`${authPageHref("/sign-in", next)}&error=workspace`}><IconRefresh />Retry account setup</Link></DropdownMenuItem> : null}
          <DropdownMenuItem disabled={pending} onSelect={event => { event.preventDefault(); signOut() }}><IconLogout />{pending ? "Signing out…" : "Sign out on this device"}</DropdownMenuItem>
        </> : account.status === "unavailable" ? <DropdownMenuItem onSelect={event => { event.preventDefault(); refreshAccount() }}><IconRefresh />Retry</DropdownMenuItem> : <>
          <DropdownMenuItem asChild><Link prefetch={false} href={authPageHref("/sign-in", next)}><IconLogin />Sign in</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link prefetch={false} href={authPageHref("/sign-up", next)}><IconUserPlus />Create account</Link></DropdownMenuItem>
        </>}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>{settings && account.status === "signed-in" ? <AccountWorkspaceDialog onClose={() => setSettings(null)} opener={settings} /> : null}</>
}
