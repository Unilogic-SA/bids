import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import type { ActivityPage } from "./types"

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

test("activity captures meaningful transitions and preserves personal, membership-scoped attention", async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at) values('${A}','a@example.test',now()),('${B}','b@example.test',now()),('${C}','c@example.test',null);
    create table public.tenders(ocid text primary key,tender_no text,title text,title_snippet text,bid_description text,buyer_name text,department text,closing_at timestamptz,briefing_datetime timestamptz,compulsory_briefing boolean,detail_path text,original_source_url text,detail_url text,source_listing_url text,derived_status text,status text default 'active',listing_type text default 'ocds',captured_at timestamptz default now());
    grant select on public.tenders to authenticated;
    insert into public.tenders(ocid,title,closing_at) values('changes','Changed tender',now()+interval '3 days'),('reminder','Reminder tender',now()+interval '12 hours');`)
  for (const file of ["20261008153243_customer_accounts.sql", "20261012112923_bid_workspace.sql", "20261015124223_shared_workspaces.sql"]) {
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"))
  }
  const scalar = async <T>(sql: string, args: unknown[] = []) => (await db.query<{ value: T }>("select " + sql + " as value", args)).rows[0].value
  const login = (user: string) => db.exec("reset role;set role authenticated;set request.jwt.claim.sub='" + user + "'")
  await db.exec("set role service_role")
  const company = await scalar<string>("public.bootstrap_customer_workspace($1)", [A])
  const other = await scalar<string>("public.bootstrap_customer_workspace($1)", [B])
  await db.query("insert into company_memberships(company_id,user_id,role) values($1,$2,'member')", [company, B])
  await login(A)
  const changes = await scalar<{ id: string }>("to_jsonb(public.save_workspace_bid($1,$2))", [company, "changes"])
  const reminder = await scalar<{ id: string }>("to_jsonb(public.save_workspace_bid($1,$2))", [company, "reminder"])
  await db.exec("reset role")
  const original = (await db.query("select to_jsonb(b) as bid from workspace_bids b order by id")).rows
  await db.exec(await readFile("supabase/migrations/20261020184000_activity_inbox.sql", "utf8"))
  assert.deepEqual((await db.query("select to_jsonb(b) as bid from workspace_bids b order by id")).rows, original)
  const feed = (id = company, page = 1, view = "inbox") => scalar<ActivityPage>("public.list_workspace_activity($1,$2,$3)", [id, page, view])
  const action = (bid: string, keys: string[], value: string) => scalar("public.update_workspace_activity($1,$2,$3,$4)", [company, bid, keys, value])
  const source = async (sql: string) => { await db.exec("reset role;" + sql); await login(A) }

  await t.test("baseline and routine imports stay silent; actual source changes group by bid", async () => {
    await login(A)
    assert.equal((await feed()).total, 0)
    await source("update tenders set captured_at=now(),title=title")
    assert.equal((await feed()).total, 0)
    await source("update tenders set captured_at=now(),closing_at=closing_at-interval '1 day' where ocid='changes'")
    const first = await feed()
    assert.equal(first.total, 1)
    assert.equal(first.unread, 1)
    assert.equal(first.items[0].reasons[0].kind, "deadline")
    await source("update tenders set captured_at=now(),closing_at=closing_at where ocid='changes'")
    assert.deepEqual((await feed()).items, first.items)
  })
  await t.test("reading is personal, stale acknowledgements cannot consume a new transition", async () => {
    const first = (await feed()).items[0]
    await action(changes.id, first.reasons.map(r => r.key), "read")
    assert.equal((await feed()).unread, 0)
    await login(B)
    assert.equal((await feed()).unread, 1)
    await login(A)
    await source("update tenders set closing_at=closing_at+interval '2 days',captured_at=now() where ocid='changes'")
    await action(changes.id, first.reasons.map(r => r.key), "read")
    assert.equal((await feed()).unread, 1)
    const newer = (await feed()).items[0]
    assert.notEqual(newer.reasons[0].key, first.reasons[0].key)
    await action(changes.id, newer.reasons.map(r => r.key), "snooze")
    assert.equal((await feed()).total, 0)
    assert.equal((await feed(company, 1, "snoozed")).total, 1)
    await action(changes.id, newer.reasons.map(r => r.key), "unsnooze")
    assert.equal((await feed()).total, 1)
    await action(changes.id, newer.reasons.map(r => r.key), "dismiss")
    assert.equal((await feed()).total, 0)
    await source("update tenders set closing_at=closing_at-interval '1 day',captured_at=now() where ocid='changes'")
    assert.equal((await feed()).unread, 1)
    // Source switches establish a baseline instead of pretending to be amendments.
    await source("update tenders set listing_type='portal_active_fallback',closing_at=closing_at+interval '1 day',captured_at=now() where ocid='changes'")
    assert.equal((await feed()).total, 0)
    await source("update tenders set listing_type='ocds',closing_at=closing_at-interval '1 day',captured_at=now() where ocid='changes'")
    assert.equal((await feed()).total, 0)
  })
  await t.test("reminders require active pursuit, use stable keys, and disappear after submission", async () => {
    assert.equal((await feed()).total, 0) // Saved-only is quiet.
    await db.query("update workspace_bids set stage='preparing' where id=$1", [reminder.id])
    const first = (await feed()).items[0]
    assert.equal(first.bidId, reminder.id)
    assert.equal(first.reasons[0].kind, "closing")
    await action(reminder.id, first.reasons.map(r => r.key), "read")
    assert.equal((await feed()).unread, 0)
    assert.equal((await feed()).items[0].reasons[0].key, first.reasons[0].key)
    await db.query("update workspace_bids set stage='submitted',submitted_at=now() where id=$1", [reminder.id])
    assert.equal((await feed()).total, 0)
    await db.query("update workspace_bids set stage='preparing',submitted_at=null where id=$1", [reminder.id])
    assert.equal((await feed()).unread, 0)
    await source("update tenders set closing_at=now()-interval '1 hour',captured_at=now() where ocid='reminder'")
    const overdue = (await feed()).items[0]
    assert.equal(overdue.reasons.find(r => r.kind === "closing")?.payload.passed, true)
    assert.equal((await feed()).total, 1) // Change + reminder is still one bid.
  })
  await t.test("explicit raw cancellation suppresses reminders; missing dates never imply cancellation", async () => {
    await source("update tenders set status='cancelled',derived_status='closed',captured_at=now() where ocid='reminder'")
    const cancelled = (await feed()).items[0]
    assert.deepEqual(cancelled.reasons.map(r => r.kind), ["cancelled"])
    await source("update tenders set status='active',closing_at=null,captured_at=now() where ocid='reminder'")
    assert.equal((await feed()).total, 0)
    await source("delete from tenders where ocid='reminder'")
    assert.equal((await feed()).total, 0)
  })
  await t.test("preferences are personal and ended bids do not revive old source notifications", async () => {
    await source("update tenders set closing_at=closing_at-interval '1 hour',captured_at=now() where ocid='changes'")
    assert.equal((await feed()).total, 1)
    await scalar("public.set_workspace_activity_preferences($1,false,true)", [company])
    assert.equal((await feed()).total, 0)
    await login(B)
    assert.equal((await feed()).total, 1)
    await login(A)
    await scalar("public.set_workspace_activity_preferences($1,true,true)", [company])
    await db.query("update workspace_bids set archived_at=now() where id=$1", [changes.id])
    assert.equal((await feed()).total, 0)
    await db.query("update workspace_bids set archived_at=null where id=$1", [changes.id])
    assert.equal((await feed()).total, 0)
  })
  await t.test("pagination and unread count cover the whole workspace, not just the visible page", async () => {
    await source("insert into tenders(ocid,title,closing_at) select 'bulk-'||i,'Bulk '||i,now()+interval '5 days' from generate_series(1,23) i")
    for (let i = 1; i <= 23; i++) await scalar("public.save_workspace_bid($1,$2)", [company, "bulk-" + i])
    await source("update tenders set closing_at=closing_at-interval '1 day',captured_at=now() where ocid like 'bulk-%'")
    const first = await feed(), second = await feed(company, 2)
    assert.equal(first.items.length, 20)
    assert.equal(second.items.length, 3)
    assert.equal(first.total, 23)
    assert.equal(first.unread, 23)
    assert.equal(new Set([...first.items, ...second.items].map(i => i.bidId)).size, 23)
  })
  await t.test("RLS blocks cross-workspace, unverified, anonymous and removed-member access", async () => {
    await assert.rejects(feed(other), /Workspace unavailable/)
    await assert.rejects(scalar("public.update_workspace_activity($1,$2,array['fake'],'read')", [other, changes.id]), /Workspace unavailable/)
    await assert.rejects(db.query("insert into workspace_activity_events(company_id,bid_id,kind,payload) values($1,$2,'deadline','{}')", [company, changes.id]), /permission denied/)
    await assert.rejects(db.query("insert into workspace_activity_state(user_id,company_id,bid_id,event_key) values($1,$2,$3,'fake')", [B, company, changes.id]), /row-level security/)
    await login(C)
    await assert.rejects(feed(), /Workspace unavailable/)
    await db.exec("reset role;set role anon")
    await assert.rejects(feed(), /permission denied/)
    await source("delete from company_memberships where company_id='" + company + "' and user_id='" + B + "'")
    await login(B)
    await assert.rejects(feed(), /Workspace unavailable/)
    assert.equal((await db.query("select * from workspace_activity_events")).rows.length, 0)
    assert.equal((await db.query("select * from workspace_activity_state")).rows.length, 0)
  })
})
