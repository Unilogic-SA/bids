# Performance and loading readiness — 12 October 2026

Scope: issue #65; based on main `3eec0df`. Existing Next.js 16.2.6 / React 19.2 / Supabase / shadcn stack. No framework upgrades or schema changes.

## Findings and implemented changes

| Finding | Change | Expected effect |
| --- | --- | --- |
| Discover pagination uses plain anchors; filter and header searches use native GET forms | Compose shadcn pagination with Next Link and use Next Form | Client navigation preserves the root shell/providers rather than reloading the document |
| AccountProvider resets on every pathname; same-user SIGNED_IN refocus events also clear identity | One session-lifetime reader; background refresh for the same verified user; explicit account changes still invalidate private state | Stops false guest headers and unnecessary private workspace remounts |
| Loading identity is interpreted as logged out | Show shadcn Skeleton while identity is unknown | Avoids misleading login/signup controls before confirmation |
| Discover awaits the database before returning any page content | Keyed results-only Suspense plus root loading boundary | Filter shell streams independently; a new query/page displays matching skeleton results |
| Missing auth/admin loading boundaries inherit the root route fallback | Route-specific shadcn form/dashboard skeletons | Relevant placeholders at each route; motion respects reduced-motion preferences |
| Bid-sheet URL changes re-trigger the entire workspace list | Separate list/filter query from `bid` selection | Opening/closing a sheet does not reload the list |
| Board/editor eagerly loaded by workspace | next/dynamic and layout-matched skeleton fallbacks | Defers DnD and bid-editor code until used |
| Workspace shows previous page/filter rows while waiting | Track the successfully loaded list query | Skeleton on new filters/pages; existing rows remain during background saves |
| Account/workspace authorization has a serial membership → company read | Read the existing foreign-key company relation with membership | Removes one database round trip, retaining getUser, RLS, owner checks, and private/no-store headers |
| Admin layout and page each verify the session | React cache for the server-render request only | Deduplicates verification without sharing accounts between requests |
| Current Vercel deployment executes in `iad1`; active Supabase database is `eu-west-1` | Commit Vercel region `dub1` | Places functions beside the database; public static assets remain CDN-served |

## Measurements and boundaries

Read-only live inspection:
- Default listing SQL plan: indexed scan; execution 0.257 ms. This is SQL execution, not end-to-end user latency or an RLS-inclusive application benchmark.
- Existing weighted-search RPC (`website`, 12 results): execution 161.229 ms. Search ranking/fallback behavior remains unchanged.
- Single baseline terminal HTTP samples: Discover first byte 9.947 s; page two 9.112 s. These include this runner's network path and are not South African user benchmarks or Core Web Vitals.
- Supabase performance advisors: informational unindexed sync-history foreign key and three unused-index notices. No automatic index removal or production migration; these are not evidence of a slow public-listing query. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

No public catalog cross-request cache was added: time-sensitive deadlines, search counts and ingestion freshness still use the current database paths. No private workspace/account response is put in a shared cache. There are no production writes, migrations, backfills, or sync runs in this work.

## Official sources checked

- [Next Form: client GET navigation and pending feedback](https://nextjs.org/docs/app/api-reference/components/form)
- [Next loading boundaries and streaming](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- [Next lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [React Suspense: keys reset boundaries for different content](https://react.dev/reference/react/Suspense)
- [React cache: request-lifetime memoization](https://react.dev/reference/react/cache)
- [shadcn Skeleton](https://ui.shadcn.com/docs/components/radix/skeleton)
- [shadcn Pagination: Next Link integration](https://ui.shadcn.com/docs/components/radix/pagination)
- [Supabase auth events and same-user SIGNED_IN notifications](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase joins and nesting](https://supabase.com/docs/guides/database/joins-and-nesting)
- [Supabase changelog](https://supabase.com/changelog.md): reviewed breaking changes; no change to the APIs used here required
- [Vercel region colocation with data sources](https://vercel.com/docs/functions/configuring-functions/region)

## Validation

The PR records the exact final check results, preview commit and observed browser flows. Auth-event tests cover same-user revalidation, immediate clearing on sign-out/account changes, request coalescing, stale responses and background outages. Workspace tests cover preservation of the list query through sheet selection.

A signed-in Google OAuth browser session and South African mobile-device Core Web Vitals must be distinguished from automated regression checks and guest-preview verification. Do not claim either without a real measurement/session.
