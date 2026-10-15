-- Shared workspaces: additive data model, live membership access, explicit scope.
-- No bids, profiles, companies or memberships are moved or deleted.
do $$ begin
  if exists(select 1 from public.company_memberships m join public.companies c on c.id=m.company_id
    where m.role <> 'owner' or m.user_id <> c.owner_user_id)
    or exists(select 1 from public.companies c where not exists(select 1 from public.company_memberships m where m.company_id=c.id and m.user_id=c.owner_user_id and m.role='owner')) then
    raise exception 'Existing ownership invariants require review';
  end if;
end $$;
alter table public.companies drop constraint companies_owner_user_id_fkey;
alter table public.companies add constraint companies_owner_user_id_fkey foreign key(owner_user_id) references auth.users(id) on delete restrict;
alter table public.companies add column invite_send_window_started_at timestamptz, add column invite_send_count integer not null default 0 check(invite_send_count>=0);
-- Keep operational sending counters out of customer projections.
revoke select on public.companies from authenticated;
grant select(id,owner_user_id,name,created_at,updated_at) on public.companies to authenticated;
alter table public.company_memberships drop constraint company_memberships_user_id_key;
alter table public.company_memberships drop constraint company_memberships_role_check;
alter table public.company_memberships alter column role set default 'member';
alter table public.company_memberships add constraint company_memberships_role_check check(role in ('owner','member'));
create index company_memberships_user on public.company_memberships(user_id,created_at,company_id);
create unique index company_memberships_one_owner on public.company_memberships(company_id) where role='owner';

-- Deferred constraints check the final transaction, allowing atomic bootstrap.
-- This trigger is private and must see both tables regardless of caller RLS.
create function app_private.check_company_owner() returns trigger
language plpgsql security definer set search_path='' as $$
declare c uuid; old_company uuid;
begin
  if tg_table_name='companies' then c:=coalesce(new.id,old.id); else c:=coalesce(new.company_id,old.company_id); end if;
  if exists(select 1 from public.companies x where x.id=c and (
    not exists(select 1 from public.company_memberships m where m.company_id=x.id and m.user_id=x.owner_user_id and m.role='owner')
    or exists(select 1 from public.company_memberships m where m.company_id=x.id and ((m.role='owner') is distinct from (m.user_id=x.owner_user_id))))) then
    raise exception 'Workspace must retain its owner';
  end if;
  if tg_table_name='company_memberships' then
   if tg_op='UPDATE' and old.company_id is distinct from new.company_id then
    old_company:=old.company_id;
    if exists(select 1 from public.companies x where x.id=old_company and not exists(select 1 from public.company_memberships m where m.company_id=x.id and m.user_id=x.owner_user_id and m.role='owner')) then raise exception 'Workspace must retain its owner'; end if;
  end if;
   end if;
  return null;
end $$;
revoke all on function app_private.check_company_owner() from public,anon,authenticated,service_role;
create constraint trigger company_owner_membership after insert or update or delete on public.company_memberships deferrable initially deferred for each row execute function app_private.check_company_owner();
create constraint trigger company_owner_identity after insert or update on public.companies deferrable initially deferred for each row execute function app_private.check_company_owner();

