-- Additive rollout: apply to staging, validate, then deploy both importers.
-- No production backfill or cron invocation is performed by this migration.
create table public.tender_source_snapshots (
  id bigint generated always as identity primary key,
  tender_ocid text not null,
  source text not null check (source in ('ocds', 'portal')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  source_url text not null,
  package_metadata jsonb not null default '{}'::jsonb,
  sync_run_id uuid references public.tender_sync_runs(id) on delete set null,
  captured_at timestamptz not null,
  unique (tender_ocid, source, content_hash)
);
create index tender_source_snapshots_history_idx
  on public.tender_source_snapshots (tender_ocid, captured_at desc);
alter table public.tender_source_snapshots enable row level security;
-- Raw portal payloads include fields outside the public catalog. Never expose them publicly.
revoke all on public.tender_source_snapshots from anon, authenticated;
grant select, insert on public.tender_source_snapshots to anon, authenticated;
grant usage on sequence public.tender_source_snapshots_id_seq to anon, authenticated, service_role;
grant all on public.tender_source_snapshots to service_role;
create policy "Sync can read source snapshots" on public.tender_source_snapshots
  for select to anon, authenticated using ((select app_private.has_valid_sync_secret()));
create policy "Sync can archive source snapshots" on public.tender_source_snapshots
  for insert to anon, authenticated with check ((select app_private.has_valid_sync_secret()));

-- A slower, older invocation must not replace a catalog row captured by a newer run.
create function public.keep_newer_tender_capture() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.captured_at < old.captured_at then return null; end if;
  return new;
end;
$$;
revoke all on function public.keep_newer_tender_capture() from public;
create trigger tenders_keep_newer_capture before update on public.tenders
  for each row execute function public.keep_newer_tender_capture();

-- PostgREST executes each call in one transaction. Failed inserts cannot erase documents.
create function public.reconcile_tender_documents(
  p_ocids text[], p_documents jsonb, p_preserve_ocids text[], p_captured_at timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  eligible_ocids text[];
begin
  if current_user <> 'service_role' and not app_private.has_valid_sync_secret() then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_ocids is null or p_preserve_ocids is null or p_captured_at is null
     or p_documents is null or jsonb_typeof(p_documents) <> 'array' then
    raise exception 'Invalid document reconciliation input';
  end if;
  if exists (select 1 from jsonb_array_elements(p_documents) d
    where d->>'tender_ocid' is null or not (d->>'tender_ocid' = any(p_ocids))) then
    raise exception 'Document outside requested tender batch';
  end if;
  -- Lock in a consistent order and ignore invocations superseded by a newer capture.
  select coalesce(array_agg(ocid), '{}'::text[]) into eligible_ocids from (
    select ocid from public.tenders where ocid = any(p_ocids)
      and captured_at = p_captured_at order by ocid for update
  ) locked;

  insert into public.tender_documents (
    tender_ocid, tender_no, detail_url, document_index, document_title, document_url,
    file_name, file_extension, document_source, date_published, date_modified, updated_at
  ) select d.tender_ocid, d.tender_no, d.detail_url, d.document_index, d.document_title, d.document_url,
    d.file_name, d.file_extension, d.document_source, d.date_published, d.date_modified, p_captured_at
  from jsonb_populate_recordset(null::public.tender_documents, p_documents) d
  where d.tender_ocid = any(eligible_ocids)
  on conflict (tender_ocid, document_url) do update set
    tender_no = excluded.tender_no, detail_url = excluded.detail_url,
    document_index = excluded.document_index, document_title = excluded.document_title,
    file_name = excluded.file_name, file_extension = excluded.file_extension,
    document_source = excluded.document_source, date_published = excluded.date_published,
    date_modified = excluded.date_modified, updated_at = excluded.updated_at;
  -- Keep locally acquired hashes, sizes and download timestamps on surviving rows.
  delete from public.tender_documents d where d.tender_ocid = any(eligible_ocids)
    and not (d.tender_ocid = any(p_preserve_ocids))
    and not exists (select 1 from jsonb_array_elements(p_documents) incoming
      where incoming->>'tender_ocid' = d.tender_ocid and incoming->>'document_url' = d.document_url);
  update public.tenders t set documents_count = (
    select count(*) from public.tender_documents d where d.tender_ocid = t.ocid
  ) where t.ocid = any(eligible_ocids);
end;
$$;
revoke all on function public.reconcile_tender_documents(text[], jsonb, text[], timestamptz) from public;
grant execute on function public.reconcile_tender_documents(text[], jsonb, text[], timestamptz)
  to anon, authenticated, service_role;
