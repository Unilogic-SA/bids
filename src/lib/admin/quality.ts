import {
  createPublicClient,
  hasSupabasePublicConfig,
} from "@/lib/supabase/server"

export type CatalogQualityExample = {
  ocid: string
  tender_no: string
  title: string | null
}
export type CatalogQualityCheck = {
  id: string
  label: string
  scope: string
  count: number | null
  examples: CatalogQualityExample[]
}

export async function getCatalogQualityChecks(
  checkedAt: string
): Promise<CatalogQualityCheck[]> {
  const definitions = [
    { id: "documents", label: "Missing documents", scope: "Open tenders" },
    { id: "province", label: "Missing province", scope: "Open tenders" },
    { id: "contact", label: "Missing contact details", scope: "Open tenders" },
    { id: "deadline", label: "Missing deadline", scope: "Full catalog" },
  ]
  if (!hasSupabasePublicConfig())
    return definitions.map((check) => ({
      ...check,
      count: null,
      examples: [],
    }))
  const client = createPublicClient()
  const results = await Promise.all(
    definitions.map(async (check) => {
      let query = client
        .from("tenders")
        .select("ocid,tender_no,title", { count: "exact" })
      if (check.id === "deadline") query = query.is("closing_at", null)
      else {
        query = query
          .in("derived_status", ["open", "closing_today"])
          .gte("closing_at", checkedAt)
        if (check.id === "documents") query = query.eq("documents_count", 0)
        if (check.id === "province")
          query = query.or('province.is.null,province.eq.""')
        if (check.id === "contact")
          query = query.or(
            'and(contact_email.is.null,contact_tel.is.null),and(contact_email.is.null,contact_tel.eq.""),and(contact_email.eq."",contact_tel.is.null),and(contact_email.eq."",contact_tel.eq."")'
          )
      }
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .order("ocid")
        .limit(5)
      return {
        ...check,
        count: error ? null : count,
        examples: error ? [] : ((data || []) as CatalogQualityExample[]),
      }
    })
  )
  return results
}