-- Narrow live Auth projection, callable only by trusted service operations.
create function app_private.verified_workspace_email(p_user_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select lower(btrim(u.email)) from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
$$;
revoke all on function app_private.verified_workspace_email(uuid) from public,anon,authenticated;
grant usage on schema app_private to service_role;
grant execute on function app_private.verified_workspace_email(uuid) to service_role;

create function app_private.workspace_account_email(p_user_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select lower(btrim(u.email)) from auth.users u where u.id=p_user_id;
$$;
revoke all on function app_private.workspace_account_email(uuid) from public,anon,authenticated;
grant execute on function app_private.workspace_account_email(uuid) to service_role;

create or replace function public.bootstrap_customer_workspace(p_user_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare c uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,49));
  if app_private.verified_workspace_email(p_user_id) is null then raise exception 'Verified account required' using errcode='42501'; end if;
  insert into public.profiles(user_id) values(p_user_id) on conflict(user_id) do nothing;
  insert into public.companies(owner_user_id) values(p_user_id) on conflict(owner_user_id) do nothing;
  select id into strict c from public.companies where owner_user_id=p_user_id;
  insert into public.company_memberships(company_id,user_id,role) values(c,p_user_id,'owner') on conflict(company_id,user_id) do nothing;
  if not exists(select 1 from public.company_memberships where company_id=c and user_id=p_user_id and role='owner') then raise exception 'Workspace owner conflict'; end if;
  return c;
end $$;
revoke all on function public.bootstrap_customer_workspace(uuid) from public,anon,authenticated;
grant execute on function public.bootstrap_customer_workspace(uuid) to service_role;

drop policy workspace_owner_read on public.workspace_bids;
drop policy workspace_owner_insert on public.workspace_bids;
drop policy workspace_owner_update on public.workspace_bids;
drop policy workspace_owner_delete on public.workspace_bids;
create policy workspace_member_select on public.workspace_bids for select to authenticated using ((select app_private.workspace_customer_verified()) and exists(select 1 from public.company_memberships m where m.company_id=workspace_bids.company_id and m.user_id=(select auth.uid()))) ;
create policy workspace_member_insert on public.workspace_bids for insert to authenticated with check ((select app_private.workspace_customer_verified()) and exists(select 1 from public.company_memberships m where m.company_id=workspace_bids.company_id and m.user_id=(select auth.uid())));
create policy workspace_member_update on public.workspace_bids for update to authenticated using ((select app_private.workspace_customer_verified()) and exists(select 1 from public.company_memberships m where m.company_id=workspace_bids.company_id and m.user_id=(select auth.uid()))) with check ((select app_private.workspace_customer_verified()) and exists(select 1 from public.company_memberships m where m.company_id=workspace_bids.company_id and m.user_id=(select auth.uid())));
create policy workspace_member_delete on public.workspace_bids for delete to authenticated using ((select app_private.workspace_customer_verified()) and exists(select 1 from public.company_memberships m where m.company_id=workspace_bids.company_id and m.user_id=(select auth.uid()))) ;

create function public.save_workspace_bid(p_company_id uuid,p_ocid text) returns public.workspace_bids
language plpgsql security invoker set search_path = '' as $$
declare c uuid; result public.workspace_bids;
begin
  if not app_private.workspace_customer_verified() then raise exception 'Verified account required' using errcode = '42501'; end if;
  c := p_company_id;
  select * into result from public.workspace_bids where company_id = c and tender_ocid = p_ocid;
  if found then return result; end if;
  insert into public.workspace_bids(company_id,tender_ocid) values (c,p_ocid) on conflict (company_id,tender_ocid) do nothing;
  select * into strict result from public.workspace_bids where company_id = c and tender_ocid = p_ocid;
  return result;
end;
$$;

create function public.import_workspace_bids(p_company_id uuid,p_ocids text[]) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare ref text; c uuid; result jsonb := '[]'::jsonb; existed boolean; row public.workspace_bids;
begin
  if p_ocids is null or cardinality(p_ocids) not between 1 and 50 then raise exception 'Invalid import size'; end if;
  c := p_company_id;
  if not app_private.workspace_customer_verified() then raise exception 'Verified account required' using errcode = '42501'; end if;
  foreach ref in array p_ocids loop
    if ref is null or char_length(ref) not between 1 and 250 or ref !~ '^[A-Za-z0-9_-]+$' then raise exception 'Invalid reference'; end if;
    select exists(select 1 from public.workspace_bids where company_id = c and tender_ocid = ref) into existed;
    if not existed and not exists(select 1 from public.tenders where ocid = ref) then
      result := result || jsonb_build_array(jsonb_build_object('ocid',ref,'status','unavailable'));
    else
      row := public.save_workspace_bid(p_company_id,ref);
      result := result || jsonb_build_array(jsonb_build_object('ocid',ref,'status',case when existed then 'already_exists' else 'inserted' end));
    end if;
  end loop;
  return result;
end;
$$;

create function public.update_workspace_bid(p_company_id uuid,p_id uuid, p_version integer, p_patch jsonb) returns public.workspace_bids
language plpgsql security invoker set search_path = '' as $$
declare result public.workspace_bids; changed_deadline timestamptz;
begin
  if jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb or p_patch - array['stage','outcome','notes','next_action','next_action_due_at','checklist','submitted_at','submission_reference','archive','acknowledge_deadline'] <> '{}'::jsonb then raise exception 'Invalid update'; end if;
  if p_patch ? 'acknowledge_deadline' then
    select t.closing_at into changed_deadline from public.workspace_bids b join public.tenders t on t.ocid=b.tender_ocid where b.company_id=p_company_id and b.id=p_id;
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
  where b.company_id=p_company_id and b.id = p_id and b.version = p_version returning b.* into result;
  if not found then raise exception 'Workspace changed or unavailable' using errcode = '40001'; end if;
  return result;
end;
$$;

create function public.delete_workspace_bid(p_company_id uuid,p_id uuid,p_version integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.workspace_bids where company_id=p_company_id and id=p_id and version=p_version;
  if not found then raise exception 'Workspace changed or unavailable' using errcode='40001'; end if;
  return true;
end;
$$;

create function public.list_workspace_bids(p_company_id uuid,p_q text default '',p_state text default 'active',p_stage text default 'all',p_week boolean default false,p_view text default 'list',p_page integer default 1,p_offsets jsonb default '{}'::jsonb) returns jsonb
language sql stable security invoker set search_path = '' as $$
with filtered as (
  select e.* from public.workspace_bid_entries e where e.company_id=p_company_id and
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

create or replace function public.save_workspace_bid(p_ocid text) returns public.workspace_bids
language sql security invoker set search_path='' as $$
  select public.save_workspace_bid((select id from public.companies where owner_user_id=auth.uid()),p_ocid);
$$;

create or replace function public.import_workspace_bids(p_ocids text[]) returns jsonb
language sql security invoker set search_path='' as $$
  select public.import_workspace_bids((select id from public.companies where owner_user_id=auth.uid()),p_ocids);
$$;

create or replace function public.update_workspace_bid(p_id uuid,p_version integer,p_patch jsonb) returns public.workspace_bids
language sql security invoker set search_path='' as $$
  select public.update_workspace_bid((select id from public.companies where owner_user_id=auth.uid()),p_id,p_version,p_patch);
$$;

create or replace function public.delete_workspace_bid(p_id uuid,p_version integer) returns boolean
language sql security invoker set search_path='' as $$
  select public.delete_workspace_bid((select id from public.companies where owner_user_id=auth.uid()),p_id,p_version);
$$;

create or replace function public.list_workspace_bids(p_q text default '',p_state text default 'active',p_stage text default 'all',p_week boolean default false,p_view text default 'list',p_page integer default 1,p_offsets jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$
  select public.list_workspace_bids((select id from public.companies where owner_user_id=auth.uid()),p_q,p_state,p_stage,p_week,p_view,p_page,p_offsets);
$$;
revoke all on function public.save_workspace_bid(uuid,text) from public,anon,authenticated;
grant execute on function public.save_workspace_bid(uuid,text) to authenticated;
revoke all on function public.import_workspace_bids(uuid,text[]) from public,anon,authenticated;
grant execute on function public.import_workspace_bids(uuid,text[]) to authenticated;
revoke all on function public.update_workspace_bid(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.update_workspace_bid(uuid,uuid,integer,jsonb) to authenticated;
revoke all on function public.delete_workspace_bid(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.delete_workspace_bid(uuid,uuid,integer) to authenticated;
revoke all on function public.list_workspace_bids(uuid,text,text,text,boolean,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.list_workspace_bids(uuid,text,text,text,boolean,text,integer,jsonb) to authenticated;

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email_normalized text not null check(email_normalized=lower(btrim(email_normalized)) and char_length(email_normalized) between 3 and 254 and email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz,revoked_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  send_version integer not null default 1 check(send_version>0),
  last_send_attempt_at timestamptz not null default now(),
  send_status text not null default 'sending' check(send_status in ('sending','sent','failed','unknown')),
  resend_email_id text,send_error_code text,
  check(accepted_at is null or revoked_at is null)
);
create unique index workspace_invitations_pending_email on public.workspace_invitations(company_id,email_normalized) where accepted_at is null and revoked_at is null;
create index workspace_invitations_company_created on public.workspace_invitations(company_id,created_at);
alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from public,anon,authenticated;
grant all on public.workspace_invitations to service_role;

-- One operational seat policy shared by reservation, acceptance and read models.
create function app_private.workspace_member_limit() returns integer
language sql immutable security invoker set search_path='' as $$ select 5 $$;
revoke all on function app_private.workspace_member_limit() from public,anon,authenticated;
grant execute on function app_private.workspace_member_limit() to service_role;

-- Every management operation takes the company lock first. No metadata/JWT roles.
create function public.read_workspace_members(p_actor_id uuid,p_company_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare owner boolean; roster jsonb; invitations jsonb; next_offset integer;
begin
  if app_private.verified_workspace_email(p_actor_id) is null or not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=p_actor_id) then raise exception 'Workspace access lost' using errcode='42501'; end if;
  select owner_user_id=p_actor_id into owner from public.companies where id=p_company_id;
  select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'role',m.role,
    'email',case when owner then app_private.verified_workspace_email(m.user_id) else null end) order by m.role desc,m.created_at,m.user_id),'[]'::jsonb)
    into roster from public.company_memberships m left join public.profiles p on p.user_id=m.user_id where m.company_id=p_company_id;
  -- Pending seats are bounded; expired invitation history uses explicit pages.
  if owner then
    select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc,x.id desc),'[]'::jsonb) into invitations from (
      select id,email_normalized as email,expires_at as "expiresAt",created_at as "createdAt",last_send_attempt_at as "lastSendAttemptAt",
        case when send_status='sending' and last_send_attempt_at < now()-interval '1 minute' then 'unknown' else send_status end as "sendStatus"
      from public.workspace_invitations where company_id=p_company_id and accepted_at is null and revoked_at is null order by created_at desc,id desc limit 26 offset greatest(0,least(coalesce(p_offset,0),100000))
    ) x;
  end if;
  if jsonb_array_length(coalesce(invitations,'[]'::jsonb))>25 then
    next_offset:=greatest(0,least(coalesce(p_offset,0),100000))+25;
    select jsonb_agg(value order by n) into invitations from jsonb_array_elements(invitations) with ordinality e(value,n) where n<=25;
  end if;
  return jsonb_build_object('members',roster,'invitations',coalesce(invitations,'[]'::jsonb),'nextOffset',next_offset,'capacity',app_private.workspace_member_limit());
end $$;

create function public.prepare_workspace_invitation(p_actor_id uuid,p_company_id uuid,p_email text,p_token_hash text,p_invitation_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.companies; inv public.workspace_invitations; normalized text:=lower(btrim(p_email)); inviter text; actor_email text; seats int;
begin
  select * into strict c from public.companies where id=p_company_id for update;
  actor_email:=app_private.verified_workspace_email(p_actor_id);
  if actor_email is null or c.owner_user_id<>p_actor_id or not exists(select 1 from public.company_memberships where company_id=c.id and user_id=p_actor_id and role='owner') then raise exception 'Only the workspace owner can invite' using errcode='42501'; end if;
  if normalized is null or char_length(normalized) not between 3 and 254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation' using errcode='22023'; end if;
  if exists(select 1 from public.company_memberships m where m.company_id=c.id and app_private.workspace_account_email(m.user_id)=normalized) then raise exception 'This person is already a member' using errcode='23505'; end if;
  if p_invitation_id is not null then
    select * into inv from public.workspace_invitations where id=p_invitation_id and company_id=c.id and accepted_at is null and revoked_at is null for update;
    if not found or inv.email_normalized<>normalized then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
  else
    select * into inv from public.workspace_invitations where company_id=c.id and email_normalized=normalized and accepted_at is null and revoked_at is null for update;
  end if;
  if inv.last_send_attempt_at > now()-interval '1 minute' then raise exception 'Wait one minute before sending again' using errcode='P0001'; end if;
  select (select count(*) from public.company_memberships where company_id=c.id)+(select count(*) from public.workspace_invitations where company_id=c.id and accepted_at is null and revoked_at is null and expires_at>now() and id is distinct from inv.id) into seats;
  if seats>=app_private.workspace_member_limit() then raise exception 'This workspace has reached its five person limit' using errcode='54000'; end if;
  if c.invite_send_window_started_at is null or c.invite_send_window_started_at<=now()-interval '1 hour' then c.invite_send_window_started_at:=now();c.invite_send_count:=0; end if;
  if c.invite_send_count>=20 then raise exception 'Hourly invitation limit reached; try later' using errcode='54000'; end if;
  update public.companies set invite_send_window_started_at=c.invite_send_window_started_at,invite_send_count=c.invite_send_count+1 where id=c.id;
  if inv.id is null then
    insert into public.workspace_invitations(company_id,email_normalized,token_hash,invited_by) values(c.id,normalized,p_token_hash,p_actor_id) returning * into inv;
  else
    update public.workspace_invitations set token_hash=p_token_hash,invited_by=p_actor_id,expires_at=now()+interval '7 days',send_version=send_version+1,last_send_attempt_at=now(),send_status='sending',resend_email_id=null,send_error_code=null,updated_at=now() where id=inv.id returning * into inv;
  end if;
  select coalesce(display_name,actor_email) into inviter from public.profiles where user_id=p_actor_id;
  return jsonb_build_object('id',inv.id,'email',inv.email_normalized,'sendVersion',inv.send_version,'workspaceName',coalesce(c.name,'Shared workspace'),'inviterName',coalesce(inviter,actor_email));
end $$;

create function public.record_workspace_invitation_send(p_id uuid,p_send_version int,p_status text,p_provider_id text default null,p_error_code text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if p_status is null or p_status not in ('sent','failed','unknown') or char_length(coalesce(p_provider_id,''))>200 or (p_error_code is not null and p_error_code not in ('transport','timeout','rejected','rate_limit','provider','configuration','status_update')) then raise exception 'Invalid send state'; end if;
  update public.workspace_invitations set send_status=p_status,resend_email_id=p_provider_id,send_error_code=p_error_code,updated_at=now() where id=p_id and send_version=p_send_version;
  return found;
end $$;

-- Token review never grants membership and exposes no roster or tender data.
create function public.review_workspace_invitation(p_id uuid,p_token_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare inv public.workspace_invitations; result jsonb;
begin
  select * into inv from public.workspace_invitations where id=p_id and token_hash=p_token_hash;
  if not found or inv.revoked_at is not null or inv.expires_at<=now() then return null; end if;
  select jsonb_build_object('id',inv.id,'workspaceName',coalesce(c.name,'Shared workspace'),'inviterName',coalesce(p.display_name,'A workspace owner'),
    'maskedEmail',left(split_part(inv.email_normalized,'@',1),1)||'…@'||split_part(inv.email_normalized,'@',2),
    'email',inv.email_normalized,'acceptedBy',inv.accepted_by,'companyId',inv.company_id)
    into result from public.companies c left join public.profiles p on p.user_id=inv.invited_by where c.id=inv.company_id;
  return result;
end $$;

create function public.accept_workspace_invitation(p_actor_id uuid,p_id uuid,p_token_hash text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare inv public.workspace_invitations; company uuid; verified_email text;
begin
  select company_id into company from public.workspace_invitations where id=p_id;
  if company is null then raise exception 'Invitation unavailable' using errcode='P0002'; end if;
  perform 1 from public.companies where id=company for update;
  select * into strict inv from public.workspace_invitations where id=p_id for update;
  verified_email:=app_private.verified_workspace_email(p_actor_id);
  if verified_email is null or verified_email<>inv.email_normalized then raise exception 'Sign in with the invited verified email' using errcode='42501'; end if;
  if inv.token_hash is distinct from p_token_hash or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invitation unavailable or expired' using errcode='P0002'; end if;
  if inv.accepted_at is not null then
    if inv.accepted_by=p_actor_id and exists(select 1 from public.company_memberships where company_id=company and user_id=p_actor_id) then return company; end if;
    raise exception 'Invitation has already been used' using errcode='P0002';
  end if;
  if not exists(select 1 from public.company_memberships where company_id=company and user_id=p_actor_id) then
    if (select count(*) from public.company_memberships where company_id=company)>=app_private.workspace_member_limit() then raise exception 'Workspace capacity reached' using errcode='54000'; end if;
    insert into public.company_memberships(company_id,user_id,role) values(company,p_actor_id,'member');
  end if;
  update public.workspace_invitations set accepted_at=now(),accepted_by=p_actor_id,updated_at=now() where id=p_id;
  return company;
end $$;

create function public.revoke_workspace_invitation(p_actor_id uuid,p_company_id uuid,p_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.companies where id=p_company_id and owner_user_id=p_actor_id for update;
  if not found or app_private.verified_workspace_email(p_actor_id) is null or not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=p_actor_id and role='owner') then raise exception 'Owner required' using errcode='42501'; end if;
  update public.workspace_invitations set revoked_at=now(),updated_at=now() where id=p_id and company_id=p_company_id and accepted_at is null and revoked_at is null;
  return found;
end $$;

create function public.remove_workspace_member(p_actor_id uuid,p_company_id uuid,p_user_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; target_email text;
begin
  select owner_user_id into owner_id from public.companies where id=p_company_id for update;
  if owner_id is null or app_private.verified_workspace_email(p_actor_id) is null or not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=p_actor_id) or (p_actor_id<>owner_id and p_actor_id<>p_user_id) then raise exception 'Workspace access lost' using errcode='42501'; end if;
  if p_user_id=owner_id then raise exception 'The owner cannot leave or be removed' using errcode='42501'; end if;
  target_email:=app_private.workspace_account_email(p_user_id);
  delete from public.company_memberships where company_id=p_company_id and user_id=p_user_id and role='member';
  update public.workspace_invitations set revoked_at=now(),updated_at=now() where company_id=p_company_id and email_normalized=target_email and accepted_at is null and revoked_at is null;
  return true;
end $$;

revoke all on function public.read_workspace_members(uuid,uuid,integer),public.prepare_workspace_invitation(uuid,uuid,text,text,uuid),public.record_workspace_invitation_send(uuid,integer,text,text,text),public.review_workspace_invitation(uuid,text),public.accept_workspace_invitation(uuid,uuid,text),public.revoke_workspace_invitation(uuid,uuid,uuid),public.remove_workspace_member(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_members(uuid,uuid,integer),public.prepare_workspace_invitation(uuid,uuid,text,text,uuid),public.record_workspace_invitation_send(uuid,integer,text,text,text),public.review_workspace_invitation(uuid,text),public.accept_workspace_invitation(uuid,uuid,text),public.revoke_workspace_invitation(uuid,uuid,uuid),public.remove_workspace_member(uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
