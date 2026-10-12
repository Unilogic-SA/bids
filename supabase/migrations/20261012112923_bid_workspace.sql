-- Private bid preparation belongs to the existing sole-owner company workspace.
-- No FK to public.tenders: private work survives expiry and catalog removal.
create schema if not exists app_private;
-- Preserve existing schema usage for catalog sync-secret policies.
grant usage on schema app_private to authenticated;

-- The only elevation in this migration: a boolean check of the caller's live
-- Auth record. Auth users are not readable by authenticated; JWT metadata is
-- neither fresh nor an authority for verification. No caller-selected ID or CRUD.
create function app_private.workspace_customer_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = (select auth.uid())
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false));
$$;
revoke all on function app_private.workspace_customer_verified() from public, anon, authenticated;
grant execute on function app_private.workspace_customer_verified() to authenticated;

create function app_private.valid_bid_checklist(items jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 50 then return false; end if;
  if exists (select 1 from jsonb_array_elements(items) x where
    jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'id') is distinct from 'string'
    or (x->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or jsonb_typeof(x->'label') is distinct from 'string'
    or char_length(x->>'label') not between 1 and 200 or x->>'label' <> btrim(x->>'label')
    or jsonb_typeof(x->'completed') is distinct from 'boolean'
    or (x ? 'kind' and x->>'kind' is distinct from 'compulsory_briefing')
    or x - array['id','label','completed','kind'] <> '{}'::jsonb) then return false; end if;
  return (select count(*) = count(distinct (x->>'id')::uuid) from jsonb_array_elements(items) x);
end;
$$;
revoke all on function app_private.valid_bid_checklist(jsonb) from public, anon, authenticated;
grant execute on function app_private.valid_bid_checklist(jsonb) to authenticated, service_role;

create table public.workspace_bids (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tender_ocid text not null check (char_length(tender_ocid) between 1 and 250 and tender_ocid ~ '^[A-Za-z0-9_-]+$'),
  stage text not null default 'saved' check (stage in ('saved','reviewing','preparing','ready','submitted')),
  outcome text check (outcome in ('won','unsuccessful','not_bidding','withdrawn')),
  notes text not null default '' check (char_length(notes) <= 10000),
  next_action text check (next_action is null or (char_length(next_action) between 1 and 200 and next_action = btrim(next_action))),
  next_action_due_at timestamptz,
  checklist jsonb not null default '[]'::jsonb check (app_private.valid_bid_checklist(checklist)),
  checklist_initialized boolean not null default false,
  submitted_at timestamptz,
  submission_reference text check (submission_reference is null or (char_length(submission_reference) between 1 and 500 and submission_reference = btrim(submission_reference))),
  tender_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(tender_snapshot) = 'object' and pg_column_size(tender_snapshot) <= 16384),
  acknowledged_closing_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (company_id, tender_ocid),
  check ((stage = 'submitted') = (submitted_at is not null)),
  check (outcome not in ('won','unsuccessful') or stage = 'submitted'),
  check (outcome <> 'not_bidding' or stage <> 'submitted')
);
create index workspace_bids_company_state_stage on public.workspace_bids(company_id, archived_at, stage);
alter table public.workspace_bids enable row level security;
revoke all on public.workspace_bids from public, anon, authenticated;
grant select, delete on public.workspace_bids to authenticated;
grant insert (company_id, tender_ocid) on public.workspace_bids to authenticated;
grant update (stage,outcome,notes,next_action,next_action_due_at,checklist,submitted_at,submission_reference,archived_at,acknowledged_closing_at) on public.workspace_bids to authenticated;
grant all on public.workspace_bids to service_role;

