// The $.state contract of the plugin's mods, one key per mod.

export type Divergence = { ahead: number; behind: number }

export type ChangeRequest =
  | { state: 'unknown' }
  | { state: 'none' }
  | {
      state: 'open' | 'merged' | 'closed'
      id: number
      url: string
      isDraft: boolean
      target: string
    }

export type GitSnapshot = {
  folder: string
  root: string
  isLinkedWorktree: boolean
  branch: string | null
  isDetached: boolean
  defaultBranch: string | null
  base: string | null
  upstream: Divergence | null
  vsBase: Divergence | null
  request: ChangeRequest
}

declare module 'claude-code' {
  interface PluginState {
    'nash403-skills': {
      gitBand: Shaped<GitSnapshot | null>
      gitBandEditedDirs: Shaped<string[]>
      isGitBandDirListOpen: boolean
    }
  }
}
