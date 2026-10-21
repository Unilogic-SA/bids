import Link from "next/link"
import { notFound } from "next/navigation"
import { PublicArticle } from "@/components/public-article"
import { findGuide, GUIDES, guidePath } from "@/lib/tenders/guides"
import { absoluteUrl, pageMetadata, stringifyJsonLd, SITE_NAME } from "@/lib/seo"
type Props = { params: Promise<{ slug: string }> }
export function generateStaticParams() {
  return GUIDES.map(({ slug }) => ({ slug }))
}
export const dynamicParams = false
export async function generateMetadata({ params }: Props) {
  const guide = findGuide((await params).slug)
  if (!guide) notFound()
  return pageMetadata(guide.title, guide.description, guidePath(guide.slug))
}
export default async function Page({ params }: Props) {
  const guide = findGuide((await params).slug)
  if (!guide) notFound()
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    mainEntityOfPage: absoluteUrl(guidePath(guide.slug)),
    author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/about") },
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
  }
  return (
    <PublicArticle
      title={guide.title}
      description={guide.description}
      path={guidePath(guide.slug)}
      parent={{ name: "Guides", path: "/guides" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
      />
      <p className="text-muted-foreground">
        Prepared by OpenBids. General preparation guidance; use the official tender pack for the
        requirements of each notice.
      </p>
      {guide.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.steps ? (
            <ul>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <section>
        <h2>Sources and next steps</h2>
        <p>
          Find the original opportunity and documents on the{" "}
          <a href="https://www.etenders.gov.za/" target="_blank" rel="noopener noreferrer">
            National Treasury eTenders portal
          </a>
          . <Link href="/about">Read how OpenBids uses official source information</Link>.
        </p>
        <p>
          <Link href="/tenders">Browse current tenders</Link> or{" "}
          <Link href="/workspace">open your Workspace</Link>.
        </p>
      </section>
      <nav aria-label="Related guides">
        <h2>Related guides</h2>
        <ul>
          {guide.related.map((slug) => {
            const related = findGuide(slug)
            return related ? (
              <li key={slug}>
                <Link href={guidePath(slug)}>{related.title}</Link>
              </li>
            ) : null
          })}
        </ul>
      </nav>
    </PublicArticle>
  )
}
