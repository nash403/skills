import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { ChangeRequest, Divergence, GitSnapshot } from '../../types'

const snapshot = atom({ plugin: 'nash403-skills', key: 'gitBand' } as const, null, {
  shape: 'snapshot-3',
})
const editedDirs = atom({ plugin: 'nash403-skills', key: 'gitBandEditedDirs' } as const, [], {
  shape: 'dirs-1',
})
const isDirListOpen = atom({ plugin: 'nash403-skills', key: 'isGitBandDirListOpen' } as const, false)

const LOCAL_EVERY_MS = 30_000
const REMOTE_EVERY_MS = 5 * 60_000
const QUIET_GIT = { GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }

type Depth = 'local' | 'request' | 'remote'

async function run($: EngineInterface, cwd: string, argv: string[], timeoutMs = 10_000) {
  try {
    const result = await $.process.run(argv, { cwd, env: QUIET_GIT, timeoutMs })

    return result.exitCode === 0 ? result.stdout.trim() : null
  } catch {
    return null
  }
}

function basename(path: string) {
  return path.replace(/\/+$/, '').split('/').pop() || path
}

function parseDivergence(counts: string | null): Divergence | null {
  if (counts === null) {
    return null
  }

  const [behind, ahead] = counts.split(/\s+/).map(Number)

  return { ahead: ahead || 0, behind: behind || 0 }
}

