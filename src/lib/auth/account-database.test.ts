import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

test("customer migration enforces owner-only access, atomic bootstrap and isolated cascades", async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table public.tender_catalog_fixture(id int primary key); insert into public.tender_catalog_fixture values (1);
    insert into auth.users(id,email_confirmed_at) values ('${A}',now()),('${B}',now()),('${C}',null);`)
  await db.exec(await readFile("supabase/migrations/20261008124213_customer_accounts.sql", "utf8"))
  const bootstrap = (id: string) => db.query<{ id: string }>("select public.bootstrap_customer_workspace($1::uuid) as id", [id])
  await db.exec("set role service_role")
  const companyA = (await bootstrap(A)).rows[0].id
  const companyB = (await bootstrap(B)).rows[0].id
  await db.exec("reset role")
  await t.test("anonymous access and ordinary bootstrap calls are denied", async () => {
    await db.exec("set role anon")
    for (const table of ["profiles", "companies", "company_memberships"]) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/)
    await assert.rejects(bootstrap(A), /permission denied/)
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${A}'`)
    await assert.rejects(bootstrap(A), /permission denied/)
  })
  await t.test("A reads/edits permitted own fields, not ownership, membership or B", async () => {
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${A}'`)
    assert.deepEqual((await db.query("select user_id from public.profiles")).rows, [{ user_id: A }])
    assert.deepEqual((await db.query("select id from public.companies")).rows, [{ id: companyA }])
    assert.equal((await db.query("select * from public.company_memberships")).rows.length, 1)
    await db.exec(`update public.profiles set display_name='Alice',company_prompt_dismissed_at=now(),profile_prompt_dismissed_at=now() where user_id='${A}';
      update public.companies set name='A company' where id='${companyA}';`)
    assert.equal((await db.query<{ display_name: string }>("select display_name from public.profiles")).rows[0].display_name, "Alice")
    assert.equal((await db.query(`update public.profiles set display_name='forged' where user_id='${B}' returning user_id`)).rows.length, 0)
    assert.equal((await db.query(`update public.companies set name='forged' where id='${companyB}' returning id`)).rows.length, 0)
    await assert.rejects(db.exec(`update public.profiles set user_id='${B}'`), /permission denied/)
    await assert.rejects(db.exec(`update public.companies set owner_user_id='${B}'`), /permission denied/)
    await assert.rejects(db.exec("update public.company_memberships set role='owner'"), /permission denied/)
    await assert.rejects(db.exec(`insert into public.profiles(user_id) values ('${C}')`), /permission denied/)
    await assert.rejects(db.exec("delete from public.companies"), /permission denied/)
    await assert.rejects(db.exec(`update public.profiles set display_name='${"x".repeat(101)}'`), /check constraint/)
  })
  await t.test("B cannot inspect A's fields or membership", async () => {
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${B}'`)
    assert.equal((await db.query(`select * from public.profiles where user_id='${A}'`)).rows.length, 0)
    assert.equal((await db.query(`select * from public.companies where id='${companyA}'`)).rows.length, 0)
    assert.equal((await db.query(`select * from public.company_memberships where user_id='${A}'`)).rows.length, 0)
  })
  await t.test("retries and concurrent invocations preserve names and create no duplicates", async () => {
    await db.exec("reset role; set role service_role")
    const results = await Promise.all(Array.from({ length: 5 }, () => bootstrap(A)))
    assert.ok(results.every(result => result.rows[0].id === companyA))
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from public.companies")).rows[0].count, 2)
    assert.equal((await db.query<{ name: string }>(`select name from public.companies where id='${companyA}'`)).rows[0].name, "A company")
    assert.equal((await db.query<{ display_name: string }>(`select display_name from public.profiles where user_id='${A}'`)).rows[0].display_name, "Alice")
    assert.equal((await db.query(`select * from public.profiles where user_id='${C}'`)).rows.length, 0)
  })
  await t.test("conflicting membership rolls back all bootstrap writes", async () => {
    await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${C}';
      insert into public.company_memberships(company_id,user_id) values ('${companyA}','${C}'); set role service_role;`)
    await assert.rejects(bootstrap(C), /ownership conflicts/)
    await assert.rejects(bootstrap(A), /additional members/)
    assert.equal((await db.query(`select * from public.profiles where user_id='${C}'`)).rows.length, 0)
    assert.equal((await db.query(`select * from public.companies where owner_user_id='${C}'`)).rows.length, 0)
    await db.exec(`reset role; delete from public.company_memberships where user_id='${C}'`)
  })
  await t.test("sole-owner deletion cascades A private data and preserves B/catalog; stale ID cannot bootstrap", async () => {
    await db.exec(`reset role; delete from auth.users where id='${A}'`)
    for (const table of ["profiles", "company_memberships"]) assert.equal((await db.query(`select * from public.${table} where user_id='${A}'`)).rows.length, 0)
    assert.equal((await db.query(`select * from public.companies where owner_user_id='${A}'`)).rows.length, 0)
    assert.equal((await db.query(`select * from public.companies where owner_user_id='${B}'`)).rows.length, 1)
    assert.equal((await db.query("select * from public.tender_catalog_fixture")).rows.length, 1)
    await db.exec("set role service_role")
    await assert.rejects(bootstrap(A), /foreign key constraint/)
  })
})
