import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import monitor


class ReverificationTest(unittest.TestCase):
    def test_expiry_after_short_and_cross_month_ranges(self):
        self.assertIn('2026-10-01', monitor.due_dates({'individualUse': {'note': '2026年9月7日〜30日は利用休止'}}))
        self.assertIn('2026-12-01', monitor.due_dates({'individualUse': {'note': '2026年7月1日〜11月30日まで休止'}}))
        self.assertIn('2027-04-01', monitor.due_dates({'individualUse': {'note': '2026年8月から年度末まで改修'}}))

    def test_exact_quote_rejects_paraphrase(self):
        sources = [{'url': 'https://official.example/a', 'text': '団体の予約がない場合に限り個人利用できます。'}]
        self.assertTrue(monitor.exact_quote('予約がない場合に限り個人利用', sources))
        self.assertFalse(monitor.exact_quote('毎日、誰でも個人利用できます', sources))
        self.assertFalse(monitor.exact_quote('予約がない場合に限り個人利用', sources, 'https://official.example/b'))

    def test_typed_patch_preserves_other_facilities(self):
        original = monitor.TRACKS.read_text()
        rows = json.loads(original)
        first = rows[0]
        updated = monitor.replace_field(original, first['id'], 'individualUse.feeYen', first['individualUse']['feeYen'], 123)
        changed = json.loads(updated)
        self.assertEqual(changed[0]['individualUse']['feeYen'], 123)
        self.assertEqual(changed[1:], rows[1:])
        self.assertLess(len(updated) - len(original), 3)

    def test_baseline_does_not_publish_without_a_previous_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / 'output'
            state = pathlib.Path(directory) / 'missing.json'
            args = type('Args', (), {'date': '2026-09-26', 'state': state, 'output': output, 'api_key': 'test'})()
            def fetched(url):
                return {'url': url, 'finalUrl': url, 'mime': 'text/html', 'status': 'ok', 'text': '公式施設案内。個人利用について記載しています。' * 5, 'links': []}
            def discovery(*_):
                return {'status': 'ok', 'candidateUrl': '', 'reason': '', 'searchCalls': 1, 'usage': {}, 'costUpperUsd': 0.01}
            with patch.object(monitor, 'fetch_one', side_effect=fetched), patch.object(monitor, 'discover', side_effect=discovery), patch.object(monitor, 'ask_model', side_effect=AssertionError('baseline must not call AI')):
                monitor.run(args)
            report = json.loads((output / 'report.json').read_text())
            saved = json.loads((output / 'state.json').read_text())
            self.assertEqual(report['facilityCount'], 133)
            self.assertEqual(report['apiCalls'], 20)
            self.assertEqual(report['changed'], [])
            self.assertEqual(len(saved['discoveryChecked']), 20)
            self.assertTrue(saved['sources'])

    def test_changed_source_needs_exact_quote_and_second_review(self):
        track = json.loads(monitor.TRACKS.read_text())[0]
        audit = next(row for row in json.loads(monitor.AUDIT.read_text())['records'] if row['trackId'] == track['id'])
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            data = root / 'tracks.json'
            data.write_text(json.dumps([track], ensure_ascii=False, indent=2))
            audit_path = root / 'audit.json'
            audit_path.write_text(json.dumps({'records': [audit]}, ensure_ascii=False))
            state = root / 'state.json'
            urls = monitor.make_urls(track, audit)
            state.write_text(json.dumps({'schemaVersion': 1, 'observedAt': '2026-09-25', 'sources': {url: {'textHash': 'old'} for url in urls}, 'discoveryChecked': {track['id']: '2026-09-26'}, 'annualCostUpper': {'2026': 0}}))
            args = type('Args', (), {'date': '2026-09-26', 'state': state, 'output': root / 'out', 'api_key': 'test'})()
            source_text = '練馬総合運動場公園 陸上競技場。個人料金は123円です。' * 5
            def fetched(url):
                return {'url': url, 'finalUrl': url, 'mime': 'text/html', 'status': 'ok', 'text': source_text, 'links': []}
            model_result = {'status': 'ok', 'usage': {'input_tokens': 100, 'output_tokens': 100}, 'checks': [{'field': 'individualUse.feeYen', 'verdict': 'conflict', 'sourceUrl': urls[0], 'quote': '個人料金は123円', 'suggestedValue': '123'}]}
            with patch.object(monitor, 'TRACKS', data), patch.object(monitor, 'AUDIT', audit_path), patch.object(monitor, 'fetch_one', side_effect=fetched), patch.object(monitor, 'ask_model', return_value=model_result), patch.object(monitor, 'second_review', return_value=(True, {'input_tokens': 100, 'output_tokens': 100}, {'quote': '個人料金は123円'})):
                monitor.run(args)
            changed = json.loads(data.read_text())
            report = json.loads((args.output / 'report.json').read_text())
            self.assertEqual(changed[0]['individualUse']['feeYen'], 123)
            self.assertEqual(report['changed'][0]['fields'][0]['field'], 'individualUse.feeYen')
            self.assertEqual(report['apiCalls'], 2)

    def test_still_unreadable_source_does_not_repeat_ai_review(self):
        track = json.loads(monitor.TRACKS.read_text())[0]
        audit = next(row for row in json.loads(monitor.AUDIT.read_text())['records'] if row['trackId'] == track['id'])
        urls = monitor.make_urls(track, audit)
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            data = root / 'tracks.json'
            data.write_text(json.dumps([track], ensure_ascii=False))
            audit_path = root / 'audit.json'
            audit_path.write_text(json.dumps({'records': [audit]}, ensure_ascii=False))
            state = root / 'state.json'
            state.write_text(json.dumps({
                'schemaVersion': 1, 'observedAt': '2026-09-19',
                'sources': {url: {'textHash': monitor.semantic_hash('同じ公式本文' * 10), 'finalUrl': url} for url in urls},
                'failedSince': {urls[0]: '2026-09-19'},
                'discoveryChecked': {track['id']: '2026-09-26'},
                'annualCostUpper': {'2026': 0},
            }))
            args = type('Args', (), {'date': '2026-09-26', 'state': state, 'output': root / 'out', 'api_key': 'test'})()
            def fetched(url):
                return {'url': url, 'finalUrl': url, 'mime': 'text/html', 'status': 'ok', 'text': '同じ公式本文' * 10, 'links': []} if url != urls[0] else {'url': url, 'status': 'error', 'error': 'HTTPError'}
            with patch.object(monitor, 'TRACKS', data), patch.object(monitor, 'AUDIT', audit_path), patch.object(monitor, 'fetch_one', side_effect=fetched), patch.object(monitor, 'ask_model', side_effect=AssertionError('unchanged sources must not call AI')):
                monitor.run(args)
            self.assertEqual(json.loads((args.output / 'report.json').read_text())['apiCalls'], 0)

    def test_persistent_total_source_loss_downgrades_to_unknown(self):
        track = json.loads(monitor.TRACKS.read_text())[0]
        audit = next(row for row in json.loads(monitor.AUDIT.read_text())['records'] if row['trackId'] == track['id'])
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            data = root / 'tracks.json'
            data.write_text(json.dumps([track], ensure_ascii=False, indent=2))
            audit_path = root / 'audit.json'
            audit_path.write_text(json.dumps({'records': [audit]}, ensure_ascii=False))
            urls = monitor.make_urls(track, audit)
            state = root / 'state.json'
            state.write_text(json.dumps({'schemaVersion': 1, 'observedAt': '2026-09-19', 'sources': {url: {'textHash': 'old'} for url in urls}, 'failedSince': {url: '2026-08-20' for url in urls}, 'discoveryChecked': {track['id']: '2026-09-26'}, 'brokenDiscoveryChecked': {track['id']: '2026-09-26'}, 'annualCostUpper': {'2026': 0}}))
            args = type('Args', (), {'date': '2026-09-26', 'state': state, 'output': root / 'out', 'api_key': 'test'})()
            def failed(url):
                return {'url': url, 'status': 'error', 'error': 'HTTPError'}
            with patch.object(monitor, 'TRACKS', data), patch.object(monitor, 'AUDIT', audit_path), patch.object(monitor, 'fetch_one', side_effect=failed), patch.object(monitor, 'ask_model', side_effect=AssertionError('no AI without a source')):
                monitor.run(args)
            changed = json.loads(data.read_text())
            report = json.loads((args.output / 'report.json').read_text())
            self.assertEqual(changed[0]['individualUse']['status'], 'unknown')
            self.assertEqual(report['changed'][0]['fields'][0]['reason'], 'all-official-sources-unreadable-for-28-days')


if __name__ == '__main__':
    unittest.main()