async function findDefaultBranch($: EngineInterface, cwd: string) {
  const head = await run($, cwd, ['git', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])

  if (head) {
    return head.replace(/^origin\//, '')
  }

  for (const name of ['main', 'master', 'develop']) {
    if ((await run($, cwd, ['git', 'rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}`])) !== null) {
      return name
    }
  }

  return null
}

async function isLinkedWorktree($: EngineInterface, cwd: string) {
  const dirs = await run($, cwd, ['git', 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'])
  const [gitDir, commonDir] = (dirs ?? '').split('\n')

  return Boolean(gitDir && commonDir && gitDir !== commonDir)
}

async function findChangeRequest($: EngineInterface, cwd: string): Promise<ChangeRequest> {
  const remote = (await run($, cwd, ['git', 'remote', 'get-url', 'origin'])) ?? ''

  if (remote.includes('github')) {
    const json = await run($, cwd, ['gh', 'pr', 'view', '--json', 'number,url,state,isDraft,baseRefName'], 15_000)

    if (json === null) {
      return { state: 'none' }
    }

    try {
      const pr = JSON.parse(json)
      const state = pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'closed' : 'open'

      return { state, id: pr.number, url: pr.url, isDraft: Boolean(pr.isDraft), target: pr.baseRefName }
    } catch {
      return { state: 'unknown' }
    }
  }

  if (remote.includes('gitlab')) {
    const json = await run($, cwd, ['glab', 'mr', 'view', '--output', 'json'], 15_000)

    if (json === null) {
      return { state: 'none' }
    }

    try {
      const mr = JSON.parse(json)
      const state = mr.state === 'merged' ? 'merged' : mr.state === 'closed' ? 'closed' : 'open'

      return { state, id: mr.iid, url: mr.web_url, isDraft: Boolean(mr.draft), target: mr.target_branch }
    } catch {
      return { state: 'unknown' }
    }
  }

  return { state: 'unknown' }
}

async function readSnapshot($: EngineInterface, depth: Depth, previous: GitSnapshot | null): Promise<GitSnapshot> {
  const cwd = await $.session.cwd()
  const folder = basename(cwd)
  const outsideGit: GitSnapshot = {
    folder,
    root: cwd,
    isLinkedWorktree: false,
    branch: null,
    isDetached: false,
    defaultBranch: null,
    base: null,
    upstream: null,
    vsBase: null,
    request: { state: 'unknown' },
  }

  if ((await run($, cwd, ['git', 'rev-parse', '--is-inside-work-tree'])) !== 'true') {
    return outsideGit
  }

  if (depth === 'remote') {
    await run($, cwd, ['git', 'fetch', '--quiet', '--prune', 'origin'], 60_000)
  }

  const current = await run($, cwd, ['git', 'branch', '--show-current'])
  const isDetached = !current
  const branch = current || (await run($, cwd, ['git', 'rev-parse', '--short', 'HEAD']))
  const defaultBranch = await findDefaultBranch($, cwd)
  const isOnDefault = isDetached || branch === defaultBranch

  const isSameBranch = previous?.branch === branch && previous.folder === folder
  const request: ChangeRequest = isOnDefault
    ? { state: 'unknown' }
    : depth !== 'local' || !isSameBranch
      ? await findChangeRequest($, cwd)
      : previous.request

  const target = request.state === 'open' ? request.target : null
  const base = isOnDefault ? null : (target ?? defaultBranch)

  const upstream = isDetached
    ? null
    : parseDivergence(await run($, cwd, ['git', 'rev-list', '--left-right', '--count', '@{upstream}...HEAD']))
  const vsBase = base
    ? parseDivergence(await run($, cwd, ['git', 'rev-list', '--left-right', '--count', `origin/${base}...HEAD`]))
    : null

  return {
    folder,
    root: (await run($, cwd, ['git', 'rev-parse', '--show-toplevel'])) ?? cwd,
    isLinkedWorktree: await isLinkedWorktree($, cwd),
    branch,
    isDetached,
    defaultBranch,
    base,
    upstream,
    vsBase,
    request,
  }
}

function rebasePrompt(git: GitSnapshot) {
  const { branch, base, defaultBranch } = git
  const lines = [
    `Bring \`${branch}\` up to date with the latest \`${base}\` (fetch first).`,
    `Rebase by default, but merge \`${base}\` into it when that is simpler: others pushed to the branch, a rebase would replay the same conflict commit after commit, the branch already holds merges from its base, or its PR is squashed on merge.`,
    'Tell me which one you picked and why before doing it.',
  ]

  if (base !== defaultBranch) {
    lines.push(
      `\`${base}\` is not the main branch (\`${defaultBranch}\`): before that, ask me whether to bring \`${base}\` up to date with its own base too, the same way. If I agree, cascade down the stack to \`${defaultBranch}\`, bottom first.`,
    )
  }

  lines.push('Ask me before any force push.')

  return lines.join(' ')
}

// Cuts a long branch name in its middle, leaning on its start, so its type, ticket key and last words stay readable.
function shorten(name: string, max: number) {
  if (name.length <= max) {
    return name
  }

  const kept = max - 1
  const head = Math.ceil(kept * 0.6)

  return `${name.slice(0, head)}…${name.slice(name.length - (kept - head))}`
}

function syncStatus(upstream: Divergence | null): { text: string; color: Color } {
  if (upstream === null) {
    return { text: 'not pushed', color: 'warning' }
  }

  const { ahead, behind } = upstream

  if (ahead && behind) {
    return { text: '↑↓', color: 'error' }
  }

  if (behind) {
    return { text: '↓', color: 'warning' }
  }

  if (ahead) {
    return { text: '↑', color: 'suggestion' }
  }

  return { text: '✓', color: 'success' }
}

function requestText(request: ChangeRequest) {
  if (request.state === 'unknown' || request.state === 'none') {
    return null
  }

  const suffix = request.isDraft && request.state === 'open' ? ' draft' : request.state === 'open' ? '' : ` ${request.state}`
  const color = request.state === 'open' ? 'success' : request.state === 'merged' ? 'merged' : 'inactive'

  return { text: `PR #${request.id}${suffix}`, color: color as Color, url: request.url }
}

function newRequestPrompt({ branch, base }: GitSnapshot) {
  return [
    `Open a PR for \`${branch}\` targeting \`${base}\`, pushing the branch first if needed.`,
    `Draft its title and description from what this session set out to do, starting from my first request, and from the branch's changes against \`${base}\`, committed or not.`,
    'Before creating it, show me the draft and ask me to confirm it with the target branch and the options to set: squash on merge, skip CI, labels, draft, and any other the platform offers.',
    'Once it is created, give me its web link.',
  ].join(' ')
}

function canOpenRequest({ request, base }: GitSnapshot) {
  return request.state === 'none' && base !== null
}

function needsRebase({ base, vsBase }: GitSnapshot) {
  return Boolean(base && vsBase && vsBase.behind > 0)
}

// The same facts as the band, as plain text for the status line under the prompt.
function statusText(git: GitSnapshot) {
  const parts = [`${git.isLinkedWorktree ? '🌿' : '📁'} ${git.folder}`]

  if (git.branch !== null) {
    parts.push(`⎇ ${shorten(git.branch, 40)}${git.base ? ` → ${shorten(git.base, 24)}` : ''}`)
    parts.push(requestText(git.request)?.text ?? '')
    parts.push(git.isDetached ? '' : syncStatus(git.upstream).text)
    parts.push(needsRebase(git) ? '⚠ rebase' : '')
  }

  return parts.filter(Boolean).join('  ')
}

// Keeps the repo (or the folder, outside git) of each file the agent edits, to show where it worked besides the session's folder.
async function recordEditedDir($: EngineInterface, path: string) {
  const dir = path.replace(/\/[^/]*$/, '') || '/'
  const root = (await run($, dir, ['git', 'rev-parse', '--show-toplevel'])) ?? dir

  await update($, editedDirs, dirs => (dirs.includes(root) ? dirs : [...dirs, root]))
}

async function noteEdit($: EngineInterface, result: ToolCallResult, path: string) {
  if (result.deny === undefined && !result.isError) {
    void recordEditedDir($, path)
  }

  return result
}

function withTilde(path: string, home: string | undefined) {
  return home && path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

let running: Promise<void> | null = null

async function refresh($: EngineInterface, depth: Depth) {
  while (running) {
    await running
  }

  running = (async () => {
    const previous = await read($, snapshot)
    const next = await readSnapshot($, depth, previous)
    await update($, snapshot, () => next)
    $.ui.status(statusText(next))
  })()

  try {
    await running
  } catch (error) {
    $.ui.log(`git-band: refresh failed: ${String(error)}`, { to: 'debug' })
  } finally {
    running = null
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    void refresh($, 'remote')
    $.clock.every(LOCAL_EVERY_MS, () => void refresh($, 'local'))
    $.clock.every(REMOTE_EVERY_MS, () => void refresh($, 'remote'))

    return started
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    void refresh($, 'request')

    return result
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => noteEdit($, await next(e), e.file_path))
  on('tool.call', { tool: 'Write' }, async ($, e, next) => noteEdit($, await next(e), e.file_path))
  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => noteEdit($, await next(e), e.notebook_path))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const git = await read($, snapshot)

    if (e.props.hasSurvey || git === null) {
      return next(e)
    }

    const { Box, Button, Link, Text } = $.ui.resolve(e)
    const { branch, base } = git
    const columns = e.props.bodyColumns
    const sync = branch !== null && !git.isDetached ? syncStatus(git.upstream) : null
    const request = requestText(git.request)
    const dirs = await read($, editedDirs)
    const hasEditedElsewhere = dirs.some(dir => dir !== git.root)
    const isListOpen = hasEditedElsewhere && (await read($, isDirListOpen))
    const home = isListOpen ? await $.env.get('HOME') : undefined

    return (
      <Box flexDirection="column" width="100%">
        <Box flexDirection="row" flexWrap="wrap" columnGap={2} width="100%">
          <Text dimColor>
            {git.isLinkedWorktree ? '🌿' : '📁'} {git.folder}
          </Text>
          {hasEditedElsewhere && (
            <Button
              key="dirs"
              label={`✏️ ${dirs.length}`}
              plain
              dimColor={!isListOpen}
              onPress={() => void update($, isDirListOpen, isOpen => !isOpen)}
            />
          )}
          {branch !== null && (
            <Text>
              <Text bold>⎇ {shorten(branch, Math.max(16, Math.floor(columns * 0.3)))}</Text>
              {git.isDetached && <Text dimColor> (detached)</Text>}
              {base && <Text dimColor> → {shorten(base, Math.max(12, Math.floor(columns * 0.2)))}</Text>}
            </Text>
          )}
          {request && (
            <Link href={request.url}>
              <Text color={request.color}>{request.text}</Text>
            </Link>
          )}
          {sync && <Text color={sync.color}>{sync.text}</Text>}
          {canOpenRequest(git) && (
            <Button
              key="new-pr"
              label="New PR"
              hotkey="p"
              onPress={() => void $.prompt.submit({ text: newRequestPrompt(git), asUser: true })}
            />
          )}
          {needsRebase(git) && (
            <Button
              key="rebase"
              label="Rebase"
              hotkey="r"
              variant="primary"
              onPress={() => void $.prompt.submit({ text: rebasePrompt(git), asUser: true })}
            />
          )}
          <Box flexGrow={1} />
          <Button key="refresh" label="↻" plain dimColor onPress={() => void refresh($, 'remote')} />
        </Box>
        {isListOpen && (
          <Box flexDirection="column" paddingLeft={3}>
            {dirs.map(dir => (
              <Text dimColor={dir === git.root}>
                {withTilde(dir, home)}
                {dir === git.root ? ' (session)' : ''}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
