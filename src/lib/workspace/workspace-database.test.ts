import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
test("workspace database isolates owners, validates lifecycle, retains private work and paginates", async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create schema app_private;grant usage on schema app_private to anon;
    create function app_private.has_valid_sync_secret() returns boolean language sql as $$select true$$;
    grant execute on function app_private.has_valid_sync_secret() to anon;
    insert into auth.users(id,email_confirmed_at,is_anonymous) values('${A}',now(),false),('${B}',now(),false),('${C}',null,false);
    create table public.tenders(ocid text primary key,tender_no text,title text,title_snippet text,bid_description text,buyer_name text,department text,closing_at timestamptz,briefing_datetime timestamptz,compulsory_briefing boolean,detail_path text,original_source_url text,detail_url text,source_listing_url text,derived_status text);
    grant select on public.tenders to authenticated;
    insert into public.tenders(ocid,tender_no,title,closing_at,compulsory_briefing) values('test-1','RFQ-1','First tender',now()+interval '2 days',true),('test-2','RFQ-2','Second tender',now()+interval '1 day',false),('test-3','RFQ-3','Expired tender',now()-interval '3 days',false);`)
  await db.exec(
    await readFile(
      "supabase/migrations/20261008153243_customer_accounts.sql",
      "utf8"
    )
  )
  await db.exec(
    await readFile(
      "supabase/migrations/20261012112923_bid_workspace.sql",
      "utf8"
    )
  )
  const companies = await db.query<{ user_id: string; company_id: string }>(
    "select u.id as user_id, public.bootstrap_customer_workspace(u.id) as company_id from auth.users u"
  )
  const companyA = companies.rows.find((row) => row.user_id === A)!.company_id
  const companyB = companies.rows.find((row) => row.user_id === B)!.company_id
  const login = async (id: string) =>
    db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${id}'`
    )
  const save = async (ocid: string) =>
    (
      await db.query<{ bid: Record<string, unknown> }>(
        "select to_jsonb(public.save_workspace_bid($1)) as bid",
        [ocid]
      )
    ).rows[0].bid
  const update = async (id: unknown, version: unknown, patch: unknown) =>
    (
      await db.query<{ bid: Record<string, unknown> }>(
        "select to_jsonb(public.update_workspace_bid($1::uuid,$2::int,$3::jsonb)) as bid",
        [id, version, JSON.stringify(patch)]
      )
    ).rows[0].bid
  await t.test(
    "existing anon schema usage and sync helper preserved; workspace grants restricted",
    async () => {
      await db.exec("set role anon")
      assert.equal(
        (
          await db.query<{ valid: boolean }>(
            "select app_private.has_valid_sync_secret() as valid"
          )
        ).rows[0].valid,
        true
      )
      await assert.rejects(save("test-1"), /permission denied/)
      await assert.rejects(
        db.exec("select * from workspace_bids"),
        /permission denied/
      )
      await db.exec("reset role")
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select has_table_privilege('authenticated','workspace_bids','truncate') as allowed"
          )
        ).rows[0].allowed,
        false
      )
    }
  )
  await login(A)
  let bid = await save("test-1")
  await t.test(
    "snapshot server-built, duplicate saves/import preserve preparation and immutable identities",
    async () => {
      assert.equal(
        (bid.tender_snapshot as { title: string }).title,
        "First tender"
      )
      assert.equal((bid.checklist as unknown[]).length, 0)
      bid = await update(bid.id, bid.version, {
        stage: "preparing",
        notes: "Private draft"
      })
      assert.equal((bid.checklist as unknown[]).length, 7)
      assert.equal(bid.checklist_initialized, true)
      assert.equal((await save("test-1")).notes, "Private draft")
      const imported = (
        await db.query<{ result: Array<{ status: string }> }>(
          "select public.import_workspace_bids(array['test-1','test-2','missing']) as result"
        )
      ).rows[0].result
      assert.deepEqual(
        imported.map((item) => item.status),
        ["already_exists", "inserted", "unavailable"]
      )
      await assert.rejects(
        db.exec(`update workspace_bids set company_id='${companyB}'`),
        /permission denied/
      )
      await assert.rejects(
        db.exec(`update workspace_bids set tender_snapshot='{}'::jsonb`),
        /permission denied/
      )
      await assert.rejects(
        db.exec(
          `insert into workspace_bids(company_id,tender_ocid,tender_snapshot) values('${companyA}','test-3','{}')`
        ),
        /permission denied/
      )
      await assert.rejects(
        db.exec(
          `insert into workspace_bids(company_id,tender_ocid) values('${companyB}','test-3')`
        ),
        /row-level security/
      )
      await assert.rejects(
        db.exec(`update workspace_bids set version=200`),
        /permission denied/
      )
    }
  )
  await t.test(
    "optimistic versions, checklist validation, one-time initialization and transition constraints",
    async () => {
      await assert.rejects(
        update(bid.id, 1, { notes: "stale" }),
        /Workspace changed/
      )
      await assert.rejects(
        update(bid.id, bid.version, {
          checklist: [{ id: "bad", label: "x", completed: true }]
        }),
        /check constraint/
      )
      await assert.rejects(
        update(bid.id, bid.version, { notes: "x".repeat(10001) }),
        /check constraint/
      )
      await assert.rejects(
        update(bid.id, bid.version, { outcome: "won" }),
        /check constraint/
      )
      await assert.rejects(
        update(bid.id, bid.version, { stage: "submitted" }),
        /check constraint/
      )
      bid = await update(bid.id, bid.version, { checklist: [] })
      bid = await update(bid.id, bid.version, { stage: "reviewing" })
      bid = await update(bid.id, bid.version, { stage: "preparing" })
      assert.equal((bid.checklist as unknown[]).length, 0)
      bid = await update(bid.id, bid.version, {
        stage: "submitted",
        submitted_at: new Date().toISOString(),
        submission_reference: "receipt-1"
      })
      await assert.rejects(
        update(bid.id, bid.version, { outcome: "not_bidding" }),
        /check constraint/
      )
      bid = await update(bid.id, bid.version, { outcome: "won" })
      bid = await update(bid.id, bid.version, { archive: true })
      assert.ok(bid.archived_at)
      bid = await update(bid.id, bid.version, {
        archive: false,
        outcome: null,
        stage: "preparing"
      })
      assert.equal(bid.submitted_at, null)
      assert.equal(bid.submission_reference, null)
    }
  )
  await t.test(
    "other, unverified and anonymous accounts cannot read or mutate entries",
    async () => {
      await login(B)
      assert.equal(
        (await db.query("select * from workspace_bids")).rows.length,
        0
      )
      await assert.rejects(
        update(bid.id, bid.version, { notes: "foreign" }),
        /Workspace changed/
      )
      await assert.rejects(
        db.query("select public.delete_workspace_bid($1::uuid,$2::int)", [
          bid.id,
          bid.version
        ]),
        /Workspace changed/
      )
      await save("test-1")
      await login(C)
      assert.equal(
        (await db.query("select * from workspace_bids")).rows.length,
        0
      )
      await assert.rejects(save("test-1"), /Verified account/)
      await db.exec(
        `reset role;update auth.users set is_anonymous=true where id='${A}'`
      )
      await login(A)
      assert.equal(
        (await db.query("select * from workspace_bids")).rows.length,
        0
      )
      await assert.rejects(save("test-1"), /Verified account/)
      await db.exec(
        `reset role;update auth.users set is_anonymous=false where id='${A}'`
      )
      await login(A)
    }
  )
  await t.test(
    "list globally deadline-sorted across mixed stages, active board bounded per column with counts",
    async () => {
      const data = (
        await db.query<{ data: { items: Array<{ tender_ocid: string }> } }>(
          "select public.list_workspace_bids() as data"
        )
      ).rows[0].data
      assert.deepEqual(
        data.items.map((item) => item.tender_ocid),
        ["test-2", "test-1"]
      )
      await db.exec(
        `reset role;insert into tenders(ocid,tender_no,title,closing_at) select 'bulk-'||i,'B-'||i,'Bulk tender '||i,now()+interval '10 days' from generate_series(1,35) i;`
      )
      await login(A)
      await db.query(
        "select public.import_workspace_bids(array(select 'bulk-'||i from generate_series(1,35) i))"
      )
      const board = (
        await db.query<{
          data: { items: unknown[]; counts: { saved: number } }
        }>(
          "select public.list_workspace_bids('','active','saved',false,'board',1,'{}') as data"
        )
      ).rows[0].data
      assert.equal(board.items.length, 30)
      assert.equal(board.counts.saved, 36)
      const more = (
        await db.query<{ data: { items: unknown[] } }>(
          `select public.list_workspace_bids('','active','saved',false,'board',1,'{"saved":30}') as data`
        )
      ).rows[0].data
      assert.equal(more.items.length, 6)
      const plan = await db.query(
        "explain select * from workspace_bid_entries where company_id=$1::uuid and archived_at is null and stage=$2",
        [companyA, "saved"]
      )
      assert.ok(plan.rows.length)
    }
  )
  await t.test(
    "expiry/removal retain work and snapshots; live deadline acknowledgement only",
    async () => {
      const expired = await save("test-3")
      assert.ok(expired.id)
      await db.exec(
        `reset role;update tenders set closing_at=now()+interval '7 days' where ocid='test-1'`
      )
      await login(A)
      await assert.rejects(
        db.exec(
          `update workspace_bids set acknowledged_closing_at='2000-01-01' where id='${bid.id}'`
        ),
        /Invalid deadline/
      )
      bid = await update(bid.id, bid.version, { acknowledge_deadline: true })
      assert.ok(bid.acknowledged_closing_at)
      await db.exec("reset role;delete from tenders where ocid='test-1'")
      await login(A)
      const entry = (
        await db.query<{
          source_available: boolean
          tender: { title: string }
        }>(
          "select source_available,tender from workspace_bid_entries where id=$1::uuid",
          [bid.id]
        )
      ).rows[0]
      assert.equal(entry.source_available, false)
      assert.equal(entry.tender.title, "First tender")
      assert.equal((await save("test-1")).notes, "Private draft")
    }
  )
  await t.test(
    "owner deletion removes only own private bids; stale token sees none",
    async () => {
      await db.exec(`reset role;delete from auth.users where id='${A}'`)
      await login(A)
      assert.equal(
        (await db.query("select * from workspace_bids")).rows.length,
        0
      )
      await assert.rejects(save("test-2"), /Verified account/)
      await login(B)
      assert.equal(
        (await db.query("select * from workspace_bids")).rows.length,
        1
      )
      assert.ok((await db.query("select * from tenders")).rows.length)
    }
  )
})
