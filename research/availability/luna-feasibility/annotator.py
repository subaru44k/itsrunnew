#!/usr/bin/env python3
"""Loopback-only annotation editor. No AI, credentials, or external requests."""
import argparse
import hashlib
import html
import json
import mimetypes
import os
from pathlib import Path
import re
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
FIELDS = ('status', 'time', 'conditions', 'evidence', 'notes')
STATUSES = ('', '利用可', '一部利用可', '利用不可', '判断不能')
FACILITIES = [
    {'id': 'okazaki', 'name': '岡崎龍北・陸上競技場', 'sources': [
        {'file': 'okazaki-week.jpg', 'label': '週間予定', 'type': 'image'},
        {'file': 'okazaki-restrictions.png', 'label': '利用制限のお知らせ', 'type': 'image'},
        {'file': 'okazaki-personal.txt', 'label': '個人利用の案内', 'type': 'text'},
        {'file': 'okazaki-restrictions.txt', 'label': '利用制限の案内', 'type': 'text'},
        {'file': 'okazaki-restrictions.pdf', 'label': '利用制限PDF', 'type': 'pdf'},
    ]},
    {'id': 'hirakata', 'name': '枚方・陸上競技場', 'sources': [
        {'file': 'hirakata.txt', 'label': '施設の利用案内', 'type': 'text'},
    ]},
    {'id': 'fuchu', 'name': '府中市民陸上競技場', 'sources': [
        {'file': 'fuchu-calendar.png', 'label': '年間カレンダー', 'type': 'image'},
        {'file': 'fuchu.txt', 'label': '施設の利用案内', 'type': 'text'},
        {'file': 'fuchu-calendar.pdf', 'label': 'カレンダーPDF', 'type': 'pdf'},
    ]},
]


def decode_cell(value):
    return value.strip().replace('<br>', '\n').replace('&#124;', '|').replace('&lt;', '<').replace('&amp;', '&')


def encode_cell(value):
    return value.replace('&', '&amp;').replace('<', '&lt;').replace('|', '&#124;').replace('\r\n', '\n').replace('\r', '\n').replace('\n', '<br>')


def parse_rows(text):
    rows = []
    for index, line in enumerate(text.splitlines(keepends=True)):
        if not re.match(r'^\| (?:fuchu|okazaki|hirakata)-\d+ \|', line):
            continue
        cells = [decode_cell(c) for c in line.strip().split('|')[1:-1]]
        if len(cells) != 7:
            raise ValueError('判定表の列数が一致しません。Markdownを確認してください。')
        row = dict(zip(('id', 'date') + FIELDS, cells))
        row['facility'] = row['id'].split('-')[0]
        row['revision'] = hashlib.sha256(line.encode()).hexdigest()
        if row['status'] not in STATUSES:
            raise ValueError('判定表に未対応の判定値があります。')
        rows.append((index, row))
    if len(rows) != 30 or len({r['id'] for _, r in rows}) != 30:
        raise ValueError('30件の判定表を読み込めませんでした。')
    return rows


class Store:
    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()

    def get(self):
        with self.lock:
            return [row for _, row in parse_rows(self.path.read_text())]

    def save(self, body):
        if not isinstance(body, dict) or set(body) != set(('id', 'revision') + FIELDS):
            raise ValueError('保存データの項目が一致しません。')
        if any(not isinstance(body[k], str) or len(body[k]) > 20000 or '\x00' in body[k] for k in body):
            raise ValueError('入力値が長すぎるか、不正な形式です。')
        if body['status'] not in STATUSES:
            raise ValueError('判定を選び直してください。')
        with self.lock:
            original = self.path.read_text()
            match = next(((i, r) for i, r in parse_rows(original) if r['id'] == body['id']), None)
            if match is None:
                raise ValueError('対象日が見つかりません。')
            index, row = match
            if row['revision'] != body['revision']:
                raise FileExistsError('別の画面またはファイルでこの日が更新されています。入力を控えてから画面を再読み込みしてください。')
            cells = [row['id'], row['date']] + [body[k] for k in FIELDS]
            lines = original.splitlines(keepends=True)
            lines[index] = '| ' + ' | '.join(encode_cell(c) for c in cells) + ' |\n'
            updated = ''.join(lines)
            new_rows = parse_rows(updated)
            backups = self.path.parent / 'local-state' / 'backups'
            backups.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256(original.encode()).hexdigest()
            backup = backups / (digest + '.md')
            if not backup.exists():
                backup.write_text(original)
            # Preserve all other rows and prose, and atomically replace the sheet.
            fd, temporary = tempfile.mkstemp(prefix='.annotation-', dir=self.path.parent)
            try:
                with os.fdopen(fd, 'w') as handle:
                    handle.write(updated)
                    handle.flush()
                    os.fsync(handle.fileno())
                if self.path.read_text() != original:
                    raise FileExistsError('保存中にファイルが変更されました。入力を控えて再読み込みしてください。')
                os.replace(temporary, self.path)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
            return next(r for _, r in new_rows if r['id'] == row['id'])


