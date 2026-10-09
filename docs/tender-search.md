# Public tender search

Both the Discover filter form and the signed-in header submit a GET request to
Discover. The header retains region, buyer, industry, tender type and explicitly
selected sort, and starts at page one. On a tender detail page it restores these
values from the validated listing return link. Unrelated account URLs do not
supply search filters.

`getTenderListing` is the shared server entry point. Keyword searches call
`search_open_tenders`; only PostgREST's missing-function error (`PGRST202`)
falls back to the existing public substring search. Permission and operational
errors remain visible. Without an explicit sort, keywords use relevance and
unfiltered listings use closing soonest.

## Weighted-search activation

The already-merged weighted-search migration had not been applied to the live
database. It was applied on 9 October 2026, using bounded lock/statement timeouts
and a PostgREST schema reload. Keep the already-published filename
`20261004120000_add_weighted_tender_search.sql` and its SQL unchanged so databases
that applied it earlier retain compatible migration histories.

The live application initially recorded this activation as `20261009094557`.
That single history record was reconciled to `20261004120000` on 9 October 2026,
preserving its recorded SQL and name. This was a history-only correction: no
schema SQL was replayed and neither of the later search corrections was reverted.
Do not apply the weighted-search SQL again to that database as a new migration.
Other environments that already record `20261004120000` need no repair for this
change. Check `supabase migration list` before deploying migrations; reconcile
history only after verifying the corresponding schema change is already present.

The generated search vector gives highest weight to tender numbers and titles,
then buyers/departments/types, then classification/location fields, and finally
descriptions and eligibility information. The existing full-text index remains;
the weighted vector has its own valid GIN index. The RPC uses invoker rights,
respects tender RLS, and permits execution by anonymous and authenticated readers.

Live verification confirmed every vector was populated, anonymous callers could
search, and combined filters worked. At the time of verification, `software
development` returned one open tender in the production browser, `laptops`
returned eleven, and `software` narrowed from twenty-three to six when filtered
to Gauteng. Counts change as the catalog and deadlines change.

## Review

The follow-up `20261009103133_prioritize_tender_display_subject.sql` corrects
ranking for the portal's real field mapping. Its source `title` frequently holds
the tender number; Discover displays `bid_description`, then `title_snippet`,
then `title`. Relevance sorting therefore puts exact tender references first,
then matches in that displayed subject, ordered by length-normalized subject
score, then the existing weighted score and stable tie-breakers. Repeated
document-download instructions cannot outrank a displayed-subject match.
Explicit date sorting still takes precedence. Matching, counts, the GIN index,
RLS and grants stay unchanged; this is a function-only migration.

This function-only correction was applied on 9 October 2026 with bounded
lock/statement timeouts. Supabase recorded version `20261009103133`. The live
app and ordinary Preview share this public search database, so both use the
corrected ranking. No frontend changes were merged. Live anonymous RPC and
production browser checks confirmed the four website-specific tenders appeared
first; the full count remained 108 and explicit date sorting still worked.

Search navigation, weighted matching, explicit sorts, pagination, RLS and the
missing-RPC fallback are covered by the normal test suite. Header visibility,
button variants and submitted form fields are additionally checked with isolated
render fixtures. These fixtures do not constitute a real sign-in test.

An ordinary Preview without isolated customer-auth configuration can show the
public header and live Discover search, but cannot show the signed-in header.
Do not copy production privileged credentials into Preview or bypass auth to
make that surface reviewable. Use the configured isolated auth environment for
authenticated browser review.

## Keyword eligibility

`20261009110714_exclude_tender_instruction_matches.sql` adds the indexed
`search_vector_v3` and switches the RPC to it. Searchable content comprises
references, source titles, buyers/departments, type/category/location metadata
and the tender description (falling back to its snippet). Special conditions
and eligibility notes do not qualify or exclude a tender through keyword
queries. They remain available in the tender details.

This changes result eligibility and counts, not just ranking. The existing
vectors and indexes are retained. The migration was applied on 9 October 2026
with bounded lock/statement timeouts; Supabase recorded version `20261009110714`.
Anonymous RPC and browser checks confirmed `website` decreased from 108 matches
to five, excluding the unrelated construction tenders under any sort. Four
are website tenders; the remaining server tender mentions website in its main
description rather than its conditions. This is lexical search across the
listed fields, rather than a semantic classification of procurement topics.

Regression tests cover conditions-only and eligibility-only matches, negative
keywords, counts, pagination, every explicit sort, and genuine construction
metadata matches. No construction category is globally excluded.
