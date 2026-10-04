# Tender ingestion incident — 4 October 2026

Issue: #35. Based on production reads, source HTTP probes and recovery runs.

## Cause

The OCDS endpoint and its Swagger contract returned HTTP 404, including for historical windows known to contain releases. The Supabase database was available and its two cron schedules were active. Recent ingestion never reached new catalog writes. At investigation start there were 16,834 stored tenders and 1,132 available open tenders. The newest publication was 28 September, while the latest completed job (2 October) refreshed an older September window. Existing tenders continued reaching their deadlines. This was failed replenishment, rather than evidence of catalog deletion.

The independent official eTenders portal returned 2,121 active records, including a 4 October publication. A first recovery attempt hit a database statement timeout after 1,000 catalog upserts (844 new tenders). Catalog batch size is therefore reduced from 500 to 50 and document reconciliation from 100 to 25. A subsequent run wrote all 2,121 catalog records and reconciled documents, but its unbounded expired-status update timed out. Expiry housekeeping is now bounded to 25 identities per statement (with a deadline recheck for concurrent extensions) and resumes next run if its cap is reached. No database timeout limit or authorization was weakened.

## Repair

Both importers use the active portal when OCDS fails. Portal payloads are archived as portal snapshots; adapted fields update the catalog under the existing OCDS identity. Original OCDS payloads and release IDs remain intact, optional absent portal fields preserve prior values, and known documents are retained. Portal timestamps without an offset use SAST. Historical backfills still fail if OCDS is unavailable, since an active list cannot provide complete history. Every fallback run explicitly records active-only coverage and source warnings.

Interrupted runs older than ten minutes are labelled abandoned on the next invocation, with a message that partial writes may exist. Fetch and catalog write counts are recorded before completion; failures name their phase. There is no new cron schedule or schema migration.

Listings and sitemap include closing_today alongside open, subject to the actual deadline. Stale saved listing pages recover to page one while preserving filters. Admin separates the full catalog, open now, past deadline, additions in 24 hours and upcoming deadlines; exposes source warnings and stalled runs; uses an unstacked activity chart and explains that processed records are not newly created tenders. Failed reads show unknown counts rather than zero.

The test command now runs both top-level and nested test files directly through Node with tsx imports; the former shell glob skipped nested ingestion tests and tsx CLI IPC was blocked in this execution environment.

## Deployment and rollback

The owner explicitly requested incident repair and recovery. Deploy the Edge Function with all shared files and an explicit relative deno.json import-map path; preserve verify_jwt=false because the deployed function already uses the existing sync secret and database RLS for authentication. Invoke the existing endpoint using the secret directly from Vault; never print or move that secret into CI or Preview. Verify completion, active portal coverage, counts and document consistency.

App changes are prepared on codex/35-restore-tender-ingestion. Repository instructions require explicit owner approval before merging the current change. Vercel Git integration deploys main. Vercel environment metadata access returned 403, so credential configuration could not be audited. No production secrets were moved into Preview.

Rollback the importer code to the previous revision while retaining source snapshots and catalog records. This restores the previous OCDS-only behavior and therefore does not cure the upstream outage. Do not delete recovered tenders or archives during rollback.

## Validation

- npm ci, lint, typecheck and production build.
- 43 application/ingestion regression tests and 8 repository automation tests.
- All 2,121 fetched live portal payloads pass the adapter validation.
- Deno check passes on a temporary copy using Deno built-ins and installed, matching Supabase 2.105.4 type declarations. The canonical network-based check could not download its unchanged JSR runtime declaration; the Supabase deployment service also validates bundling.
- Deployed recovery evidence recorded below after final verification.

## Production recovery verified

Edge Function version 12 completed recovery run `6057b7be-7be4-4318-b1d4-20de986780a9` at 18:17:11 UTC (20:17 SAST) in 53 seconds. It fetched/upserted 2,121 active portal tenders, reconciled 7,292 document records and updated 198 expired statuses in bounded batches. Catalog totals: 17,757 stored, 2,134 open now, 923 new tenders recovered. All 2,121 portal identities matched catalog records; none missing; zero document-count mismatches across the catalog. Original archived OCDS snapshots are retained. Thirteen additional older open catalog records remain awaiting source re-verification; absence from the active portal alone is not used to cancel/delete them. Coverage remains explicitly degraded while OCDS is down.

## Review hardening

The merge gate surfaced a valid review finding: absent portal flags and delivery values could become false/zero mapper defaults and replace richer existing enrichment. Both importers now pass the original portal payload to the shared preservation helper. It preserves briefing flags, special-condition fields and the entire delivery group when their underlying source value is absent or blank, honors explicit false and supplied values, and rebuilds briefing text from the effective fields. Three regression tests cover absent/null/blank enrichment, explicit false and new values, and partially supplied flags.
