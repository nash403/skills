#!/usr/bin/env bash
# PostToolUse hook on Bash: after a push, a merge, or a PR or MR is opened or
# merged, tell the agent a ticket's status may need to follow.
# It only nudges; the syncing-ticket-status skill does the judging.

# The first "command" field is tool_input.command; the tool's output comes after it.
command=$(grep -oE '"command"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"' | head -n 1)

if printf '%s' "$command" | grep -Eq '(^|[^[:alnum:]_-]|\\[nt])(git (push|merge)|gh pr (create|merge)|glab mr (create|merge))([^[:alnum:]_-]|$)'; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"A push, merge, or pull or merge request just happened. The ticket it relates to may need its status updated: the syncing-ticket-status skill covers this."}}'
fi
exit 0
