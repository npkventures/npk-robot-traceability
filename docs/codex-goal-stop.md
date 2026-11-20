# Stop after confirmed goal completion

Requested November 12, 2026, during the backend debugging goal. Product direction and evidence gates remain governed by [build.md](../build.md).

The repository configures `PostToolUse` and `Stop` hooks in [`.codex/hooks.json`](../.codex/hooks.json). Both invoke [scripts/codex-goal-stop.py](../scripts/codex-goal-stop.py). A successful `create_goal`, `get_goal`, or `update_goal` response is recorded as session ID, turn ID and status under ignored `.cache/codex-goal-hooks/`. Objectives, transcripts, credentials and other tool output are not saved.

At turn end, the hook returns `continue: false` only when the goal tool confirmed `complete` for the same session and turn. Active, paused, blocked, failed, unknown and stale observations do not trigger it. The hook never asks for another continuation, edits goal status, runs verification, or treats a green test suite as completion. Native goal controls remain authoritative. After the full completion audit, the agent must mark the goal complete and then finish; this hook additionally suppresses competing Stop-hook continuation.

## Activation and verification

Open **Settings → Hooks** in the desktop app or `/hooks` in the CLI, review the repository hooks named **Checking confirmed goal completion**, and trust them. Codex requires trust for new or changed non-managed hook definitions. If the current session has not discovered the new configuration, resume the thread after reloading Codex. Do not bypass hook trust.

Run `python3 scripts/test_codex_goal_stop.py` for the synthetic contract checks. The script works with the system Python 3.9; backend collector tests separately require Python 3.10 or newer. Local hook tests cover status transitions, failed updates, cross-session/stale-turn isolation and minimal stored state. Passing them does not prove that Codex has trusted or executed the hooks in a live session.

Only the result shape observed from the current goal tools (`goal.threadId` and `goal.status`, as an object or JSON string) is accepted. Public hook documentation defines the `tool_response` container, not the goal-specific payload. If runtime hook payloads change or the tool path does not emit hooks, the script does not infer completion. No transcript parsing or private Codex database access is used.

Official references: [Hooks](https://learn.chatgpt.com/docs/hooks), [Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).
