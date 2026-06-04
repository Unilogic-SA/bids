select cron.unschedule('sync-tenders-daily-batch-0');
select cron.unschedule('sync-tenders-daily-batch-1');
select cron.unschedule('sync-tenders-daily-batch-2');
select cron.unschedule('sync-tenders-daily-batch-3');

update public.tender_sync_runs
set
  status = 'abandoned',
  completed_at = coalesce(completed_at, started_at + interval '150 seconds'),
  message = coalesce(
    message,
    'Sync invocation abandoned after pg_net or Edge Function timeout before completion.'
  )
where status = 'running'
  and started_at < now() - interval '10 minutes';

select cron.schedule(
  'sync-tenders-recent-refresh',
  '5 */6 * * *',
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
          'mode',
          'range',
          'dateFrom',
          to_char(current_date - 1, 'YYYY-MM-DD'),
          'dateTo',
          to_char(current_date, 'YYYY-MM-DD'),
          'pageSize',
          20000,
          'maxPages',
          20
        ),
        timeout_milliseconds := 120000
      ) as request_id;
  $$
);

select cron.schedule(
  'sync-tenders-open-horizon-rotating',
  '20,50 * * * *',
  $$
    with sync_window_bounds as (
      select
        coalesce(
          least(
            min(published_at)::date,
            current_date - 1
          ),
          current_date - 1
        ) as first_date
      from public.tenders
      where derived_status in ('open', 'closing_today')
        and (closing_at is null or closing_at >= now())
    ),
    sync_windows as (
      select
        row_number() over (order by window_start) - 1 as window_index,
        count(*) over () as window_count,
        window_start::date as date_from,
        least(window_start::date + 1, current_date) as date_to
      from sync_window_bounds
      cross join lateral generate_series(
        first_date,
        current_date,
        interval '2 days'
      ) as window_start
    ),
    selected_window as (
      select date_from, date_to
      from sync_windows
      where window_index = mod(
        floor(extract(epoch from now()) / 1800)::int,
        window_count
      )
      limit 1
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
    from selected_window;
  $$
);
