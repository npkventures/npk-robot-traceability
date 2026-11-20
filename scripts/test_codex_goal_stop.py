import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('goal_stop', Path(__file__).with_name('codex-goal-stop.py'))
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


class GoalStopTests(unittest.TestCase):
    def test_only_confirmed_completion_stops_the_matching_turn(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            base = {'session_id': 'test-session', 'turn_id': 'turn-1'}
            stop = {**base, 'hook_event_name': 'Stop'}
            self.assertEqual(hook.handle(stop, directory), {})
            for status in ('active', 'paused', 'blocked', 'complete'):
                response = {'goal': {'threadId': base['session_id'], 'status': status}}
                event = {**base, 'hook_event_name': 'PostToolUse', 'tool_name': 'update_goal', 'tool_response': response}
                self.assertEqual(hook.handle(event, directory), {})
                self.assertEqual(hook.handle(stop, directory).get('continue'), False if status == 'complete' else None)
            self.assertEqual(hook.handle({**stop, 'turn_id': 'turn-2'}, directory), {})
            self.assertEqual(hook.handle({**stop, 'session_id': 'other-session'}, directory), {})
            # A failed update or a resumed active goal must clear completion.
            for response in ({'error': 'failed'}, {'goal': {'threadId': 'other-session', 'status': 'complete'}},
                             {'goal': {'threadId': base['session_id'], 'status': 'active'}}, None, 'invalid'):
                hook.handle({**event, 'tool_response': response}, directory)
                self.assertEqual(hook.handle(stop, directory), {})

    def test_string_results_work_and_no_private_response_fields_are_saved(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            event = {'session_id': 's', 'turn_id': 't', 'hook_event_name': 'PostToolUse', 'tool_name': 'get_goal',
                     'tool_response': json.dumps({'goal': {'threadId': 's', 'status': 'complete', 'objective': 'private'}})}
            hook.handle(event, directory)
            self.assertNotIn('private', (directory / 's.json').read_text())
            self.assertFalse(hook.handle({**event, 'hook_event_name': 'Stop'}, directory)['continue'])
            self.assertEqual(hook.handle({**event, 'session_id': '../bad'}, directory), {})
            self.assertEqual(hook.handle({**event, 'session_id': 'other', 'tool_name': 'Bash'}, directory), {})
            self.assertFalse((directory / 'other.json').exists())


if __name__ == '__main__':
    unittest.main()