def handler_for(store):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def allowed_host(self):
            port = self.server.server_port
            return self.headers.get('Host') in (f'127.0.0.1:{port}', f'localhost:{port}')

        def send(self, status, data, content_type='application/json; charset=utf-8', pdf_preview=False, download=False):
            if not isinstance(data, bytes):
                data = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            ancestors = "'self'" if pdf_preview else "'none'"
            self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self'; object-src 'none'; connect-src 'self'; frame-ancestors " + ancestors + "; base-uri 'none'; form-action 'none'")
            if download:
                self.send_header('Content-Disposition', 'attachment')
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.allowed_host():
                return self.send(403, {'error': 'Local access only'})
            path = urlsplit(self.path).path
            if path == '/api/annotations':
                try:
                    return self.send(200, {'facilities': FACILITIES, 'records': store.get()})
                except (ValueError, OSError):
                    return self.send(500, {'error': '判定表を読み込めませんでした。ファイルを確認してください。'})
            allowed = {'/': ROOT / 'annotator.html'}
            for name in ('annotator.html', 'annotator.js', 'annotator.css'):
                allowed['/' + name] = ROOT / name
            for facility in FACILITIES:
                for source in facility['sources']:
                    allowed['/sources/' + source['file']] = ROOT / 'sources' / source['file']
            file = allowed.get(path)
            if not file or not file.is_file():
                return self.send(404, {'error': '資料が見つかりません。'})
            if file.is_symlink():
                return self.send(403, {'error': 'Unsupported file'})
            if file.suffix == '.pdf' and urlsplit(self.path).query != 'download=1':
                # The in-app browser may not provide a native PDF viewer. Display
                # the already verified full-page rendering instead, retaining the original.
                image_path = html.escape(path[:-4] + '.png', quote=True)
                download_path = html.escape(path + '?download=1', quote=True)
                title = next(s['label'] for f in FACILITIES for s in f['sources'] if s['file'] == file.name)
                page = f'''<!doctype html><html lang="ja"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(title)}</title>
<style>body{{margin:0;background:#edf2ef;color:#203331;font:14px/1.6 sans-serif}}header{{padding:14px 20px;background:white;position:sticky;top:0;display:flex;gap:18px;flex-wrap:wrap}}a{{color:#176d60}}main{{padding:12px}}img{{display:block;width:100%;max-width:1600px;height:auto;margin:auto;background:white}}p{{margin:0}}</style>
<header><strong>{html.escape(title)}</strong><a href="{download_path}" download>原本PDFをダウンロード</a><a href="/" target="_top">入力画面へ戻る</a><p>PDF全1ページの画像プレビュー。拡大はブラウザのズームを使えます。</p></header>
<main><img src="{image_path}" alt="{html.escape(title)} 全1ページ"></main></html>'''
                return self.send(200, page.encode(), 'text/html; charset=utf-8', pdf_preview=True)
            kind = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
            if kind.startswith('text/') or file.suffix == '.js':
                kind += '; charset=utf-8'
            return self.send(200, file.read_bytes(), kind, download=file.suffix == '.pdf')

        def do_POST(self):
            if not self.allowed_host() or self.headers.get('Origin') != 'http://' + self.headers.get('Host', ''):
                return self.send(403, {'error': '同じ画面から保存してください。'})
            if urlsplit(self.path).path != '/api/annotations':
                return self.send(404, {'error': 'Not found'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.send(415, {'error': 'JSON required'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 400000:
                    return self.send(413, {'error': '入力が大きすぎます。'})
                body = json.loads(self.rfile.read(size))
                return self.send(200, store.save(body))
            except FileExistsError as error:
                return self.send(409, {'error': str(error)})
            except (ValueError, UnicodeError) as error:
                return self.send(400, {'error': str(error)})
            except OSError:
                return self.send(500, {'error': 'ファイルへ保存できませんでした。入力は画面に残っています。'})

    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--annotation', type=Path, default=ROOT / 'annotation.md', help='Alternate sheet for isolated tests')
    args = parser.parse_args()
    store = Store(args.annotation.resolve())
    store.get()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler_for(store))
    print(f'Annotation editor: http://127.0.0.1:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
