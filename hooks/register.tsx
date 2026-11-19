// The plugin's one hooks module: hooks.json names a single module, so each mod
// lives in its own hooks/<name>/ folder and registers from here.
// Validate refuses an event hooked twice without a matcher in one module, so the
// session lifecycle events are hooked here, once, and handed to each mod.
// The band above the prompt holds one row per plugin, so its rows are stacked here too.
import type { Register } from 'claude-code'

import { catchUpBabysitPrAfterTurn, register as babysitPr, startBabysitPr } from './babysit-pr/register'
import { drawGitBand, refreshGitBandAfterTurn, register as gitBand, startGitBand } from './git-band/register'
import { drawSessionTime, refreshSessionTimeAfterTurn, startSessionTime } from './session-time/register'

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    startGitBand($)
    startSessionTime($)
    await startBabysitPr($)

    return started
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    refreshGitBandAfterTurn($)
    catchUpBabysitPrAfterTurn($, e)

    if (e.agentId === undefined) {
      refreshSessionTimeAfterTurn($)
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const git = await drawGitBand($, e)
    const time = await drawSessionTime($, e)

    if (git === null && time === null) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" rowGap={1} width="100%">
        {git}
        {time}
      </Box>
    )
  })

  gitBand(on, options)
  babysitPr(on, options)
}
