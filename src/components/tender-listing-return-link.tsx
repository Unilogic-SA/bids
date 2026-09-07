"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { parseListingReturnHref } from "@/lib/tenders/navigation"

export function TenderListingReturnButton() {
  const searchParams = useSearchParams()
  const listingHref = parseListingReturnHref(searchParams.getAll("from"))

  return (
    <Button asChild>
      <Link href={listingHref}>Back to open tenders</Link>
    </Button>
  )
}
