#!/usr/bin/env python3
"""Reproduce diagnostic comparisons; raw model outputs are never rewritten."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'results/round3'
def read(name):
    return json.loads((OUT / name).read_text())
def records(name):
    v = read(name)
    return v['records'] if isinstance(v, dict) else v
def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
def core(record):
    if record is None:
        return None
    # Adjacent periods with the same entry deadline describe the same interval.
    periods = sorted((p['start'], p['end'], p.get('last_entry')) for p in record['periods'])
    merged = []
    for start, end, entry in periods:
        if merged and merged[-1][1] >= start and merged[-1][2] == entry:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end, entry])
    return [record['status'], merged]
def main():
    packets = read('packets.json')
    astra = records('astra-records.json')
    reference = copy.deepcopy(astra)
    changes = []
    for r in reference:
        if r['id'] == 'chita-2026-10-10':
            before = copy.deepcopy(r)
            r.update(status='available', periods=[{'start':'09:00','end':'17:00','scope':'陸上トラックの個人利用','last_entry':None}], evidence=[{'source':'chita-2-1.png','location':'10日行と下部開放時間注記','quote_or_symbol':'9–17時の4列は○、17–19時は×××'}])
            changes.append({'id':r['id'],'before':before,'after':copy.deepcopy(r),'reason':'原PDF全ページ画像の行を主担当が再確認。Astraの行読み違い。Lunaはこの日の時間帯を正しく読んでいる。'})
        if r['id'] == 'chita-2026-10-15':
            before = copy.deepcopy(r)
            r.update(status='unavailable', periods=[], evidence=[{'source':'chita-2-1.png','location':'15日行','quote_or_symbol':'全5列×××'}])
            changes.append({'id':r['id'],'before':before,'after':copy.deepcopy(r),'reason':'原PDF全ページ画像の行を主担当が再確認。Astraの行読み違い。Lunaはこの日を正しく不可とした。'})
    save('primary-adjudications.json', changes)
    save('primary-reviewed-reference.json', {'records':reference,'note':'Astraを起点に主担当が資料確認。人手goldや独立した追加モデル試行ではない。条件全文の自動一致採点はしない。'})
    ref = {r['id']:r for r in reference}
    summaries, diffs, totalcost = [], [], 0
    for packet in packets:
        key = packet['key']; case_dates = [c['date'] for c in packet['cases']]
        expected = {(c['id'],c['date']) for c in packet['cases']}
        trials = []; run_summaries = []
        for n in range(1,4):
            rr = records(f'luna-{key}-{n}-records.json')
            bydate = {r['date']:r for r in rr}; trials.append(bydate)
            identity = len(rr)==len(expected) and {(r['id'],r['date']) for r in rr}==expected
            wrong = []
            statusmatches = 0
            for c in packet['cases']:
                r = bydate.get(c['date']); q = ref[c['id']]
                statusmatches += r is not None and r['status']==q['status']
                if core(r)!=core(q):
                    wrong.append(c['date']); diffs.append({'facility':key,'run':n,'date':c['date'],'luna':core(r),'reference':core(q)})
            response = read(f'luna-{key}-{n}.json')['response']; u=response['usage']; d=u.get('input_tokens_details',{}); cached=d.get('cached_tokens',0); written=d.get('cache_write_tokens',0)
            cost=((u['input_tokens']-cached-written)*.2+cached*.02+written*.25+u['output_tokens']*1.2)/1e6;totalcost+=cost
            run_summaries.append({'run':n,'returned':len(rr),'identity_valid':identity,'status_matches':statusmatches,'core_matches':len(case_dates)-len(wrong),'core_mismatch_dates':wrong,'usd':cost,'model':response.get('model'),'reasoning':response.get('reasoning')})
        stable=sum(core(trials[0].get(d)) is not None and core(trials[0].get(d))==core(trials[1].get(d))==core(trials[2].get(d)) for d in case_dates)
        qualifies=all(r['identity_valid'] and r['core_matches']==len(case_dates) for r in run_summaries)
        summaries.append({'key':key,'cases':len(case_dates),'stable_core_days':stable,'passes_core_and_identity_gate':qualifies,'runs':run_summaries})
    result={'facilities':summaries,'total_usd':totalcost,'primary_adjudications':len(changes),'note':'Core includes status, merged hours and last_entry. IDs checked separately; by-date comparison is diagnostic only. Conditions/evidence require source review.'}
    save('comparison.json',result);save('core-differences.json',diffs)
    lines=['# Round 3比較','', '同じ固定資料でLuna noneを3回独立実行。188件・5施設（4資料系統）。Astraの2件を原資料確認で訂正した別referenceと比較。ID不一致は日付で診断比較するが、合格にはしない。','', '|施設|件数|core一致 run1/2/3|3回安定|ID整合 run1/2/3|core gate|','|---|---:|---|---:|---|---|']
    for s in summaries:
        lines.append(f"|{s['key']}|{s['cases']}|"+'/'.join(str(r['core_matches']) for r in s['runs'])+f"|{s['stable_core_days']}|"+'/'.join('OK' if r['identity_valid'] else 'NG' for r in s['runs'])+f"|{'pass' if s['passes_core_and_identity_gate'] else 'hold'}|")
    lines += ['',f'Luna API推計実費: ${totalcost:.8f}（15 requests、応答usageと取得時料金から算出）。AstraはCodexサブエージェントで実行、API課金なし。','', 'coreはstatus・隣接区間を結合した開始/終了・最終入場。条件や根拠の言い回しは採点対象外。これはモデル比較であり、全件の人手正解に対する精度ではない。詳細はローカル results/round3/comparison.json、core-differences.json、primary-adjudications.json。']
    (ROOT/'round3-comparison.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
