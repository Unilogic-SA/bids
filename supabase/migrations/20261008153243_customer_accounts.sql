-- Customer records are private; existing catalog/admin tables are untouched.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or (display_name = btrim(display_name) and char_length(display_name) between 1 and 100)),
  company_prompt_dismissed_at timestamptz,
  profile_prompt_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text check (name is null or (name = btrim(name) and char_length(name) between 1 and 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;

revoke all on public.profiles, public.companies, public.company_memberships from public, anon, authenticated;
grant select on public.profiles, public.companies, public.company_memberships to authenticated;
grant update (display_name, company_prompt_dismissed_at, profile_prompt_dismissed_at) on public.profiles to authenticated;
grant update (name) on public.companies to authenticated;
grant all on public.profiles, public.companies, public.company_memberships to service_role;

create policy profiles_read_self on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy memberships_read_self on public.company_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy companies_read_member on public.companies for select to authenticated
  using (exists (select 1 from public.company_memberships m where m.company_id = companies.id and m.user_id = (select auth.uid())));
create policy companies_update_owner on public.companies for update to authenticated
  using (owner_user_id = (select auth.uid()) and exists (
    select 1 from public.company_memberships m where m.company_id = companies.id and m.user_id = (select auth.uid()) and m.role = 'owner'
  )) with check (owner_user_id = (select auth.uid()) and exists (
    select 1 from public.company_memberships m where m.company_id = companies.id and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));

create function public.touch_customer_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_customer_updated_at() from public, anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.touch_customer_updated_at();
create trigger companies_updated_at before update on public.companies
  for each row execute function public.touch_customer_updated_at();

-- Only the trusted server may call this, after fresh Auth getUser verification.
-- INVOKER rights mean it cannot elevate an ordinary customer's privileges.
create function public.bootstrap_customer_workspace(p_user_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_company_id uuid;
  v_membership public.company_memberships%rowtype;
begin
  -- Serialize concurrent first logins/retries for the same identity.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 49));
  -- The caller verifies confirmation using fresh Auth getUser. The profile FK
  -- obtains a key-share lock on the live Auth user during the insert below,
  -- closing the deletion race without granting service_role Auth table access.

  select * into v_membership from public.company_memberships where user_id = p_user_id;
  if found and not exists (
    select 1 from public.companies where id = v_membership.company_id and owner_user_id = p_user_id
  ) then
    raise exception 'Workspace ownership conflicts; contact support';
  end if;
  if exists (select 1 from public.company_memberships m join public.companies c on c.id = m.company_id
    where c.owner_user_id = p_user_id and m.user_id <> p_user_id) then
    raise exception 'Workspace has additional members; contact support';
  end if;

  insert into public.profiles(user_id) values (p_user_id) on conflict (user_id) do nothing;
  insert into public.companies(owner_user_id) values (p_user_id) on conflict (owner_user_id) do nothing;
  select id into strict v_company_id from public.companies where owner_user_id = p_user_id;
  insert into public.company_memberships(company_id, user_id, role) values (v_company_id, p_user_id, 'owner')
    on conflict (user_id) do nothing;
  if not exists (select 1 from public.company_memberships where user_id = p_user_id and company_id = v_company_id and role = 'owner') then
    raise exception 'Workspace membership conflicts; contact support';
  end if;
  return v_company_id;
end;
$$;
revoke all on function public.bootstrap_customer_workspace(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_customer_workspace(uuid) to service_role;

-- Sole-owner MVP: auth deletion cascades private customer records only.
-- Before invitations, replace this policy with explicit ownership transfer.
