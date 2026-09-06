// Metadata-only automation. Never execute PR code or fetch an external repository.
const REPO = { owner: 'Unilogic-SA', repo: 'bids' };
const FULL = 'Unilogic-SA/bids';
const STATES = ['needs-spec', 'codex-ready', 'in-development', 'ready-for-testing', 'changes-needed', 'approved'];
function boundary(context) {
  if (context.repo.owner + '/' + context.repo.repo !== FULL) throw new Error('Repository boundary violation');
}
function linkedIssue(body = '') {
  // Exactly one explicit local closing line. URLs and owner/repo references are intentionally rejected.
  const matches = [...body.matchAll(/^(?:closes|fixes|resolves)\s+#([1-9]\d*)\s*$/gim)];
  return matches.length === 1 ? Number(matches[0][1]) : null;
}
function specComplete(body = '') {
  const sections = new Map();
  const parts = body.split(/^###?\s+(.+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) sections.set(parts[i].trim().toLowerCase(), (parts[i + 1] || '').replace(/<!--[\s\S]*?-->/g, '').trim());
  const usable = names => names.every(n => {
    const value = sections.get(n) || '';
    return value.length >= 12 && !/^(_no response_|n\/a|tbd|todo|none)[.!]?$/i.test(value);
  });
  return usable(['problem', 'desired outcome', 'acceptance criteria']) ||
    usable(['what happened', 'expected behaviour', 'steps to reproduce', 'acceptance criteria for the fix']);
}
async function state(github, number, next) {
  const { data: item } = await github.rest.issues.get({ ...REPO, issue_number: number });
  const labels = item.labels.map(l => typeof l === 'string' ? l : l.name);
  // Preserve type/risk/size and all unrelated labels.
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
    // Idempotent setup; creates only missing labels and never deletes user labels.
    const wanted = require('../labels.json');
    const existing = await github.paginate(github.rest.issues.listLabelsForRepo, { ...REPO, per_page: 100 });
    for (const label of wanted) if (!existing.some(l => l.name === label.name)) await github.rest.issues.createLabel({ ...REPO, ...label });
    core.info('Labels installed for ' + FULL);
    return;
  }
  if (context.eventName === 'issues') {
    const number = context.payload.issue.number;
    const { data: issue } = await github.rest.issues.get({ ...REPO, issue_number: number });
    if (issue.state === 'closed') return state(github, number, null);
    const labels = issue.labels.map(l => l.name);
    if (context.payload.action === 'opened' && !labels.some(l => STATES.includes(l))) {
      // Intake needs only one label. Ensure it exists on first use.
      try { await github.rest.issues.createLabel({ ...REPO, name: 'needs-spec', color: 'FBCA04', description: 'Clarify the outcome and acceptance criteria' }); }
      catch (e) { if (e.status !== 422) throw e; }
      await state(github, number, 'needs-spec');
    }
    if (labels.includes('codex-ready')) {
      if (!specComplete(issue.body || '')) {
        await state(github, number, 'needs-spec');
        await note(github, number, 'Please complete the problem, desired outcome and acceptance criteria (or the Bug form). Each should contain a useful sentence. Then apply codex-ready again. This check only checks completeness.');
      } else {
        await state(github, number, 'codex-ready');
        await note(github, number, 'Ready for your Codex handoff. In Codex Cloud select Unilogic-SA/bids and submit: "Implement ' + issue.html_url + ' following AGENTS.md. Use a dedicated branch, open a PR with Closes #' + number + ', and do not merge." This label does not launch Codex. See docs/development-workflow.md.');
      }
    } else if (context.payload.action === 'labeled' && STATES.includes(context.payload.label.name)) {
      await state(github, number, context.payload.label.name);
    }
    return;
  }
  const eventPr = context.payload.pull_request;
  if (!eventPr || eventPr.head.repo?.full_name !== FULL || eventPr.base.ref !== 'main') return;
  const { data: pr } = await github.rest.pulls.get({ ...REPO, pull_number: eventPr.number });
  const issue = await origin(github, pr);
  if (!issue) {
    if (pr.state === 'open') await note(github, pr.number, 'Add exactly one standalone line "Closes #123" pointing to the originating Issue in Unilogic-SA/bids.');
    return;
  }
  if (pr.state === 'closed') {
    await state(github, pr.number, null);
    // GitHub closing syntax handles Issue closure only on merge to main.
    if (pr.merged) await state(github, issue.number, null);
    else await note(github, issue.number, 'The linked PR was closed without merging. This Issue stays open; decide whether to resume it or return it to Backlog.');
    return;
  }
  if (context.payload.action === 'labeled' && STATES.includes(context.payload.label.name)) {
    await state(github, pr.number, context.payload.label.name);
    if (issue.state === 'open') await state(github, issue.number, context.payload.label.name);
    return;
  }
  if (['opened', 'reopened', 'synchronize', 'ready_for_review', 'converted_to_draft'].includes(context.payload.action)) {
    await state(github, pr.number, 'in-development');
    if (issue.state === 'open') await state(github, issue.number, 'in-development');
  }
  await note(github, pr.number, 'Linked to #' + issue.number + '. Keep fixes on this PR. Wait for CI and a Vercel preview for the latest commit, test it, then explicitly approve and merge in GitHub. No automation merges this PR.');
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
    // Respect a human's changes-needed/approved labels, including on the Issue.
    const { data: freshLabels } = await github.rest.issues.get({ ...REPO, issue_number: pr.number });
    if (!freshLabels.labels.some(l => l.name === 'in-development')) continue;
    if (issue.labels.some(l => ['changes-needed', 'approved'].includes(l.name))) continue;
    await state(github, pr.number, 'ready-for-testing');
    if (issue.state === 'open') await state(github, issue.number, 'ready-for-testing');
    await note(github, pr.number, 'Ready for testing at ' + url.href + '\n\nCommit: ' + sha + '\n\nCI succeeded. Test the acceptance criteria before approving. This is not production approval.');
  }
  core.info('Readiness reconciliation complete; missing trusted signals leave work in development.');
}
module.exports = run;
module.exports.preview = preview;
module.exports.linkedIssue = linkedIssue;
module.exports.specComplete = specComplete;
module.exports.boundary = boundary;

