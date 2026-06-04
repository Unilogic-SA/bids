import type {
  IndustryFilter,
  ListingSort,
  TenderTypeFilter,
} from "@/lib/tenders/types"

export type FilterOption<T extends string = string> = {
  value: T
  label: string
}

export const DEFAULT_LISTING_SORT: ListingSort = "closing_at_asc"

export const REGION_OPTIONS: FilterOption[] = [
  { value: "National", label: "National" },
  { value: "Eastern Cape", label: "Eastern Cape" },
  { value: "Free State", label: "Free State" },
  { value: "Gauteng", label: "Gauteng" },
  { value: "KwaZulu-Natal", label: "KwaZulu-Natal" },
  { value: "Limpopo", label: "Limpopo" },
  { value: "Mpumalanga", label: "Mpumalanga" },
  { value: "North West", label: "North West" },
  { value: "Northern Cape", label: "Northern Cape" },
  { value: "Western Cape", label: "Western Cape" },
]

export const SORT_OPTIONS: FilterOption<ListingSort>[] = [
  { value: "closing_at_asc", label: "Closing soonest" },
  { value: "closing_at_desc", label: "Closing latest" },
  { value: "published_at_desc", label: "Newest published" },
  { value: "published_at_asc", label: "Oldest published" },
]

export const INDUSTRY_FILTERS: Array<
  FilterOption<IndustryFilter> & { rawValues: string[] }
> = [
  {
    value: "services",
    label: "Services",
    rawValues: [
      "Services: Professional",
      "Services: General",
      "Other service activities",
      "Services: Functional (Including Cleaning and Security Services)",
      "Administrative and support activities",
      "Office administrative, office support and other business support activities",
      "Security and investigation activities",
      "Services: Electrical",
      "Services: Building",
      "Services: Civil",
      "Services to buildings and landscape activities",
      "Repair and installation of machinery and equipment",
      "Other personal service activities",
      "Other professional, scientific and technical activities",
    ],
  },
  {
    value: "supplies",
    label: "Supplies",
    rawValues: [
      "Supplies: General",
      "Supplies: Electrical Equipment",
      "Supplies: Stationery/Printing",
      "Supplies: Medical",
      "Supplies: Computer Equipment",
      "Supplies: Clothing/Textiles/Footwear",
      "Supplies: Perishable Provisions",
      "Agricultural Products and Services",
      "Food and beverage service activities",
    ],
  },
  {
    value: "construction",
    label: "Construction",
    rawValues: [
      "Construction",
      "Construction of buildings",
      "Civil engineering",
      "Specialised construction activities",
      "Architectural and engineering activities; technical testing and analysis",
    ],
  },
  {
    value: "ict",
    label: "ICT",
    rawValues: [
      "Information and communication",
      "Information service activities",
      "Telecommunications",
      "Computer programming, consultancy and related activities",
      "Publishing activities",
      "Programming and broadcasting activities",
      "Motion picture, video and television programme production, sound recording and music publishing activities",
    ],
  },
  {
    value: "finance_professional",
    label: "Finance & professional",
    rawValues: [
      "Financial service activities, except insurance and pension funding",
      "Financial and insurance activities",
      "Activities auxiliary to financial service and insurance activities.",
      "Insurance, reinsurance and pension funding, except compulsory social security",
      "Legal and accounting activities",
      "Professional, scientific and technical activities",
      "Activities of head offices; management consultancy activities",
      "Advertising and market research",
      "Scientific research and development",
    ],
  },
  {
    value: "property_facilities",
    label: "Property & facilities",
    rawValues: [
      "Accommodation",
      "Real estate activities",
      "Rental and leasing activities",
      "Travel agency, tour operator, reservation service and related activities",
      "Libraries, archives, museums and other cultural activities",
    ],
  },
  {
    value: "utilities_environment",
    label: "Utilities & environment",
    rawValues: [
      "Electricity, gas, steam and air conditioning",
      "Water supply; sewerage, waste management and remediation activities",
      "Water collection, treatment and supply",
      "Waste collection, treatment and disposal activities; materials recovery",
      "Remediation activities and other waste management services",
      "Sewerage",
    ],
  },
  {
    value: "health_education",
    label: "Health & education",
    rawValues: [
      "Education",
      "Human health activities",
      "Human health and social work activities",
    ],
  },
  {
    value: "transport_trade",
    label: "Transport & trade",
    rawValues: [
      "Transportation and storage",
      "Water transport",
      "Wholesale and retail trade and repair of motor vehicles and motorcycles",
    ],
  },
]

export const TENDER_TYPE_FILTERS: Array<
  FilterOption<TenderTypeFilter> & { rawValues: string[] }
> = [
  {
    value: "open_bid",
    label: "Open bid",
    rawValues: ["Request for Bid(Open-Tender)"],
  },
  {
    value: "rfq",
    label: "RFQ",
    rawValues: ["Request for Quotation"],
  },
  {
    value: "rfp",
    label: "RFP",
    rawValues: ["Request for Proposal"],
  },
  {
    value: "rfi",
    label: "RFI",
    rawValues: ["Request for Information"],
  },
  {
    value: "eoi",
    label: "EOI",
    rawValues: ["Expression of interest"],
  },
  {
    value: "limited_participation",
    label: "Limited / participation",
    rawValues: ["Request for Bid(Limited-Tender", "Participation"],
  },
  {
    value: "restricted_bidding",
    label: "Restricted bidding",
    rawValues: ["Restricted Bidding"],
  },
  {
    value: "sita",
    label: "SITA contract",
    rawValues: ["SITA contract"],
  },
  {
    value: "sole_source",
    label: "Sole source",
    rawValues: ["Sole source bidding"],
  },
]

export function getIndustryRawValues(value?: IndustryFilter) {
  return INDUSTRY_FILTERS.find((option) => option.value === value)?.rawValues
}

export function getTenderTypeRawValues(value?: TenderTypeFilter) {
  return TENDER_TYPE_FILTERS.find((option) => option.value === value)?.rawValues
}

export function isRegion(value?: string) {
  return REGION_OPTIONS.some((option) => option.value === value)
}

export function isIndustryFilter(value?: string): value is IndustryFilter {
  return INDUSTRY_FILTERS.some((option) => option.value === value)
}

export function isTenderTypeFilter(value?: string): value is TenderTypeFilter {
  return TENDER_TYPE_FILTERS.some((option) => option.value === value)
}

export function isListingSort(value?: string): value is ListingSort {
  return SORT_OPTIONS.some((option) => option.value === value)
}
