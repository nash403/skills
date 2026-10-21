#!/usr/bin/env bash
# Tests for check.sh and validate.sh, against a throwaway git repo and fake gh and glab CLIs:
# no network, no auth.
set -uo pipefail

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
hook="$dir/check.sh"
validate="$dir/validate.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com

# Fake CLIs: `list` answers $FAKE_PRS (or fails when $FAKE_FAIL is set), `update`/`edit` appends its
# arguments to $FAKE_UPDATES.
mkdir -p "$tmp/bin"
for cli in gh glab; do
  cat >"$tmp/bin/$cli" <<'EOF'
#!/usr/bin/env bash
[[ -n "${FAKE_FAIL:-}" ]] && { echo "401 Unauthorized" >&2; exit 1; }
case "$1 $2" in
  "pr list" | "mr list") printf '%s\n' "${FAKE_PRS:-[]}" ;;
  "pr edit" | "mr update") shift 2; printf '%s\n' "$@" >>"$FAKE_UPDATES" ;;
  *) echo "unexpected call: $*" >&2; exit 2 ;;
esac
EOF
  chmod +x "$tmp/bin/$cli"
done
export PATH="$tmp/bin:$PATH" FAKE_UPDATES="$tmp/updates"

repo="$tmp/repo"
git init -q --bare "$tmp/origin.git"
git init -q -b develop "$repo"
git -C "$repo" remote add origin "$tmp/origin.git"
echo base >"$repo/base.txt"
git -C "$repo" add base.txt && git -C "$repo" commit -qm base
git -C "$repo" push -q origin develop
git -C "$repo" switch -qc feature
echo one >"$repo/feature.txt"
git -C "$repo" add feature.txt && git -C "$repo" commit -qm one

mr='[{"iid":42,"target_branch":"develop","web_url":"https://gitlab.example/mr/42","draft":false}]'

failures=0
check() { # description, ok|ko
  if [[ "$2" == ok ]]; then echo "ok   - $1"; else echo "FAIL - $1"; failures=$((failures + 1)); fi
}
run_hook() { # command [cwd]
  jq -nc --arg cmd "$1" --arg cwd "${2:-$repo}" \
    '{hook_event_name:"PreToolUse",tool_name:"Bash",tool_input:{command:$cmd},cwd:$cwd}' | "$hook"
}
denied() { [[ "$(jq -r '.hookSpecificOutput.permissionDecision // empty' <<<"$1" 2>/dev/null)" == deny ]]; }
is() { if "$@"; then echo ok; else echo ko; fi; }

# GitLab (any non-GitHub remote)

export FAKE_PRS='[]'
check "push on a branch without MR goes through silently" "$(is test -z "$(run_hook "git push")")"

export FAKE_PRS="$mr"
check "non-push commands are ignored" "$(is test -z "$(run_hook "git status")")"

out=$(run_hook "git push -u origin feature")
check "push on a branch with an unchecked MR is denied" "$(is denied "$out")"
check "the denial names the MR and the skill" "$(is grep -q 'MR !42.*syncing-pr-description' <<<"$out")"
check "the denial gives the validation command" "$(is grep -q 'validate.sh' <<<"$out")"

for cmd in "git add . && git commit -m x && git push --force-with-lease" \
  "GIT_SSH_COMMAND=ssh git -c push.default=current push"; do
  check "push detected in: $cmd" "$(is denied "$(run_hook "$cmd")")"
done
for cmd in "git -C $repo push" "cd $repo && git push" "cd repo && git push"; do
  check "push detected from another directory: $cmd" "$(is denied "$(run_hook "$cmd" "$tmp")")"
done
for cmd in "echo git push" "git push --delete origin old" "git push --dry-run" "git push --tags" \
  "git log --grep push"; do
  check "no check for: $cmd" "$(is test -z "$(run_hook "$cmd")")"
done

export FAKE_PRS='[{"iid":42,"target_branch":"develop","web_url":"u","draft":true}]'
check "a draft MR is ignored" "$(is test -z "$(run_hook "git push")")"
export FAKE_PRS="$mr"

