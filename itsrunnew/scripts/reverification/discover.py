"""Find candidate official sources and count every billed search action."""

import argparse
import datetime as dt
import json
import os
import pathlib
import urllib.error
import urllib.parse
import urllib.request

from trial import AUDIT, MODEL, TRACKS, cost_upper, make_urls

SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {
        'facilityId': {'type': 'string'},
        'candidateUrl': {'type': 'string'},
        'reason': {'type': 'string'},
    },
    'required': ['facilityId', 'candidateUrl', 'reason'],
}


def discover(track, audit, api_key):
    known = make_urls(track, audit)
    payload = {
        'model': MODEL,
        'reasoning': {'effort': 'xhigh'},
        'tools': [{'type': 'web_search'}],
        'tool_choice': 'required',
        'max_tool_calls': 1,
        'instructions': '検索は情報源の発見だけに使う。自治体・施設・指定管理者の現在の公式ページを探す。検索結果の要約から公開値を確定しない。既知URLと異なる公式候補がなければcandidateUrlを空文字とする。',
        'input': [{'role': 'user', 'content': [{'type': 'input_text', 'text': f"施設ID: {track['id']}\n施設名: {track['name']['ja']}\n住所: {track['location']['address']}\n既知の公式URL: {json.dumps(known, ensure_ascii=False)}\n現在の施設案内・個人利用条件が載る新しい公式URLを1件探す。"}]}],
        'text': {'format': {'type': 'json_schema', 'name': 'official_source_candidate', 'strict': True, 'schema': SCHEMA}},
        'max_output_tokens': 5000,
        'store': False,
    }
    request = urllib.request.Request('https://api.openai.com/v1/responses', data=json.dumps(payload, ensure_ascii=False).encode(), headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
        output = ''.join(part.get('text', '') for item in result.get('output', []) for part in item.get('content', []) if part.get('type') == 'output_text')
        parsed = json.loads(output)
        calls = sum(item.get('type') == 'web_search_call' and item.get('action', {}).get('type') == 'search' for item in result.get('output', []))
        url = parsed.get('candidateUrl', '')
        valid = parsed.get('facilityId') == track['id'] and (not url or urllib.parse.urlparse(url).scheme == 'https')
        return {'status': 'ok' if valid and result.get('status') == 'completed' else 'invalid', 'candidateUrl': url if valid else '', 'reason': parsed.get('reason', '') if valid else '', 'searchCalls': calls, 'usage': result.get('usage', {}), 'costUpperUsd': round(cost_upper(result.get('usage', {})) + calls * 0.01, 6)}
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return {'status': 'error', 'candidateUrl': '', 'reason': '', 'searchCalls': 0, 'usage': {}, 'costUpperUsd': 0.0}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=133)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise SystemExit('OPENAI_API_KEY required')
    tracks = json.loads(TRACKS.read_text())[:args.limit]
    audit = {row['trackId']: row for row in json.loads(AUDIT.read_text())['records']}
    report = {'runAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'facilities': {}}
    if args.output.exists():
        report = json.loads(args.output.read_text())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for index, track in enumerate(tracks, 1):
        if track['id'] in report['facilities']:
            continue
        report['facilities'][track['id']] = discover(track, audit[track['id']], api_key)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        if index % 10 == 0 or index == len(tracks):
            spent = sum(row['costUpperUsd'] for row in report['facilities'].values())
            print(f'{index}/{len(tracks)} discoveries; upper cost ${spent:.4f}', flush=True)


if __name__ == '__main__':
    main()
