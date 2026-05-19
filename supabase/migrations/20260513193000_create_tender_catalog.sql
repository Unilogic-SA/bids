create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;

create table if not exists app_private.sync_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_private.sync_settings enable row level security;

drop policy if exists "No direct sync settings access" on app_private.sync_settings;
create policy "No direct sync settings access"
on app_private.sync_settings
for all
to public
using (false)
with check (false);

create or replace function app_private.has_valid_sync_secret()
returns boolean
language sql
stable
security definer
set search_path = app_private, public
as $$
  select exists (
    select 1
    from app_private.sync_settings
    where key = 'etenders_sync_secret'
      and value = coalesce(
        current_setting('request.headers', true)::jsonb ->> 'x-sync-secret',
        ''
      )
      and value <> ''
  );
$$;

revoke all on function app_private.has_valid_sync_secret() from public;
grant usage on schema app_private to anon, authenticated, service_role;
grant execute on function app_private.has_valid_sync_secret() to anon, authenticated, service_role;

create table if not exists public.tenders (
  ocid text primary key,
  release_id text not null,
  source_site text not null default 'eTenders',
  source_listing_url text,
  detail_url text,
  detail_path text,
  listing_type text,
  is_new boolean not null default false,
  tender_source_id text,
  tender_no text not null,
  tender_type text,
  department text,
  buyer_name text,
  title text,
  title_snippet text,
  bid_description text,
  province text,
  industry text,
  procurement_category text,
  procurement_method text,
  procurement_method_details text,
  views_count integer,
  header_timestamp timestamptz,
  published_at timestamptz,
  opening_at timestamptz,
  closing_at timestamptz,
  modified_at timestamptz,
  status text,
  derived_status text not null default 'open',
  imported_at timestamptz,
  original_source_url text,
  source_label text,
  place_raw text,
  address_line text,
  suburb_or_area text,
  city text,
  postal_code text,
  delivery_location_confidence numeric(3, 2),
  contact_person text,
  contact_email text,
  contact_tel text,
  contact_role text,
  contact_raw text,
  briefing_session boolean,
  compulsory_briefing boolean,
  briefing_datetime timestamptz,
  briefing_venue text,
  briefing_raw text,
  special_conditions text,
  has_special_conditions boolean not null default false,
  eligibility_notes text,
  documents_count integer not null default 0,
  raw_release jsonb not null default '{}'::jsonb,
  raw_tender jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(tender_no, '') || ' ' ||
      coalesce(title, '') || ' ' ||
      coalesce(bid_description, '') || ' ' ||
      coalesce(buyer_name, '') || ' ' ||
      coalesce(department, '') || ' ' ||
      coalesce(province, '') || ' ' ||
      coalesce(industry, '')
    )
  ) stored,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  tender_ocid text not null references public.tenders(ocid) on delete cascade,
  tender_no text,
  detail_url text,
  document_index integer not null,
  document_title text,
  document_url text not null,
  file_name text,
  file_extension text,
  file_size_text text,
  file_size_kb numeric,
  document_source text,
  date_published timestamptz,
  date_modified timestamptz,
  downloaded_at timestamptz,
  document_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tender_ocid, document_url)
);

create table if not exists public.tender_sync_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  status text not null,
  date_from date,
  date_to date,
  page_size integer,
  fetched_count integer not null default 0,
  open_count integer not null default 0,
  upserted_tender_count integer not null default 0,
  upserted_document_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  message text,
  raw_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tenders_search_vector_idx on public.tenders using gin (search_vector);
create index if not exists tenders_closing_at_idx on public.tenders (closing_at);
create index if not exists tenders_published_at_idx on public.tenders (published_at desc);
create index if not exists tenders_tender_no_idx on public.tenders (tender_no);
create index if not exists tenders_province_idx on public.tenders (province);
create index if not exists tenders_buyer_name_idx on public.tenders (buyer_name);
create index if not exists tenders_industry_idx on public.tenders (industry);
create index if not exists tenders_status_idx on public.tenders (status);
create index if not exists tenders_derived_status_idx on public.tenders (derived_status);
create index if not exists tender_documents_tender_ocid_idx on public.tender_documents (tender_ocid);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenders_set_updated_at on public.tenders;
create trigger tenders_set_updated_at
before update on public.tenders
for each row execute function public.set_updated_at();

drop trigger if exists tender_documents_set_updated_at on public.tender_documents;
create trigger tender_documents_set_updated_at
before update on public.tender_documents
for each row execute function public.set_updated_at();

alter table public.tenders enable row level security;
alter table public.tender_documents enable row level security;
alter table public.tender_sync_runs enable row level security;

drop policy if exists "Public tenders are readable" on public.tenders;
create policy "Public tenders are readable"
on public.tenders
for select
to anon, authenticated
using (true);

drop policy if exists "Sync can insert tenders" on public.tenders;
create policy "Sync can insert tenders"
on public.tenders
for insert
to anon, authenticated
with check (
  app_private.has_valid_sync_secret()
);

drop policy if exists "Sync can update tenders" on public.tenders;
create policy "Sync can update tenders"
on public.tenders
for update
to anon, authenticated
using (
  app_private.has_valid_sync_secret()
)
with check (
  app_private.has_valid_sync_secret()
);

drop policy if exists "Public tender documents are readable" on public.tender_documents;
create policy "Public tender documents are readable"
on public.tender_documents
for select
to anon, authenticated
using (true);

drop policy if exists "Sync can insert tender documents" on public.tender_documents;
create policy "Sync can insert tender documents"
on public.tender_documents
for insert
to anon, authenticated
with check (
  app_private.has_valid_sync_secret()
);

drop policy if exists "Sync can update tender documents" on public.tender_documents;
create policy "Sync can update tender documents"
on public.tender_documents
for update
to anon, authenticated
using (
  app_private.has_valid_sync_secret()
)
with check (
  app_private.has_valid_sync_secret()
);

drop policy if exists "Public sync runs are readable" on public.tender_sync_runs;
create policy "Public sync runs are readable"
on public.tender_sync_runs
for select
to anon, authenticated
using (true);

drop policy if exists "Sync can insert sync runs" on public.tender_sync_runs;
create policy "Sync can insert sync runs"
on public.tender_sync_runs
for insert
to anon, authenticated
with check (
  app_private.has_valid_sync_secret()
);

drop policy if exists "Sync can update sync runs" on public.tender_sync_runs;
create policy "Sync can update sync runs"
on public.tender_sync_runs
for update
to anon, authenticated
using (
  app_private.has_valid_sync_secret()
)
with check (
  app_private.has_valid_sync_secret()
);

grant select on table public.tenders to anon, authenticated;
grant select on table public.tender_documents to anon, authenticated;
grant select on table public.tender_sync_runs to anon, authenticated;

grant insert, update on table public.tenders to anon, authenticated;
grant insert, update on table public.tender_documents to anon, authenticated;
grant insert, update on table public.tender_sync_runs to anon, authenticated;

grant all on table public.tenders to service_role;
grant all on table public.tender_documents to service_role;
grant all on table public.tender_sync_runs to service_role;
