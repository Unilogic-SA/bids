import type { TenderDetail } from "./types"

type TenderLocation = Partial<
  Pick<
    TenderDetail,
    | "address_line"
    | "suburb_or_area"
    | "city"
    | "province"
    | "postal_code"
    | "place_raw"
  >
>

const placeholders = new Set([
  "not supplied",
  "not applicable",
  "n/a",
  "none",
  "-",
])
const key = (value: string) =>
  value.toLocaleLowerCase("en-ZA").replace(/\s+/g, " ").trim()

function parts(value?: string | null) {
  if (!value) return []
  return (
    value
      // Portal addresses sometimes use a dash immediately after a place name.
      // Keep internal hyphens in KwaZulu-Natal, double-barrelled names and ranges.
      .replace(/(?<=\p{L})\s+-\s*/gu, ", ")
      .replace(/\s*-\s+(?=\p{L})/gu, ", ")
      .split(/[,;|\n]+/)
      .flatMap((part) => {
        const trimmed = part
          .replace(/^[\s-]+|[\s-]+$/g, "")
          .replace(/\s+/g, " ")
        const repeated = trimmed
          .split("-")
          .map((piece) => piece.trim())
          .filter(Boolean)
        // e.g. Mpumalanga-Mpumalanga-Mpumalanga, but not KwaZulu-Natal.
        return repeated.length > 1 &&
          repeated.every((piece) => key(piece) === key(repeated[0]))
          ? [repeated[0]]
          : [trimmed]
      })
      .filter((part) => part && !placeholders.has(key(part)))
  )
}

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const normalized = key(value)
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

export function formatTenderLocation(tender: TenderLocation) {
  const street = parts(tender.address_line)
  const area = unique(
    [
      tender.suburb_or_area,
      tender.city,
      tender.province,
      tender.postal_code,
    ].flatMap(parts)
  )
  const structured = unique([...street, ...area])
  const raw = unique(parts(tender.place_raw))
  const hasStreet = street.some(
    (part) => !area.some((value) => key(value) === key(part))
  )
  const hasCityOrArea =
    parts(tender.city).length > 0 || parts(tender.suburb_or_area).length > 0
  const rawContainsStructured = structured.every((part) =>
    raw.some((value) => key(value).includes(key(part)))
  )

  // Prefer a complete address, retaining richer raw text (e.g. building names)
  // when it already contains that address. Never concatenate overlapping forms.
  if (hasStreet && hasCityOrArea) {
    return (raw.length && rawContainsStructured ? raw : structured).join(", ")
  }
  return (raw.length ? raw : structured).join(", ")
}
