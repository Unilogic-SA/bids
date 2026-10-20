-- In-app attention only. Existing catalog/bids are the silent baseline.
-- Source transitions are captured atomically with accepted catalog writes.
create table public.workspace_activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bid_id uuid not null references public.workspace_bids(id) on delete cascade,
  kind text not null check(kind in ('deadline','cancelled')),
  payload jsonb not null check(jsonb_typeof(payload)='object' and pg_column_size(payload)<=4096),
  detected_at timestamptz not null default now(),
  unique(bid_id,kind)
);
create index workspace_bids_activity_tender on public.workspace_bids(tender_ocid);
create index workspace_activity_events_company on public.workspace_activity_events(company_id,detected_at desc);
alter table public.workspace_activity_events enable row level security;
revoke all on public.workspace_activity_events from public,anon,authenticated;
grant select on public.workspace_activity_events to authenticated;
grant all on public.workspace_activity_events to service_role;
create policy activity_events_member_read on public.workspace_activity_events for select to authenticated
using ((select app_private.workspace_customer_verified()) and exists(
  select 1 from public.company_memberships m where m.company_id=workspace_activity_events.company_id and m.user_id=(select auth.uid())));

create table public.workspace_activity_state (
  user_id uuid not null,
  company_id uuid not null,
  bid_id uuid not null references public.workspace_bids(id) on delete cascade,
  event_key text not null check(char_length(event_key) between 1 and 160),
  read_at timestamptz,
  dismissed boolean not null default false,
  snoozed_until timestamptz,
  primary key(user_id,company_id,bid_id,event_key),
  foreign key(company_id,user_id) references public.company_memberships(company_id,user_id) on delete cascade
);
alter table public.workspace_activity_state enable row level security;
revoke all on public.workspace_activity_state from public,anon,authenticated;
grant select,insert on public.workspace_activity_state to authenticated;
grant update(read_at,dismissed,snoozed_until) on public.workspace_activity_state to authenticated;
grant all on public.workspace_activity_state to service_role;
create policy activity_state_self on public.workspace_activity_state for all to authenticated
using (user_id=(select auth.uid()) and (select app_private.workspace_customer_verified()) and exists(
 select 1 from public.workspace_bids b join public.company_memberships m on m.company_id=b.company_id
 where b.id=workspace_activity_state.bid_id and b.company_id=workspace_activity_state.company_id and m.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and (select app_private.workspace_customer_verified()) and exists(
 select 1 from public.workspace_bids b join public.company_memberships m on m.company_id=b.company_id
 where b.id=workspace_activity_state.bid_id and b.company_id=workspace_activity_state.company_id and m.user_id=(select auth.uid())));

create table public.workspace_activity_preferences (
  user_id uuid not null,
  company_id uuid not null,
  changes boolean not null default true,
  reminders boolean not null default true,
  primary key(user_id,company_id),
  foreign key(company_id,user_id) references public.company_memberships(company_id,user_id) on delete cascade
);
alter table public.workspace_activity_preferences enable row level security;
revoke all on public.workspace_activity_preferences from public,anon,authenticated;
grant select,insert on public.workspace_activity_preferences to authenticated;
grant update(changes,reminders) on public.workspace_activity_preferences to authenticated;
grant all on public.workspace_activity_preferences to service_role;
create policy activity_preferences_self on public.workspace_activity_preferences for all to authenticated
using (user_id=(select auth.uid()) and (select app_private.workspace_customer_verified()) and exists(
 select 1 from public.company_memberships m where m.company_id=workspace_activity_preferences.company_id and m.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and (select app_private.workspace_customer_verified()) and exists(
 select 1 from public.company_memberships m where m.company_id=workspace_activity_preferences.company_id and m.user_id=(select auth.uid())));

-- Private definer is necessary: ingestion roles cannot write customer activity.
-- It takes no caller-controlled actor/company and is trigger-only.
create function app_private.capture_workspace_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- A source switch is a new baseline, never evidence of an authority amendment.
  if new.captured_at < old.captured_at then return null; end if;
  if new.listing_type is distinct from old.listing_type then
    delete from public.workspace_activity_events e using public.workspace_bids b where e.bid_id=b.id and b.tender_ocid=new.ocid;
    return null;
  end if;
  if new.closing_at is not null and old.closing_at is not null and new.closing_at is distinct from old.closing_at then
    insert into public.workspace_activity_events(company_id,bid_id,kind,payload)
    select b.company_id,b.id,'deadline',jsonb_build_object('previous',old.closing_at,'current',new.closing_at)
    from public.workspace_bids b where b.tender_ocid=new.ocid and b.archived_at is null and b.outcome is null and b.stage<>'submitted'
    on conflict(bid_id,kind) do update set id=excluded.id,payload=excluded.payload,detected_at=excluded.detected_at;
  end if;
  -- Explicit source status only. Disappearance and normal expiry are not cancellation.
  if lower(coalesce(new.status,'')) in ('cancelled','canceled','withdrawn') then
    if lower(coalesce(old.status,'')) not in ('cancelled','canceled','withdrawn') then
      insert into public.workspace_activity_events(company_id,bid_id,kind,payload)
      select b.company_id,b.id,'cancelled',jsonb_build_object('status',lower(new.status))
      from public.workspace_bids b where b.tender_ocid=new.ocid and b.archived_at is null and b.outcome is null
      on conflict(bid_id,kind) do update set id=excluded.id,payload=excluded.payload,detected_at=excluded.detected_at;
    end if;
  else
    delete from public.workspace_activity_events e using public.workspace_bids b
    where e.bid_id=b.id and b.tender_ocid=new.ocid and e.kind='cancelled';
  end if;
  return null;
end $$;
revoke all on function app_private.capture_workspace_activity() from public,anon,authenticated,service_role;
create trigger capture_workspace_activity after update on public.tenders for each row
when (old.closing_at is distinct from new.closing_at or old.status is distinct from new.status)
execute function app_private.capture_workspace_activity();

-- Ended bids must not regain old change alerts when later restored.
create function app_private.clear_ended_workspace_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.archived_at is not null or new.outcome is not null then
  delete from public.workspace_activity_events where bid_id=new.id;
 end if;
 return null;
end $$;
revoke all on function app_private.clear_ended_workspace_activity() from public,anon,authenticated,service_role;
create trigger clear_ended_workspace_activity after update on public.workspace_bids for each row
when (new.archived_at is not null or new.outcome is not null)
execute function app_private.clear_ended_workspace_activity();

-- Reminders are server-time conditions with stable keys, not new rows on each poll.
-- No cron/outbound delivery is required for an in-app-only inbox: due items exist
-- whenever queried, including after time spent offline.
create function app_private.workspace_activity_candidates(p_company_id uuid)
returns table(bid_id uuid,event_key text,kind text,payload jsonb,priority integer,detected_at timestamptz,title text,reference text,unread boolean,snoozed_until timestamptz)
language sql stable security invoker set search_path='' as $$
 with scope as (
  select b.id,b.company_id,b.stage,b.created_at,t.closing_at,t.status,
   coalesce((b.tender_snapshot->>'closing_at')::timestamptz,t.closing_at) as initial_closing_at,
   coalesce(nullif(t.bid_description,''),nullif(t.title_snippet,''),t.title,'Saved tender') as title,t.tender_no as reference,
   m.created_at as joined_at,coalesce(p.changes,true) as changes,coalesce(p.reminders,true) as reminders
  from public.workspace_bids b join public.tenders t on t.ocid=b.tender_ocid
  join public.company_memberships m on m.company_id=b.company_id and m.user_id=(select auth.uid())
  left join public.workspace_activity_preferences p on p.company_id=b.company_id and p.user_id=(select auth.uid())
  where b.company_id=p_company_id and b.archived_at is null and b.outcome is null and (select app_private.workspace_customer_verified())
 ), candidates as (
  select s.id,'event:'||e.id::text as event_key,e.kind,e.payload,
   case when e.kind='cancelled' then 0 when (e.payload->>'current')::timestamptz < (e.payload->>'previous')::timestamptz then 1 else 2 end as priority,
   e.detected_at,s.title,s.reference
  from scope s join public.workspace_activity_events e on e.bid_id=s.id and e.company_id=s.company_id
  where s.changes and e.detected_at>=s.joined_at
   and ((e.kind='cancelled' and lower(coalesce(s.status,'')) in ('cancelled','canceled','withdrawn'))
    or (e.kind='deadline' and s.stage<>'submitted' and s.closing_at=(e.payload->>'current')::timestamptz
     and lower(coalesce(s.status,'')) not in ('cancelled','canceled','withdrawn')))
  union all
  select s.id,'closing:'||extract(epoch from s.closing_at)::text,'closing',
   jsonb_build_object('closingAt',s.closing_at,'passed',s.closing_at<=now()),3,
   s.closing_at-interval '24 hours',s.title,s.reference
  from scope s where s.reminders and s.stage in ('reviewing','preparing','ready')
   and s.closing_at<=now()+interval '24 hours' and s.closing_at>now()-interval '7 days' and s.created_at<s.initial_closing_at
   and lower(coalesce(s.status,'')) not in ('cancelled','canceled','withdrawn')
 )
 select c.id,c.event_key,c.kind,c.payload,c.priority,c.detected_at,c.title,c.reference,
  r.read_at is null as unread,r.snoozed_until
 from candidates c left join public.workspace_activity_state r on r.company_id=p_company_id
  and r.user_id=(select auth.uid()) and r.bid_id=c.id and r.event_key=c.event_key
 where not coalesce(r.dismissed,false);
$$;
revoke all on function app_private.workspace_activity_candidates(uuid) from public,anon;
grant execute on function app_private.workspace_activity_candidates(uuid) to authenticated;

create function public.list_workspace_activity(p_company_id uuid,p_page integer default 1,p_view text default 'inbox') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not app_private.workspace_customer_verified() or not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=(select auth.uid())) then
  raise exception 'Workspace unavailable' using errcode='42501';
 end if;
 if p_page is null or p_page not between 1 and 10000 or p_view is null or p_view not in ('inbox','snoozed') then raise exception 'Invalid activity page'; end if;
 with candidates as materialized (select * from app_private.workspace_activity_candidates(p_company_id)),
 grouped as (
  select c.bid_id,max(c.title) as title,max(c.reference) as reference,min(c.priority) as priority,max(c.detected_at) as detected_at,
   bool_or(c.unread) as unread,
   jsonb_agg(jsonb_build_object('key',c.event_key,'kind',c.kind,'payload',c.payload,'unread',c.unread,'detectedAt',c.detected_at,'snoozedUntil',c.snoozed_until) order by c.priority,c.detected_at desc,c.event_key) as reasons
  from candidates c where case when p_view='snoozed' then c.snoozed_until>now() else c.snoozed_until is null or c.snoozed_until<=now() end
  group by c.bid_id
 ), page as (select * from grouped order by priority,detected_at desc,bid_id limit 20 offset ((p_page-1)*20))
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('bidId',bid_id,'title',title,'reference',reference,'unread',unread,'reasons',reasons) order by priority,detected_at desc,bid_id) from page),'[]'::jsonb),
  'total',(select count(*) from grouped),
  'unread',(select count(distinct bid_id) from candidates where unread and (snoozed_until is null or snoozed_until<=now())),
  'page',p_page,
  'preferences',jsonb_build_object(
   'changes',coalesce((select p.changes from public.workspace_activity_preferences p where p.company_id=p_company_id and p.user_id=(select auth.uid())),true),
   'reminders',coalesce((select p.reminders from public.workspace_activity_preferences p where p.company_id=p_company_id and p.user_id=(select auth.uid())),true))
 ) into result;
 return result;
