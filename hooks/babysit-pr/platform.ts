import type { EngineInterface } from 'claude-code'

import type { PrApproval, PrHead, PrRef, PrSnapshot, Repo } from '../../types'
import { GITHUB_PR_QUERY, parseGithubPr } from './github'
import { GITLAB_MR_QUERY, parseGitlabApprovalTimes, parseGitlabMr, parseGitlabVersions } from './gitlab'
import { comparedHeadShas, parsePatchId } from './pushes'
import { gitlabMrPath, parsePrUrl, parseRemote } from './refs'
import { approveCommand, replyCommand, resolveCommand, unapproveCommand, writeFailureReason } from './writes'
import type { WriteCommand } from './writes'

const QUIET = { GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GH_PROMPT_DISABLED: '1', NO_COLOR: '1' }

export type WriteResult = { isOk: true } | { isOk: false; reason: string }

type RunResult = { isOk: true; stdout: string; isStdoutTruncated: boolean } | { isOk: false; stdout: string; reason: string }

// Rejects when the command cannot start.
async function runProcess($: EngineInterface, argv: string[], cwd: string, stdin?: string) {
  return $.process.run(argv, { cwd, env: QUIET, stdin, timeoutMs: 30_000 })
}

function didNotStart(argv: readonly string[], error: unknown) {
  return `${argv[0]} did not start: ${String(error)}`
}

async function run($: EngineInterface, cwd: string, argv: string[], stdin?: string): Promise<RunResult> {
  try {
    const { exitCode, stdout, stderr, isStdoutTruncated = false } = await runProcess($, argv, cwd, stdin)

    if (exitCode !== 0) {
      return { isOk: false, stdout, reason: stderr.trim() || `${argv[0]} exited with ${exitCode}` }
    }

    return { isOk: true, stdout, isStdoutTruncated }
  } catch (error) {
    return { isOk: false, stdout: '', reason: didNotStart(argv, error) }
  }
}

// gh and glab exit non-zero on a GraphQL error but still print the answer, whose `errors` say more than stderr.
async function runJson($: EngineInterface, cwd: string, argv: string[]): Promise<unknown> {
  const result = await run($, cwd, argv)

  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(result.isOk ? `${argv[0]} printed no JSON` : result.reason)
  }
}

// The PR's diff at `sha`, as GitHub shows it against the base, through `git patch-id`. Null when either fails.
async function githubPatchId($: EngineInterface, cwd: string, ref: PrRef, base: string, sha: string) {
  const diff = await run($, cwd, [
    'gh', 'api', '--hostname', ref.host, '-H', 'Accept: application/vnd.github.diff', `repos/${ref.project}/compare/${base.split('/').map(encodeURIComponent).join('/')}...${sha}`,
  ])

  if (!diff.isOk || diff.isStdoutTruncated) {
    return null
  }

  const patchId = await run($, cwd, ['git', 'patch-id', '--stable'], diff.stdout)

  return patchId.isOk ? parsePatchId(patchId.stdout) : null
}

// The last read's heads, unless the PR moved to another base: patch-ids are taken against the base.
function previousHeads(pr: PrSnapshot, previous: PrSnapshot | null) {
  return previous?.baseBranch === pr.baseBranch ? previous.heads : []
}

// GitHub keeps no push history: only the heads the rules compare are read, and a patch-id the last read has is reused.
async function withGithubHeads($: EngineInterface, cwd: string, ref: PrRef, pr: PrSnapshot, previous: PrSnapshot | null): Promise<PrSnapshot> {
  const known = new Map(previousHeads(pr, previous).filter(head => head.patchId !== null).map(head => [head.sha, head]))
  const heads = await Promise.all(
    comparedHeadShas(pr).map(
      async (sha): Promise<PrHead> => known.get(sha) ?? { sha, pushedAt: null, patchId: await githubPatchId($, cwd, ref, pr.baseBranch, sha) },
    ),
  )

  return { ...pr, heads }
}

async function fetchGithubPr($: EngineInterface, cwd: string, ref: PrRef, previous: PrSnapshot | null) {
  const [owner = '', ...repo] = ref.project.split('/')
  const answer = await runJson($, cwd, [
    'gh', 'api', 'graphql', '--hostname', ref.host,
    '-f', `owner=${owner}`, '-f', `repo=${repo.join('/')}`, '-F', `number=${ref.number}`,
    '-f', `query=${GITHUB_PR_QUERY}`,
  ])
  const pr = parseGithubPr(answer)

  return pr.state === 'open' ? withGithubHeads($, cwd, ref, pr, previous) : pr
}

