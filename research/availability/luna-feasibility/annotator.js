'use strict';
const $ = id => document.getElementById(id);
const fields = ['status', 'time', 'conditions', 'evidence', 'notes'];
let data, current, facility, sourceIndex = 0, busy = false, dirty = false, sourceSerial = 0;
const textCache = new Map();
const statuses = [
  ['', '未記入', 'まだ判定していない'],
  ['利用可', '利用可', '通常の開場時間を通して利用できる'],
  ['一部利用可', '一部利用可', '明示された一部の時間・レーンで利用できる'],
  ['利用不可', '利用不可', '終日の休場・利用不可が明示されている'],
  ['判断不能', '判断不能', '読んだ資料だけでは確定できない'],
];
function el(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
function message(text) { $('save-status').textContent = text; }
function error(text) { $('error-status').textContent = text || ''; $('error-status').hidden = !text; }
function values() { return Object.fromEntries(fields.map(k => [k, k === 'status' ? document.querySelector('input[name="status"]:checked')?.value || '' : $(k + '-input').value])); }
function markDirty() { dirty = fields.some(k => values()[k] !== current[k]); $('dirty-pill').hidden = !dirty; message(dirty ? '未保存の変更があります。「保存する」で記録してください。' : '保存済み'); }
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#annotation-form input, #annotation-form textarea, #annotation-form button, #facility-select, #date-list button').forEach(n => n.disabled = value);
  if (!value) $('copy-previous-button').disabled = rows().findIndex(r => r.id === current.id) === 0;
}
function rows() { return data.records.filter(r => r.facility === facility.id); }
function completion(r) { return r.status && r.evidence.trim() ? 'done' : fields.some(k => r[k].trim()) ? 'partial' : 'empty'; }
function renderProgress() {
  const rr = rows(), counts = {done: 0, partial: 0, empty: 0}; rr.forEach(r => counts[completion(r)]++);
  $('progress-total').textContent = `${counts.done} / ${rr.length}`;
  $('progress-complete').textContent = `${counts.done}件`;
  $('progress-in-progress').textContent = `${counts.partial}件`;
  $('progress-unstarted').textContent = `${counts.empty}件`;
  $('progress-bar').style.width = `${counts.done / rr.length * 100}%`;
  $('facility-summary').textContent = `${facility.name} · ${rr.length}件`;
  $('date-list').replaceChildren(...rr.map((r, i) => {
    const state = completion(r), button = el('button', undefined, `date-button ${r.id === current.id ? 'is-current' : ''}`);
    button.type = 'button'; button.setAttribute('aria-current', r.id === current.id ? 'date' : 'false');
    button.append(el('span', `${String(i + 1).padStart(2, '0')}  ${r.date.slice(5).replace('-', '/')}`), el('span', {done:'記入済み', partial:'途中', empty:'未記入'}[state], 'case-state ' + state));
    button.addEventListener('click', () => navigate(r.id)); return button;
  }));
}
function renderForm() {
  fields.forEach(k => { if (k !== 'status') $(k + '-input').value = current[k]; });
  document.querySelectorAll('input[name="status"]').forEach(n => n.checked = n.value === current.status);
  const day = new Date(current.date + 'T12:00:00+09:00');
  $('case-heading').textContent = new Intl.DateTimeFormat('ja-JP', {year:'numeric',month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(day);
  $('case-meta').textContent = `${facility.name} / ${current.id}`;
  dirty = false; $('dirty-pill').hidden = true; renderProgress(); setBusy(false); error(''); message('保存済みの記録を表示しています。入力後に保存してください。');
}
async function save() {
  if (busy) return false;
  if (!dirty) { message('保存済み'); return true; }
  const body = {id:current.id, revision:current.revision, ...values()};
  setBusy(true); error(''); message('保存しています…');
  try {
    const res = await fetch('/api/annotations', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const result = await res.json(); if (!res.ok) throw new Error(result.error || '保存できませんでした。');
    const index = data.records.findIndex(r => r.id === current.id); data.records[index] = result; current = result;
    dirty = false; $('dirty-pill').hidden = true; renderProgress(); message('保存済み · このMacの判定表へ記録しました。'); return true;
  } catch(e) { error(e.message + ' 入力はこの画面に残っています。'); message('未保存です。'); return false; }
  finally { setBusy(false); }
}
async function navigate(id, nextFacility = facility) {
  if (busy || !(await save())) { $('facility-select').value = facility.id; return; }
  const changed = facility.id !== nextFacility.id; facility = nextFacility; current = data.records.find(r => r.id === id);
  $('facility-select').value = facility.id; renderForm();
  if (changed) { sourceIndex = 0; renderSourceTabs(); showSource(); }
}
function renderSourceTabs() {
  $('source-count').textContent = `${facility.sources.length}資料`;
  $('source-tabs').replaceChildren(...facility.sources.map((s, i) => {
    const b = el('button', s.label, 'source-tab'); b.type = 'button'; b.role = 'tab'; b.setAttribute('aria-selected', String(i === sourceIndex));
    b.addEventListener('click', () => { sourceIndex = i; renderSourceTabs(); showSource(); }); return b;
  }));
}
async function showSource() {
  const serial = ++sourceSerial, s = facility.sources[sourceIndex], url = '/sources/' + encodeURIComponent(s.file);
  const viewer = $('source-viewer'), toolbar = el('div', undefined, 'source-toolbar');
  const link = el('a', '資料を別タブで開く ↗'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; toolbar.append(link);
  viewer.replaceChildren(toolbar);
  if (s.type === 'image') {
    const label = el('label', '拡大 '), slider = el('input'); slider.type = 'range'; slider.min = '100'; slider.max = '250'; slider.step = '25'; slider.value = '100'; slider.setAttribute('aria-label','資料の拡大率');
    label.append(slider); toolbar.append(label);
    const scroll = el('div', undefined, 'image-scroll'), img = el('img'); img.src = url; img.alt = `${facility.name} ${s.label}`; img.style.width = '100%';
    slider.addEventListener('input', () => img.style.width = slider.value + '%');
    img.addEventListener('error', () => { if(serial === sourceSerial) scroll.replaceChildren(el('p', '資料画像を読み込めませんでした。保存先を確認してください。', 'source-error')); });
    scroll.append(img); viewer.append(scroll);
  } else if (s.type === 'text') {
    const pre = el('pre', '資料を読み込んでいます…', 'source-text'); viewer.append(pre);
    try { if (!textCache.has(url)) { const res = await fetch(url); if(!res.ok) throw new Error(); textCache.set(url, await res.text()); } if(serial === sourceSerial) pre.textContent = textCache.get(url); }
    catch { if(serial === sourceSerial) pre.textContent = '資料を読み込めませんでした。別タブのリンクも確認してください。'; }
  } else { const frame = el('iframe'); frame.src = url; frame.title = s.label; frame.className = 'pdf-frame'; viewer.append(frame); }
}
function setup() {
  $('status-options').replaceChildren(...statuses.map(([value, title, help], i) => {
    const label = el('label', undefined, 'status-option'), input = el('input'); input.type='radio'; input.disabled=true; input.name='status'; input.value=value; input.id='status-'+i;
    const copy = el('span'); copy.append(el('strong', title), el('small', help)); label.append(input,copy); return label;
  }));
  $('annotation-form').addEventListener('submit', e => e.preventDefault());
  $('annotation-form').addEventListener('input', markDirty);
  $('save-button').addEventListener('click', save);
  $('save-next-button').addEventListener('click', async () => { if(busy || !(await save())) return; const rr=rows(), i=rr.findIndex(r=>r.id===current.id); if(i+1<rr.length) await navigate(rr[i+1].id); else message('最後のケースを保存しました。左の施設選択から次へ進めます。'); });
  $('facility-select').addEventListener('change', async e => { const f=data.facilities.find(x=>x.id===e.target.value), rr=data.records.filter(r=>r.facility===f.id); await navigate((rr.find(r=>completion(r)!=='done')||rr[0]).id,f); });
  document.querySelectorAll('[data-time-value]').forEach(b => b.addEventListener('click', () => { $('time-input').value=b.dataset.timeValue; markDirty(); }));
  $('copy-previous-button').addEventListener('click', () => { const rr=rows(), i=rr.findIndex(r=>r.id===current.id); if(i<1) return; for(const k of fields.filter(k=>k!=='status')) if(!$(k+'-input').value.trim()) $(k+'-input').value=rr[i-1][k]; markDirty(); message('前のケースの記録を空欄へコピーしました。対象日の根拠として正しいか確認して保存してください。'); });
  window.addEventListener('beforeunload', e => { if(dirty || busy) { e.preventDefault(); e.returnValue=''; } });
  document.addEventListener('keydown', e => { if((e.ctrlKey||e.metaKey)&&e.key==='s') { e.preventDefault(); if(current) save(); } });
  $('retry-button').addEventListener('click', () => location.reload());
}
async function load() {
  setup();
  try {
    const res = await fetch('/api/annotations'); const result = await res.json(); if(!res.ok) throw new Error(result.error);
    data=result; facility=data.facilities.find(f=>f.id==='okazaki') || data.facilities[0]; current=rows().find(r=>completion(r)!=='done') || rows()[0];
    $('facility-select').replaceChildren(...data.facilities.map(f=>{const o=el('option',f.name);o.value=f.id;return o;}));
    $('facility-select').value=facility.id; renderForm(); renderSourceTabs(); showSource();
  } catch(e) { error(e.message || '読み込みに失敗しました。'); message('読み込めませんでした。'); $('retry-button').hidden=false; }
}
load();
