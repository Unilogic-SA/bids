select cron.unschedule('sync-tenders-daily-batch-0');
select cron.unschedule('sync-tenders-daily-batch-1');
select cron.unschedule('sync-tenders-daily-batch-2');

select cron.schedule(
  'sync-tenders-daily-batch-0',
  '0 6 * * *',
  $$
    with sync_window_bounds as (
      select
        coalesce(
          least(
            min(published_at)::date,
            current_date - 4
          ),
          current_date - 4
        ) as first_date
      from public.tenders
      where derived_status in ('open', 'closing_today')
        and (closing_at is null or closing_at >= now())
    ),
    sync_windows as (
      select
        row_number() over (order by window_start) - 1 as window_index,
        window_start::date as date_from,
        least(window_start::date + 4, current_date) as date_to
      from sync_window_bounds
      cross join lateral generate_series(
        first_date,
        current_date,
        interval '5 days'
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
    from sync_windows
    where mod(window_index, 4) = 0;
  $$
);

select cron.schedule(
  'sync-tenders-daily-batch-1',
  '10 6 * * *',
  $$
    with sync_window_bounds as (
      select
        coalesce(
          least(
            min(published_at)::date,
            current_date - 4
          ),
          current_date - 4
        ) as first_date
      from public.tenders
      where derived_status in ('open', 'closing_today')
        and (closing_at is null or closing_at >= now())
    ),
    sync_windows as (
      select
        row_number() over (order by window_start) - 1 as window_index,
        window_start::date as date_from,
        least(window_start::date + 4, current_date) as date_to
      from sync_window_bounds
      cross join lateral generate_series(
        first_date,
        current_date,
        interval '5 days'
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
    from sync_windows
    where mod(window_index, 4) = 1;
  $$
);

select cron.schedule(
  'sync-tenders-daily-batch-2',
  '20 6 * * *',
  $$
    with sync_window_bounds as (
      select
        coalesce(
          least(
            min(published_at)::date,
            current_date - 4
          ),
          current_date - 4
        ) as first_date
      from public.tenders
      where derived_status in ('open', 'closing_today')
        and (closing_at is null or closing_at >= now())
    ),
    sync_windows as (
      select
        row_number() over (order by window_start) - 1 as window_index,
        window_start::date as date_from,
        least(window_start::date + 4, current_date) as date_to
      from sync_window_bounds
      cross join lateral generate_series(
        first_date,
        current_date,
        interval '5 days'
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
    from sync_windows
    where mod(window_index, 4) = 2;
  $$
);

select cron.schedule(
  'sync-tenders-daily-batch-3',
  '30 6 * * *',
  $$
    with sync_window_bounds as (
      select
        coalesce(
          least(
            min(published_at)::date,
            current_date - 4
          ),
          current_date - 4
        ) as first_date
      from public.tenders
      where derived_status in ('open', 'closing_today')
        and (closing_at is null or closing_at >= now())
    ),
    sync_windows as (
      select
        row_number() over (order by window_start) - 1 as window_index,
        window_start::date as date_from,
        least(window_start::date + 4, current_date) as date_to
      from sync_window_bounds
      cross join lateral generate_series(
        first_date,
        current_date,
        interval '5 days'
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
    from sync_windows
    where mod(window_index, 4) = 3;
  $$
);