async function withApprovalTimes($: EngineInterface, cwd: string, ref: PrRef, mr: PrSnapshot): Promise<PrSnapshot> {
  const hasViewerApproved = mr.approvals.some(approval => approval.user === mr.viewer)

  if (!hasViewerApproved || mr.author === mr.viewer) {
    return mr
  }

  const path = `${gitlabMrPath(ref)}/approvals`
  const times = parseGitlabApprovalTimes(await runJson($, cwd, ['glab', 'api', '--hostname', ref.host, path]))

  return { ...mr, approvals: mr.approvals.map(({ user }) => ({ user, approvedAt: times[user] ?? null })) }
}

// One MR version per push. The list only grows on a push, so it is read again only when the head moved.
async function withGitlabVersions($: EngineInterface, cwd: string, ref: PrRef, mr: PrSnapshot, previous: PrSnapshot | null): Promise<PrSnapshot> {
  const heads = previousHeads(mr, previous)

  if (previous?.headSha === mr.headSha && heads.length > 0) {
    return { ...mr, heads }
  }

  const versions = await run($, cwd, ['glab', 'api', '--hostname', ref.host, `${gitlabMrPath(ref)}/versions?per_page=100`])

  if (!versions.isOk) {
    return mr
  }

  try {
    return { ...mr, heads: parseGitlabVersions(JSON.parse(versions.stdout)) }
  } catch {
    // Not JSON: no versions, so the rules fall back on the head commit date until the next read.
    return mr
  }
}

async function fetchGitlabMr($: EngineInterface, cwd: string, ref: PrRef, previous: PrSnapshot | null) {
  const answer = await runJson($, cwd, [
    'glab', 'api', 'graphql', '--hostname', ref.host,
    '-f', `project=${ref.project}`, '-f', `iid=${ref.number}`,
    '-f', `query=${GITLAB_MR_QUERY}`,
  ])
  const mr = await withApprovalTimes($, cwd, ref, parseGitlabMr(answer))

  return mr.state === 'open' ? withGitlabVersions($, cwd, ref, mr, previous) : mr
}

// Read only: never a write call to GitHub or GitLab. `previous` is the last read, whose push detection is reused.
export async function fetchSnapshot($: EngineInterface, ref: PrRef, previous: PrSnapshot | null): Promise<PrSnapshot> {
  const cwd = await $.session.cwd()

  return ref.platform === 'github' ? fetchGithubPr($, cwd, ref, previous) : fetchGitlabMr($, cwd, ref, previous)
}

export async function findCurrentRepo($: EngineInterface): Promise<Repo | null> {
  const result = await run($, await $.session.cwd(), ['git', 'remote', 'get-url', 'origin'])

  return result.isOk ? parseRemote(result.stdout) : null
}

export async function findCurrentBranchPr($: EngineInterface, repo: Repo): Promise<PrRef | null> {
  const argv = repo.platform === 'github' ? ['gh', 'pr', 'view', '--json', 'url'] : ['glab', 'mr', 'view', '--output', 'json']
  const result = await run($, await $.session.cwd(), argv)

  if (!result.isOk) {
    return null
  }

  try {
    const { url, web_url } = JSON.parse(result.stdout) as { url?: string; web_url?: string }

    return parsePrUrl(url ?? web_url ?? '')
  } catch {
    return null
  }
}

// The only write calls to a platform, run on the user's click in the pane.
async function runWrite($: EngineInterface, { argv, stdin }: WriteCommand): Promise<WriteResult> {
  try {
    const reason = writeFailureReason(await runProcess($, argv, await $.session.cwd(), stdin))

    return reason === null ? { isOk: true } : { isOk: false, reason }
  } catch (error) {
    return { isOk: false, reason: didNotStart(argv, error) }
  }
}

export async function postReply($: EngineInterface, ref: PrRef, threadId: string, body: string) {
  return runWrite($, replyCommand(ref, threadId, body))
}

export async function markThreadResolved($: EngineInterface, ref: PrRef, threadId: string) {
  return runWrite($, resolveCommand(ref, threadId))
}

// `headSha` is the head the user saw: GitHub and GitLab both refuse an approval of another one.
export async function approvePr($: EngineInterface, ref: PrRef, headSha: string) {
  return runWrite($, approveCommand(ref, headSha))
}

export async function unapprovePr($: EngineInterface, ref: PrRef, approval: PrApproval) {
  return runWrite($, unapproveCommand(ref, approval))
}
