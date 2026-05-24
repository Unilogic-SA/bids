"use client"

import Link from "next/link"
import { IconChevronDown } from "@tabler/icons-react"
import { RotateCcwIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DEFAULT_LISTING_SORT,
  INDUSTRY_FILTERS,
  REGION_OPTIONS,
  SORT_OPTIONS,
  TENDER_TYPE_FILTERS,
} from "@/lib/tenders/filters"
import type { ListingSearchParams } from "@/lib/tenders/types"
import { trackUmamiEvent } from "@/lib/analytics"

type ListingFilterIslandProps = {
  filters: ListingSearchParams
}

export function ListingFilterIsland({ filters }: ListingFilterIslandProps) {
  return (
    <Card className="lg:sticky lg:top-6" size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontalIcon data-icon="inline-start" />
          Filters
        </CardTitle>
        <CardDescription>Open tenders only.</CardDescription>
      </CardHeader>
      <form
        action="/"
        method="get"
        onSubmit={(event) => trackFilterApply("desktop", event.currentTarget)}
      >
        <CardContent>
          <SearchFilterFields filters={filters} idPrefix="desktop" includeSort />
        </CardContent>

        <CardFooter className="mt-4 justify-between gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              href="/"
              onClick={() =>
                trackUmamiEvent("tender_filter_reset", { surface: "desktop" })
              }
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Link>
          </Button>
          <Button size="sm" type="submit">
            <SearchIcon data-icon="inline-start" />
            Apply
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export function MobileListingControls({ filters }: ListingFilterIslandProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] overflow-hidden rounded-md border bg-card">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            className="h-14 justify-center rounded-none text-base font-normal text-muted-foreground"
            onClick={() =>
              trackUmamiEvent("tender_filter_panel_open", { panel: "search" })
            }
            variant="ghost"
          >
            Search
            <IconChevronDown data-icon="inline-end" />
          </Button>
        </SheetTrigger>
        <SheetContent className="max-h-[85svh] overflow-y-auto p-0" side="bottom">
          <SheetHeader>
            <SheetTitle>Search</SheetTitle>
          </SheetHeader>
          <form
            action="/"
            method="get"
            onSubmit={(event) =>
              trackFilterApply("mobile_search", event.currentTarget)
            }
          >
            <HiddenInput
              name="sort"
              value={
                filters.sort !== DEFAULT_LISTING_SORT ? filters.sort : undefined
              }
            />
            <div className="px-4">
              <SearchFilterFields filters={filters} idPrefix="mobile-filter" />
            </div>
            <SheetFooter>
              <Button asChild variant="outline">
                <Link
                  href="/"
                  onClick={() =>
                    trackUmamiEvent("tender_filter_reset", {
                      surface: "mobile_search",
                    })
                  }
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Reset
                </Link>
              </Button>
              <Button type="submit">
                <SearchIcon data-icon="inline-start" />
                Apply
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Separator orientation="vertical" />

      <Sheet>
        <SheetTrigger asChild>
          <Button
            className="h-14 justify-center rounded-none text-base font-normal text-muted-foreground"
            onClick={() =>
              trackUmamiEvent("tender_filter_panel_open", { panel: "sort" })
            }
            variant="ghost"
          >
            Sort By
            <IconChevronDown data-icon="inline-end" />
          </Button>
        </SheetTrigger>
        <SheetContent className="p-0" side="bottom">
          <SheetHeader>
            <SheetTitle>Sort By</SheetTitle>
          </SheetHeader>
          <form
            action="/"
            method="get"
            onSubmit={(event) =>
              trackFilterApply("mobile_sort", event.currentTarget)
            }
          >
            <PreservedFilterInputs filters={filters} />
            <div className="px-4">
              <FieldSet>
                <FieldLegend className="sr-only">Sort tenders</FieldLegend>
                <FieldGroup>
                  <SortField filters={filters} id="mobile-sort-sort" />
                </FieldGroup>
              </FieldSet>
            </div>
            <SheetFooter>
              <Button asChild variant="outline">
                <Link
                  href={buildFilterHref(filters, { sort: DEFAULT_LISTING_SORT })}
                  onClick={() =>
                    trackUmamiEvent("tender_filter_reset", {
                      surface: "mobile_sort",
                    })
                  }
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Reset
                </Link>
              </Button>
              <Button type="submit">Apply</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SearchFilterFields({
  filters,
  includeSort,
  idPrefix,
}: ListingFilterIslandProps & {
  includeSort?: boolean
  idPrefix: string
}) {
  return (
    <FieldSet>
      <FieldLegend className="sr-only">Tender filters</FieldLegend>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-q`}>Search</FieldLabel>
          <InputGroup>
            <InputGroupInput
              defaultValue={filters.q || ""}
              id={`${idPrefix}-q`}
              name="q"
              placeholder="Number, buyer, keyword"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Search tenders"
                size="icon-xs"
                type="submit"
              >
                <SearchIcon data-icon="inline-start" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-region`}>Region</FieldLabel>
          <NativeSelect
            className="w-full"
            defaultValue={filters.region || ""}
            id={`${idPrefix}-region`}
            name="region"
            size="sm"
          >
            <NativeSelectOption value="">All regions</NativeSelectOption>
            {REGION_OPTIONS.map((region) => (
              <NativeSelectOption key={region.value} value={region.value}>
                {region.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-buyer`}>Buyer</FieldLabel>
          <InputGroup>
            <InputGroupInput
              defaultValue={filters.buyer || ""}
              id={`${idPrefix}-buyer`}
              name="buyer"
              placeholder="Buyer contains…"
            />
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-industry`}>Industry</FieldLabel>
          <NativeSelect
            className="w-full"
            defaultValue={filters.industry || ""}
            id={`${idPrefix}-industry`}
            name="industry"
            size="sm"
          >
            <NativeSelectOption value="">All industries</NativeSelectOption>
            {INDUSTRY_FILTERS.map((industry) => (
              <NativeSelectOption key={industry.value} value={industry.value}>
                {industry.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-tender-type`}>Tender type</FieldLabel>
          <NativeSelect
            className="w-full"
            defaultValue={filters.tenderType || ""}
            id={`${idPrefix}-tender-type`}
            name="tender_type"
            size="sm"
          >
            <NativeSelectOption value="">All types</NativeSelectOption>
            {TENDER_TYPE_FILTERS.map((tenderType) => (
              <NativeSelectOption
                key={tenderType.value}
                value={tenderType.value}
              >
                {tenderType.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {includeSort ? (
          <SortField filters={filters} id={`${idPrefix}-sort`} />
        ) : null}
      </FieldGroup>
    </FieldSet>
  )
}

function SortField({
  filters,
  id,
}: ListingFilterIslandProps & {
  id: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Sort</FieldLabel>
      <NativeSelect
        className="w-full"
        defaultValue={filters.sort || DEFAULT_LISTING_SORT}
        id={id}
        name="sort"
        size="sm"
      >
        {SORT_OPTIONS.map((sort) => (
          <NativeSelectOption key={sort.value} value={sort.value}>
            {sort.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
}

function PreservedFilterInputs({ filters }: ListingFilterIslandProps) {
  return (
    <>
      <HiddenInput name="q" value={filters.q} />
      <HiddenInput name="region" value={filters.region} />
      <HiddenInput name="buyer" value={filters.buyer} />
      <HiddenInput name="industry" value={filters.industry} />
      <HiddenInput name="tender_type" value={filters.tenderType} />
    </>
  )
}

function HiddenInput({
  name,
  value,
}: {
  name: string
  value?: string | null
}) {
  return value ? <input name={name} type="hidden" value={value} /> : null
}

function buildFilterHref(
  filters: ListingSearchParams,
  patch: Partial<ListingSearchParams> = {}
) {
  const next = new URLSearchParams()
  const merged = { ...filters, ...patch }

  appendParam(next, "q", merged.q)
  appendParam(next, "region", merged.region)
  appendParam(next, "buyer", merged.buyer)
  appendParam(next, "industry", merged.industry)
  appendParam(next, "tender_type", merged.tenderType)
  appendParam(
    next,
    "sort",
    merged.sort !== DEFAULT_LISTING_SORT ? merged.sort : undefined
  )

  const query = next.toString()
  return query ? `/?${query}` : "/"
}

function trackFilterApply(surface: string, form: HTMLFormElement) {
  const formData = new FormData(form)
  const query = String(formData.get("q") || "").trim()
  const buyer = String(formData.get("buyer") || "").trim()
  const region = String(formData.get("region") || "")
  const industry = String(formData.get("industry") || "")
  const tenderType = String(formData.get("tender_type") || "")
  const sort = String(formData.get("sort") || DEFAULT_LISTING_SORT)

  trackUmamiEvent("tender_filter_apply", {
    active_filters: countActiveFilters({
      buyer,
      industry,
      q: query,
      region,
      tenderType,
    }),
    buyer_present: Boolean(buyer),
    industry: industry || "all",
    query_length: query.length,
    query_present: Boolean(query),
    region: region || "all",
    sort,
    surface,
    tender_type: tenderType || "all",
  })
}

function countActiveFilters(filters: {
  buyer?: string
  industry?: string
  q?: string
  region?: string
  tenderType?: string
}) {
  return Object.values(filters).filter(Boolean).length
}

function appendParam(params: URLSearchParams, key: string, value?: string) {
  if (value) params.set(key, value)
}
