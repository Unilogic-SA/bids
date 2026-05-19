import Link from "next/link"
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
import {
  DEFAULT_LISTING_SORT,
  INDUSTRY_FILTERS,
  REGION_OPTIONS,
  SORT_OPTIONS,
  TENDER_TYPE_FILTERS,
} from "@/lib/tenders/filters"
import type { ListingSearchParams } from "@/lib/tenders/types"

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
      <form action="/" method="get">
        <CardContent>
          <FieldSet>
            <FieldLegend className="sr-only">Tender filters</FieldLegend>
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="q">Search</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    defaultValue={filters.q || ""}
                    id="q"
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
                <FieldLabel htmlFor="region">Region</FieldLabel>
                <NativeSelect
                  className="w-full"
                  defaultValue={filters.region || ""}
                  id="region"
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
                <FieldLabel htmlFor="buyer">Buyer</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    defaultValue={filters.buyer || ""}
                    id="buyer"
                    name="buyer"
                    placeholder="Buyer contains…"
                  />
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="industry">Industry</FieldLabel>
                <NativeSelect
                  className="w-full"
                  defaultValue={filters.industry || ""}
                  id="industry"
                  name="industry"
                  size="sm"
                >
                  <NativeSelectOption value="">All industries</NativeSelectOption>
                  {INDUSTRY_FILTERS.map((industry) => (
                    <NativeSelectOption
                      key={industry.value}
                      value={industry.value}
                    >
                      {industry.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <Field>
                <FieldLabel htmlFor="tender_type">Tender type</FieldLabel>
                <NativeSelect
                  className="w-full"
                  defaultValue={filters.tenderType || ""}
                  id="tender_type"
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

              <Field>
                <FieldLabel htmlFor="sort">Sort</FieldLabel>
                <NativeSelect
                  className="w-full"
                  defaultValue={filters.sort || DEFAULT_LISTING_SORT}
                  id="sort"
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
            </FieldGroup>
          </FieldSet>
        </CardContent>

        <CardFooter className="mt-4 justify-between gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/">
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
