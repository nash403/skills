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
  const sessionReads: string[] = []
  const tools: string[] = []
  const prompts: string[] = []
  let openPanes: { id: string }[] = []

  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('ui.status', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: '/work/app' }))
  on('session.messages', () => {
    sessionReads.push('messages')

    return { value: messages }
  })
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
  on('tool.register', (_: unknown, e: { name: string }) => {
    tools.push(e.name)

    return { value: { tool: `mcp__nash403-skills__${e.name}` } }
  })
  on('prompt.submit', (_: unknown, e: { text: string }) => {
    prompts.push(e.text)

    return { text: e.text }
  })
  on('process.run', (_: unknown, e: { argv: readonly string[] }) => {
    const argv = [...e.argv]
    calls.push({ argv })

    const answer = answerTo(argv, answers)

    return { value: { exitCode: 0, stdout: typeof answer === 'string' ? answer : JSON.stringify(answer), stderr: '' } }
  })

  return { calls, toasts, sessionReads, tools, prompts, closePane: () => (openPanes = []) }
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
    expect((await ui.find({ type: 'Text', text: /commits/ }))?.text).toBe('2 commits')
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

test('nothing reads the session or calls gh or glab before /babysit-pr runs once', async ($, on) => {
  const clock = mock.clock(on)
  const { calls, sessionReads, tools } = stubEngine(on, [{ role: 'user', text: 'https://github.com/acme/app/pull/7', toolUses: [] }])
  on('classic.PostToolUse', () => ({}))

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ ...TURN, reason: 'answer' })
  await $.classic.PostToolUse({
    tool_name: 'Bash',
    tool_input: { command: 'gh pr create --fill' },
    tool_response: { stdout: 'https://github.com/acme/app/pull/40\n' },
    tool_use_id: 't1',
  })
  await clock.advance(3 * 60_000)

  // The git band runs git and gh pr view on its own; the PR pane's own calls are its API reads and its branch lookup.
  expect(sessionReads).toEqual([])
  expect(platformCalls(calls)).toEqual([])
  expect(calls.filter(({ argv }) => argv.join(' ') === 'gh pr view --json url')).toEqual([])
  expect(tools).toEqual([])

  await $.command.run(OPEN_COMMAND)
  await clock.settle()
  expect(platformCalls(calls)).toEqual(['number=12', 'number=7'])
  expect(tools).toEqual(['babysit_pr_triage'])
})

test('a gh command adds the PR it prints, and a subagent turn scans nothing', async ($, on) => {
  const clock = mock.clock(on)
  const { calls } = stubEngine(on, [])
  on('classic.PostToolUse', () => ({}))

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()
  calls.length = 0

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
  await ui.press({ key: 'previous' })
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

function reviewThread(id: string, isResolved: boolean, comments: [login: string, createdAt: string, body: string][]) {
  return {
    id,
    isResolved,
    path: 'src/export.ts',
    line: 3,
    comments: {
      nodes: comments.map(([login, createdAt, body], index) => ({
        author: { login },
        createdAt,
        body,
        url: `https://github.com/acme/app/pull/12#discussion_${id}_${index}`,
      })),
    },
  }
}

test('the next step and my open threads show whose turn it is, mine first', async ($, on) => {
  const clock = mock.clock(on)
  stubEngine(on, [], {
    12: githubAnswer(12, {
      reviewThreads: {
        totalCount: 3,
        nodes: [
          reviewThread('waiting', false, [
            ['bob', '2026-11-11T10:00:00Z', 'Why does the export skip empty rows?'],
            ['ana', '2026-11-11T11:00:00Z', 'On purpose.'],
          ]),
          reviewThread('mine', false, [['cid', '2026-11-11T10:00:00Z', 'Rename this\n\nto `exportRows`.']]),
          reviewThread('done', true, [['bob', '2026-11-11T10:00:00Z', 'Nit']]),
        ],
      },
    }),
  })

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.findAll({ type: 'Text', text: /^→/ })).map(step => step.text)).toEqual([
      '→ You: reply to 1 thread',
      '→ Reviewers: 1 thread waits for them',
    ])
    expect((await ui.findAll({ type: 'Text', text: /^(your turn|waiting)$/ })).map(turn => turn.text)).toEqual(['your turn', 'waiting'])
    expect((await ui.find({ key: 'mine' }))?.text).toContain('cid')
    expect((await ui.find({ key: 'mine' }))?.text).toContain('Rename this to `exportRows`.')
    expect((await ui.find({ key: 'waiting' }))?.text).toContain('Why does the export skip empty rows?')
    expect(await ui.find({ key: 'done' })).toBeUndefined()
    expect((await ui.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([
      'https://github.com/acme/app/pull/12',
      'https://github.com/acme/app/pull/12#discussion_mine_0',
      'https://github.com/acme/app/pull/12#discussion_waiting_0',
    ])
    await ui.unmount()
  }
})

test('a PR past the 100 commits the query reads says 100+', async ($, on) => {
  const clock = mock.clock(on)
  const commits = Array.from({ length: 100 }, (_, index) => ({
    commit: { oid: `c${index}`, committedDate: '2026-11-10T08:00:00Z', authors: { nodes: [{ user: { login: 'ana' }, name: 'Ana' }] } },
  }))
  stubEngine(on, [], { 12: githubAnswer(12, { commits: { totalCount: 150, nodes: commits } }) })

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /commits/ }))?.text).toBe('100+ commits')
    await ui.unmount()
  }
})

