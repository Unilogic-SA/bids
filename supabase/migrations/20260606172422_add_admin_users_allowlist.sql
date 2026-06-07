create table if not exists public.admin_users (
  email text primary key,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_email_is_lowercase check (email = lower(email)),
  constraint admin_users_role_valid check (role in ('owner', 'admin'))
);

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon;
revoke all on table public.admin_users from authenticated;

grant select on table public.admin_users to authenticated;
grant all on table public.admin_users to service_role;

drop policy if exists "Admins can read their own allowlist entry" on public.admin_users;
create policy "Admins can read their own allowlist entry"
on public.admin_users
for select
to authenticated
using (
  (select auth.uid()) is not null
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and (
    user_id is null
    or user_id = (select auth.uid())
  )
);

insert into public.admin_users (email, role)
values ('mesuli@unilogic.co.za', 'owner')
on conflict (email) do update
set role = excluded.role;
