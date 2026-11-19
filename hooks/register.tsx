// The plugin's one hooks module: hooks.json names a single module, so each mod
// lives in its own hooks/<name>/ folder and registers from here.
// Validate refuses an event hooked twice without a matcher in one module, so the
// session lifecycle events are hooked here, once, and handed to each mod.
import type { Register } from 'claude-code'

import { refreshGitBandAfterTurn, register as gitBand, startGitBand } from './git-band/register'

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    startGitBand($)

    return started
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    refreshGitBandAfterTurn($)

    return result
  })

  gitBand(on, options)
}