const TRIAGE_TOOL = 'mcp__nash403-skills__babysit_pr_triage'

const TRIAGED_PR = githubAnswer(12, {
  reviewThreads: {
    totalCount: 2,
    nodes: [
      reviewThread('mine', false, [['cid', '2026-11-11T10:00:00Z', 'Rename this to `exportRows`.']]),
      reviewThread('waiting', false, [
        ['bob', '2026-11-11T10:00:00Z', 'Why does the export skip empty rows?'],
        ['ana', '2026-11-11T11:00:00Z', 'On purpose.'],
      ]),
    ],
  },
})

const MINE_TRIAGE = {
  threadId: 'mine',
  name: 'rename-export-rows',
  classification: 'Nitpick',
  importance: 'low',
  isHandled: true,
  summary: 'Cid wants the helper renamed to exportRows.',
  details: 'The helper name says rows but it exports a page. Already renamed in c2.',
}

async function openOnTriagedPr($: any, on: any, answers: Record<number, unknown> = { 12: TRIAGED_PR }) {
  const clock = mock.clock(on)
  const engine = stubEngine(on, [], answers)

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.command.run(OPEN_COMMAND)
  await clock.settle()

  return { clock, ...engine }
}

test('a triage call fills its thread row, the badge counts the rest, more opens the longer summary', async ($, on) => {
  await openOnTriagedPr($, on)

  const before = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await before.find({ type: 'Text', text: /to triage/ }))?.text).toBe(' 2 to triage ')
  expect((await before.find({ type: 'Text', text: /handled/ }))?.text).toBe('0 of 2 handled, 2 unknown')
  await before.unmount()

  const answer = await $.tool.call({ tool: TRIAGE_TOOL, pr: 'https://github.com/acme/app/pull/12', threads: [MINE_TRIAGE] })
  expect(answer).toMatchObject({ result: 'Recorded the triage of 1 thread on acme/app#12. The /babysit-pr pane shows it.' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /to triage/ }))?.text).toBe(' 1 to triage ')
    expect((await ui.find({ type: 'Text', text: /handled,/ }))?.text).toBe('1 of 2 handled, 1 unknown')
    const row = (await ui.find({ key: 'mine' }))?.text
    expect(row).toContain('rename-export-rows')
    expect(row).toContain('Nitpick')
    expect(row).toContain('Cid wants the helper renamed to exportRows.')
    expect(row).not.toContain('Already renamed in c2.')
    expect(row).not.toContain('Rename this to')
    expect((await ui.find({ key: 'waiting' }))?.text).toContain('Why does the export skip empty rows?')

    await ui.press({ key: 'more:mine' })
    expect((await ui.find({ key: 'mine' }))?.text).toContain('Already renamed in c2.')
    await ui.press({ key: 'more:mine' })
    expect((await ui.find({ key: 'mine' }))?.text).not.toContain('Already renamed in c2.')
    await ui.unmount()
  }
})

