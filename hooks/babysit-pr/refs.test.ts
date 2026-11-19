import { expect, test } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'

import type { Repo } from '../../types'
import { findSessionPrs, parsePrInput, parsePrUrl, parseRemote, prKey } from './refs'

const GITHUB_REPO: Repo = { platform: 'github', host: 'github.com', project: 'acme/app' }
const GITLAB_REPO: Repo = { platform: 'gitlab', host: 'gitlab.com', project: 'team/group/app' }

test('a remote names its platform, host and project', () => {
  expect(parseRemote('git@github.com:acme/app.git')).toEqual(GITHUB_REPO)
  expect(parseRemote('https://github.com/acme/app')).toEqual(GITHUB_REPO)
  expect(parseRemote('https://oauth2:secret@gitlab.com/team/group/app.git')).toEqual(GITLAB_REPO)
  expect(parseRemote('ssh://git@gitlab.example.org:2222/team/app.git')).toEqual({
    platform: 'gitlab',
    host: 'gitlab.example.org',
    project: 'team/app',
  })
  expect(parseRemote('git@bitbucket.org:acme/app.git')).toBeNull()
})

test('a PR or MR URL gives its reference', () => {
  expect(parsePrUrl('https://github.com/acme/app/pull/12')).toEqual({ ...GITHUB_REPO, number: 12 })
  expect(parsePrUrl('https://gitlab.com/team/group/app/-/merge_requests/345#note_1')).toEqual({
    ...GITLAB_REPO,
    number: 345,
  })
  expect(parsePrUrl('https://github.com/acme/app/issues/12')).toBeNull()
  expect(parsePrUrl('https://github.com/acme/app/pull/new/feat/x')).toBeNull()
})

test('a PR typed by hand is a number of the current repo or a URL', () => {
  expect(parsePrInput(' 12 ', GITHUB_REPO)).toEqual({ ref: { ...GITHUB_REPO, number: 12 } })
  expect(parsePrInput('#12', GITHUB_REPO)).toEqual({ ref: { ...GITHUB_REPO, number: 12 } })
  expect(parsePrInput('!345', GITLAB_REPO)).toEqual({ ref: { ...GITLAB_REPO, number: 345 } })
  expect(parsePrInput('https://github.com/other/lib/pull/3', GITLAB_REPO)).toEqual({
    ref: { platform: 'github', host: 'github.com', project: 'other/lib', number: 3 },
  })
  expect(parsePrInput('12', null)).toEqual({ error: 'No GitHub or GitLab remote here: paste the PR URL.' })
  expect(parsePrInput('hello', GITHUB_REPO)).toEqual({ error: 'Type a PR number or paste a PR URL.' })
})

test('the session PRs come from URLs in messages and from gh and glab commands', () => {
  const messages: SessionMessage[] = [
    { role: 'user', text: 'Look at https://github.com/acme/app/pull/7 please', toolUses: [] },
    {
      role: 'assistant',
      text: 'Opening it.',
      toolUses: [
        {
          tool_use_id: 't1',
          tool: 'Bash',
          input: { command: 'gh pr create --title "Add x" --body "y"' },
          text: 'https://github.com/acme/app/pull/8\n',
        },
        { tool_use_id: 't2', tool: 'Bash', input: { command: 'gh pr view 9 --json title -q .title' }, text: 'Fix' },
        { tool_use_id: 't3', tool: 'Bash', input: { command: 'cd lib && gh pr view 4 -R other/lib' }, text: '' },
        { tool_use_id: 't4', tool: 'Bash', input: { command: 'glab mr view 21 --repo team/tools' }, text: '' },
        { tool_use_id: 't5', tool: 'Bash', input: { command: 'gh pr view feat/branch' }, text: '' },
        { tool_use_id: 't6', tool: 'Bash', input: { command: 'gh pr list' }, text: 'https://github.com/acme/app/pull/99' },
        { tool_use_id: 't7', tool: 'Read', input: { file_path: 'CHANGELOG.md' }, text: 'https://github.com/acme/app/pull/98' },
        { tool_use_id: 't8', tool: 'Edit', input: { file_path: 'CHANGELOG.md', new_string: 'https://github.com/acme/app/pull/97' } },
        { tool_use_id: 't9', tool: 'WebFetch', input: { url: 'https://github.com/acme/app/pull/5/files' }, text: '' },
        {
          tool_use_id: 't10',
          tool: 'Bash',
          input: { command: 'git -C /work/tools push' },
          text: 'remote: View merge request for chore/tidy:\nremote:   https://gitlab.com/team/tools/-/merge_requests/22',
        },
      ],
    },
    { role: 'assistant', text: 'Again https://github.com/acme/app/pull/7.', toolUses: [] },
  ]

  expect(findSessionPrs(messages, GITHUB_REPO).map(prKey)).toEqual([
    'github.com/acme/app#7',
    'github.com/acme/app#8',
    'github.com/acme/app#9',
    'github.com/other/lib#4',
    'gitlab.com/team/tools#21',
    'github.com/acme/app#5',
    'gitlab.com/team/tools#22',
  ])
  expect(findSessionPrs(messages, GITLAB_REPO).map(prKey)).toEqual([
    'github.com/acme/app#7',
    'github.com/acme/app#8',
    'github.com/other/lib#4',
    'gitlab.com/team/tools#21',
    'github.com/acme/app#5',
    'gitlab.com/team/tools#22',
  ])
})
