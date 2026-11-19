#!/usr/bin/env bash
# PreToolUse (Claude Code) / beforeShellExecution (Cursor) gate. Asks the
# user to approve every git commit instead of letting the agent commit silently.
set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // .command // empty')

# git, then any global options (-C <dir>, -c <k=v>, --flag), then the commit subcommand.
pattern='(^|[;&|(`[:space:]])git(([[:space:]]+-[cC][[:space:]]+[^[:space:]]+)|([[:space:]]+--?[^[:space:]]+))*[[:space:]]+commit([[:space:]]|$)'
echo "$command" | grep -qE "$pattern" || exit 0

reason="git commit needs manual approval."

if echo "$input" | jq -e 'has("tool_input")' >/dev/null; then
  jq -n --arg reason "$reason" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: $reason}}'
else
  jq -n --arg reason "$reason" '{permission: "ask", user_message: $reason, agent_message: $reason}'
fi

exit 0
