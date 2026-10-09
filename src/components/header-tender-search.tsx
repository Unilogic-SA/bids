"use client"

import { usePathname, useSearchParams } from "next/navigation"
import type { Ref } from "react"
import { TenderSearchInput } from "@/components/tender-search-input"
import { buildListingHref, parseHeaderSearchParams } from "@/lib/tenders/navigation"
import { trackUmamiEvent } from "@/lib/analytics"

export function HeaderTenderSearch({ id, inputRef, shortcut }: {
  id: string
  inputRef?: Ref<HTMLInputElement>
  shortcut?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Keep first-value semantics consistent with the server's query parser.
  const input = Object.fromEntries(Array.from(searchParams.keys()).map(key => [key, searchParams.get(key) || undefined]))
  const filters = parseHeaderSearchParams(pathname, input)

  return <form
    key={buildListingHref(filters)}
    action="/"
    method="get"
    role="search"
    aria-label="Header tender search"
    onSubmit={event => {
      const query = String(new FormData(event.currentTarget).get("q") || "").trim()
      trackUmamiEvent("tender_header_search", { query_length: query.length, query_present: Boolean(query), surface: shortcut ? "desktop" : "mobile" })
    }}
  >
    <TenderSearchInput id={id} label="App search" defaultValue={filters.q} inputRef={inputRef} shortcut={shortcut} />
    {[
      ["region", filters.region],
      ["buyer", filters.buyer],
      ["industry", filters.industry],
      ["type", filters.tenderType],
      ["sort", filters.sortExplicit ? filters.sort : undefined],
    ].map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
  </form>
}
