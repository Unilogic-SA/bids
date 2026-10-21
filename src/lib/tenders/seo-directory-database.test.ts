import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

test("directory classifies subjects, bounds requests and reads only public fields without elevation", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.tenders (ocid text primary key, detail_path text, tender_no text, tender_type text, buyer_name text, department text, bid_description text, title text, title_snippet text, province text, industry text, published_at timestamptz, closing_at timestamptz, derived_status text, documents_count int, is_new boolean, raw_release jsonb);
      alter table public.tenders enable row level security;
      create policy public_read on public.tenders for select to anon using (true);
      grant usage on schema public to anon; grant select on public.tenders to anon;`)
    await db.exec(
      await readFile(
        new URL(
          "../../../supabase/migrations/20261021071511_public_tender_directory.sql",
          import.meta.url
        ),
        "utf8"
      )
    )
    await db.exec(
      await readFile(
        new URL(
          "../../../supabase/migrations/20261021071644_refine_tender_seo_topics.sql",
          import.meta.url
        ),
        "utf8"
      )
    )
    await db.exec(
      await readFile(
        new URL(
          "../../../supabase/migrations/20261021071843_guard_marketing_source_classification.sql",
          import.meta.url
        ),
        "utf8"
      )
    )
    await db.exec(
      await readFile(
        new URL(
          "../../../supabase/migrations/20261021072137_index_public_tender_topics.sql",
          import.meta.url
        ),
        "utf8"
      )
    )
    const notices = [
      [
        "a",
        "Supply and support of network switches",
        "Gauteng",
        "Buyer A",
        "Services: Professional",
        1,
      ],
      [
        "b",
        "Digital marketing and advertising campaign",
        "Gauteng",
        "Buyer B",
        "Services: Professional",
        1,
      ],
      [
        "c",
        "Build municipal roads; submit pricing on website",
        "Western Cape",
        "Buyer A",
        "Construction",
        -1,
      ],
      [
        "d",
        "Printing and branded marketing materials",
        "Gauteng",
        "Buyer A",
        "Supplies: General",
        1,
      ],
      [
        "f",
        "RE-ADVERTISEMENT: maintenance of municipal buildings",
        "Gauteng",
        "Buyer C",
        "Construction",
        1,
      ],
      [
        "g",
        "Provision of cleaning services. Please download documents on our website",
        "Gauteng",
        "Buyer C",
        "Services: General",
        1,
      ],
      [
        "i",
        "Lease speed red light cameras and fines management",
        "Gauteng",
        "Buyer C",
        "Advertising and market research",
        1,
      ],
      [
        "h",
        "Supply and delivery of broadband seismometers",
        "Gauteng",
        "Buyer C",
        "Supplies: General",
        1,
      ],
      [
        "e",
        "Installation of computer equipment",
        "Western Cape",
        "Buyer A",
        "Supplies: Computer Equipment",
        1,
      ],
    ]
    for (const [id, subject, province, buyer, industry, days] of notices)
      await db.query(
        `insert into public.tenders(ocid,bid_description,province,buyer_name,industry,closing_at,derived_status,raw_release) values ($1,$2,$3,$4,$5,now()+($6||' days')::interval,'open','{"private_snapshot":true}')`,
        [id, subject, province, buyer, industry, String(days)]
      )
    await db.exec("set role anon")
    const read = async (
      topic: string | null,
      province: string | null = null,
      buyers: string[] | null = null,
      page = 1
    ) =>
      (
        await db.query<{
          result: { items: { ocid: string }[]; totalCount: number; buyerCount: number }
        }>("select public.browse_public_tenders($1,$2,$3,$4) result", [
          topic,
          province,
          buyers,
          page,
        ])
      ).rows[0].result
    const tech = await read("information-technology")
    assert.deepEqual(
      tech.items.map((x) => x.ocid),
      ["a", "e"]
    )
    assert.equal(JSON.stringify(tech).includes("private_snapshot"), false)
    assert.equal((await read("marketing")).totalCount, 2)
    assert.equal((await read(null, "Gauteng")).buyerCount, 3)
    assert.equal((await read(null, null, ["Buyer A"])).totalCount, 3)
    assert.equal((await read(null, null, ["Buyer"])).totalCount, 0)
    assert.equal((await read(null, null, null, 2)).items.length, 0)
    await assert.rejects(read("unsupported"), /Invalid topic/)
    await assert.rejects(read(null, null, null, 4001), /Invalid page/)
    await assert.rejects(read(null, "Fake province"), /Invalid province/)
    await assert.rejects(
      db.exec("insert into public.tenders(ocid) values ('forbidden')"),
      /permission denied/
    )
  } finally {
    await db.close()
  }
})
