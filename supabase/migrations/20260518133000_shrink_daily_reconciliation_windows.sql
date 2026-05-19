select cron.unschedule('sync-tenders-daily');

select cron.schedule(
  'sync-tenders-daily',
  '0 6 * * *',
  $$
    with sync_window_bounds as (
      select
        coalesce(
          least(
            min(published_at)::date,
            current_date - 6
          ),
          current_date - 6
        ) as first_date
      from public.tenders
      where derived_status in ('open', 'closing_today')
        and (closing_at is null or closing_at >= now())
    ),
    sync_windows as (
      select
        window_start::date as date_from,
        least(window_start::date + 6, current_date) as date_to
      from sync_window_bounds
      cross join lateral generate_series(
        first_date,
        current_date,
        interval '7 days'
      ) as window_start
    )
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
          'mode',
          'range',
          'dateFrom',
          to_char(date_from, 'YYYY-MM-DD'),
          'dateTo',
          to_char(date_to, 'YYYY-MM-DD'),
          'pageSize',
          20000,
          'maxPages',
          20
        ),
        timeout_milliseconds := 120000
      ) as request_id
    from sync_windows;
  $$
);
