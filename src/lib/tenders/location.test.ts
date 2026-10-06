import assert from "node:assert/strict"
import test from "node:test"
import { formatTenderLocation } from "./location"

test("cleans repeated portal locations from the reported mobile examples", () => {
  assert.equal(
    formatTenderLocation({
      address_line: "Mpumalanga-Mpumalanga-Mpumalanga-",
      city: "Mpumalanga",
      province: "Mpumalanga",
      place_raw: "Mpumalanga-Mpumalanga-Mpumalanga-, Mpumalanga",
    }),
    "Mpumalanga"
  )
  assert.equal(
    formatTenderLocation({
      place_raw: "Gauteng -Gauteng -Germiston -2000, Gauteng",
      province: "Gauteng",
    }),
    "Gauteng, Germiston, 2000"
  )
})

test("preserves meaningful hyphens, street ranges and complete structured addresses", () => {
  assert.equal(
    formatTenderLocation({
      address_line: "12 - 14 Main Road",
      city: "Durban",
      province: "KwaZulu-Natal",
      postal_code: "4001",
      place_raw: "Durban",
    }),
    "12 - 14 Main Road, Durban, KwaZulu-Natal, 4001"
  )
  assert.equal(
    formatTenderLocation({ place_raw: "Graaff-Reinet, Eastern Cape" }),
    "Graaff-Reinet, Eastern Cape"
  )
  assert.equal(
    formatTenderLocation({
      address_line: "1 Main Road",
      city: "Durban",
      place_raw: "Civic Centre, 1 Main Road, Durban",
    }),
    "Civic Centre, 1 Main Road, Durban"
  )
})

test("deduplicates case-insensitively and rejects sparse placeholders", () => {
  assert.equal(
    formatTenderLocation({
      province: "Gauteng",
      city: "gauteng",
      place_raw: "n/a",
    }),
    "gauteng"
  )
  assert.equal(
    formatTenderLocation({ address_line: "not supplied", place_raw: "-" }),
    ""
  )
})
