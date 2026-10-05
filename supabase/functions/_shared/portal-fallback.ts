// The official portal is an independent live source when the OCDS export is unavailable.
// These adapters are for catalog fields; the original portal payload is archived separately.
export type ActivePortalTender = {
  id?: number | string
  ocid?: string | null
  tender_No?: string
  description?: string
  category?: string
  type?: string
  organ_of_State?: string
  department?: string
  status?: string
  closing_Date?: string
  date_Published?: string
  province?: string
  delivery?: string
  conditions?: string
  contactPerson?: string
  email?: string
  telephone?: string
  briefingSession?: boolean | null
  briefingCompulsory?: boolean | null
  compulsory_briefing_session?: string | null
  briefingVenue?: string | null
}

export function portalOcid(portal: ActivePortalTender) {
  if (!/^\d+$/.test(String(portal.id))) throw new Error("Invalid numeric eTenders portal id")
  const expected = `ocds-9t57fa-${portal.id}`
  if (portal.ocid && portal.ocid !== expected) throw new Error("Unexpected eTenders portal OCID")
  return expected
}

export function portalDate(value?: string | null) {
  if (!value || value.startsWith("0001-01-01")) return undefined
  // Portal dates without an offset are South African local time.
  const qualified = /(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}+02:00`
  const parsed = new Date(qualified)
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid eTenders portal date")
  return parsed.toISOString()
}

export function portalCatalogRelease(portal: ActivePortalTender) {
  const closing = portalDate(portal.closing_Date)
  const published = portalDate(portal.date_Published)
  if (!closing || !published || !portal.tender_No || !portal.description) {
    throw new Error("Incomplete eTenders portal tender")
  }
  if (portal.status !== "Published") throw new Error("Unexpected active portal status")
  return {
    ocid: portalOcid(portal),
    id: `portal-${portal.id}`,
    date: published,
    buyer: { name: portal.organ_of_State || portal.department },
    tender: {
      id: String(portal.id), title: portal.tender_No, description: portal.description,
      status: "active", category: portal.category, province: portal.province,
      procurementMethodDetails: portal.type, deliveryLocation: portal.delivery,
      specialConditions: portal.conditions,
      tenderPeriod: { startDate: published, endDate: closing },
      procuringEntity: { name: portal.department || portal.organ_of_State },
      contactPerson: { name: portal.contactPerson, email: portal.email, telephoneNumber: portal.telephone },
      briefingSession: {
        isSession: portal.briefingSession ?? undefined, compulsory: portal.briefingCompulsory ?? undefined,
        date: portalDate(portal.compulsory_briefing_session), venue: portal.briefingVenue || undefined,
      },
    },
  }
}

export async function resolveCatalogSources<T, P extends ActivePortalTender>(options: {
  fetchOcds: () => Promise<T[]>
  fetchPortal: () => Promise<{ tenders: Map<string, P>; warning: string | null }>
  allowPortalFallback: boolean
}) {
  let releases: T[] = []
  let ocdsError: unknown
  try { releases = await options.fetchOcds() } catch (error) { ocdsError = error }
  const portal = await options.fetchPortal()
  if (!ocdsError) return { releases, portal, sourceMode: "ocds" as const, warnings: portal.warning ? [portal.warning] : [] }
  const reason = ocdsError instanceof Error ? ocdsError.message : String(ocdsError)
  if (!options.allowPortalFallback) throw new Error(`OCDS coverage unavailable: ${reason}; portal cannot recover historical backfills`)
  if (portal.warning || !portal.tenders.size) throw new Error(`Both tender sources unavailable: OCDS ${reason}; portal ${portal.warning || "empty active catalog"}`)
  return { releases: [], portal, sourceMode: "portal_active_fallback" as const,
    warnings: [`OCDS unavailable: ${reason}. Active portal catalog refreshed; historical OCDS coverage is incomplete.`] }
}

export function preserveOcdsPayload(
  row: Record<string, unknown>,
  prior: (Record<string, unknown> & { release_id: string; raw_release: unknown; raw_tender: unknown }) | undefined,
  portal: ActivePortalTender,
) {
  row.raw_release = prior?.raw_release || {}
  row.raw_tender = prior?.raw_tender || {}
  row.release_id = prior?.release_id || row.release_id
  row.listing_type = "portal_active_fallback"
  const conditionsFields = ["special_conditions", "has_special_conditions", "eligibility_notes"]
  const deliveryFields = ["place_raw", "address_line", "suburb_or_area", "city", "postal_code", "delivery_location_confidence"]
  const sourcePresenceFields = new Set([...conditionsFields, ...deliveryFields, "briefing_session", "compulsory_briefing"])
  // Missing optional portal fields must not clear richer existing OCDS fields.
  for (const key of Object.keys(row)) {
    if (!sourcePresenceFields.has(key) && row[key] === null && prior?.[key] != null) row[key] = prior[key]
  }
  if (!prior) return row
  // Mappers default absent flags to false and absent location confidence to zero.
  // Preserve those groups by source presence; explicit false remains authoritative.
  const preserve = (keys: string[]) => {
    for (const key of keys) if (prior[key] != null) row[key] = prior[key]
  }
  if (typeof portal.briefingSession !== "boolean") preserve(["briefing_session"])
  if (typeof portal.briefingCompulsory !== "boolean") preserve(["compulsory_briefing"])
  row.briefing_raw = [
    row.briefing_session ? "Yes" : "No",
    row.compulsory_briefing ? "Compulsory" : "Not compulsory",
    row.briefing_datetime, row.briefing_venue,
  ].filter(Boolean).join(" | ")
  if (!portal.conditions?.trim()) preserve(conditionsFields)
  if (!portal.delivery?.trim()) preserve(deliveryFields)
  return row
}
