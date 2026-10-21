#!/usr/bin/env bash
# Tests for nudge.sh: which Bash commands trigger the ticket status nudge.
set -uo pipefail

hook="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nudge.sh"
failures=0

check() { # description, expected (nudge|quiet), hook input
  local got=quiet
  printf '%s' "$3" | "$hook" | grep -q additionalContext && got=nudge
  if [[ "$got" == "$2" ]]; then echo "ok   - $1"; else echo "FAIL - $1 (got $got)"; failures=$((failures + 1)); fi
}

check "git push" nudge '{"tool_input":{"command":"git push -q origin main"},"tool_response":{"stdout":""}}'
check "commit then push, with escaped quotes" nudge '{"tool_input":{"command":"git commit -m \"fix: x\" && git push"}}'
check "push on a second line" nudge '{"tool_input":{"command":"cd repo &&\ngit push origin main"}}'
check "gh pr create" nudge '{"tool_input":{"command":"gh pr create --fill"}}'
check "glab mr merge" nudge '{"tool_input":{"command":"glab mr merge 12"}}'
check "git merge-base" quiet '{"tool_input":{"command":"git merge-base --is-ancestor a b"}}'
check "git commit alone" quiet '{"tool_input":{"command":"git commit -m \"x\""}}'
check "output that mentions git push" quiet '{"tool_input":{"command":"git log -1"},"tool_response":{"stdout":"use git push to publish"}}'
check "git config pushurl" quiet '{"tool_input":{"command":"git config remote.origin.pushurl"}}'

echo
if ((failures)); then echo "$failures test(s) failed"; exit 1; fi
echo "all tests passed"
