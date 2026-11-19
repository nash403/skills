import type { EngineInterface } from 'claude-code'

import type { PrRef, PrSnapshot, Repo } from '../../types'
import { GITHUB_PR_QUERY, parseGithubPr } from './github'
import { GITLAB_MR_QUERY, parseGitlabApprovalTimes, parseGitlabMr } from './gitlab'
import { parsePrUrl, parseRemote } from './refs'

const QUIET = { GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GH_PROMPT_DISABLED: '1', NO_COLOR: '1' }

type RunResult = { isOk: true; stdout: string } | { isOk: false; stdout: string; reason: string }

async function run($: EngineInterface, cwd: string, argv: string[]): Promise<RunResult> {
  try {
    const { exitCode, stdout, stderr } = await $.process.run(argv, { cwd, env: QUIET, timeoutMs: 30_000 })

    return exitCode === 0 ? { isOk: true, stdout } : { isOk: false, stdout, reason: stderr.trim() || `${argv[0]} exited with ${exitCode}` }
  } catch (error) {
    return { isOk: false, stdout: '', reason: `${argv[0]} did not start: ${String(error)}` }
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

async function fetchGithubPr($: EngineInterface, cwd: string, ref: PrRef) {
  const [owner = '', ...repo] = ref.project.split('/')
  const answer = await runJson($, cwd, [
    'gh', 'api', 'graphql', '--hostname', ref.host,
    '-f', `owner=${owner}`, '-f', `repo=${repo.join('/')}`, '-F', `number=${ref.number}`,
    '-f', `query=${GITHUB_PR_QUERY}`,
  ])

  return parseGithubPr(answer)
}

async function withApprovalTimes($: EngineInterface, cwd: string, ref: PrRef, mr: PrSnapshot): Promise<PrSnapshot> {
  const hasViewerApproved = mr.approvals.some(approval => approval.user === mr.viewer)

  if (!hasViewerApproved || mr.author === mr.viewer) {
    return mr
  }

  const path = `projects/${encodeURIComponent(ref.project)}/merge_requests/${ref.number}/approvals`
  const times = parseGitlabApprovalTimes(await runJson($, cwd, ['glab', 'api', '--hostname', ref.host, path]))

  return { ...mr, approvals: mr.approvals.map(({ user }) => ({ user, approvedAt: times[user] ?? null })) }
}

async function fetchGitlabMr($: EngineInterface, cwd: string, ref: PrRef) {
  const answer = await runJson($, cwd, [
    'glab', 'api', 'graphql', '--hostname', ref.host,
    '-f', `project=${ref.project}`, '-f', `iid=${ref.number}`,
    '-f', `query=${GITLAB_MR_QUERY}`,
  ])

  return withApprovalTimes($, cwd, ref, parseGitlabMr(answer))
}

// Read only: never a write call to GitHub or GitLab.
export async function fetchSnapshot($: EngineInterface, ref: PrRef): Promise<PrSnapshot> {
  const cwd = await $.session.cwd()

  return ref.platform === 'github' ? fetchGithubPr($, cwd, ref) : fetchGitlabMr($, cwd, ref)
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
