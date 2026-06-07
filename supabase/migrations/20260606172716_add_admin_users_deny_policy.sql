drop policy if exists "No direct admin allowlist access" on public.admin_users;
create policy "No direct admin allowlist access"
on public.admin_users
for all
to public
using (false)
with check (false);