(cd "$repo" && "$validate" --unchanged >/dev/null)
check "push goes through once the description is validated" "$(is test -z "$(run_hook "git push")")"

git -C "$repo" switch -q develop
echo other >"$repo/other.txt"
git -C "$repo" add other.txt && git -C "$repo" commit -qm other
git -C "$repo" push -q origin develop
git -C "$repo" switch -q feature
git -C "$repo" rebase -q develop
check "a rebase that leaves the changes untouched doesn't re-trigger the check" \
  "$(is test -z "$(run_hook "git push --force-with-lease")")"

echo two >>"$repo/feature.txt"
git -C "$repo" commit -qam two
check "new commits re-trigger the check" "$(is denied "$(run_hook "git push")")"

printf '## Why\n\nBecause.\n' >"$tmp/description.md"
(cd "$repo" && "$validate" --description-file "$tmp/description.md" >/dev/null)
check "validating with a description file updates the MR" "$(is grep -qx 'Because.' "$FAKE_UPDATES")"
check "push goes through after the update" "$(is test -z "$(run_hook "git push")")"

printf 'bin\0one' >"$repo/blob.bin"
git -C "$repo" add blob.bin && git -C "$repo" commit -qm blob
(cd "$repo" && "$validate" --unchanged >/dev/null)
printf 'bin\0two' >"$repo/blob.bin"
git -C "$repo" commit -qam blob-two
check "binary changes re-trigger the check" "$(is denied "$(run_hook "git push")")"
(cd "$repo" && "$validate" --unchanged >/dev/null)

export FAKE_PRS='[{"iid":42,"target_branch":"release","web_url":"u","draft":false}]'
out=$(run_hook "git push")
export FAKE_PRS="$mr"
check "push is denied when the target branch can't be diffed" "$(is denied "$out")"
check "that denial asks to fetch the target branch" "$(is grep -q 'fetch origin release' <<<"$out")"

spaced="$tmp/with space"
git -C "$repo" worktree add -q -b spaced "$spaced"
check "push from a path with spaces is denied" "$(is denied "$(run_hook "git push" "$spaced")")"
git -C "$repo" worktree remove "$spaced"

(cd "$repo" && "$validate" >/dev/null 2>&1)
check "validating without --unchanged or --description-file is refused" "$(is test $? -ne 0)"

echo three >>"$repo/feature.txt"
git -C "$repo" commit -qam three
export FAKE_FAIL=1
out=$(run_hook "git push")
unset FAKE_FAIL
check "a CLI failure lets the push through" "$(is test "$(jq -r '.hookSpecificOutput.permissionDecision // "none"' <<<"$out")" = none)"
check "a CLI failure surfaces a warning" "$(is test -n "$(jq -r '.systemMessage // empty' <<<"$out")")"

check "fingerprints stay out of the work tree" "$(is test -z "$(git -C "$repo" status --porcelain)")"

# GitHub

git -C "$repo" remote set-url origin https://github.com/example/repo.git
export FAKE_PRS='[{"number":7,"baseRefName":"develop","url":"https://github.com/example/repo/pull/7","isDraft":false}]'
out=$(run_hook "git push")
check "GitHub: push on a branch with an unchecked PR is denied" "$(is denied "$out")"
check "GitHub: the denial names the PR" "$(is grep -q 'PR #7' <<<"$out")"

printf 'Updated.\n' >"$tmp/description.md"
(cd "$repo" && "$validate" --description-file "$tmp/description.md" >/dev/null)
check "GitHub: validating with a description file edits the PR body" "$(is grep -qx -- '--body-file' "$FAKE_UPDATES")"
check "GitHub: push goes through after the update" "$(is test -z "$(run_hook "git push")")"

echo four >>"$repo/feature.txt"
git -C "$repo" commit -qam four
export FAKE_PRS='[{"number":7,"baseRefName":"develop","url":"u","isDraft":true}]'
check "GitHub: a draft PR is ignored" "$(is test -z "$(run_hook "git push")")"

echo
if ((failures)); then echo "$failures test(s) failed"; exit 1; fi
echo "all tests passed"
