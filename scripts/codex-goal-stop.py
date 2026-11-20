"""Stop hook continuation only after a successful goal completion in this turn.

Goal status remains owned by Codex. This hook neither completes goals nor runs tests.
State contains session/turn IDs and status only, never transcripts or tool bodies.
"""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / '.cache' / 'codex-goal-hooks'
TOOLS = {'create_goal', 'get_goal', 'update_goal'}


def handle(event, directory=STATE):
    session = event.get('session_id')
    turn = event.get('turn_id')
    if not isinstance(session, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,120}', session):
        return {}
    if not isinstance(turn, str) or not turn:
        return {}
    path = directory / (session + '.json')
    if event.get('hook_event_name') == 'PostToolUse' and event.get('tool_name') in TOOLS:
        # Clear prior observations even when this update fails or returns an unknown shape.
        state = {'session_id': session, 'turn_id': turn, 'status': 'unconfirmed'}
        response = event.get('tool_response')
        if isinstance(response, str):
            try:
                response = json.loads(response)
            except ValueError:
                response = None
        if isinstance(response, dict) and not response.get('isError') and not response.get('error'):
            goal = response.get('goal')
            if isinstance(goal, dict) and goal.get('threadId') == session:
                state['status'] = goal.get('status') if goal.get('status') in ('active', 'complete', 'paused', 'blocked') else 'unconfirmed'
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = path.with_suffix('.pending')
        with temporary.open('w', encoding='utf-8') as output:
            temporary.chmod(0o600)
            json.dump(state, output)
        temporary.replace(path)
    elif event.get('hook_event_name') == 'Stop':
        try:
            state = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            return {}
        if state == {'session_id': session, 'turn_id': turn, 'status': 'complete'}:
            return {'continue': False, 'stopReason': 'The goal tool confirmed completion in this turn.'}
    return {}


if __name__ == '__main__':
    try:
        event = json.loads(sys.stdin.read(65537))
        result = handle(event) if isinstance(event, dict) else {}
    except (OSError, ValueError, TypeError):
        result = {'systemMessage': 'Goal stop hook could not read its state; native goal controls remain authoritative.'}
    print(json.dumps(result))
