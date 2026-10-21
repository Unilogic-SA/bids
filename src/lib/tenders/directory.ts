/** Deliberately curated registry: no arbitrary topic/location permutations. */
export type TenderCollection = {
  kind: "province" | "industry" | "buyer"
  slug: string
  name: string
  title: string
  description: string
  guidance: string
  province?: string
  topic?: "information-technology" | "marketing"
  buyers?: string[]
  officialUrl?: string
}

const provinceCopy: Record<string, string> = {
  Gauteng:
    "Check the delivery address and briefing venue: a notice listed in Gauteng may cover work at several sites or services for a national buyer.",
  "Western Cape":
    "Read the delivery schedule and site list before pricing travel or delivery. Notices listed in the Western Cape can include multiple locations.",
  "KwaZulu-Natal":
    "Confirm the named delivery site and any compulsory site visit before preparing a response. The province label alone does not establish the place of work.",
  "Eastern Cape":
    "Check whether pricing must cover one site or several delivery points. Use the official documents for addresses, briefing arrangements and submission instructions.",
  "Free State":
    "Check the delivery address, service period and briefing arrangements in the tender pack. The listed province is a source classification rather than a guarantee of local-only work.",
  Limpopo:
    "Review the site list and delivery schedule before estimating transport and attendance costs. Check whether a briefing is compulsory and whether its date has passed.",
  Mpumalanga:
    "Confirm access requirements and exact delivery locations in the documents. Industrial and public-sector sites can have notice-specific briefing or delivery arrangements.",
  "North West":
    "Use the official pack to confirm the work location and submission point. These can differ from the buyer’s office or the province shown in the feed.",
  "Northern Cape":
    "Review distances between the named delivery points before pricing. A province-wide notice may require work at multiple sites rather than one central location.",
  National:
    "National notices are classified separately from the nine provinces. Check the documents for the actual service area: national classification does not necessarily mean delivery in every province.",
}

export const PROVINCE_COLLECTIONS: TenderCollection[] = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "National",
].map((province) => ({
  kind: "province",
  slug: province.toLowerCase().replaceAll(" ", "-"),
  name: province,
  title:
    province === "National" ? "National government tenders" : `Government tenders in ${province}`,
  description: `Browse current public tenders and RFQs classified as ${province} in the official feed, with buyers, closing dates and available documents.`,
  guidance: provinceCopy[province],
  province,
}))

export const INDUSTRY_COLLECTIONS: TenderCollection[] = [
  {
    kind: "industry",
    slug: "information-technology",
    name: "IT & ICT",
    title: "IT and ICT tenders in South Africa",
    topic: "information-technology",
    description:
      "Find public-sector software, computer equipment, networking, cybersecurity and ICT service opportunities, with closing dates and tender documents.",
    guidance:
      "Read the scope for licence terms, hardware specifications, support periods and required accreditations. This collection matches procurement subjects and selected official classifications; it does not treat every professional-services or media notice as IT.",
  },
  {
    kind: "industry",
    slug: "marketing",
    name: "Marketing & advertising",
    title: "Marketing and advertising tenders in South Africa",
    topic: "marketing",
    description:
      "Browse public-sector marketing, advertising, brand, communications and market-research opportunities with official notice details and documents.",
    guidance:
      "Check whether the scope covers strategy, creative production, media placement or research, and whether these are separate deliverables. Read the tender pack for evaluation criteria, proof of experience and the required pricing format.",
  },
]

export const BUYER_COLLECTIONS: TenderCollection[] = [
  {
    kind: "buyer",
    slug: "eskom",
    name: "Eskom",
    title: "Eskom tenders",
    buyers: ["ESKOM"],
    officialUrl: "https://www.eskom.co.za/",
    description:
      "Browse current public procurement notices published under Eskom in the official feed, with references, closing dates and available documents.",
    guidance:
      "Match the exact tender reference before responding. Notices from separately named Eskom entities are not automatically merged into this collection. Check the official documents for the responsible business unit and submission channel.",
  },
  {
    kind: "buyer",
    slug: "transnet",
    name: "Transnet SOC Ltd",
    title: "Transnet SOC Ltd tenders",
    buyers: ["Transnet SOC Ltd"],
    officialUrl: "https://www.transnet.net/",
    description:
      "Find current notices published under Transnet SOC Ltd, including tender references, deadlines and available procurement documents.",
    guidance:
      "This collection covers the Transnet SOC Ltd buyer name. Notices listed separately under Transnet National Ports Authority are not silently combined. Confirm the division, site and exact submission instructions in the official pack.",
  },
  {
    kind: "buyer",
    slug: "city-of-cape-town",
    name: "City of Cape Town",
    title: "City of Cape Town tenders",
    buyers: ["City of Cape Town"],
    officialUrl: "https://www.capetown.gov.za/",
    description:
      "Browse City of Cape Town public tender notices from the official feed, with closing dates, references and tender documents.",
    guidance:
      "Check whether the notice is for a once-off purchase, a term contract or another procurement arrangement. Confirm the reference and the designated submission point before responding.",
  },
  {
    kind: "buyer",
    slug: "sita",
    name: "SITA",
    title: "SITA tenders",
    buyers: ["State Information Technology Agency"],
    officialUrl: "https://www.sita.co.za/",
    description:
      "Browse State Information Technology Agency tender notices with current closing dates, references and available official documents.",
    guidance:
      "SITA notices can procure services for other public bodies. Confirm the beneficiary, contract scope, accreditation requirements and response instructions in each official tender pack.",
  },
]
export const TENDER_COLLECTIONS = [
  ...INDUSTRY_COLLECTIONS,
  ...PROVINCE_COLLECTIONS,
  ...BUYER_COLLECTIONS,
]
export function collectionPath(collection: Pick<TenderCollection, "kind" | "slug">) {
  return `/tenders/${collection.kind}/${collection.slug}`
}
export function findCollection(kind: string, slug: string) {
  return TENDER_COLLECTIONS.find((item) => item.kind === kind && item.slug === slug)
}
export function collectionPageHref(collection: TenderCollection, page: number) {
  return `${collectionPath(collection)}${page > 1 ? `?page=${page}` : ""}`
}
