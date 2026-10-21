# shellcheck shell=bash
# Helpers shared by check.sh and validate.sh. GitHub goes through gh, any other remote through glab.

pr_cli() { # repo
  case "$(git -C "$1" remote get-url origin 2>/dev/null)" in
    *github*) echo gh ;;
    *) echo glab ;;
  esac
}

# Prints the branch's open, non-draft PR or MR as {id, target, url, label}, or nothing when there
# is none. Fails when the CLI is missing or can't reach the platform.
pr_for_branch() { # repo branch
  local cli list
  cli=$(pr_cli "$1")
  command -v "$cli" >/dev/null || return 1
  if [[ "$cli" == gh ]]; then
    list=$(cd "$1" && gh pr list --head "$2" --state open --json number,baseRefName,url,isDraft 2>/dev/null) || return 1
    jq -c 'if type == "array" then map(select(.isDraft | not)) | .[0] // empty
      | {id: .number, target: .baseRefName, url, label: "PR #\(.number)"} else error end' <<<"$list" 2>/dev/null
  else
    list=$(cd "$1" && glab mr list --source-branch "$2" -F json 2>/dev/null) || return 1
    jq -c 'if type == "array" then map(select((.draft // .work_in_progress // false) | not)) | .[0] // empty
      | {id: .iid, target: .target_branch, url: .web_url, label: "MR !\(.iid)"} else error end' <<<"$list" 2>/dev/null
  fi
}

pr_update_description() { # repo id file
  if [[ "$(pr_cli "$1")" == gh ]]; then
    (cd "$1" && gh pr edit "$2" --body-file "$3" >/dev/null)
  else
    (cd "$1" && glab mr update "$2" --description "$(cat "$3")" >/dev/null)
  fi
}

# Hash of the branch's changes against its target, binary contents included. Hunk headers and blob
# ids are left out, so a rebase that leaves the changes untouched keeps the same fingerprint.
pr_fingerprint() { # repo target
  local base
  base=$(git -C "$1" merge-base "origin/$2" HEAD 2>/dev/null) || return 1
  git -C "$1" diff --no-color --no-ext-diff --binary --unified=0 "$base" HEAD |
    grep -v -e '^@@' -e '^index ' |
    git -C "$1" hash-object --stdin
}

# Per-worktree file holding the last validated fingerprint, inside .git so it's never committed.
pr_fingerprint_file() { # repo id
  echo "$(git -C "$1" rev-parse --absolute-git-dir)/claude-pr-description/$2"
}
