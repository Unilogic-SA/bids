/* eslint-disable @typescript-eslint/no-require-imports */
// Metadata-only automation. Never execute PR code or fetch an external repository.
const REPO = { owner: 'Unilogic-SA', repo: 'bids' };
const FULL = 'Unilogic-SA/bids';
const OWNER = 'Unilogic-SA';
const STATES = ['needs-spec', 'codex-ready', 'in-development', 'ready-for-testing', 'changes-needed', 'approved'];
const ACTION_WORDS = /\b(?:implement|build|fix|change|update|continue|resolve)\b/i;

function boundary(context) {
  if (context.repo.owner + '/' + context.repo.repo !== FULL) throw new Error('Repository boundary violation');
}

function linkedIssue(body = '') {
  // Accept normal Markdown around one local closing reference while rejecting URLs and owner/repo references.
  const matches = [...body.matchAll(/\b(?:closes|fixes|resolves)\s+#([1-9]\d*)\b/gi)];
  return matches.length === 1 ? Number(matches[0][1]) : null;
}

function ownerCodexRequest(payload = {}) {
  const issue = payload.issue;
  const comment = payload.comment;
  return Boolean(
    payload.action === 'created' &&
    issue?.state === 'open' &&
    comment?.user?.login === OWNER &&
    /@codex\b/i.test(comment.body || '') &&
    ACTION_WORDS.test(comment.body || '')
  );
}

async function state(github, number, next) {
  const { data: item } = await github.rest.issues.get({ ...REPO, issue_number: number });
  const labels = item.labels.map(l => typeof l === 'string' ? l : l.name);
  for (const name of labels.filter(n => STATES.includes(n) && n !== next)) {
    try { await github.rest.issues.removeLabel({ ...REPO, issue_number: number, name }); }
    catch (e) { if (e.status !== 404) throw e; }
  }
  if (next && !labels.includes(next)) await github.rest.issues.addLabels({ ...REPO, issue_number: number, labels: [next] });
}

async function note(github, number, text) {
  const marker = '<!-- bids-workflow -->';
  const comments = await github.paginate(github.rest.issues.listComments, { ...REPO, issue_number: number, per_page: 100 });
  const prior = comments.find(c => c.user.login === 'github-actions[bot]' && c.body.startsWith(marker));
  const body = marker + '\n' + text;
  if (prior && prior.body !== body) await github.rest.issues.updateComment({ ...REPO, comment_id: prior.id, body });
  else if (!prior) await github.rest.issues.createComment({ ...REPO, issue_number: number, body });
}

async function origin(github, pr) {
  const number = linkedIssue(pr.body || '');
  if (!number) return null;
  try {
    const { data } = await github.rest.issues.get({ ...REPO, issue_number: number });
    return data.pull_request ? null : data;
  } catch (e) { if (e.status === 404) return null; throw e; }
}

async function run({ github, context, core }) {
  boundary(context);
  if (context.eventName === 'workflow_dispatch') {
    const wanted = require('../labels.json');
    const existing = await github.paginate(github.rest.issues.listLabelsForRepo, { ...REPO, per_page: 100 });
    for (const label of wanted) if (!existing.some(l => l.name === label.name)) await github.rest.issues.createLabel({ ...REPO, ...label });
    core.info('Labels installed for ' + FULL);
    return;
  }

  if (context.eventName === 'issue_comment') {
    if (!ownerCodexRequest(context.payload)) return;
    const number = context.payload.issue.number;
    if (!context.payload.issue.pull_request) return state(github, number, 'in-development');

    const { data: pr } = await github.rest.pulls.get({ ...REPO, pull_number: number });
    if (pr.state !== 'open' || pr.head.repo?.full_name !== FULL || pr.base.ref !== 'main') return;
    const issue = await origin(github, pr);
    if (!issue) return;
    await state(github, pr.number, 'in-development');
    if (issue.state === 'open') await state(github, issue.number, 'in-development');
    return;
  }

  if (context.eventName === 'issues') {
    const number = context.payload.issue.number;
    const { data: issue } = await github.rest.issues.get({ ...REPO, issue_number: number });
    if (issue.state === 'closed') return state(github, number, null);
    if (context.payload.action === 'labeled' && STATES.includes(context.payload.label.name)) {
      await state(github, number, context.payload.label.name);
    }
    return;
  }

  const eventPr = context.payload.pull_request;
  if (!eventPr || eventPr.head.repo?.full_name !== FULL || eventPr.base.ref !== 'main') return;
  const { data: pr } = await github.rest.pulls.get({ ...REPO, pull_number: eventPr.number });
  const issue = await origin(github, pr);
  if (!issue) return;

  if (pr.state === 'closed') {
    await state(github, pr.number, null);
    if (pr.merged) await state(github, issue.number, null);
    return;
  }
  if (context.payload.action === 'labeled' && STATES.includes(context.payload.label.name)) {
    await state(github, pr.number, context.payload.label.name);
    if (issue.state === 'open') await state(github, issue.number, context.payload.label.name);
    return;
  }
  if (['opened', 'edited', 'reopened', 'synchronize', 'ready_for_review', 'converted_to_draft'].includes(context.payload.action)) {
    await state(github, pr.number, 'in-development');
    if (issue.state === 'open') await state(github, issue.number, 'in-development');
  }
}

async function preview({ github, context, core }) {
  boundary(context);
  const prs = await github.paginate(github.rest.pulls.list, { ...REPO, state: 'open', base: 'main', per_page: 100 });
  for (const pr of prs) {
    if (pr.draft || pr.head.repo?.full_name !== FULL) continue;
    const { data: current } = await github.rest.issues.get({ ...REPO, issue_number: pr.number });
    if (!current.labels.some(l => l.name === 'in-development')) continue;
    const sha = pr.head.sha;
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, { ...REPO, workflow_id: 'ci.yml', head_sha: sha, event: 'pull_request', per_page: 100 });
    const latest = runs.filter(r => r.head_repository?.full_name === FULL).sort((a,b) => b.id - a.id)[0];
    if (!latest || latest.conclusion !== 'success' || latest.status !== 'completed') continue;
    const deployments = await github.paginate(github.rest.repos.listDeployments, { ...REPO, sha, per_page: 100 });
    const deployment = deployments.filter(d => d.creator?.login === 'vercel[bot]' && d.environment.toLowerCase() === 'preview').sort((a,b) => b.id - a.id)[0];
    if (!deployment) continue;
    const { data: statuses } = await github.rest.repos.listDeploymentStatuses({ ...REPO, deployment_id: deployment.id, per_page: 1 });
    const status = statuses[0];
    if (status?.state !== 'success') continue;
    let url;
    try { url = new URL(status.environment_url); } catch { continue; }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) continue;
    const { data: fresh } = await github.rest.pulls.get({ ...REPO, pull_number: pr.number });
    if (fresh.state !== 'open' || fresh.draft || fresh.head.sha !== sha) continue;
    const issue = await origin(github, fresh);
    if (!issue) continue;
    const { data: freshLabels } = await github.rest.issues.get({ ...REPO, issue_number: pr.number });
    if (!freshLabels.labels.some(l => l.name === 'in-development')) continue;
    if (issue.labels.some(l => ['changes-needed', 'approved'].includes(l.name))) continue;
    await state(github, pr.number, 'ready-for-testing');
    if (issue.state === 'open') await state(github, issue.number, 'ready-for-testing');
    await note(github, pr.number, 'Ready for testing at ' + url.href + '\n\nCommit: ' + sha + '\n\nCI succeeded. Test the acceptance criteria before approving.');
  }
  core.info('Readiness reconciliation complete.');
}

module.exports = run;
module.exports.preview = preview;
module.exports.linkedIssue = linkedIssue;
module.exports.ownerCodexRequest = ownerCodexRequest;
module.exports.boundary = boundary;


