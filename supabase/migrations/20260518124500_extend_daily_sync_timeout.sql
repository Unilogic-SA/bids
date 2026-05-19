select cron.alter_job(
  job_id := (
    select jobid
    from cron.job
    where jobname = 'sync-tenders-daily'
  ),
  command := $$
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
