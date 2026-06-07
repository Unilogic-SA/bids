create index if not exists admin_users_user_id_idx
on public.admin_users (user_id);

drop policy if exists "Admins can read their own allowlist entry" on public.admin_users;
create policy "Admins can read their own allowlist entry"
on public.admin_users
for select
to authenticated
using (
  (select auth.uid()) is not null
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and (
    user_id is null
    or user_id = (select auth.uid())
  )
);
