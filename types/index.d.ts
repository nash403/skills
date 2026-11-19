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

export type Platform = 'github' | 'gitlab'

export type Repo = { platform: Platform; host: string; project: string }

export type PrRef = Repo & { number: number }

export type PrState = 'open' | 'merged' | 'closed'

export type CiState = 'none' | 'starting' | 'pending' | 'ok' | 'error'

export type BlockedReason = 'conflicts' | 'rebase' | 'approvals' | 'threads' | 'checks' | 'blocked'

export type PrComment = { author: string; createdAt: string; body: string; url: string }

export type PrThread = {
  id: string
  isResolved: boolean
  path: string | null
  line: number | null
  comments: PrComment[]
}

// GitHub says which head an approval was given on; GitLab says only when, and only through its REST API.
export type PrApproval = { user: string; sha: string } | { user: string; approvedAt: string | null }

export type PrCommit = { sha: string; author: string; committedAt: string }

// A submitted review. GitLab gives a reviewer's state only, with no time.
export type PrReview = { author: string; state: 'approved' | 'changes-requested' | 'commented' | 'dismissed'; submittedAt: string | null }

export type PrSnapshot = {
  url: string
  title: string
  state: PrState
  isDraft: boolean
  isApproved: boolean
  author: string
  viewer: string
  headSha: string
  headBranch: string
  baseBranch: string
  headMessage: string
  additions: number
  deletions: number
  changedFiles: number
  ci: CiState
  blocked: BlockedReason | null
  reviewers: string[]
  approvals: PrApproval[]
  reviews: PrReview[]
  commits: PrCommit[]
  threads: PrThread[]
  hasMoreThreads: boolean
  hasMoreCommits: boolean
}

export type FollowedPr = {
  ref: PrRef
  snapshot: PrSnapshot | null
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'nash403-skills': {
      gitBand: Shaped<GitSnapshot | null>
      gitBandEditedDirs: Shaped<string[]>
      isGitBandDirListOpen: boolean
      babysitPrs: Shaped<FollowedPr[]>
      babysitRemovedPrs: Shaped<string[]>
      babysitSelectedPr: string | null
      babysitScannedMessage: string | null
      isBabysitPrOptedIn: boolean
    }
  }
}
