import { cache } from "react"
import { createPublicClient, hasSupabasePublicConfig } from "@/lib/supabase/server"
import { findCollection } from "./directory"
import type { TenderListingItem } from "./types"

export const getCollectionListing = cache(async (kind: string, slug: string, page = 1) => {
  const collection = findCollection(kind, slug)
  if (!collection) throw new Error("Unknown tender collection")
  if (!hasSupabasePublicConfig()) throw new Error("Public tender catalog unavailable")
  const { data, error } = await createPublicClient().rpc("browse_public_tenders", {
    p_topic: collection.topic ?? null,
    p_province: collection.province ?? null,
    p_buyers: collection.buyers ?? null,
    p_page: page,
  })
  if (error) throw new Error(`Public directory unavailable: ${error.code}`)
  const result = data as { items: TenderListingItem[]; totalCount: number; buyerCount: number }
  return { ...result, pageCount: Math.ceil(result.totalCount / 12) }
})
