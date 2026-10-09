import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"

type SearchItem = {
  ocid: string
  tender_no: string
}

type SearchResult = {
  items: SearchItem[]
  totalCount: number
}

test("weighted public tender full-text search", async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;")
  const baseline = await readFile("supabase/migrations/20260513193000_create_tender_catalog.sql", "utf8")
  await db.exec(baseline.replace("create extension if not exists pgcrypto;", ""))
  const migration = await readFile("supabase/migrations/20261009094557_add_weighted_tender_search.sql", "utf8")
  await db.exec(migration)
  await db.exec(await readFile("supabase/migrations/20261009103133_prioritize_tender_display_subject.sql", "utf8"))

  await db.exec(`
    insert into public.tenders (
      ocid, release_id, tender_no, title, bid_description, buyer_name,
      department, province, industry, tender_type, procurement_category,
      special_conditions, published_at, closing_at
    ) values
      ('exact', 'r1', 'ABC-123-2026', 'Laptop supply', null, 'Acme Technology', 'IT Department', 'Gauteng', 'Information and communication', 'Request for Proposal', 'Goods', null, '2026-01-10', '2099-02-01'),
      ('title', 'r2', 'OTHER-1', 'Laptop fleet', null, 'Other Buyer', 'Finance', 'Western Cape', 'Supplies: Computer Equipment', 'Request for Quotation', 'Goods', null, '2026-01-09', '2099-02-02'),
      ('description', 'r3', 'OTHER-2', 'Office equipment', 'Laptop fleet compatible with ABC-123-2026', 'Other Buyer', 'Finance', 'Gauteng', 'Supplies: Computer Equipment', 'Request for Quotation', 'Goods', null, '2026-01-08', '2099-02-03'),
      ('multi', 'r4', 'DEV-9', 'Software services', 'Development of a public portal', 'Digital Buyer', 'Innovation Department', 'Gauteng', 'Information and communication', 'Request for Proposal', 'Services', null, '2026-01-07', '2099-02-04'),
      ('buyer', 'r5', 'BUY-1', 'Office chairs', null, 'Laptop Council', 'Procurement', 'National', 'Supplies: General', 'Request for Bid(Open-Tender)', 'Goods', null, '2026-01-06', '2099-02-05');
  `)

  const search = async (query: string, options: {
    province?: string
    buyer?: string
    industries?: string[]
    tenderTypes?: string[]
    sort?: string
    limit?: number
    offset?: number
  } = {}) => {
    const result = await db.query<{ result: SearchResult }>(
      `select public.search_open_tenders($1, $2, $3, $4, $5, $6, $7, $8) as result`,
      [
        query,
        options.province ?? null,
        options.buyer ?? null,
        options.industries ?? null,
        options.tenderTypes ?? null,
        options.sort ?? "relevance",
        options.limit ?? 12,
        options.offset ?? 0,
      ]
    )
    return result.rows[0].result
  }

  await t.test("natural multi-word and stemmed searches do not require a contiguous substring", async () => {
    assert.deepEqual((await search("software development")).items.map(item => item.ocid), ["multi"])
    assert.ok((await search("laptops")).items.some(item => item.ocid === "title"))
  })

  await t.test("websearch phrases, OR and exclusions are preserved even with reference digits", async () => {
    assert.deepEqual((await search('"laptop fleet"')).items.map(item => item.ocid), ["title", "description"])
    assert.equal((await search("software OR laptop")).totalCount, 5)
    assert.deepEqual((await search("laptop -ABC-123-2026")).items.map(item => item.ocid), ["title", "buyer"])
    assert.equal((await search("nonexistent")).totalCount, 0)
    assert.equal((await search("the")).totalCount, 0)
  })

  await t.test("exact and partial tender references remain useful", async () => {
    const exactResults = await search("ABC-123-2026")
    assert.equal(exactResults.items[0].ocid, "exact")
    assert.ok(exactResults.items.some(item => item.ocid === "description"))
    assert.ok((await search("ABC-123")).items.some(item => item.ocid === "exact"))
  })

  await t.test("weighted title matches outrank description-only matches", async () => {
    const ids = (await search("laptop")).items.map(item => item.ocid)
    assert.ok(ids.indexOf("title") < ids.indexOf("description"))
  })

  await t.test("portal display subjects outrank repeated website download boilerplate", async () => {
    await db.exec(`
      insert into public.tenders (ocid, release_id, tender_no, title, bid_description, title_snippet, special_conditions, published_at, closing_at) values
        ('web-scope', 'web1', 'WEB-2026-01', 'WEB-2026-01', 'Website revamp and maintenance', 'Website revamp and maintenance', null, '2026-01-10', '2099-03-02'),
        ('web-hosting', 'web2', 'WEB-2026-02', 'WEB-2026-02', 'Website hosting and technical support for thirty six months', null, null, '2026-01-09', '2099-03-03'),
        ('web-boilerplate', 'web3', 'BUILD-2026-01', 'BUILD-2026-01', 'School repairs and renovations', null, repeat('Download documents from our website. ', 30), '2026-01-08', '2099-03-01'),
        ('web-title-fallback', 'web4', 'WEB-2026-03', 'Website development', null, 'Website development', null, '2026-01-07', '2099-03-04');
    `)
    const results = await search('website')
    assert.equal(results.totalCount, 4)
    assert.equal(results.items.at(-1)?.ocid, 'web-boilerplate')
    assert.deepEqual(new Set(results.items.slice(0, 3).map(item => item.ocid)), new Set(['web-scope', 'web-hosting', 'web-title-fallback']))
    assert.equal((await search('website', { sort: 'closing_at_asc' })).items[0].ocid, 'web-boilerplate')
    for (const item of results.items) {
      assert.ok(!('subject_match' in item) && !('subject_relevance' in item))
    }
  })

  await t.test("buyer and listing filters combine with keyword search", async () => {
    assert.deepEqual((await search("council", { buyer: "Laptop" })).items.map(item => item.ocid), ["buyer"])
    assert.deepEqual((await search("laptop", { province: "Western Cape" })).items.map(item => item.ocid), ["title"])
    assert.deepEqual((await search("laptop", { industries: ["Supplies: Computer Equipment"] })).items.map(item => item.ocid), ["title", "description"])
    assert.deepEqual((await search("software", { tenderTypes: ["Request for Proposal"] })).items.map(item => item.ocid), ["multi"])
  })

  await t.test("pagination returns a stable page and the full matched count", async () => {
    const first = await search("laptop", { limit: 2 })
    const second = await search("laptop", { limit: 2, offset: 2 })
    assert.equal(first.totalCount, 4)
    assert.equal(second.totalCount, 4)
    assert.equal(new Set([...first.items, ...second.items].map(item => item.ocid)).size, 4)
  })

  await t.test("explicit closing and published sorts take precedence", async () => {
    assert.equal((await search("laptop", { sort: "closing_at_asc" })).items[0].ocid, "exact")
    assert.equal((await search("laptop", { sort: "published_at_desc" })).items[0].ocid, "exact")
    await assert.rejects(search("laptop", { sort: "drop table tenders" }), /Unsupported tender search sort/)
  })

  await t.test("null and out-of-bounds pagination is rejected for anonymous callers", async () => {
    await db.exec("set role anon;")
    try {
      for (const [limit, offset] of [[null, 0], [12, null], [null, null], [0, 0], [101, 0], [12, -1]]) {
        await assert.rejects(
          db.query("select public.search_open_tenders('laptop', p_limit => $1, p_offset => $2)", [limit, offset]),
          /Invalid tender search pagination/
        )
      }
      await assert.rejects(db.query("select public.search_open_tenders('laptop', p_sort => null)"), /Unsupported tender search sort/)
      await assert.rejects(db.query("select public.search_open_tenders(null)"), /non-empty tender search query/)
    } finally {
      await db.exec("reset role;")
    }
  })

  await t.test("closing-today tenders remain searchable and expired or closed tenders are excluded", async () => {
    await db.exec(`
      insert into public.tenders (ocid, release_id, tender_no, title, derived_status, closing_at) values
        ('today', 'r6', 'STATUS-1', 'Status fixture', 'closing_today', now() + interval '1 hour'),
        ('expired', 'r7', 'STATUS-2', 'Status fixture', 'open', now() - interval '1 hour'),
        ('closed', 'r8', 'STATUS-3', 'Status fixture', 'closed', now() + interval '1 hour');
    `)
    assert.deepEqual((await search("status fixture")).items.map(item => item.ocid), ["today"])
  })

  await t.test("anonymous results and counts obey row-level security", async () => {
    await db.exec(`alter policy "Public tenders are readable" on public.tenders using (ocid <> 'exact'); set role anon;`)
    try {
      const result = await search("ABC-123-2026")
      assert.deepEqual(result.items.map(item => item.ocid), ["description"])
      assert.equal(result.totalCount, 1)
    } finally {
      await db.exec(`reset role; alter policy "Public tenders are readable" on public.tenders using (true);`)
    }
  })

  await t.test("the public RPC uses invoker rights and its GIN predicate is indexable", async () => {
    const security = await db.query<{ prosecdef: boolean; proconfig: string[] }>("select prosecdef, proconfig from pg_proc where proname = 'search_open_tenders'")
    assert.equal(security.rows[0].prosecdef, false)
    assert.deepEqual(security.rows[0].proconfig, ["search_path=\"\""])
    const privileges = await db.query<{ anon: boolean; public: boolean }>(`
      select
        has_function_privilege('anon', 'public.search_open_tenders(text,text,text,text[],text[],text,integer,integer)', 'execute') as anon,
        exists (
          select from pg_proc p, aclexplode(p.proacl) acl
          where p.proname = 'search_open_tenders'
            and acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        ) as public
    `)
    assert.deepEqual(privileges.rows[0], { anon: true, public: false })
    await db.exec("set role anon;")
    assert.equal((await search("software")).items[0].ocid, "multi")
    await db.exec("reset role;")
    await db.exec("set enable_seqscan = off;")
    const plan = await db.query<{ "QUERY PLAN": string }>("explain select ocid from public.tenders where search_vector_v2 @@ websearch_to_tsquery('english', 'laptop')")
    assert.match(plan.rows.map(row => row["QUERY PLAN"]).join("\n"), /tenders_search_vector_v2_idx/)
  })
})
