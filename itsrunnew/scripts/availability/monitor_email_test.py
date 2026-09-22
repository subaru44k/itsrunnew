import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock

spec = importlib.util.spec_from_file_location('monitor_email', Path(__file__).with_name('monitor-email.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EmailTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name)
        self.env = {'AVAILABILITY_SMTP_USER': 'sender@example.test', 'AVAILABILITY_ALERT_TO': 'recipient@example.test', 'AVAILABILITY_SMTP_APP_PASSWORD': 'private-test-password'}
        self.factory = MagicMock()
        self.client = self.factory.return_value.__enter__.return_value
        self.client.send_message.return_value = {}
        (self.path / 'notification.txt').write_text('○○競技場: 異常発生\n原因: parse_failed\n')

    def events(self, events):
        (self.path / 'events.json').write_text(json.dumps(events))

    def test_quiet_without_transitions_and_without_credentials(self):
        self.events([])
        self.assertFalse(module.send(self.path, {}, self.factory))
        self.factory.assert_not_called()

    def test_one_tls_digest_with_headers_and_japanese_text(self):
        self.events([{'kind': 'opened'}, {'kind': 'recovered'}])
        self.assertTrue(module.send(self.path, self.env, self.factory))
        self.assertEqual(self.factory.call_args.args, ('smtp.gmail.com', 465))
        self.assertTrue(self.factory.call_args.kwargs['context'].check_hostname)
        self.client.login.assert_called_once_with(self.env['AVAILABILITY_SMTP_USER'], self.env['AVAILABILITY_SMTP_APP_PASSWORD'])
        message = self.client.send_message.call_args.args[0]
        self.assertEqual(message['To'], 'recipient@example.test')
        self.assertIn('2件', message['Subject'])
        self.assertIn('○○競技場', message.get_content())
        self.assertNotIn('private-test-password', message.as_string())

    def test_manual_connection_test_sends_even_without_changes(self):
        self.events([])
        self.assertTrue(module.send(self.path, self.env, self.factory, test=True))
        message = self.client.send_message.call_args.args[0]
        self.assertIn('接続テスト', message['Subject'])
        self.assertIn('接続テスト', message.get_content())

    def test_missing_secret_and_header_injection_fail_before_connect(self):
        self.events([{}])
        for env in [{}, {**self.env, 'AVAILABILITY_ALERT_TO': 'a@test\nBcc: b@test'}, {**self.env, 'AVAILABILITY_SMTP_APP_PASSWORD': ''}]:
            with self.assertRaises(ValueError):
                module.send(self.path, env, self.factory)
        self.factory.assert_not_called()

    def test_delivery_rejection_propagates_so_state_is_not_acknowledged(self):
        self.events([{}])
        self.client.send_message.return_value = {'recipient@example.test': (550, b'rejected')}
        with self.assertRaises(RuntimeError):
            module.send(self.path, self.env, self.factory)


if __name__ == '__main__':
    unittest.main()
