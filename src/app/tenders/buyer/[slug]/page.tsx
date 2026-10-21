import {
  TenderCollectionPage,
  collectionMetadata,
  type CollectionProps,
} from "@/components/tender-collection-page"
export const dynamic = "force-dynamic"
export function generateMetadata(props: CollectionProps) {
  return collectionMetadata("buyer", props)
}
export default function Page(props: CollectionProps) {
  return <TenderCollectionPage {...props} kind="buyer" />
}
