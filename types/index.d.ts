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

// `headSha` is the head the comment was written on: GitHub says it, GitLab doesn't.
export type PrComment = { author: string; createdAt: string; body: string; url: string; headSha: string | null }

// `resolvedBy` is null while the thread is open.
export type PrThread = {
  id: string
  isResolved: boolean
  resolvedBy: string | null
  path: string | null
  line: number | null
  comments: PrComment[]
}

// GitHub names the approving review, to dismiss to withdraw it, and the head it was given on (null once that commit
// is gone). GitLab says only when, and only through its REST API.
export type PrApproval = { user: string; reviewId: number; sha: string | null; approvedAt: string | null } | { user: string; approvedAt: string | null }

export type PrCommit = { sha: string; author: string; committedAt: string }

// A submitted review. GitLab gives a reviewer's state only, with no time.
export type PrReview = { author: string; state: 'approved' | 'changes-requested' | 'commented' | 'dismissed'; submittedAt: string | null }

// A head the PR had, with the patch-id of its diff: a rebase alone keeps it. `pushedAt` is when it was pushed,
// which only GitLab says (one MR version per push).
export type PrHead = { sha: string; pushedAt: string | null; patchId: string | null }

// When someone reviewed or commented, and the head they did it on when the platform says (GitHub).
export type ReviewPoint = { at: string; headSha: string | null }

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
  // What push detection compares, read for open PRs only. GitLab: every MR version, oldest first. GitHub: the head,
  // and the heads the rules compare it with (see `comparedHeadShas`).
  heads: PrHead[]
  // The viewer's last review or comment, approvals and requested changes included.
  lastViewerActivity: ReviewPoint | null
  hasMoreThreads: boolean
  hasMoreCommits: boolean
}

// What changed on a PR between two reads, by someone other than the viewer.
export type PrChange =
  | { kind: 'code-pushed' }
  | { kind: 'replied' | 'mentioned'; author: string; threadIds: string[] }
  | { kind: 'threads-resolved' }
  | { kind: 'approved' | 'unapproved'; user: string }

// The newest head whose patch-id was read. A code push is measured from it, so a failed read raises no event and the
// next read that has a patch-id still compares with the right head.
export type CodeHead = { sha: string; patchId: string; baseBranch: string }

// One PR's watch: the changes the user has not acted on yet, and whether the pane showed the PR since they came in.
export type PrWatch = { codeHead: CodeHead | null; changes: PrChange[]; isShown: boolean }

export type FollowedPr = {
  ref: PrRef
  snapshot: PrSnapshot | null
  error: string | null
}

export type TriageImportance = 'high' | 'medium' | 'low'

// What the model recorded for one thread. `lastCommentUrl` is the newest comment the model read in the thread:
// a newer one in the pane means the triage is out of date.
export type ThreadTriage = {
  name: string
  classification: string
  importance: TriageImportance
  isHandled: boolean
  summary: string
  details: string
  lastCommentUrl: string
}

// One PR's triage, by thread id.
export type PrTriage = Record<string, ThreadTriage>

// One PR's draft replies, the text by thread id.
export type ReplyDrafts = Record<string, string>

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
      // By PR key.
      babysitTriages: Shaped<Record<string, PrTriage>>
      isBabysitTriageOpen: StateFamily<boolean>
      // By PR key.
      babysitReplyDrafts: Shaped<Record<string, ReplyDrafts>>
      // By PR key.
      babysitWatches: Shaped<Record<string, PrWatch>>
    }
  }
}
