import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'nash403-skills',
  component: 'Pane',
  requestId: 'babysit-pr',
  props: {
    title: 'PRs',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop'] as const

const OPEN_COMMAND = {
  command: 'babysit-pr',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
} as const

const TURN = { answer: 'Done.', durationMs: 1, isAborted: false, turnId: 'turn-1' }

type Calls = { argv: string[] }[]

function githubAnswer(number: number, overrides: Record<string, unknown> = {}) {
  return {
    data: {
      viewer: { login: 'ana' },
      repository: {
        pullRequest: {
          title: `Add the export ${number} [skip ci]`,
          url: `https://github.com/acme/app/pull/${number}`,
          state: 'OPEN',
          isDraft: true,
          author: { login: 'ana' },
          headRefName: 'feat/export',
          headRefOid: 'c2',
          baseRefName: 'main',
          additions: 40,
          deletions: 3,
          changedFiles: 2,
          mergeStateStatus: 'BLOCKED',
          reviewDecision: 'REVIEW_REQUIRED',
          reviewRequests: { nodes: [{ requestedReviewer: { login: 'cid' } }] },
          latestOpinionatedReviews: { nodes: [{ author: { login: 'bob' }, state: 'APPROVED', submittedAt: '2026-11-11T09:00:00Z', commit: { oid: 'c2' } }] },
          reviews: { nodes: [] },
          commits: {
            nodes: [
              { commit: { oid: 'c1', committedDate: '2026-11-10T08:00:00Z', authors: { nodes: [{ user: { login: 'ana' }, name: 'Ana' }] } } },
              { commit: { oid: 'c2', committedDate: '2026-11-10T09:00:00Z', authors: { nodes: [{ user: { login: 'bob' }, name: 'Bob' }] } } },
            ],
          },
          statusCheckRollup: {
            nodes: [
              {
                commit: {
                  message: 'Fix',
                  statusCheckRollup: {
                    contexts: { nodes: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }] },
                  },
                },
              },
            ],
          },
          reviewThreads: {
            totalCount: 2,
            nodes: [
              { id: 'PRRT_1', isResolved: false, path: 'a.ts', line: 1, comments: { nodes: [{ author: { login: 'bob' }, createdAt: '2026-11-11T10:00:00Z', body: 'Why?', url: 'u1' }] } },
              { id: 'PRRT_2', isResolved: true, path: 'b.ts', line: 2, comments: { nodes: [{ author: { login: 'bob' }, createdAt: '2026-11-11T10:00:00Z', body: 'Nit', url: 'u2' }] } },
            ],
          },
          ...overrides,
        },
      },
    },
  }
}

const GITLAB_ANSWER = {
  data: {
    currentUser: { username: 'ana' },
    project: {
      mergeRequest: {
        title: 'Tidy the tools',
        webUrl: 'https://gitlab.com/team/tools/-/merge_requests/21',
        state: 'opened',
        draft: false,
        author: { username: 'dee' },
        diffHeadSha: 'g2',
        sourceBranch: 'chore/tidy',
        targetBranch: 'develop',
        detailedMergeStatus: 'MERGEABLE',
        approved: true,
        approvedBy: { nodes: [{ username: 'ana' }] },
        reviewers: { nodes: [{ username: 'ana' }] },
        diffStatsSummary: { additions: 5, deletions: 9, fileCount: 1 },
        commits: { nodes: [{ sha: 'g2', committedDate: '2026-11-12T10:00:00Z', message: 'Tidy', author: { username: 'dee' }, authorName: 'Dee' }] },
        headPipeline: { jobs: { nodes: [{ status: 'SUCCESS', allowFailure: false }] } },
        discussions: { pageInfo: { hasNextPage: false }, nodes: [] },
      },
    },
  },
}

const GITLAB_APPROVALS = { approved_by: [{ user: { username: 'ana' }, approved_at: '2026-11-11T10:00:00Z' }] }

