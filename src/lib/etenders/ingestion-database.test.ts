import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"

test("ingestion migration, RLS and transactional document reconciliation", async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;")
  const baseline = await readFile("supabase/migrations/20260513193000_create_tender_catalog.sql", "utf8")
  // gen_random_uuid is built into PostgreSQL; pgcrypto is not needed by these tests.
  await db.exec(baseline.replace("create extension if not exists pgcrypto;", ""))
  await db.exec(await readFile("supabase/migrations/20260518141500_allow_sync_document_reconciliation.sql", "utf8"))
  await db.exec(await readFile("supabase/migrations/20260925140727_retain_tender_source_snapshots.sql", "utf8"))
  await db.exec("insert into app_private.sync_settings(key,value) values ('etenders_sync_secret','test-only');")
  await db.exec("insert into public.tenders(ocid,release_id,tender_no,captured_at) values ('one','release','T1','2026-09-25');")
  const snapshot = `insert into public.tender_source_snapshots(tender_ocid,source,content_hash,payload,source_url,captured_at)
    values ('one','ocds',repeat('a',64),'{"awards":[{"value":42}]}','https://example.com','2026-09-25')
    on conflict(tender_ocid,source,content_hash) do nothing`;
  const docs = (url: string, index: number | null = 1) => [{ tender_ocid: "one", document_url: url, document_index: index }]
  const reconcile = (rows: unknown[], preserve: string[] = [], captured = "2026-09-25") => db.query(
    "select public.reconcile_tender_documents($1,$2::jsonb,$3,$4::timestamptz)", [["one"], JSON.stringify(rows), preserve, captured])

  await t.test("anonymous readers cannot inspect snapshots, write them or invoke reconciliation", async () => {
    await db.exec("set role anon;")
    assert.equal((await db.query("select * from public.tender_source_snapshots")).rows.length, 0)
    await assert.rejects(db.exec(snapshot), /row-level security/)
    await assert.rejects(reconcile([]), /Unauthorized/)
    await db.exec("reset role;")
  })
  await t.test("authorized sync archives once and snapshots are hidden after removing credentials", async () => {
    await db.exec(`set role anon; set request.headers = '{"x-sync-secret":"test-only"}';`)
    await db.exec(snapshot)
    await db.exec(snapshot)
    assert.equal((await db.query("select * from public.tender_source_snapshots")).rows.length, 1)
    await assert.rejects(db.exec("update public.tender_source_snapshots set payload='{}'"), /permission denied/)
    await db.exec("set request.headers='{}';")
    assert.equal((await db.query("select * from public.tender_source_snapshots")).rows.length, 0)
    await db.exec("reset role; set role authenticated;")
    assert.equal((await db.query("select * from public.tender_source_snapshots")).rows.length, 0)
    await assert.rejects(reconcile([]), /Unauthorized/)
    await db.exec(`reset role; set role anon; set request.headers = '{"x-sync-secret":"test-only"}';`)
  })
  await t.test("sync reconciles under existing RLS and preserves downloaded metadata", async () => {
    await reconcile(docs("https://example.com/old.pdf"))
    await db.exec("update public.tender_documents set document_hash='saved-hash', downloaded_at='2026-09-25',file_size_kb=10 where tender_ocid='one';")
    await reconcile(docs("https://example.com/old.pdf"))
    const row = (await db.query<{ document_hash: string; file_size_kb: string }>("select document_hash,file_size_kb from public.tender_documents")).rows[0]
    assert.equal(row.document_hash, "saved-hash")
    assert.equal(Number(row.file_size_kb), 10)
  })
  await t.test("a failed replacement leaves previous documents intact", async () => {
    await assert.rejects(reconcile(docs("https://example.com/broken.pdf", null)), /not-null/)
    assert.deepEqual((await db.query("select document_url from public.tender_documents")).rows, [{ document_url: "https://example.com/old.pdf" }])
  })
  await t.test("portal outage preserves previous documents and recomputes the count", async () => {
    await reconcile(docs("https://example.com/new.pdf"), ["one"])
    assert.equal((await db.query("select * from public.tender_documents")).rows.length, 2)
    assert.deepEqual((await db.query("select documents_count from public.tenders")).rows, [{ documents_count: 2 }])
    await reconcile(docs("https://example.com/new.pdf"))
    assert.equal((await db.query("select * from public.tender_documents")).rows.length, 1)
  })
  await t.test("cross-batch input is rejected", async () => {
    await assert.rejects(reconcile([{ ...docs("https://example.com/no.pdf")[0], tender_ocid: "other" }]), /outside requested/)
  })
  await t.test("older invocations cannot regress the catalog or its documents", async () => {
    await db.exec("update public.tenders set captured_at='2026-09-26',title='newer' where ocid='one';")
    await db.exec("update public.tenders set captured_at='2026-09-25',title='older' where ocid='one';")
    await reconcile([])
    assert.deepEqual((await db.query("select title from public.tenders")).rows, [{ title: "newer" }])
    assert.equal((await db.query("select * from public.tender_documents")).rows.length, 1)
    await db.exec("reset role; set request.headers='{}'; set role service_role;")
    await reconcile([], [], "2026-09-26")
    assert.equal((await db.query("select * from public.tender_documents")).rows.length, 0)
  })
})
