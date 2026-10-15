import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const HASH = "a".repeat(64), ROTATED = "b".repeat(64)
test("shared workspaces retain private work, enforce scoped access and atomic invitation lifecycle", async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at) values('${A}','a@example.test',now()),('${B}','b@example.test',now()),('${C}','c@example.test',now()),('${D}','d@example.test',null);
    create table public.tenders(ocid text primary key,tender_no text,title text,title_snippet text,bid_description text,buyer_name text,department text,closing_at timestamptz,briefing_datetime timestamptz,compulsory_briefing boolean,detail_path text,original_source_url text,detail_url text,source_listing_url text,derived_status text);
    grant select on public.tenders to authenticated;
    insert into public.tenders(ocid,title,closing_at) values('test-1','First tender',now()+interval '2 days'),('test-2','Second tender',now()+interval '3 days');`)
  for (const file of ["20261008153243_customer_accounts.sql", "20261012112923_bid_workspace.sql"]) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"))
  const login = (id: string) => db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}'`)
  const service = () => db.exec("reset role;set role service_role")
  const scalar = async <T>(sql: string, args: unknown[] = []) => (await db.query<{ value: T }>(`select ${sql} as value`, args)).rows[0].value
  await service()
  const companyA = await scalar<string>("public.bootstrap_customer_workspace($1)", [A]), companyB = await scalar<string>("public.bootstrap_customer_workspace($1)", [B])
  await login(A)
  const bidA = await scalar<{ id: string; version: number; company_id: string }>("to_jsonb(public.save_workspace_bid($1::text))", ["test-1"])
  await login(B)
  const bidB = await scalar<{ id: string; version: number }>("to_jsonb(public.save_workspace_bid($1::text))", ["test-1"])
  await db.exec("reset role")
  const originalBids = (await db.query("select to_jsonb(b) as bid from workspace_bids b order by id")).rows
  await db.exec(await readFile("supabase/migrations/20261015124223_shared_workspaces.sql", "utf8"))
  assert.deepEqual((await db.query("select to_jsonb(b) as bid from workspace_bids b order by id")).rows, originalBids)
  await service()
  await assert.rejects(scalar("public.bootstrap_customer_workspace($1)", [D]), /Verified account/)
  const create = (actor: string, company: string, email: string, hash = HASH, id: string | null = null) => scalar<{ id: string; sendVersion: number }>("public.prepare_workspace_invitation($1,$2,$3,$4,$5)", [actor, company, email, hash, id])
  const accept = (actor: string, id: string, hash = HASH) => scalar<string>("public.accept_workspace_invitation($1,$2,$3)", [actor, id, hash])
  await t.test("service RPCs and direct membership/invitation writes deny ordinary clients", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role;set role ${role};set request.jwt.claim.sub='${A}'`)
      await assert.rejects(create(A, companyA, "b@example.test"), /permission denied/)
      await assert.rejects(scalar("public.read_workspace_members($1,$2)", [A, companyA]), /permission denied/)
      await assert.rejects(scalar("public.review_workspace_invitation($1,$2)", [A, HASH]), /permission denied/)
      await assert.rejects(accept(B, A), /permission denied/)
      await assert.rejects(db.exec(`insert into company_memberships(company_id,user_id) values('${companyA}','${B}')`), /permission denied/)
      await assert.rejects(db.exec("select * from workspace_invitations"), /permission denied/)
    }
    await service()
    await assert.rejects(create(B, companyA, "c@example.test"), /Only the workspace owner/)
  })
  let inv: { id: string; sendVersion: number }
  await t.test("verified email acceptance is explicit, retry-safe and preserves owned workspaces/bootstrap", async () => {
    inv = await create(A, companyA, " B@EXAMPLE.TEST ")
    await assert.rejects(accept(C, inv.id), /invited verified email/)
    await assert.rejects(accept(D, inv.id), /invited verified email/)
    await assert.rejects(accept(B, inv.id, ROTATED), /unavailable/)
    assert.equal(await accept(B, inv.id), companyA)
    assert.equal(await accept(B, inv.id), companyA)
    assert.equal(await scalar("public.bootstrap_customer_workspace($1)", [A]), companyA)
    assert.equal(await scalar("public.bootstrap_customer_workspace($1)", [B]), companyB)
    assert.equal((await db.query("select * from company_memberships where user_id=$1", [B])).rows.length, 2)
    assert.equal((await db.query("select * from workspace_bids")).rows.length, 2)
  })
  await t.test("member read/write is scoped, legacy wrappers stay owned-only, identity columns and other profiles stay private", async () => {
    await login(B)
    const list = (company: string) => scalar<{ total: number; items: Array<{ company_id: string }>; counts: { saved: number } }>("public.list_workspace_bids($1::uuid)", [company])
    for (const company of [companyA, companyB]) { const result = await list(company); assert.equal(result.total, 1); assert.equal(result.counts.saved, 1); assert.equal(result.items[0].company_id, company) }
    const legacy = await scalar<{ total: number; items: Array<{ company_id: string }> }>("public.list_workspace_bids()")
    assert.equal(legacy.total, 1); assert.equal(legacy.items[0].company_id, companyB)
    await assert.rejects(scalar("public.update_workspace_bid($1::uuid,$2::uuid,$3::int,$4::jsonb)", [companyA, bidB.id, 1, '{"notes":"wrong"}']), /Workspace changed/)
    await assert.rejects(scalar("public.update_workspace_bid($1::uuid,$2::int,$3::jsonb)", [bidA.id, 1, '{"notes":"wrong"}']), /Workspace changed/)
    await scalar("public.update_workspace_bid($1::uuid,$2::uuid,$3::int,$4::jsonb)", [companyA, bidA.id, 1, '{"notes":"team"}'])
    await assert.rejects(scalar("public.update_workspace_bid($1::uuid,$2::uuid,$3::int,$4::jsonb)", [companyA, bidA.id, 1, '{"notes":"stale"}']), /Workspace changed/)
    assert.equal((await db.query("select * from profiles")).rows.length, 1)
    assert.equal((await db.query("update companies set name='forged' where id=$1 returning id", [companyA])).rows.length, 0)
    await assert.rejects(db.exec(`update workspace_bids set company_id='${companyB}' where id='${bidA.id}'`), /permission denied/)
    await service()
    const roster = await scalar<{ members: Array<{ email: string | null }> }>("public.read_workspace_members($1,$2)", [B, companyA]); assert.ok(roster.members.every(m => m.email === null))
    const ownerRoster = await scalar<{ members: Array<{ email: string | null }> }>("public.read_workspace_members($1,$2)", [A, companyA]); assert.ok(ownerRoster.members.every(m => m.email))
  })
  await t.test("removal never deletes bids, old accepted tokens cannot restore access, stale JWT immediately loses writes", async () => {
    await service(); await scalar("public.remove_workspace_member($1,$2,$3)", [A, companyA, B])
    await assert.rejects(accept(B, inv.id), /already been used/)
    assert.equal((await db.query("select * from workspace_bids")).rows.length, 2)
    await login(B); assert.equal((await db.query("select * from workspace_bids where company_id=$1", [companyA])).rows.length, 0)
    await assert.rejects(scalar("public.save_workspace_bid($1::uuid,$2::text)", [companyA, "test-2"]), /row-level security/)
    await service(); await assert.rejects(scalar("public.remove_workspace_member($1,$2,$3)", [A, companyA, A]), /owner cannot/)
  })
  await t.test("resend rotates tokens, cooldown/rate/capacity enforced, revoke and expiry prevent joins", async () => {
    await service(); const fresh = await create(A, companyA, "b@example.test", ROTATED)
    await assert.rejects(create(A, companyA, "b@example.test", HASH, fresh.id), /Wait one minute/)
    await db.exec("reset role"); await db.query("update workspace_invitations set last_send_attempt_at=now()-interval '2 minutes' where id=$1", [fresh.id]); await service()
    const renewed = await create(A, companyA, "b@example.test", "c".repeat(64), fresh.id); assert.equal(renewed.sendVersion, 2)
    await assert.rejects(accept(B, fresh.id, ROTATED), /unavailable/)
    await scalar("public.revoke_workspace_invitation($1,$2,$3)", [A, companyA, fresh.id]); await assert.rejects(accept(B, fresh.id, "c".repeat(64)), /unavailable/)
    const expired = await create(A, companyA, "c@example.test", "d".repeat(64))
    await db.exec("reset role"); await db.query("update workspace_invitations set expires_at=now()-interval '1 second' where id=$1", [expired.id]); await service()
    await assert.rejects(accept(C, expired.id, "d".repeat(64)), /expired/)
    await db.exec("reset role"); await db.query("update companies set invite_send_window_started_at=now(),invite_send_count=20 where id=$1", [companyA]); await service()
    await assert.rejects(create(A, companyA, "new@example.test", "c".repeat(64)), /Hourly/)
    await assert.rejects(scalar("public.record_workspace_invitation_send($1,1,'sent',$2,null)", [fresh.id, "x".repeat(201)]), /Invalid send state/)
  })
  await t.test("five places include pending invitations; cancellation releases a seat and no send budget is consumed on rejection", async () => {
    await db.exec("reset role")
    await db.query("update companies set invite_send_count=0 where id=$1", [companyA])
    await service()
    const invitations = []
    for (let i = 0; i < 4; i++) invitations.push(await create(A, companyA, `seat${i}@example.test`, `${i + 1}`.repeat(64)))
    await assert.rejects(create(A, companyA, "extra@example.test", "5".repeat(64)), /five person limit/)
    assert.equal(await scalar<number>("(select invite_send_count from companies where id=$1)", [companyA]), 4)
    await scalar("public.revoke_workspace_invitation($1,$2,$3)", [A, companyA, invitations[0].id])
    await create(A, companyA, "extra@example.test", "5".repeat(64))
  })
  await t.test("scoped import/delete/board and unverified mutation paths cannot cross workspaces", async () => {
    await login(B)
    await assert.rejects(scalar("public.delete_workspace_bid($1::uuid,$2::uuid,1)", [companyA, bidB.id]), /Workspace changed/)
    const imported = await scalar<Array<{ status: string }>>("public.import_workspace_bids($1::uuid,array['test-2'])", [companyB]); assert.equal(imported[0].status, "inserted")
    const board = await scalar<{ total: number; counts: { saved: number }; items: Array<{ company_id: string }> }>("public.list_workspace_bids($1::uuid,'','active','all',false,'board',1,'{}')", [companyB])
    assert.equal(board.total, 2); assert.equal(board.counts.saved, 2); assert.ok(board.items.every(bid => bid.company_id === companyB))
    await db.exec("reset role"); await db.query("update auth.users set email_confirmed_at=null where id=$1", [B]); await login(B)
    await assert.rejects(scalar("public.save_workspace_bid($1::uuid,'test-1')", [companyB]), /Verified account/)
    await assert.rejects(scalar("public.update_workspace_bid($1::uuid,$2::uuid,1,$3::jsonb)", [companyB, bidB.id, JSON.stringify({ notes: "blocked" })]), /Workspace changed/)
    await assert.rejects(scalar("public.delete_workspace_bid($1::uuid,$2::uuid,1)", [companyB, bidB.id]), /Workspace changed/)
    await assert.rejects(scalar("app_private.verified_workspace_email($1)", [A]), /permission denied/)
    await db.exec("reset role"); await db.query("update auth.users set email_confirmed_at=now() where id=$1", [B])
  })
  await t.test("owner invitation history is paginated without tokens; member projection stays minimal", async () => {
    await db.exec("reset role")
    await db.query(`insert into workspace_invitations(company_id,email_normalized,token_hash,invited_by,expires_at) select $1::uuid,'history'||i||'@example.test',repeat(lpad(to_hex(i+100),2,'0'),32),$2::uuid,now()-interval '1 day' from generate_series(1,30) i`, [companyA, A])
    await service()
    const first = await scalar<{ invitations: Array<{ id: string }>; nextOffset: number | null; capacity: number }>("public.read_workspace_members($1,$2,0)", [A, companyA])
    assert.equal(first.invitations.length, 25); assert.equal(first.nextOffset, 25); assert.equal(first.capacity, 5)
    const second = await scalar<{ invitations: Array<{ id: string }>; nextOffset: number | null }>("public.read_workspace_members($1,$2,25)", [A, companyA])
    assert.equal(second.nextOffset, null); assert.ok(second.invitations.length > 0)
    assert.equal(new Set([...first.invitations, ...second.invitations].map(invite => invite.id)).size, first.invitations.length + second.invitations.length)
    assert.ok(!JSON.stringify(first).includes('token_hash')); assert.ok(!JSON.stringify(first).includes(HASH))
    const exposed = await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('bootstrap_customer_workspace','read_workspace_members','prepare_workspace_invitation','record_workspace_invitation_send','review_workspace_invitation','accept_workspace_invitation','revoke_workspace_invitation','remove_workspace_member') and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE'))")
    assert.equal(exposed.rows.length, 0)
  })
  await t.test("owner invariant blocks demotion/moves/deletion and owner Auth deletion is restrictive", async () => {
    await db.exec("reset role")
    await assert.rejects(db.query("delete from auth.users where id=$1", [A]), /foreign key constraint/)
    await assert.rejects(db.query("delete from company_memberships where company_id=$1 and user_id=$2", [companyA, A]), /retain its owner/)
    await assert.rejects(db.query("update company_memberships set role='member' where company_id=$1 and user_id=$2", [companyA, A]), /retain its owner/)
    await assert.rejects(db.query("update company_memberships set company_id=$1 where company_id=$2 and user_id=$3", [companyB, companyA, A]), /one_owner|retain its owner/)
    await db.query("update auth.users set email_confirmed_at=null where id=$1", [B]); await login(B)
    assert.equal((await db.query("select * from workspace_bids")).rows.length, 0)
  })
})