end $$;
revoke all on function public.list_workspace_activity(uuid,integer,text) from public,anon;
grant execute on function public.list_workspace_activity(uuid,integer,text) to authenticated;

create function public.update_workspace_activity(p_company_id uuid,p_bid_id uuid,p_keys text[],p_action text) returns void
language plpgsql security invoker set search_path='' as $$
declare k text; valid_keys text[];
begin
 if not app_private.workspace_customer_verified() or not exists(select 1 from public.workspace_bids b join public.company_memberships m on m.company_id=b.company_id
  where b.id=p_bid_id and b.company_id=p_company_id and m.user_id=(select auth.uid())) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if p_action is null or p_action not in ('read','dismiss','snooze','unsnooze') or p_keys is null or cardinality(p_keys) not between 1 and 5 then raise exception 'Invalid activity action'; end if;
 -- Only exact keys the client actually saw can be acknowledged. A newer source
 -- event has a different key, so a stale request cannot consume that change.
 select array_agg(event_key) into valid_keys from app_private.workspace_activity_candidates(p_company_id) where bid_id=p_bid_id;
 foreach k in array p_keys loop
  if k is null or not coalesce(k=any(valid_keys),false) then continue; end if;
  insert into public.workspace_activity_state(user_id,company_id,bid_id,event_key,read_at,dismissed,snoozed_until)
  values((select auth.uid()),p_company_id,p_bid_id,k,case when p_action='read' then now() end,p_action='dismiss',case when p_action='snooze' then now()+interval '1 hour' end)
  on conflict(user_id,company_id,bid_id,event_key) do update set
   read_at=case when p_action='read' then now() else workspace_activity_state.read_at end,
   dismissed=workspace_activity_state.dismissed or p_action='dismiss',
   snoozed_until=case when p_action='snooze' then now()+interval '1 hour' when p_action='unsnooze' then null else workspace_activity_state.snoozed_until end;
 end loop;
end $$;
revoke all on function public.update_workspace_activity(uuid,uuid,text[],text) from public,anon;
grant execute on function public.update_workspace_activity(uuid,uuid,text[],text) to authenticated;

create function public.set_workspace_activity_preferences(p_company_id uuid,p_changes boolean,p_reminders boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_changes is null or p_reminders is null then raise exception 'Invalid preferences'; end if;
 if not app_private.workspace_customer_verified() or not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=(select auth.uid())) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 insert into public.workspace_activity_preferences(user_id,company_id,changes,reminders)
 values((select auth.uid()),p_company_id,p_changes,p_reminders)
 on conflict(user_id,company_id) do update set changes=excluded.changes,reminders=excluded.reminders;
end $$;
revoke all on function public.set_workspace_activity_preferences(uuid,boolean,boolean) from public,anon;
grant execute on function public.set_workspace_activity_preferences(uuid,boolean,boolean) to authenticated;
