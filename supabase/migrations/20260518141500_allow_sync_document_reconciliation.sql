drop policy if exists "Sync can delete tender documents" on public.tender_documents;
create policy "Sync can delete tender documents"
on public.tender_documents
for delete
to anon, authenticated
using (
  app_private.has_valid_sync_secret()
);

grant delete on table public.tender_documents to anon, authenticated;
