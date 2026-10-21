-- Public-only, bounded reads. No privilege elevation and no changes to existing RLS.
create or replace function public.tender_seo_topics(p_subject text, p_industry text)
returns text[] language sql immutable parallel safe set search_path = '' as $$
  select array_remove(array[
    case when coalesce(p_industry, '') in ('Supplies: Computer Equipment', 'Computer programming, consultancy and related activities', 'Information service activities', 'Telecommunications')
      or coalesce(p_subject, '') ~* '\m(ICT|software|cybersecurity|cyber.security|computer[s]?|laptop[s]?|desktop[s]?|firewall[s]?|broadband|Wi-Fi|wifi|fibre|fiber|data.centre|data.center|cloud.hosting|web.hosting|web.development|website|network.switch(es)?|network.infrastructure|IT.support|IT.services|information.technology|Microsoft|Oracle|SAP.licen[cs]|ERP|PABX|VoIP)\M'
      then 'information-technology' end,
    case when coalesce(p_industry, '') = 'Advertising and market research'
      or coalesce(p_subject, '') ~* '\m(marketing|advertising|advertisement|brand(ing)?|media.buying|media.placement|public.relations|social.media|digital.campaign[s]?|market.research|communication[s]?.strateg[yies]+|creative.agenc[yies]+)\M'
      then 'marketing' end
  ]::text[], null)
$$;
revoke all on function public.tender_seo_topics(text,text) from public;
grant execute on function public.tender_seo_topics(text,text) to anon, authenticated, service_role;

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
      and (p_topic is null or p_topic = any(public.tender_seo_topics(coalesce(nullif(t.bid_description,''),t.title_snippet,t.title), t.industry)))
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
