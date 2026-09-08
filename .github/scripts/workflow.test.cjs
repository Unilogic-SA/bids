/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const run = require('./workflow.cjs');

test('refuses any repository except Unilogic-SA/bids', () => {
  assert.throws(() => run.boundary({repo:{owner:'other',repo:'bids'}}), /boundary/);
  run.boundary({repo:{owner:'Unilogic-SA',repo:'bids'}});
});

test('accepts one local closing reference with ordinary Markdown', () => {
  for (const body of ['Closes #13', '- Closes #13', '- [x] Fixes #13.', 'Summary\nResolves #13 — tested']) {
    assert.equal(run.linkedIssue(body), 13);
  }
  for (const body of ['Closes other/repo#13', 'Closes https://github.com/other/repo/issues/13', 'Closes #1\nFixes #2', 'Closes #0']) {
    assert.equal(run.linkedIssue(body), null);
  }
});

test('recognises direct owner Codex action requests on Issues and PRs', () => {
  const base = {action:'created',issue:{number:12,state:'open'},comment:{user:{login:'Unilogic-SA'},body:'@codex implement this issue'}};
  assert.equal(run.ownerCodexRequest(base), true);
  assert.equal(run.ownerCodexRequest({...base,issue:{...base.issue,pull_request:{url:'pr'}},comment:{...base.comment,body:'@codex fix the review feedback'}}), true);
  assert.equal(run.ownerCodexRequest({...base,comment:{...base.comment,body:'@codex groom this issue only'}}), false);
  assert.equal(run.ownerCodexRequest({...base,comment:{...base.comment,user:{login:'someone-else'}}}), false);
  assert.equal(run.ownerCodexRequest({...base,action:'edited'}), false);
  assert.equal(run.ownerCodexRequest({...base,issue:{...base.issue,state:'closed'}}), false);
});

test('owner implementation comment moves an Issue to in-development without posting bot instructions', async () => {
  const calls = [];
  const github = {rest:{issues:{
    get:async()=>({data:{labels:[{name:'needs-spec'}]}}),
    removeLabel:async args=>calls.push({kind:'remove',...args}),
    addLabels:async args=>calls.push({kind:'add',...args})
  }}};
  await run({github,context:{repo:{owner:'Unilogic-SA',repo:'bids'},eventName:'issue_comment',payload:{action:'created',issue:{number:12,state:'open'},comment:{user:{login:'Unilogic-SA'},body:'@codex build this issue'}}},core:{info(){}}});
  assert.ok(calls.some(c=>c.kind==='remove'&&c.name==='needs-spec'));
  assert.ok(calls.some(c=>c.kind==='add'&&c.labels.includes('in-development')));
});

test('owner fix comment on a linked PR moves both PR and Issue to in-development', async () => {
  const calls = [];
  const pr = {number:21,state:'open',body:'- Closes #13',head:{repo:{full_name:'Unilogic-SA/bids'}},base:{ref:'main'}};
  const github = {rest:{
    pulls:{get:async()=>({data:pr})},
    issues:{
      get:async({issue_number})=>({data:issue_number===13?{number:13,state:'open',labels:[{name:'changes-needed'}]}:{labels:[{name:'changes-needed'}]}}),
      removeLabel:async args=>calls.push({kind:'remove',...args}),
      addLabels:async args=>calls.push({kind:'add',...args})
    }
  }};
  await run({github,context:{repo:{owner:'Unilogic-SA',repo:'bids'},eventName:'issue_comment',payload:{action:'created',issue:{number:21,state:'open',pull_request:{url:'pr'}},comment:{user:{login:'Unilogic-SA'},body:'@codex resolve this on the same PR'}}},core:{info(){}}});
  assert.deepEqual(calls.filter(c=>c.kind==='add').map(c=>c.issue_number).sort((a,b)=>a-b),[13,21]);
});

test('cross-repository event performs no API calls', async () => {
  await assert.rejects(run({github:{},context:{repo:{owner:'other',repo:'bids'}}}), /boundary/);
});

test('all YAML files use valid JSON, safe permissions and repository guards', () => {
  for (const folder of ['workflows','ISSUE_TEMPLATE']) {
    for (const file of fs.readdirSync(path.join(__dirname,'..',folder)).filter(f=>f.endsWith('.yml'))) {
      const doc = JSON.parse(fs.readFileSync(path.join(__dirname,'..',folder,file),'utf8'));
      if (folder !== 'workflows') { assert.ok(doc.body.length); continue; }
      assert.ok(doc.on);
      assert.notEqual(doc.permissions, 'write-all');
      for (const job of Object.values(doc.jobs)) {
        assert.equal(job.if, "github.repository == 'Unilogic-SA/bids'");
        if (doc.on.pull_request_target || doc.on.workflow_run) {
          const checkout = job.steps.find(s=>s.uses?.startsWith('actions/checkout@'));
          assert.equal(checkout.with.ref, 'main');
          assert.equal(checkout.with['persist-credentials'], false);
          assert.ok(!job.steps.some(s=>s.run));
        }
      }
    }
  }
});

test('trusted preview signals must all refer to the current commit', async () => {
  const calls = [];
  const pr = {number:2,head:{sha:'abc',repo:{full_name:'Unilogic-SA/bids'}},base:{ref:'main'},body:'- Closes #1',state:'open',draft:false};
  const issue = {number:1,state:'open',labels:[{name:'in-development'}]};
  let freshSha = 'different';
  const github = {rest:{
    pulls:{list:'pulls',get:async()=>({data:{...pr,head:{...pr.head,sha:freshSha}}})},
    actions:{listWorkflowRuns:'runs'},
    repos:{listDeployments:'deployments',listDeploymentStatuses:async()=>({data:[{state:'success',environment_url:'https://preview.vercel.app'}]})},
    issues:{
      get:async({issue_number})=>({data:issue_number===1?issue:{labels:[{name:'in-development'}]}}),
      removeLabel:async args=>calls.push(args),
      addLabels:async args=>calls.push(args),
      listComments:'comments',createComment:async args=>calls.push(args)
    }
  },paginate:async method=>{
    if(method==='pulls') return [pr];
    if(method==='runs') return [{id:1,head_repository:{full_name:'Unilogic-SA/bids'},status:'completed',conclusion:'success'}];
    if(method==='deployments') return [{id:1,environment:'Preview',creator:{login:'vercel[bot]'}}];
    return [];
  }};
  const ctx = {github,context:{repo:{owner:'Unilogic-SA',repo:'bids'}},core:{info(){}}};
  await run.preview(ctx);
  assert.equal(calls.length,0,'stale commit must not be ready');
  freshSha='abc';
  await run.preview(ctx);
  assert.ok(calls.some(c=>c.issue_number===1&&c.labels?.includes('ready-for-testing')));
  calls.length=0;
  issue.labels=[{name:'changes-needed'}];
  await run.preview(ctx);
  assert.equal(calls.length,0,'human changes request must survive readiness reconciliation');
});

