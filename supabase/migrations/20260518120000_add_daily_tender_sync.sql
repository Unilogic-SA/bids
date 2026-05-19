create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

do $$
declare
  existing_secret_id uuid;
  sync_secret text;
begin
  select value
  into sync_secret
  from app_private.sync_settings
  where key = 'etenders_sync_secret';

  if sync_secret is null or sync_secret = '' then
    raise exception 'Missing app_private.sync_settings.etenders_sync_secret';
  end if;

  select id
  into existing_secret_id
  from vault.decrypted_secrets
  where name = 'etenders_cron_sync_secret';

  if existing_secret_id is null then
    perform vault.create_secret(
      sync_secret,
      'etenders_cron_sync_secret',
      'Secret used by Supabase Cron to call the sync-tenders Edge Function'
    );
  else
    perform vault.update_secret(
      existing_secret_id,
      sync_secret,
      'etenders_cron_sync_secret',
      'Secret used by Supabase Cron to call the sync-tenders Edge Function'
    );
  end if;
end
$$;

select cron.schedule(
  'sync-tenders-daily',
  '0 6 * * *',
  $$
    select
      net.http_post(
        url := 'https://eanhpdxlskwxplglprrt.supabase.co/functions/v1/sync-tenders',
        headers := jsonb_build_object(
          'Content-Type',
          'application/json',
          'x-sync-secret',
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'etenders_cron_sync_secret'
          )
        ),
        body := jsonb_build_object(
          'days',
          14,
          'pageSize',
          20000,
          'maxPages',
          20
        ),
        timeout_milliseconds := 120000
      ) as request_id;
  $$
);
