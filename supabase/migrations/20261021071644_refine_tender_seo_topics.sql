-- Refine subject precision after reviewing the current catalog.
-- Re-advertisements are publication labels, not marketing work.
create or replace function public.tender_seo_topics(p_subject text, p_industry text)
returns text[] language sql immutable parallel safe set search_path = '' as $$
  select array_remove(array[
    case when coalesce(p_industry, '') in ('Supplies: Computer Equipment', 'Computer programming, consultancy and related activities', 'Information service activities', 'Telecommunications')
      or subject ~* '\m(ICT|software|cybersecurity|cyber.security|computer[s]?|laptop[s]?|desktop[s]?|firewall[s]?|broadband.(internet|connectivity|service)|internet.(access|connectivity|service)|Wi-Fi|wifi|optic.fibre|fibre.optic|fibre.(cable|connect|network|termination)|fiber.(cable|connect|network|materials)|data.centre|data.center|cloud.hosting|web.hosting|web.development|website|network.switch(es)?|network.infrastructure|IT.support|IT.services|information.technology|Microsoft|Oracle|SAP.licen[cs]|ERP|PABX|VoIP)\M'
      then 'information-technology' end,
    case when coalesce(p_industry, '') = 'Advertising and market research'
      or subject ~* '\m(marketing|advertising|brand(ing)?|media.buying|media.placement|public.relations|social.media|digital.campaign[s]?|market.research|communication[s]?.strateg[yies]+|creative.agenc[yies]+)\M'
      then 'marketing' end
  ]::text[], null)
  from (select regexp_replace(coalesce(p_subject,''), '\m(please|special conditions|for more information|download documents|visit our website)\M.*$', '', 'i') as subject) cleaned
$$;
