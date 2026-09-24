"""Persistence and HTTP boundaries, with isolated copies of the human sheet."""
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

from annotator import ROOT, FIELDS, Store, handler_for


class AnnotatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'annotation.md'
        self.original = (ROOT / 'annotation.md').read_text()
        self.path.write_text(self.original)
        self.store = Store(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def body(self, row_id='okazaki-01'):
        row = next(r for r in self.store.get() if r['id'] == row_id)
        return {k: row[k] for k in ('id', 'revision') + FIELDS}

    def test_saved_row_round_trip_preserves_other_human_rows_and_backups(self):
        body = self.body()
        body.update(status='判断不能', time='不明', evidence='凡例 | 注記\n次の行 & <br> &#124; <script>')
        saved = self.store.save(body)
        self.assertEqual(saved['evidence'], body['evidence'])
        original_lines = self.original.splitlines()
        updated_lines = self.path.read_text().splitlines()
        self.assertEqual(len(original_lines), len(updated_lines))
        for old, new in zip(original_lines, updated_lines):
            if not old.startswith('| okazaki-01 |'):
                self.assertEqual(old, new)
        backups = list((self.path.parent / 'local-state/backups').glob('*.md'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_text(), self.original)

    def test_stale_same_row_conflicts_but_other_row_does_not(self):
        first, other = self.body(), self.body('okazaki-02')
        first['evidence'] = '最初の保存'
        self.store.save(first)
        with self.assertRaises(FileExistsError):
            self.store.save(first)
        self.store.save(other)
        self.assertEqual(next(r for r in self.store.get() if r['id'] == first['id'])['evidence'], '最初の保存')

    def test_invalid_update_does_not_change_file(self):
        body = self.body()
        body['status'] = 'probably'
        with self.assertRaises(ValueError):
            self.store.save(body)
        self.assertEqual(self.path.read_text(), self.original)

    def test_http_does_not_serve_results_or_allow_cross_origin_writes(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
        try:
            for path in ('/results/fuchu-1-records.json', '/sources/../results/api-probe.json', '/annotation.md', '/annotator.py'):
                connection.request('GET', path)
                response = connection.getresponse()
                self.assertEqual(response.status, 404)
                response.read()
            connection.request('GET', '/sources/okazaki-restrictions.pdf')
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertIn('text/html', response.getheader('Content-Type'))
            self.assertIn("frame-ancestors 'self'", response.getheader('Content-Security-Policy'))
            self.assertIn(b'okazaki-restrictions.png', response.read())
            connection.request('GET', '/sources/okazaki-restrictions.pdf?download=1')
            response = connection.getresponse()
            self.assertEqual(response.getheader('Content-Disposition'), 'attachment')
            self.assertEqual(response.read(), (ROOT / 'sources/okazaki-restrictions.pdf').read_bytes())
            connection.request('GET', '/api/annotations', headers={'Host': 'untrusted.example'})
            response = connection.getresponse()
            self.assertEqual(response.status, 403)
            response.read()
            body = self.body()
            for origin in ('https://example.com', 'null'):
                connection.request('POST', '/api/annotations', json.dumps(body), {'Content-Type': 'application/json', 'Origin': origin})
                response = connection.getresponse()
                self.assertEqual(response.status, 403)
                response.read()
            body.update(status='判断不能', evidence='保存確認')
            connection.request('POST', '/api/annotations', json.dumps(body), {'Content-Type': 'application/json', 'Origin': f'http://127.0.0.1:{server.server_port}'})
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(json.loads(response.read())['evidence'], '保存確認')
        finally:
            connection.close()
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
