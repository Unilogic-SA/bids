"use client"

import type { Ref } from "react"
import { IconSearch } from "@tabler/icons-react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"

export function TenderSearchInput({ id, defaultValue, label, inputRef, shortcut = false }: {
  id: string
  defaultValue?: string
  label?: string
  inputRef?: Ref<HTMLInputElement>
  shortcut?: boolean
}) {
  return <InputGroup>
    <InputGroupInput
      ref={inputRef}
      id={id}
      name="q"
      type="search"
      aria-label={label}
      defaultValue={defaultValue || ""}
      placeholder="Number, buyer, keyword"
      maxLength={100}
      autoComplete="off"
    />
    <InputGroupAddon align="inline-end">
      {shortcut ? <Kbd aria-label="Control or Command plus slash">⌘ /</Kbd> : null}
      <InputGroupButton aria-label="Search tenders" size="icon-xs" type="submit">
        <IconSearch data-icon="inline-start" />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
}
