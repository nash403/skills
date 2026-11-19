import type { SessionMessage } from 'claude-code'

import type { Platform, PrRef, Repo } from '../../types'

const DEFAULT_HOSTS: Record<Platform, string> = { github: 'github.com', gitlab: 'gitlab.com' }

const GITHUB_PR_URL = /https?:\/\/([^/\s]*github[^/\s]*)\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g
const GITLAB_MR_URL = /https?:\/\/([^/\s]+)\/([\w.-]+(?:\/[\w.-]+)+)\/-\/merge_requests\/(\d+)/g
const PR_COMMAND = /\b(gh\s+pr|glab\s+mr)\s+(create|view)\b([^;&|\n]*)/g
// `git push` to a branch with an MR prints the MR's URL on GitLab.
const PUSH_COMMAND = /\bgit\s(?:[^;&|\n]*\s)?push\b/
const FILE_WRITING_TOOLS = ['Edit', 'Write', 'NotebookEdit']
const FLAGS_WITH_VALUE = new Set(['-R', '--repo', '--json', '-q', '--jq', '-t', '--template', '-F', '--output', '-p', '--page', '-P', '--per-page'])

export function prKey(ref: PrRef) {
  return `${ref.host}/${ref.project}#${ref.number}`
}

// GitHub numbers its PRs `#12`, GitLab its MRs `!12`.
export function prLabel(ref: PrRef) {
  return `${ref.project}${ref.platform === 'github' ? '#' : '!'}${ref.number}`
}

function platformOfHost(host: string): Platform | null {
  if (host.includes('github')) {
    return 'github'
  }

  return host.includes('gitlab') ? 'gitlab' : null
}

export function parseRemote(remote: string): Repo | null {
  const match = remote.trim().match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^:/]+)(?::\d+)?[:/](.+?)(?:\.git)?\/?$/)

  if (!match) {
    return null
  }

  const [, host = '', project = ''] = match
  const platform = platformOfHost(host)

  return platform && project.includes('/') ? { platform, host, project } : null
}

function refsOf(text: string, pattern: RegExp, platform: Platform): PrRef[] {
  return [...text.matchAll(pattern)].map(([, host = '', project = '', number]) => ({ platform, host, project, number: Number(number) }))
}

function findPrUrls(text: string): PrRef[] {
  return [...refsOf(text, GITHUB_PR_URL, 'github'), ...refsOf(text, GITLAB_MR_URL, 'gitlab')]
}

export function parsePrUrl(url: string): PrRef | null {
  return findPrUrls(url)[0] ?? null
}

function argumentsOf(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  let target: string | null = null
  let repo: string | null = null

  for (let i = 0; i < words.length; i++) {
    const [flag = '', inlineValue] = (words[i] ?? '').split('=', 2)

    if (!flag.startsWith('-')) {
      target ??= flag
      continue
    }

    if (!FLAGS_WITH_VALUE.has(flag)) {
      continue
    }

    const value = inlineValue ?? words[++i] ?? null

    if (flag === '-R' || flag === '--repo') {
      repo = value
    }
  }

  return { target, repo }
}

function sameRepo(current: Repo | null, platform: Platform) {
  return current?.platform === platform ? current : null
}

function repoOfFlag(value: string, platform: Platform, current: Repo | null): Repo | null {
  if (value.includes('://')) {
    return parseRemote(value)
  }

  const host = current?.platform === platform ? current.host : DEFAULT_HOSTS[platform]

  return { platform, host, project: value }
}

// `gh pr view 12` and `glab mr view 12` name a PR by number: in the repo of `-R`, else in the session's.
function findCommandPrs(command: string, current: Repo | null): PrRef[] {
  return [...command.matchAll(PR_COMMAND)].flatMap(([, tool = '', action, rest = '']) => {
    const { target, repo } = argumentsOf(rest)

    if (action !== 'view' || target === null || !/^\d+$/.test(target)) {
      return []
    }

    const platform: Platform = tool.startsWith('gh') ? 'github' : 'gitlab'
    const base = repo ? repoOfFlag(repo, platform, current) : sameRepo(current, platform)

    return base ? [{ ...base, number: Number(target) }] : []
  })
}

function commandOf(input: Record<string, unknown>) {
  return typeof input.command === 'string' ? input.command : ''
}

// Only the output of a PR command or a push is read: other output (a changelog, `gh pr list`) names PRs the session doesn't work on.
export function findBashPrs(command: string, output: string, current: Repo | null): PrRef[] {
  const isOutputRead = Boolean(command.match(PR_COMMAND)) || PUSH_COMMAND.test(command)

  return [...findPrUrls(command), ...findCommandPrs(command, current), ...(isOutputRead ? findPrUrls(output) : [])]
}

// A file the agent writes may link PRs it doesn't work on; any other tool's input (a fetched URL, an MCP call) names one it does.
function findToolUsePrs(toolUse: SessionMessage['toolUses'][number], current: Repo | null): PrRef[] {
  if (toolUse.tool === 'Bash') {
    return findBashPrs(commandOf(toolUse.input), toolUse.text ?? '', current)
  }

  return FILE_WRITING_TOOLS.includes(toolUse.tool) ? [] : findPrUrls(JSON.stringify(toolUse.input))
}

export function findSessionPrs(messages: readonly SessionMessage[], current: Repo | null): PrRef[] {
  const found = messages.flatMap(message => [
    ...findPrUrls(message.text),
    ...message.toolUses.flatMap(toolUse => findToolUsePrs(toolUse, current)),
  ])

  return uniquePrs(found)
}

export function uniquePrs(refs: readonly PrRef[]): PrRef[] {
  const byKey = new Map(refs.map(ref => [prKey(ref), ref]))

  return [...byKey.values()]
}

export function parsePrInput(text: string, current: Repo | null): { ref: PrRef } | { error: string } {
  const input = text.trim()
  const number = input.match(/^[#!]?(\d+)$/)?.[1]

  if (number !== undefined) {
    return current ? { ref: { ...current, number: Number(number) } } : { error: 'No GitHub or GitLab remote here: paste the PR URL.' }
  }

  const ref = parsePrUrl(input)

  return ref ? { ref } : { error: 'Type a PR number or paste a PR URL.' }
}
