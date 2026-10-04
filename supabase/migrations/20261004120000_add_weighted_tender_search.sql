-- Keep the original search_vector in place while the weighted search is proven.
alter table public.tenders
add column if not exists search_vector_v2 tsvector generated always as (
  setweight(to_tsvector('english', coalesce(tender_no, '') || ' ' || coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(buyer_name, '') || ' ' || coalesce(department, '') || ' ' || coalesce(tender_type, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(industry, '') || ' ' || coalesce(province, '') || ' ' || coalesce(procurement_category, '') || ' ' || coalesce(procurement_method, '') || ' ' || coalesce(procurement_method_details, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(bid_description, '') || ' ' || coalesce(special_conditions, '') || ' ' || coalesce(eligibility_notes, '')), 'D')
) stored;

create index if not exists tenders_search_vector_v2_idx
on public.tenders using gin (search_vector_v2);

create or replace function public.search_open_tenders(
  p_query text,
  p_province text default null,
  p_buyer text default null,
  p_industries text[] default null,
  p_tender_types text[] default null,
  p_sort text default 'relevance',
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_web_query tsquery;
  v_prefix_query tsquery;
begin
  if p_sort not in (
    'relevance',
    'closing_at_asc',
    'closing_at_desc',
    'published_at_desc',
    'published_at_asc'
  ) then
    raise exception 'Unsupported tender search sort: %', p_sort
      using errcode = '22023';
  end if;

  if nullif(btrim(p_query), '') is null then
    raise exception 'A non-empty tender search query is required'
      using errcode = '22023';
  end if;

  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'Invalid tender search pagination'
      using errcode = '22023';
  end if;

  v_web_query := websearch_to_tsquery('english', p_query);

  -- Prefix the lexemes emitted by PostgreSQL's parser, rather than interpolating
  -- raw user input. This keeps partial tender references such as "ABC-12" useful.
  v_prefix_query := to_tsquery(
    'english',
    regexp_replace(
      plainto_tsquery('english', p_query)::text,
      '''([^'']+)''',
      '''\1'':*',
      'g'
    )
  );

  return (
    with matched as materialized (
      select
        t.ocid,
        t.source_site,
        t.detail_path,
        t.tender_no,
        t.tender_type,
        t.department,
        t.buyer_name,
        t.title,
        t.title_snippet,
        t.bid_description,
        t.province,
        t.industry,
        t.views_count,
        t.published_at,
        t.closing_at,
        t.status,
        t.derived_status,
        t.is_new,
        t.documents_count,
        lower(btrim(t.tender_no)) = lower(btrim(p_query)) as exact_tender_no,
        ts_rank_cd(t.search_vector_v2, v_web_query, 32) as relevance
      from public.tenders as t
      where t.derived_status = 'open'
        and t.closing_at >= now()
        and (
          t.search_vector_v2 @@ v_web_query
          or (
            p_query ~ '[0-9]'
            and t.search_vector_v2 @@ v_prefix_query
          )
        )
        and (p_province is null or t.province = p_province)
        and (p_buyer is null or t.buyer_name ilike '%' || p_buyer || '%')
        and (p_industries is null or t.industry = any(p_industries))
        and (p_tender_types is null or t.tender_type = any(p_tender_types))
    ),
    paged as (
      select
        matched.*,
        row_number() over (
          order by
            case when p_sort = 'relevance' then exact_tender_no end desc nulls last,
            case when p_sort = 'relevance' then relevance end desc nulls last,
            case when p_sort = 'closing_at_asc' then closing_at end asc nulls last,
            case when p_sort = 'closing_at_desc' then closing_at end desc nulls last,
            case when p_sort = 'published_at_desc' then published_at end desc nulls last,
            case when p_sort = 'published_at_asc' then published_at end asc nulls last,
            case when p_sort <> 'relevance' then relevance end desc nulls last,
            closing_at asc nulls last,
            published_at desc nulls last,
            ocid asc
        ) as result_order
      from matched
      order by
        case when p_sort = 'relevance' then exact_tender_no end desc nulls last,
        case when p_sort = 'relevance' then relevance end desc nulls last,
        case when p_sort = 'closing_at_asc' then closing_at end asc nulls last,
        case when p_sort = 'closing_at_desc' then closing_at end desc nulls last,
        case when p_sort = 'published_at_desc' then published_at end desc nulls last,
        case when p_sort = 'published_at_asc' then published_at end asc nulls last,
        case when p_sort <> 'relevance' then relevance end desc nulls last,
        closing_at asc nulls last,
        published_at desc nulls last,
        ocid asc
      limit p_limit
      offset p_offset
    )
    select jsonb_build_object(
      'items', coalesce(
        (
          select jsonb_agg(
            to_jsonb(paged) - 'exact_tender_no' - 'relevance' - 'result_order'
            order by result_order
          )
          from paged
        ),
        '[]'::jsonb
      ),
      'totalCount', (select count(*) from matched)
    )
  );
end;
$$;

revoke all on function public.search_open_tenders(
  text, text, text, text[], text[], text, integer, integer
) from public;
grant execute on function public.search_open_tenders(
  text, text, text, text[], text[], text, integer, integer
) to anon, authenticated;