test('every thread triaged and handled shows all feedback handled, with nothing to triage', async ($, on) => {
  await openOnTriagedPr($, on)

  await $.tool.call({
    tool: TRIAGE_TOOL,
    pr: 'https://github.com/acme/app/pull/12',
    threads: [MINE_TRIAGE, { ...MINE_TRIAGE, threadId: 'waiting', name: 'skip-empty-rows' }],
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /handled/ }))?.text).toBe('✓ all feedback handled')
    expect(await ui.find({ type: 'Text', text: /to triage/ })).toBeUndefined()
    expect(await ui.find({ key: 'triage' })).toBeUndefined()
    await ui.unmount()
  }
})

test('a comment after the triage puts its thread back to triage', async ($, on) => {
  const answers: Record<number, unknown> = { 12: TRIAGED_PR }
  await openOnTriagedPr($, on, answers)
  await $.tool.call({ tool: TRIAGE_TOOL, pr: 'https://github.com/acme/app/pull/12', threads: [MINE_TRIAGE] })

  answers[12] = githubAnswer(12, {
    reviewThreads: {
      totalCount: 2,
      nodes: [
        reviewThread('mine', false, [
          ['cid', '2026-11-11T10:00:00Z', 'Rename this to `exportRows`.'],
          ['cid', '2026-11-12T10:00:00Z', 'Also the test.'],
        ]),
      ],
    },
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })

    await ui.press({ key: 'refresh' })
    expect((await ui.find({ type: 'Text', text: /to triage/ }))?.text).toBe(' 1 to triage ')
    expect((await ui.find({ key: 'mine' }))?.text).toContain('new comment since triage')
    expect((await ui.find({ type: 'Text', text: /handled/ }))?.text).toBe('0 of 1 handled, 1 unknown')
    await ui.unmount()
  }
})

test('Triage asks for the threads not triaged yet, Explain for one thread', async ($, on) => {
  const { prompts } = await openOnTriagedPr($, on)
  await $.tool.call({ tool: TRIAGE_TOOL, pr: 'https://github.com/acme/app/pull/12', threads: [MINE_TRIAGE] })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    prompts.length = 0

    await ui.press({ key: 'triage' })
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('Triage 1 thread on my PR acme/app#12 (https://github.com/acme/app/pull/12)')
    expect(prompts[0]).toContain('- waiting: https://github.com/acme/app/pull/12#discussion_waiting_0')
    expect(prompts[0]).not.toContain('- mine:')

    await ui.press({ key: 'explain:mine' })
    expect(prompts[1]).toContain('Explain the problem that review thread rename-export-rows raises on my PR acme/app#12')
    expect(prompts[1]).toContain('Thread mine: https://github.com/acme/app/pull/12#discussion_mine_0')
    await ui.unmount()
  }
})

test('a triage call that is malformed or names a PR the pane does not follow is refused', async ($, on) => {
  const { calls } = await openOnTriagedPr($, on)
  calls.length = 0

  const malformed = await $.tool.call({ tool: TRIAGE_TOOL, pr: 'https://github.com/acme/app/pull/12', threads: [{ ...MINE_TRIAGE, importance: 'urgent' }] })
  const unfollowed = await $.tool.call({ tool: TRIAGE_TOOL, pr: 'https://github.com/acme/app/pull/99', threads: [MINE_TRIAGE] })

  expect(malformed).toMatchObject({ deny: '`threads[0].importance` must be high, medium or low.' })
  expect(unfollowed).toMatchObject({ deny: 'https://github.com/acme/app/pull/99 is not a PR the /babysit-pr pane follows, or it has not loaded yet.' })
  expect(calls).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /to triage/ }))?.text).toBe(' 2 to triage ')
  await ui.unmount()
})
