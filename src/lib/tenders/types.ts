export type ListingSort =
  | "published_at_asc"
  | "published_at_desc"
  | "closing_at_asc"
  | "closing_at_desc"

export type IndustryFilter =
  | "services"
  | "supplies"
  | "construction"
  | "ict"
  | "finance_professional"
  | "property_facilities"
  | "utilities_environment"
  | "health_education"
  | "transport_trade"

export type TenderTypeFilter =
  | "open_bid"
  | "rfq"
  | "rfp"
  | "rfi"
  | "eoi"
  | "limited_participation"
  | "sita"

export type ListingSearchParams = {
  q?: string
  region?: string
  buyer?: string
  industry?: IndustryFilter
  tenderType?: TenderTypeFilter
  sort: ListingSort
  page: number
}

export type TenderListingItem = {
  ocid: string
  source_site: string | null
  detail_path: string | null
  tender_no: string | null
  tender_type: string | null
  department: string | null
  buyer_name: string | null
  title: string | null
  title_snippet: string | null
  bid_description: string | null
  province: string | null
  industry: string | null
  views_count: number | null
  published_at: string | null
  closing_at: string | null
  status: string | null
  derived_status: string | null
  is_new: boolean | null
  documents_count: number | null
}

export type TenderDetail = TenderListingItem & {
  release_id: string | null
  tender_source_id: string | null
  source_listing_url: string | null
  detail_url: string | null
  listing_type: string | null
  procurement_category: string | null
  procurement_method: string | null
  procurement_method_details: string | null
  header_timestamp: string | null
  opening_at: string | null
  modified_at: string | null
  imported_at: string | null
  original_source_url: string | null
  source_label: string | null
  place_raw: string | null
  address_line: string | null
  suburb_or_area: string | null
  city: string | null
  postal_code: string | null
  delivery_location_confidence: number | null
  contact_person: string | null
  contact_email: string | null
  contact_tel: string | null
  contact_role: string | null
  contact_raw: string | null
  briefing_session: boolean | null
  compulsory_briefing: boolean | null
  briefing_datetime: string | null
  briefing_venue: string | null
  briefing_raw: string | null
  special_conditions: string | null
  has_special_conditions: boolean | null
  eligibility_notes: string | null
  captured_at: string | null
}

export type TenderDocument = {
  id: string
  tender_ocid: string
  tender_no: string | null
  detail_url: string | null
  document_index: number
  document_title: string | null
  document_url: string
  file_name: string | null
  file_extension: string | null
  file_size_text: string | null
  file_size_kb: number | null
  document_source: string | null
  date_published: string | null
  date_modified: string | null
  downloaded_at: string | null
  document_hash: string | null
}
