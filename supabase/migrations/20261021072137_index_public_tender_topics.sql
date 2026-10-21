-- Catalog profiling found repeated regex evaluation over every open notice.
-- Index the deterministic topic expression rather than caching stale deadlines.
create index if not exists tenders_seo_topics_open_idx on public.tenders using gin
  (public.tender_seo_topics(coalesce(nullif(bid_description,''),title_snippet,title),industry))
  where derived_status in ('open','closing_today');

create or replace function public.browse_public_tenders(
  p_topic text default null,
  p_province text default null,
  p_buyers text[] default null,
  p_page integer default 1
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_page is null or p_page < 1 or p_page > 4000 then raise exception 'Invalid page' using errcode = '22023'; end if;
  if p_topic is not null and p_topic not in ('information-technology','marketing') then raise exception 'Invalid topic' using errcode = '22023'; end if;
  if p_province is not null and p_province not in ('National','Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Free State','Limpopo','Mpumalanga','North West','Northern Cape') then raise exception 'Invalid province' using errcode = '22023'; end if;
  if p_buyers is not null and (cardinality(p_buyers) < 1 or cardinality(p_buyers) > 10 or exists(select 1 from unnest(p_buyers) b where b is null or length(b) > 200)) then raise exception 'Invalid buyers' using errcode = '22023'; end if;
  with eligible as materialized (
    select t.ocid, t.detail_path, t.tender_no, t.tender_type, t.buyer_name, t.department,
      t.bid_description, t.title, t.title_snippet, t.province, t.industry, t.published_at,
      t.closing_at, t.derived_status, t.documents_count, t.is_new
    from public.tenders t
    where t.derived_status in ('open','closing_today') and t.closing_at > now()
      and (p_province is null or t.province = p_province)
      and (p_buyers is null or t.buyer_name = any(p_buyers))
      and (p_topic is null or public.tender_seo_topics(coalesce(nullif(t.bid_description,''),t.title_snippet,t.title), t.industry) @> array[p_topic])
  ), paged as (
    select * from eligible order by closing_at, ocid limit 12 offset ((p_page - 1) * 12)
  ) select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.closing_at,p.ocid) from paged p),'[]'::jsonb),
    'totalCount',(select count(*) from eligible),
    'buyerCount',(select count(distinct buyer_name) from eligible)
  ) into result;
  return result;
end;
$$;
revoke all on function public.browse_public_tenders(text,text,text[],integer) from public;
grant execute on function public.browse_public_tenders(text,text,text[],integer) to anon, authenticated, service_role;
