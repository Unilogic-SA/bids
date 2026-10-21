# Public SEO operations

## Architecture and publication

The production canonical origin is `https://www.openbid.co.za`. Set
`NEXT_PUBLIC_SITE_URL` to that origin; ephemeral deployment URLs must never become
canonicals. Preview metadata is noindex. Public HTML is still allowed to remain
private/no-store because the session proxy owns its authentication boundary.
Only public notice data is cached, for 60 seconds; no cookie or workspace data
enters that cache. Collections query current deadlines directly.

`src/lib/tenders/directory.ts` is the deliberate publication registry: ten
source-region collections (nine provinces plus National), two subject collections
and four exact buyer identities. Unknown slugs do not create pages. Do not add
all possible intersections, city names or years. Before expanding, verify demand,
repeat inventory, relevance and unique utility. Keep established useful pages
when a collection temporarily has no open notices; do not switch indexing daily.

The subject classifier is deterministic SQL in versioned migrations. Its
expression index covers open/closing-today notices. **Any future change to the
immutable classifier must rebuild `tenders_seo_topics_open_idx` in the same
release**, otherwise existing entries may disagree with the new function.
Add negative fixtures for irrelevant incidental words and source misclassification.
Keep the query's array-containment operator so PostgreSQL can use the GIN index.

The October 2026 pilot reviewed all 20 initial marketing matches and 30+ IT matches.
This caught re-advertisement, seismometer and mislabeled traffic-camera matches;
regression fixtures and refined rules remove those errors. Province counts and
buyer identities were checked against the live public catalog. This is not a
claim of exhaustive coverage or permanent classification accuracy.

## Route policy

- Home and unfiltered pagination: index-eligible, self canonical, crawlable links.
- User search/filter states and alternate sort orders: noindex; normalize
  equivalent parameters. Never block pagination in robots.
- Curated collections and their valid pages: self canonical and index-eligible.
- Stable OCID detail URLs: retain existing paths. Notice metadata is subject-led;
  sparse records without a useful subject/buyer are noindex. Useful closed
  records remain available with their closed state and relevant open alternatives.
- Existing Discover `from` links retain their return-navigation behavior and clean
  canonicals. New directory and related-notice links use canonical URLs directly.
- Auth, admin, invitations, password and Workspace routes retain their exclusions
  and access controls. Robots is not an authorization mechanism.
- Unknown slugs and out-of-range collection pages use not-found. With a streaming
  boundary Next.js may return 200 plus noindex; verify the exclusion as well as
  status. Never return indexable empty success for an operational catalog error.

## Sitemap integrity

`getTenderSitemapItems` uses stable OCID keyset pagination with one request-time
availability cutoff. It reads until an empty batch, including when the API caps
batches below the requested size. It fails on non-advancing data, partial failure
or the 45,000-notice budget; add sharding before reaching that budget.

The sitemap contains canonical static resources, approved hubs and quality-eligible
open notices. Compare eligible database rows to returned unique notices at a
consistent cutoff; source changes during generation can explain small concurrent
count differences. Missing configuration/read failures must produce an error,
not a successful homepage-only sitemap. Investigate `seo_sitemap_empty_active_catalog`
and `seo_related_tenders_read_failed` logs.

Last-modified values use source modification/publication dates and, on detail
schema, recorded document publication/modification. Import, polling and download
timestamps do not impersonate content updates. Static pages omit invented lastmod.
No sitemap freshness is inferred from request time.

## Release checks

Run `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
The database fixture verifies anonymous public reads, private-field omission,
invalid arguments and denied writes. Sitemap fixtures exceed the API's observed
1,000-row cap and exercise failure/overflow.

Run `SEO_VERIFY_BASE_URL=https://www.openbid.co.za node scripts/verify-seo.mjs`
after release. Override `SEO_MIN_SITEMAP_URLS` when a documented source change
justifies a different count. For an accessible Preview, set
`SEO_VERIFY_PREVIEW=1`; do not disable deployment protection for testing.

Render desktop/mobile, check long titles and navigation, and validate JSON-LD with
Schema Markup Validator and the applicable Rich Results Test. General
WebPage/CreativeWork markup does not promise a Google tender rich result.

The directory migrations are additive invoker functions and a public-data index;
existing RLS, accounts, workspaces and source data are untouched. Apply migrations
before deploying dependent routes. A code rollback can leave these additive
functions in place; do not drop catalog or workspace data as a rollback step.

## Search performance and next decisions

Optional `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` metadata support
webmaster ownership verification; tokens are intentionally public. DNS property
verification may already suffice. Submit `/sitemap.xml` from the verified
Search Console and Bing properties once account access is available. Do not use
the removed sitemap ping endpoints or the JobPosting Indexing API for tenders.

Capture the last 28/90 days of impressions, clicks, CTR, average position and
Google-selected canonicals by page/query/device. Separate brand traffic,
evergreen collections and short-lived notices. Reassess cohorts after 3–4 weeks,
not after a few hours. Prioritize relevant pages in positions 8–20 and check
cannibalization before edits. Rankings, adoption and traffic gains are not
promised by this implementation.

Existing analytics retain consent/host/private-route restrictions. Approved
collection/guide paths receive normalized public measurement; arbitrary dynamic
segments, search text, return URLs and auth data are not exported to Google.
Umami/Google collection details remain governed by the separate analytics work.
Do not introduce another analytics vendor as a prerequisite for public SEO.

Measure relevant tender opens, document engagement and successful saves/signups
where the existing systems support attribution. Do not call a button click a
completed signup or upload private workspace/checklist information. Account
access, consent and referrer gaps limit a complete organic conversion census.

Potential follow-ups require evidence/access: validated category/province
intersections, more exact buyer profiles, a useful historical archive, field
Core Web Vitals, backlinks and reviewed original procurement insights. Outreach
requires explicit recipient instructions; no outreach is sent as part of rollout.

## Font delivery

Inter, Figtree and Geist Mono keep the existing CSS variables and weight ranges.
They are now bundled with `next/font/local`, avoiding Google network calls at
build time. Licensed WOFF2 subsets cover Latin, Latin Extended, African Latin
letters, punctuation and currencies; other scripts use browser font fallback.
Sources and OFL notices are in `src/app/fonts`. No runtime font service is added.
