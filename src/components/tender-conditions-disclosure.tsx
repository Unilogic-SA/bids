"use client"

import { useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export type TenderConditionItem = {
  label: string
  value: string
}

const PREVIEW_LENGTH = 420

export function TenderConditionsDisclosure({
  items,
}: {
  items: TenderConditionItem[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      className="flex flex-col gap-3"
      onOpenChange={setOpen}
      open={open}
    >
      {!open ? <ConditionItems items={getPreviewItems(items)} /> : null}
      {open ? (
        <CollapsibleContent>
          <ConditionItems items={items} />
        </CollapsibleContent>
      ) : null}
      <CollapsibleTrigger asChild>
        <Button className="w-fit" size="sm" type="button" variant="ghost">
          {open ? "Show less" : "Show full conditions"}
          <IconChevronDown data-icon="inline-end" />
        </Button>
      </CollapsibleTrigger>
    </Collapsible>
  )
}

function ConditionItems({ items }: { items: TenderConditionItem[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {items.map((item) => (
        <div className="flex min-w-0 flex-col gap-1" key={item.label}>
          <dt className="text-xs font-medium text-muted-foreground">
            {item.label}
          </dt>
          <dd className="whitespace-pre-line break-words text-sm leading-6">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function getPreviewItems(items: TenderConditionItem[]) {
  return items.map((item) => ({
    ...item,
    value: truncateAtWord(item.value, PREVIEW_LENGTH),
  }))
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value

  const candidate = value.slice(0, maxLength + 1)
  const lastWhitespace = candidate.search(/\s+\S*$/)
  const truncated = candidate.slice(
    0,
    lastWhitespace > maxLength * 0.7 ? lastWhitespace : maxLength
  )

  return `${truncated.trimEnd()}…`
}
