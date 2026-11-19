import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'nash403-skills',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

type Repo = Record<string, string>

const STACKED_BRANCH: Repo = {
  'git rev-parse --is-inside-work-tree': 'true',
  'git rev-parse --path-format=absolute --git-dir --git-common-dir': '/work/app/.git/worktrees/child\n/work/app/.git',
  'git branch --show-current': 'feat/child',
  'git symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
  'git remote get-url origin': 'git@gitlab.com:team/app.git',
  'glab mr view --output json': JSON.stringify({
    iid: 12,
    web_url: 'https://gitlab.com/team/app/-/merge_requests/12',
    state: 'opened',
    draft: false,
    target_branch: 'feat/parent',
  }),
  'git rev-list --left-right --count @{upstream}...HEAD': '0\t2',
  'git rev-list --left-right --count origin/feat/parent...HEAD': '3\t4',
}

const MAIN_UP_TO_DATE: Repo = {
  'git rev-parse --is-inside-work-tree': 'true',
  'git rev-parse --path-format=absolute --git-dir --git-common-dir': '/work/app/.git\n/work/app/.git',
  'git branch --show-current': 'main',
  'git symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
  'git rev-list --left-right --count @{upstream}...HEAD': '0\t0',
}

test('a stacked branch behind its base offers a cascading rebase', async ($, on) => {
  const submitted: string[] = []
  const { statuses } = stubEngine(on, STACKED_BRANCH, submitted)

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect((await ui.find({ key: 'folder' }))?.text).toBe('🌿 app')
    expect((await ui.find({ type: 'Text', text: /PR/ }))?.text).toBe('PR #12')
    expect(await ui.find({ type: 'Link' })).toMatchObject({ props: { href: 'https://gitlab.com/team/app/-/merge_requests/12' } })
    expect((await ui.find({ type: 'Text', text: /^↑$/ }))?.text).toBe('↑')
    expect(await ui.find({ type: 'Text', text: /behind/ })).toBeUndefined()
    expect(statuses.at(-1)).toBe('🌿 app  ⎇ feat/child → feat/parent  PR #12  ↑  ⚠ rebase')

    await ui.press({ key: 'rebase' })
    await ui.unmount()
  }

  expect(submitted.length).toBe(2)
  expect(submitted[0]).toContain('Bring `feat/child` up to date with the latest `feat/parent`')
  expect(submitted[0]).toContain('cascade down the stack to `main`')
  expect(submitted[0]).toContain('Rebase by default, but merge `feat/parent` into it')
})

test('a long branch name is cut in its middle and copied whole on click', async ($, on) => {
  const { copies, toasts } = stubEngine(on, {
    ...STACKED_BRANCH,
    'git branch --show-current': 'feat/KLA-1234-a-very-long-description-nobody-reads-whole',
  }, [])

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 80 }, surface: 'desktop' })
  const branch = await ui.find({ type: 'Text', text: /⎇/ })

  expect(branch?.text).toContain('feat/KLA-1234')
  expect(branch?.text).toContain('…')
  expect(branch?.text).toContain('whole')

  await ui.press({ key: 'branch' })
  expect(copies.at(-1)).toBe('feat/KLA-1234-a-very-long-description-nobody-reads-whole')
  expect(toasts.at(-1)).toBe('Copied feat/KLA-1234-a-very-long-description-nobody-reads-whole')
  await ui.unmount()
})

test('a branch with no PR offers to open one', async ($, on) => {
  const { 'glab mr view --output json': _, ...withoutRequest } = STACKED_BRANCH
  const submitted: string[] = []
  stubEngine(on, withoutRequest, submitted)

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /PR/ })).toBeUndefined()
  await ui.press({ key: 'new-pr' })
  await ui.unmount()

  expect(submitted[0]).toContain('Open a PR for `feat/child` targeting `main`')
  expect(submitted[0]).toContain('Draft its title and description from what this session set out to do')
  expect(submitted[0]).toContain('show me the draft and ask me to confirm it with the target branch and the options')
  expect(submitted[0]).toContain('give me its web link')
})

test('the main branch in sync shows no rebase or new PR button, and the folder copies its path', async ($, on) => {
  const { copies, toasts } = stubEngine(on, MAIN_UP_TO_DATE, [])

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect((await ui.find({ key: 'folder' }))?.text).toBe('📁 app')

  await ui.press({ key: 'folder' })
  expect(copies.at(-1)).toBe('/work/app')
  expect(toasts.at(-1)).toBe('Copied /work/app')
  expect((await ui.find({ type: 'Text', text: /^✓$/ }))?.text).toBe('✓')
  expect(await ui.find({ key: 'rebase' })).toBeUndefined()
  expect(await ui.find({ key: 'new-pr' })).toBeUndefined()
  expect(await ui.find({ key: 'dirs' })).toBeUndefined()
  await ui.unmount()
})

test('edits outside the session folder list their folders on click', async ($, on) => {
  stubEngine(on, {
    ...MAIN_UP_TO_DATE,
    '/work/app git rev-parse --show-toplevel': '/work/app',
    '/work/app/src git rev-parse --show-toplevel': '/work/app',
    '/home/me/other/src git rev-parse --show-toplevel': '/home/me/other',
  }, [])

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/work/app/src/a.ts', old_string: 'a', new_string: 'b' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect(await ui.find({ key: 'dirs' })).toBeUndefined()
    await ui.unmount()
  }

  await $.tool.call({ tool: 'Write', file_path: '/home/me/other/src/b.ts', content: 'b' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect(await ui.find({ type: 'Text', text: /other/ })).toBeUndefined()
    await ui.press({ key: 'dirs' })
    expect((await ui.find({ type: 'Text', text: /other/ }))?.text).toBe('~/other')
    expect((await ui.find({ type: 'Text', text: /session/ }))?.text).toBe('/work/app (session)')
    await ui.press({ key: 'dirs' })
    expect(await ui.find({ type: 'Text', text: /other/ })).toBeUndefined()
    await ui.unmount()
  }
})

function stubEngine(on: any, repo: Repo, submitted: string[]) {
  const statuses: (string | undefined)[] = []
  const copies: string[] = []
  const toasts: string[] = []
  on('ui.copy', (_: unknown, e: { text: string }) => {
    copies.push(e.text)

    return { value: { isCopied: true } }
  })
  on('ui.toast', (_: unknown, e: { text: string }) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.status', (_: unknown, e: { text: string | undefined }) => {
    statuses.push(e.text)

    return { value: undefined }
  })
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work/app' }))
  on('clock.every', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/me' }))
  on('tool.call', () => ({ result: {} }))
  on('process.run', (_: unknown, e: { argv: readonly string[]; init?: { cwd?: string } }) => {
    const command = e.argv.join(' ')
    const stdout = repo[`${e.init?.cwd} ${command}`] ?? repo[command]

    return { value: { exitCode: stdout === undefined ? 1 : 0, stdout: stdout ?? '', stderr: '' } }
  })
  on('prompt.submit', (_: unknown, e: { text: string }) => {
    submitted.push(e.text)

    return { text: e.text }
  })

  return { statuses, copies, toasts }
}