create policy workspace_owner_read on public.workspace_bids for select to authenticated using (
  (select app_private.workspace_customer_verified()) and exists (select 1 from public.companies c
    join public.company_memberships m on m.company_id = c.id where c.id = workspace_bids.company_id
    and c.owner_user_id = (select auth.uid()) and m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy workspace_owner_insert on public.workspace_bids for insert to authenticated with check (
  (select app_private.workspace_customer_verified()) and exists (select 1 from public.companies c
    join public.company_memberships m on m.company_id = c.id where c.id = workspace_bids.company_id
    and c.owner_user_id = (select auth.uid()) and m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy workspace_owner_update on public.workspace_bids for update to authenticated using (
  (select app_private.workspace_customer_verified()) and exists (select 1 from public.companies c
    join public.company_memberships m on m.company_id = c.id where c.id = workspace_bids.company_id
    and c.owner_user_id = (select auth.uid()) and m.user_id = (select auth.uid()) and m.role = 'owner')) with check (
  (select app_private.workspace_customer_verified()) and exists (select 1 from public.companies c
    join public.company_memberships m on m.company_id = c.id where c.id = workspace_bids.company_id
    and c.owner_user_id = (select auth.uid()) and m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy workspace_owner_delete on public.workspace_bids for delete to authenticated using (
  (select app_private.workspace_customer_verified()) and exists (select 1 from public.companies c
    join public.company_memberships m on m.company_id = c.id where c.id = workspace_bids.company_id
    and c.owner_user_id = (select auth.uid()) and m.user_id = (select auth.uid()) and m.role = 'owner'));

create function app_private.guard_workspace_bid() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare t public.tenders%rowtype; item_label text; generated jsonb := '[]'::jsonb;
begin
  if tg_op = 'INSERT' then
    select * into t from public.tenders where ocid = new.tender_ocid;
    if not found then raise exception 'Tender unavailable' using errcode = 'P0002'; end if;
    new.tender_snapshot := jsonb_build_object('ocid', t.ocid, 'tender_no', left(t.tender_no,250),
      'title',left(coalesce(t.title,t.title_snippet,t.bid_description),2000),'buyer_name',left(coalesce(t.buyer_name,t.department),500),
      'closing_at',t.closing_at,'briefing_datetime',t.briefing_datetime,'compulsory_briefing',t.compulsory_briefing,
      'detail_path',t.detail_path,'source_url',left(coalesce(t.original_source_url,t.detail_url,t.source_listing_url),2000));
    new.acknowledged_closing_at := t.closing_at;
  else
    if new.id <> old.id or new.company_id <> old.company_id or new.tender_ocid <> old.tender_ocid or new.tender_snapshot <> old.tender_snapshot
      or new.created_at <> old.created_at then raise exception 'Workspace identity is immutable'; end if;
    new.version := old.version + 1;
    new.updated_at := now();
    -- An acknowledgement can only adopt the current catalog deadline.
    if new.acknowledged_closing_at is distinct from old.acknowledged_closing_at then
      select * into t from public.tenders where ocid = new.tender_ocid;
      if not found or new.acknowledged_closing_at is distinct from t.closing_at then raise exception 'Invalid deadline acknowledgement'; end if;
    end if;
    new.checklist_initialized := old.checklist_initialized;
    if not old.checklist_initialized and (jsonb_array_length(new.checklist) > 0 or new.stage = 'preparing') then
      new.checklist_initialized := true;
      if jsonb_array_length(new.checklist) = 0 then
        foreach item_label in array array['Review tender requirements','Confirm eligibility','Obtain pricing and complete response','Collect supporting documents','Review the complete submission','Submit and retain confirmation'] loop
          generated := generated || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label',item_label,'completed',false));
        end loop;
        select * into t from public.tenders where ocid = new.tender_ocid;
        if coalesce(t.compulsory_briefing,(new.tender_snapshot->>'compulsory_briefing')::boolean,false) then
          generated := generated || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','Attend compulsory briefing','completed',false,'kind','compulsory_briefing'));
        end if;
        new.checklist := generated;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_workspace_bid() from public, anon, authenticated;
create trigger workspace_bid_guard before insert or update on public.workspace_bids for each row execute function app_private.guard_workspace_bid();

create function public.save_workspace_bid(p_ocid text) returns public.workspace_bids
language plpgsql security invoker set search_path = '' as $$
declare c uuid; result public.workspace_bids;
begin
  if not app_private.workspace_customer_verified() then raise exception 'Verified account required' using errcode = '42501'; end if;
  select m.company_id into strict c from public.company_memberships m join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid() and m.role = 'owner' and c.owner_user_id = auth.uid();
  select * into result from public.workspace_bids where company_id = c and tender_ocid = p_ocid;
  if found then return result; end if;
  insert into public.workspace_bids(company_id,tender_ocid) values (c,p_ocid) on conflict (company_id,tender_ocid) do nothing;
  select * into strict result from public.workspace_bids where company_id = c and tender_ocid = p_ocid;
  return result;
end;
$$;

create function public.import_workspace_bids(p_ocids text[]) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare ref text; c uuid; result jsonb := '[]'::jsonb; existed boolean; row public.workspace_bids;
begin
  if p_ocids is null or cardinality(p_ocids) not between 1 and 50 then raise exception 'Invalid import size'; end if;
  select m.company_id into strict c from public.company_memberships m join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid() and m.role = 'owner' and c.owner_user_id = auth.uid();
  if not app_private.workspace_customer_verified() then raise exception 'Verified account required' using errcode = '42501'; end if;
  foreach ref in array p_ocids loop
    if ref is null or char_length(ref) not between 1 and 250 or ref !~ '^[A-Za-z0-9_-]+$' then raise exception 'Invalid reference'; end if;
    select exists(select 1 from public.workspace_bids where company_id = c and tender_ocid = ref) into existed;
    if not existed and not exists(select 1 from public.tenders where ocid = ref) then
      result := result || jsonb_build_array(jsonb_build_object('ocid',ref,'status','unavailable'));
    else
      row := public.save_workspace_bid(ref);
      result := result || jsonb_build_array(jsonb_build_object('ocid',ref,'status',case when existed then 'already_exists' else 'inserted' end));
    end if;
  end loop;
  return result;
end;
$$;

create function public.update_workspace_bid(p_id uuid, p_version integer, p_patch jsonb) returns public.workspace_bids
language plpgsql security invoker set search_path = '' as $$
declare result public.workspace_bids; changed_deadline timestamptz;
begin
  if jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb or p_patch - array['stage','outcome','notes','next_action','next_action_due_at','checklist','submitted_at','submission_reference','archive','acknowledge_deadline'] <> '{}'::jsonb then raise exception 'Invalid update'; end if;
  if p_patch ? 'acknowledge_deadline' then
    select t.closing_at into changed_deadline from public.workspace_bids b join public.tenders t on t.ocid=b.tender_ocid where b.id=p_id;
    if not found then raise exception 'Tender unavailable' using errcode='P0002'; end if;
  end if;
  update public.workspace_bids b set
    stage = case when p_patch ? 'stage' then p_patch->>'stage' else b.stage end,
    outcome = case when p_patch ? 'outcome' then p_patch->>'outcome' else b.outcome end,
    notes = case when p_patch ? 'notes' then p_patch->>'notes' else b.notes end,
    next_action = case when p_patch ? 'next_action' then nullif(btrim(p_patch->>'next_action'),'') else b.next_action end,
    next_action_due_at = case when p_patch ? 'next_action_due_at' then (p_patch->>'next_action_due_at')::timestamptz else b.next_action_due_at end,
    checklist = case when p_patch ? 'checklist' then p_patch->'checklist' else b.checklist end,
    submitted_at = case when p_patch ? 'stage' and p_patch->>'stage' <> 'submitted' then null when p_patch ? 'submitted_at' then (p_patch->>'submitted_at')::timestamptz else b.submitted_at end,
    submission_reference = case when p_patch ? 'stage' and p_patch->>'stage' <> 'submitted' then null when p_patch ? 'submission_reference' then nullif(btrim(p_patch->>'submission_reference'),'') else b.submission_reference end,
    archived_at = case when p_patch ? 'archive' then case when (p_patch->>'archive')::boolean then now() else null end else b.archived_at end,
    acknowledged_closing_at = case when coalesce((p_patch->>'acknowledge_deadline')::boolean,false) then changed_deadline else b.acknowledged_closing_at end
  where b.id = p_id and b.version = p_version returning b.* into result;
  if not found then raise exception 'Workspace changed or unavailable' using errcode = '40001'; end if;
  return result;
end;
$$;
create function public.delete_workspace_bid(p_id uuid,p_version integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.workspace_bids where id=p_id and version=p_version;
  if not found then raise exception 'Workspace changed or unavailable' using errcode='40001'; end if;
  return true;
end;
$$;

-- A single batch join serves closed, cancelled and missing catalog records.
create view public.workspace_bid_entries with (security_invoker = true) as
select b.*, (t.ocid is not null) as source_available,
  case when t.ocid is null then b.tender_snapshot else jsonb_build_object(
    'ocid',t.ocid,'tender_no',t.tender_no,'title',coalesce(t.title,t.title_snippet,t.bid_description),
    'buyer_name',coalesce(t.buyer_name,t.department),'closing_at',t.closing_at,
    'briefing_datetime',t.briefing_datetime,'compulsory_briefing',t.compulsory_briefing,
    'detail_path',t.detail_path,'source_url',coalesce(t.original_source_url,t.detail_url,t.source_listing_url),'derived_status',t.derived_status) end as tender
from public.workspace_bids b left join public.tenders t on t.ocid=b.tender_ocid;
revoke all on public.workspace_bid_entries from public,anon,authenticated;
grant select on public.workspace_bid_entries to authenticated;

create function public.list_workspace_bids(p_q text default '',p_state text default 'active',p_stage text default 'all',p_week boolean default false,p_view text default 'list',p_page integer default 1,p_offsets jsonb default '{}'::jsonb) returns jsonb
language sql stable security invoker set search_path = '' as $$
with filtered as (
  select e.* from public.workspace_bid_entries e where
    case p_state when 'archived' then e.archived_at is not null when 'completed' then e.archived_at is null and e.outcome is not null else e.archived_at is null and e.outcome is null end
    and (p_stage = 'all' or e.stage=p_stage)
    and (coalesce(p_q,'')='' or concat_ws(' ',e.tender->>'title',e.tender->>'buyer_name',e.tender->>'tender_no',e.next_action) ilike '%' || replace(replace(replace(left(p_q,200),'\','\\'),'%','\%'),'_','\_') || '%')
    and (not p_week or ((e.tender->>'closing_at')::timestamptz >= now() and (e.tender->>'closing_at')::timestamptz < ((date_trunc('week',now() at time zone 'Africa/Johannesburg') + interval '1 week') at time zone 'Africa/Johannesburg')))
), ranked as (
  select f.*, row_number() over (partition by case when p_view='board' and p_state='active' then f.stage else '' end order by
    case when p_state in ('completed','archived') then f.updated_at end desc,
    case when p_state='active' then (f.tender->>'closing_at')::timestamptz end asc nulls last, f.id) as rn from filtered f
), selected as (
 select r.* from ranked r where case when p_view='board' and p_state='active' then
   rn > greatest(0,least(coalesce((p_offsets->>r.stage)::int,0),100000)) and rn <= greatest(0,least(coalesce((p_offsets->>r.stage)::int,0),100000))+30
 else rn > (greatest(1,least(p_page,2000))-1)*50 and rn <= greatest(1,least(p_page,2000))*50 end
)
select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(s)-'rn' order by case when p_view='board' and p_state='active' then s.stage else '' end,s.rn) from selected s),'[]'::jsonb),
  'total',(select count(*) from filtered), 'counts', jsonb_build_object('saved',(select count(*) from filtered where stage='saved'),
  'reviewing',(select count(*) from filtered where stage='reviewing'),'preparing',(select count(*) from filtered where stage='preparing'),
  'ready',(select count(*) from filtered where stage='ready'),'submitted',(select count(*) from filtered where stage='submitted')));
$$;

revoke all on function public.save_workspace_bid(text),public.import_workspace_bids(text[]),public.update_workspace_bid(uuid,integer,jsonb),public.delete_workspace_bid(uuid,integer),public.list_workspace_bids(text,text,text,boolean,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_workspace_bid(text),public.import_workspace_bids(text[]),public.update_workspace_bid(uuid,integer,jsonb),public.delete_workspace_bid(uuid,integer),public.list_workspace_bids(text,text,text,boolean,text,integer,jsonb) to authenticated;
