# Public Tender Board

Next.js MVP for public tender listing and tender detail pages. The UI is built with official `shadcn/ui` components and tender data is served from Supabase.

## Supabase Setup

1. Create or select the Supabase project for this app.
2. Apply `supabase/migrations/20260513193000_create_tender_catalog.sql`.
3. Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ETENDERS_SYNC_SECRET=
```

The migration enables RLS on all public tables and grants public read-only access to tender listings, documents, and sync status.

## Initial Sync

Run a backfill after the env vars are set and the app is running:

```bash
curl -X POST "http://localhost:3000/api/sync?secret=$ETENDERS_SYNC_SECRET&mode=backfill&months=36&pageSize=20000"
```

Daily refresh:

```bash
curl -X POST "http://localhost:3000/api/sync?secret=$ETENDERS_SYNC_SECRET&mode=daily&days=14&pageSize=20000"
```

## Automatic Refresh

The production data path is Supabase-native:

1. `sync-tenders` Edge Function supports both a rolling recent refresh and explicit date-range refreshes against the OCDS API, and refreshes every release in each covered window so early closures are reflected too.
2. Supabase Cron keeps production data fresh with two jobs:
   - `sync-tenders-recent-refresh` runs every 6 hours and refreshes yesterday through today so the public listing has a current successful sync.
   - `sync-tenders-open-horizon-rotating` runs every 30 minutes and reconciles one 2-day window at a time from the oldest still-open tender through today, avoiding the timeout-prone morning fan-out.
3. The listing page reads the last successful sync from Supabase and shows a stale-data warning when the latest successful run is older than 26 hours or the latest run failed.

The manual `/api/sync` route is still useful for one-off backfills and recovery runs.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.