// Answers gh, glab and git as a repo on github.com/acme/app whose branch has PR #12.
function stubEngine(on: any, messages: unknown[], answers: Record<number, unknown> = {}) {
  const calls: Calls = []
  const toasts: string[] = []
  let openPanes: { id: string }[] = []

  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('ui.status', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: '/work/app' }))
  on('session.messages', () => ({ value: messages }))
  on('command.register', () => ({ value: { command: 'babysit-pr' } }))
  on('ui.open', (_: unknown, e: { id: string }) => {
    openPanes = [{ id: e.id }]

    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: openPanes.map(pane => ({ ...pane, title: 'PRs', isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.toast', (_: unknown, e: { text: string }) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('process.run', (_: unknown, e: { argv: readonly string[] }) => {
    const argv = [...e.argv]
    calls.push({ argv })

    const answer = answerTo(argv, answers)

    return { value: { exitCode: 0, stdout: typeof answer === 'string' ? answer : JSON.stringify(answer), stderr: '' } }
  })

  return { calls, toasts, closePane: () => (openPanes = []) }
}

function answerTo(argv: string[], answers: Record<number, unknown>): unknown {
  const command = argv.slice(0, 3).join(' ')
  const number = Number(argv.find(arg => arg.startsWith('number='))?.slice('number='.length))

  if (command === 'git remote get-url') {
    return 'git@github.com:acme/app.git'
  }

  if (command === 'gh pr view') {
    return { url: 'https://github.com/acme/app/pull/12' }
  }

  if (command === 'gh api graphql') {
    return answers[number] ?? githubAnswer(number)
  }

  if (command === 'glab api graphql') {
    return GITLAB_ANSWER
  }

  return argv.some(arg => arg.endsWith('/approvals')) ? GITLAB_APPROVALS : null
}

function platformCalls(calls: Calls) {
  return calls.filter(({ argv }) => argv[1] === 'api').map(({ argv }) => argv.find(arg => /^(number|iid)=/.test(arg)))
}

test('the PR of the branch and the PRs the session shows fill the pane, read only', async ($, on) => {
  const clock = mock.clock(on)
  const { calls } = stubEngine(on, [{ role: 'user', text: 'Review https://github.com/acme/app/pull/7', toolUses: [] }])

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()

  expect(platformCalls(calls)).toEqual(['number=12', 'number=7'])
  expect(calls.every(({ argv }) => !argv.includes('-X') && !argv.includes('--method'))).toBe(true)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /^acme\/app#12/ }))?.text).toBe('acme/app#12 ↗')
    expect(await ui.find({ type: 'Link' })).toMatchObject({ props: { href: 'https://github.com/acme/app/pull/12' } })
    expect((await ui.find({ type: 'Text', text: /^1\/2$/ }))?.text).toBe('1/2')
    expect((await ui.find({ type: 'Text', text: /approved|reviewed/ }))?.text).toBe(' reviewed ')
    expect((await ui.find({ type: 'Text', text: /^CI/ }))?.text).toBe('CI error')
    expect((await ui.find({ type: 'Text', text: /^draft$/ }))?.text).toBe('draft')
    expect((await ui.find({ type: 'Text', text: /^blocked/ }))?.text).toBe('blocked: approvals')
    expect((await ui.find({ type: 'Text', text: /^skip CI$/ }))?.text).toBe('skip CI')
    expect((await ui.find({ type: 'Text', text: /^\+/ }))?.text).toBe('+40')
    expect((await ui.find({ type: 'Text', text: /files/ }))?.text).toBe('2 files')
    expect((await ui.find({ type: 'Text', text: /^threads/ }))?.text).toBe('threads 1/2 open')
    expect((await ui.find({ type: 'Text', text: /^bob/ }))?.text).toBe('bob')
    expect((await ui.find({ type: 'Text', text: /approved$/ }))?.text).toBe('✓ approved')
    expect((await ui.find({ type: 'Text', text: /has commits/ }))?.text).toBe('has commits')
    await ui.unmount()
  }
})

test('the arrows switch PRs, refresh reads one again and remove keeps it out', async ($, on) => {
  const clock = mock.clock(on)
  const { calls } = stubEngine(on, [{ role: 'user', text: 'https://github.com/acme/app/pull/7', toolUses: [] }])

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /^acme\/app#/ }))?.text).toBe('acme/app#12 ↗')
    await ui.press({ key: 'next' })
    expect((await ui.find({ type: 'Text', text: /^acme\/app#/ }))?.text).toBe('acme/app#7 ↗')
    await ui.press({ key: 'next' })
    expect((await ui.find({ type: 'Text', text: /^acme\/app#/ }))?.text).toBe('acme/app#12 ↗')
    await ui.press({ key: 'previous' })
    expect((await ui.find({ type: 'Text', text: /^acme\/app#/ }))?.text).toBe('acme/app#7 ↗')
    await ui.press({ key: 'previous' })
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'next' })
  calls.length = 0
  await ui.press({ key: 'refresh' })
  expect(platformCalls(calls)).toEqual(['number=7'])

  await ui.press({ key: 'remove' })
  expect((await ui.find({ type: 'Text', text: /^acme\/app#/ }))?.text).toBe('acme/app#12 ↗')
  expect(await ui.find({ key: 'next' })).toBeUndefined()
  await ui.unmount()

  await $.turn.complete({ ...TURN, reason: 'answer' })
  await clock.settle()

  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /#7/ })).toBeUndefined()
  await after.unmount()
})

test('a PR added by hand is a number of the current repo or a URL', async ($, on) => {
  const clock = mock.clock(on)
  const { toasts } = stubEngine(on, [])

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    await ui.input({ key: 'add', text: 'nope' })
    expect(toasts.at(-1)).toBe('Type a PR number or paste a PR URL.')

    await ui.input({ key: 'add', text: '#30' })
    expect((await ui.find({ type: 'Text', text: /^acme\/app#/ }))?.text).toBe('acme/app#30 ↗')

    await ui.input({ key: 'add', text: 'https://gitlab.com/team/tools/-/merge_requests/21' })
    expect((await ui.find({ type: 'Text', text: /^team\/tools/ }))?.text).toBe('team/tools!21 ↗')
    expect((await ui.find({ type: 'Text', text: /^ approved/ }))?.text).toBe(' approved ')
    expect((await ui.find({ type: 'Text', text: /pushed since/ }))?.text).toBe('⚠ pushed since your approval')
    expect((await ui.find({ type: 'Text', text: /^CI/ }))?.text).toBe('CI ok')
    await ui.unmount()
  }
})

test('a gh command adds the PR it prints, and a subagent turn scans nothing', async ($, on) => {
  const clock = mock.clock(on)
  const { calls } = stubEngine(on, [])
  on('classic.PostToolUse', () => ({}))

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ ...TURN, reason: 'answer', agentId: 'a1' })
  await clock.settle()
  expect(calls.filter(({ argv }) => argv[0] !== 'git')).toHaveLength(0)

  await $.classic.PostToolUse({
    tool_name: 'Bash',
    tool_input: { command: 'gh pr create --fill' },
    tool_response: { stdout: 'https://github.com/acme/app/pull/40\n' },
    tool_use_id: 't1',
  })
  await clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^acme\/app#/ }))?.text).toBe('acme/app#40 ↗')
  await ui.unmount()
})

test('open PRs are polled every 3 minutes while the pane is open, merged ones never', async ($, on) => {
  const clock = mock.clock(on)
  const { calls, closePane } = stubEngine(on, [{ role: 'user', text: 'https://github.com/acme/app/pull/7', toolUses: [] }], {
    7: githubAnswer(7, { state: 'MERGED' }),
  })

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()
  calls.length = 0

  await clock.advance(3 * 60_000)
  expect(platformCalls(calls)).toEqual(['number=12'])

  closePane()
  await clock.advance(3 * 60_000)
  expect(platformCalls(calls)).toEqual(['number=12'])
})

test('a failed read shows its reason', async ($, on) => {
  const clock = mock.clock(on)
  stubEngine(on, [], { 12: { errors: [{ message: 'Could not resolve to a PullRequest' }] } })

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /^Could not/ }))?.text).toBe('Could not read it: Could not resolve to a PullRequest')
    await ui.unmount()
  }
})

test('an empty pane says where PRs come from', async ($, on) => {
  stubEngine(on, [])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /^No PR/ }))?.text).toContain('No PR yet.')
  expect(await ui.find({ key: 'add' })).toBeDefined()
  await ui.unmount()
})
