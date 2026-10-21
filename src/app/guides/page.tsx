import Link from "next/link"
import { PublicArticle } from "@/components/public-article"
import { GUIDES, guidePath } from "@/lib/tenders/guides"
import { pageMetadata } from "@/lib/seo"
const title = "Tender preparation guides"
const description =
  "Practical guides to reading public procurement notices, preparing a response and keeping track of deadlines."
export const metadata = pageMetadata(title, description, "/guides")
export default function Page() {
  return (
    <PublicArticle title={title} description={description} path="/guides">
      <ul>
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link href={guidePath(guide.slug)}>{guide.title}</Link>
            <p className="text-muted-foreground">{guide.description}</p>
          </li>
        ))}
      </ul>
    </PublicArticle>
  )
}
