drop policy if exists "Admins can read their own allowlist entry" on public.admin_users;

revoke all on table public.admin_users from anon;
revoke all on table public.admin_users from authenticated;
grant all on table public.admin_users to service_role;
