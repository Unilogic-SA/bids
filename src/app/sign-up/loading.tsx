import { AccountFormSkeleton } from "@/components/account/account-form-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
export default function Loading() {
  return <div className="grid min-h-svh lg:grid-cols-2"><AccountFormSkeleton /><Skeleton className="hidden h-full rounded-none lg:block" /></div>
}
