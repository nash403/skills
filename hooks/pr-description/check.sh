#!/usr/bin/env bash
# PreToolUse hook on Bash: deny the agent's push to a branch with an open, non-draft PR or MR until
# its description was checked against the current changes. Pushes run outside the agent are not
# affected, and any lookup failure lets the push through with a warning.
set -uo pipefail

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$dir/lib.sh"

skip() {
  printf '{"systemMessage":"PR description check skipped: %s"}\n' "$1"
  exit 0
}

command -v jq >/dev/null || skip "jq is not installed."

deny() {
  jq -nc --arg reason "Push blocked: $1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

resolve() { # base path
  case "$2" in /*) echo "$2" ;; *) echo "$1/$2" ;; esac
}

# Finds a `git push` that sends a branch among chained commands, and prints the directory it runs
# in. Follows `cd <dir>`, `git -C <dir>`, `git -c key=value` and env assignments; quoting is not
# interpreted.
push_dir() { # command cwd
  local cwd=$2 segment repo arg words i
  while IFS= read -r segment; do
    read -ra words <<<"$segment"
    i=0
    while [[ "${words[i]:-}" == *=* ]]; do i=$((i + 1)); done
    if [[ "${words[i]:-}" == cd && -n "${words[i + 1]:-}" ]]; then
      cwd=$(resolve "$cwd" "${words[i + 1]}")
      continue
    fi
    [[ "${words[i]:-}" == git ]] || continue
    repo=$cwd
    i=$((i + 1))
    while [[ "${words[i]:-}" == -* ]]; do
      case "${words[i]}" in
        -C) repo=$(resolve "$cwd" "${words[i + 1]:-}") && i=$((i + 2)) ;;
        -c) i=$((i + 2)) ;;
        *) i=$((i + 1)) ;;
      esac
    done
    [[ "${words[i]:-}" == push ]] || continue
    for arg in "${words[@]:i+1}"; do
      case "$arg" in --delete | -d | --dry-run | -n | --tags | --help | -h) continue 2 ;; esac
    done
    echo "$repo"
    return 0
  done < <(sed -E 's/(&&|\|\||[;|&()])/\n/g' <<<"$1")
  return 1
}

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
[[ -n "$command" ]] || exit 0

repo=$(push_dir "$command" "${cwd:-$PWD}") || exit 0
branch=$(git -C "$repo" symbolic-ref --quiet --short HEAD 2>/dev/null) || exit 0

pr=$(pr_for_branch "$repo" "$branch") || skip "could not look up the PR or MR of $branch ($(pr_cli "$repo") missing or not signed in?)."
[[ -n "$pr" ]] || exit 0
id=$(jq -r .id <<<"$pr")
target=$(jq -r .target <<<"$pr")
label="$(jq -r .label <<<"$pr") ($(jq -r .url <<<"$pr"))"

fingerprint=$(pr_fingerprint "$repo" "$target") ||
  deny "$label can't be diffed against origin/$target: fetch it with \`git -C $(printf %q "$repo") fetch origin $target\`, then retry."
[[ "$(cat "$(pr_fingerprint_file "$repo" "$id")" 2>/dev/null)" == "$fingerprint" ]] && exit 0

validate=$(printf %q "$dir/validate.sh")
deny "$label has changes its description wasn't checked against. Check it with the syncing-pr-description \
skill, record the outcome with \`$validate -C $(printf %q "$repo") --unchanged\` or \`--description-file <file>\`, \
then retry the push."
