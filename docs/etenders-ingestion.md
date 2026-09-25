# eTenders ingestion audit and rollout

Issue: [#32](https://github.com/Unilogic-SA/bids/issues/32). Inspected 25 September 2026.

## Source contract and live checks

The official [Swagger UI](https://ocds-api.etenders.gov.za/swagger/index.html) loads its
[OpenAPI contract](https://ocds-api.etenders.gov.za/swagger/v1/swagger.json). Both were
accessible directly; browser/computer automation was unnecessary. Two GET endpoints exist:

- `/api/OCDSReleases`: `PageNumber`, `PageSize`, `dateFrom`, `dateTo`; returns a release package.
- `/api/OCDSReleases/release/{ocid}`: returns a single release. A live lookup for
  `ocds-9t57fa-171664` returned the same top-level fields as its listing release. There is
  no evidence from that check that fetching every tender individually adds information.

Observed with read-only HTTP requests:

| Check | Observation | Consequence |
| --- | --- | --- |
| 20–25 September 2026, page size 2 | Responses include `links.next`; a later page contained only one release but still had a continuation | Follow the supplied link even for short pages |
| 25 September through 25 September | Returned releases dated 25 September at midnight UTC | Same-day date windows work in this sample; this is not proof of arbitrary timestamp boundary semantics |
| 1 January 2099 through the same day | Empty `releases`, empty `links` | A valid empty result is distinct from a missing/malformed release array |
| 1–2 September 2025, page size 50 | 36 releases, 23 cancelled, 13 complete, one with awards and one with parties, no populated contracts; still a next link | Closed records contain valuable data; a short page does not imply completion |
| Portal `PaginatedTenderOpportunities`, `status=1`, length 2 | `data`, `recordsTotal`, `recordsFiltered`; total 2,203 at observation time | Portal enrichment also needs pagination |
| New fetcher, configured 20,000-row reads | OCDS exhausted retries with HTTP 500 after ~33s; portal returned HTTP 500 with an upstream SQL null-value exception after ~17s | Real source failures must remain visible; portal errors must not erase documents |
| Smaller-page experiment | OCDS page size 1,000 exceeded a trial 15s timeout; portal length 500 still returned the SQL null-value error | Smaller pages alone did not resolve the failures; retain the existing 30s per-attempt allowance |

Live listing samples have `tag: ["compiled"]`. The API contract does not promise an
immutable history or a modification cursor. A release ID/date alone is therefore
insufficient to identify source changes. The feed can change between requests, and no
snapshot-consistent pagination guarantee is documented. These bounded probes are not
an exhaustive reconciliation of all government records.

The release schema includes planning/budget, parties, awards/suppliers/values, contracts,
related processes, tender value, items, submission and qualification information, and
document metadata. Availability varies: empty arrays and zero amounts must not be
interpreted as evidence of no award or a known zero budget.

Portal records additionally include validity, electronic submission indicators, bidders,
award fields, Q&A, supporting document metadata, and other source fields. Some may be
empty. Full payload retention avoids guessing which fields will be useful later.

## Existing path and focused changes

Scheduled ingestion is `supabase/functions/sync-tenders/index.ts`, invoked by the existing
recent-refresh and rotating-open-horizon cron jobs. Manual range/backfill ingestion is
`src/lib/etenders/ocds.ts`, behind `/api/sync`. Both already stored the full **latest**
release in `tenders.raw_release`; TypeScript's narrow field declarations did not strip
unknown JSON fields. The missing capability was retaining previous versions and portal
data, not adding dozens of nullable columns.

The shared runtime-neutral helper now:

- validates OCDS packages, follows same-source/same-window continuation links, and fails
  on loops, malformed records and exhausted page limits rather than declaring complete coverage;
- archives every fetched release before selecting one catalog row per OCID;
- stores complete OCDS and matching portal payloads in `tender_source_snapshots`, deduplicated
  by canonical JSON SHA-256 plus OCID and source, with source URL, capture time, run ID,
  and OCDS package metadata (publisher, license, version, links and publication policy);
- paginates the portal, records enrichment failures in `raw_summary.warnings`, and unions
  OCDS and portal documents, deduplicating equivalent query encodings;
- retries network errors, timeouts, 408, 429 and server failures, but stops on permanent
  client errors. Short Retry-After is respected; long Retry-After fails for a later run.
  Defaults are two 30-second attempts with a 1-second wait (about 61 seconds total),
  previously five 30-second attempts with 3/6/9/12-second waits (about 180 seconds).

The migration adds a restricted archive and a security-invoker document RPC. Document
inserts/updates, removal of obsolete URLs and counts run in one transaction. Existing
hashes, downloaded timestamps and sizes survive updates. Missing portal rows (including
closed tenders) preserve previously known documents rather than treating missing enrichment
as evidence that a document was removed. Older overlapping invocations cannot replace
newer catalog captures or reconcile their documents. Completion-update errors now fail
the run instead of returning a false success.

Snapshots hold **distinct observed payloads**, not every polling event: if source content
returns to an earlier value, its existing snapshot is reused. Package metadata and source
URL on that row describe its first archived observation. Empty packages create no snapshots.
Snapshots from an ultimately failed run remain useful; `sync_run_id` distinguishes those
from completed coverage. Snapshots are archived before catalog writes and do not depend
on a catalog foreign key. Binary document contents are not downloaded by this change.

## Reliability findings and limits

A read-only production query during this audit found, in the preceding seven days,
115 completed, 19 failed and 230 still-running rows. Failures included HTTP 500, aborted
fetches and database statement timeouts. Some running rows were days old. That is consistent
with interrupted workers, but is not proof of a single root cause. Shorter retries reduce
one clear runtime risk; this change does not claim to eliminate every worker or database
timeout and does not relabel existing runs. The live realistic-size checks above did not
complete successfully; successful mocked/local checks must not be confused with source
availability or successful staging ingestion.

The existing rotating cron covers publication windows starting with the oldest still-open
tender. It does **not** guarantee revisiting every old closed tender for later award/contract
changes. Extending historical coverage needs an explicitly scheduled, bounded reconciliation
after staging timing measurements. Increasing lookbacks blindly would aggravate the observed
timeouts. No cron frequency, production backfill or production data was changed here.

## Migration and deployment plan

1. Review `20260925140727_retain_tender_source_snapshots.sql`. It is additive and creates no
   production sync jobs. RLS permits archive reads/inserts only with the existing valid sync
   secret; service-role access remains available. Ordinary anonymous/authenticated readers
   cannot see raw portal snapshots. No frontend queries or UI changes are needed.
2. Apply the migration to an isolated staging/local Supabase environment, using its own
   credentials. Deploy the Edge Function and app from this branch there. Never copy the
   production service-role key or sync secret into Preview.
3. Run a small staging range, repeat it, and verify snapshot deduplication, document counts,
   warning visibility, RLS and elapsed time. Test forced portal failure and a deliberately
   small page cap. Check staging database advisors and runtime logs before approval.
4. After human production approval, apply the migration **before** deploying either importer.
   Retain existing `raw_release` rows as a baseline before a broad refresh if pre-rollout
   catalog state needs to be preserved; that is a separate, bounded, approved backfill using
   the same canonical hashing helper. Existing versions overwritten before this rollout
   cannot be reconstructed from this database alone.
5. Deploy both importers, observe normal scheduled runs and archive growth, then decide
   whether a limited historical reconciliation is warranted. There is no automatic history
   backfill in this migration. Manual very large backfills still have the app's runtime limit.
6. Rollback: revert importer code and leave the additive archive/RPC in place. Do not drop
   retained data as part of rollback. The existing older importer still has its prior
   nontransactional document behavior; use rollback only to address a verified regression.

## Validation

`npm test` exercises real PostgreSQL behavior through development-only PGlite, including
RLS, duplicate snapshots, transactional failure, existing download metadata and superseded
captures. It also tests the shared HTTP/pagination/hash helpers. This is not a claim of
end-to-end validation against a deployed staging Supabase instance.

Required checks: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
and `deno check --config supabase/functions/deno.json --no-lock supabase/functions/sync-tenders/index.ts`.
No production write, sync invocation, migration or backfill is part of these checks.
