import { expect, test } from 'claude-code/testing'

import { diffBarSvg, diffBlocks } from './look'

test('the diffstat splits five blocks by share, one at least for each side with lines', () => {
  expect(diffBlocks(40, 3)).toEqual({ added: 4, removed: 1, neutral: 0 })
  expect(diffBlocks(1000, 1)).toEqual({ added: 4, removed: 1, neutral: 0 })
  expect(diffBlocks(1, 1000)).toEqual({ added: 1, removed: 4, neutral: 0 })
  expect(diffBlocks(5, 0)).toEqual({ added: 5, removed: 0, neutral: 0 })
  expect(diffBlocks(0, 9)).toEqual({ added: 0, removed: 5, neutral: 0 })
  expect(diffBlocks(0, 0)).toEqual({ added: 0, removed: 0, neutral: 5 })
})

test('the diff bar fills its added share in green over a red rest, gray when nothing changed', () => {
  expect(diffBarSvg(30, 10, 80, 6)).toContain('<rect width="60" height="6" fill="#2F8F5B"/>')
  expect(diffBarSvg(30, 10, 80, 6)).toContain('fill="#D6404E"')
  expect(diffBarSvg(0, 0, 80, 6)).toContain('fill="#6E7781"')
})
