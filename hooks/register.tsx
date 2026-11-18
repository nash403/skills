// The plugin's one hooks module: hooks.json names a single module, so each mod
// lives in its own hooks/<name>/ folder and registers from here.
import type { Register } from 'claude-code'

import { register as gitBand } from './git-band/register'

export const register: Register = (on, options) => {
  gitBand(on, options)
}
