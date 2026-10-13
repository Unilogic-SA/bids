"use client"
import { useFormStatus } from "react-dom"
import { IconSearch } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
export function ListingSubmitButton({ size }: { size?: "sm" }) {
  const { pending } = useFormStatus()
  return <Button size={size} type="submit" disabled={pending}>
    {pending ? <Spinner aria-label="Searching tenders" /> : <IconSearch data-icon="inline-start" />}
    {pending ? "Searching…" : "Apply"}
  </Button>
}
