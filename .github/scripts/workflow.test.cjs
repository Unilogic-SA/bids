const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const run = require('./workflow.cjs');
test('refuses any repository except Unilogic-SA/bids', () => {
  assert.throws(() => run.boundary({repo:{owner:'other',repo:'bids'}}), /boundary/);
  run.boundary({repo:{owner:'Unilogic-SA',repo:'bids'}});
});
test('only accepts one unambiguous local closing line', () => {
  assert.equal(run.linkedIssue('Summary\nCloses #123\n'), 123);
  for (const body of ['Closes other/repo#1','Closes https://github.com/other/repo/issues/1','Closes #1 and #2','Closes #1\nFixes #2','Closes #0']) assert.equal(run.linkedIssue(body), null);
});
test('intake requires useful specification sections', () => {
  assert.equal(run.specComplete('### Problem\nUsers cannot find relevant tenders.\n### Desired Outcome\nMake finding relevant tenders easier.\n### Acceptance Criteria\nThe owner can filter by province.'), true);
  assert.equal(run.specComplete('### What happened\nThe filter resets unexpectedly.\n### Expected behaviour\nThe chosen filter should remain.\n### Steps to reproduce\nChoose a filter then move to page two.\n### Acceptance criteria for the fix\nThe filter remains selected on page two.'), true);
  assert.equal(run.specComplete('### Problem\n_No response_\n### Desired Outcome\nTBD\n### Acceptance Criteria\n<!-- fill this section -->'), false);
});
test('all YAML files use valid JSON (a YAML subset), safe permissions and repository guard', () => {
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
test('cross-repository event performs no API calls', async () => {
  await assert.rejects(run({github:{},context:{repo:{owner:'other',repo:'bids'}}}), /boundary/);
});
test('trusted preview signals must all refer to the current commit', async () => {
  const calls = [];
  const pr = {number:2,head:{sha:'abc',repo:{full_name:'Unilogic-SA/bids'}},base:{ref:'main'},body:'Closes #1',state:'open',draft:false};
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

