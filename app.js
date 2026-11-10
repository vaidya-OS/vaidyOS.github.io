/* VAIDYA.OS – The digital operating system for Ayurvedic healthcare – v1.0
   Offline-first digital health record for Ayurvedic OPD.
   Data is stored only in this browser (IndexedDB). Use Settings → Backup regularly. */
'use strict';

// ---------------------------------------------------------------- constants
const CD = window.CDAAT_DATA; // CDAAT sections (from the handbook)
const SECBY = Object.fromEntries(CD.map(s => [s.code, s]));
const APPV = '1.0';
const OCC = ['Desk job', 'Field / manual work', 'Student', 'Homemaker', 'Business', 'Farmer', 'Retired', 'Other'];
const EDU = ['None', 'Primary', 'Secondary', 'Graduate', 'Postgraduate'];
const SES = ['Upper', 'Upper-middle', 'Middle', 'Lower-middle', 'Lower'];
const MEALS = [['em', 'Early morning', 'Water / ukala / home remedy'], ['bf', 'Breakfast', ''], ['lu', 'Lunch', ''], ['sn', 'Evening snacks', ''], ['di', 'Dinner', ''], ['bs', 'Before sleep', 'Milk / anything']];
const QTY = ['Less', 'Adequate', 'Excess'];
const FORMS = ['Churna', 'Vati / Gutika', 'Kwatha', 'Asava / Arishta', 'Ghrita', 'Taila', 'Avaleha', 'Bhasma', 'Other'];
const KALA = ['Abhakta (empty stomach)', 'Pragbhakta (before food)', 'Madhyabhakta (middle of meal)', 'Adhobhakta (after food)', 'Sabhakta (with food)', 'Antarabhakta (between meals)', 'Samudga (before & after food)', 'Muhurmuhu (repeatedly)', 'Sagrasa (with morsel)', 'Grasantara (between morsels)', 'Nishi (bedtime)'];
const ANUPANA = ['Warm water', 'Milk', 'Honey', 'Ghee', 'Takra', 'Plain water', 'Other'];
const PK = ['Snehapana', 'Abhyanga', 'Swedana', 'Vamana', 'Virechana', 'Niruha Basti', 'Anuvasana Basti', 'Nasya', 'Raktamokshana', 'Shirodhara', 'Kati Basti', 'Janu Basti', 'Greeva Basti', 'Pinda Sweda', 'Other'];
const PKRESP = ['Samyak yoga', 'Ayoga', 'Atiyoga', 'Complication'];
const TESTS = ['Hb', 'CBC', 'ESR', 'CRP', 'RBS', 'FBS', 'PPBS', 'HbA1c', 'Lipid profile', 'LFT', 'KFT / RFT', 'S. Uric acid', 'TSH', 'T3 / T4', 'RA factor', 'Anti-CCP', 'Vitamin D', 'Vitamin B12', 'Urine routine', 'Stool routine', 'X-ray', 'USG', 'ECG', 'MRI', 'CT'];
const SYSTEMS = [['resp', 'Respiratory'], ['cvs', 'Cardiovascular'], ['abd', 'Abdomen'], ['cns', 'Nervous system'], ['msk', 'Musculoskeletal'], ['skin', 'Skin']];
const CRAV = [['vv', 'Warm, unctuous, heavy, stable things', 'Vata vriddhi'], ['vk', 'Dry, cold, light, moving things', 'Vata kshaya'], ['pv', 'Cold, mild, sweet things; cool climate', 'Pitta vriddhi'], ['pk', 'Hot, sharp, pungent, sour things', 'Pitta kshaya'], ['kv', 'Dry, light, warm, pungent things', 'Kapha vriddhi'], ['kk', 'Oily, heavy, cold, sweet things', 'Kapha kshaya']];
const DOSHA = [['vata', 'Vata', 'वात', '#5B86AE', 'V'], ['pitta', 'Pitta', 'पित्त', '#D06A3E', 'P'], ['kapha', 'Kapha', 'कफ', '#6E9A7A', 'K']];

// ---------------------------------------------------------------- utils
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${+d} ${MON[+m - 1]} ${y}`; };
const dd = iso => iso ? +iso.split('-')[2] : '';
const mon = iso => iso ? MON[+iso.split('-')[1] - 1] : '';
const initials = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
function getP(o, path) { return path.split('.').reduce((a, k) => a == null ? undefined : a[k], o); }
function setP(o, path, v) { const ks = path.split('.'); let a = o; ks.slice(0, -1).forEach((k, i) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[k]; }); a[ks.at(-1)] = v; }
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;

// ---------------------------------------------------------------- storage (IndexedDB)
const DB = {
  db: null, patients: {}, visits: {}, meta: {},
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('cdaat-ehr', 1);
      r.onupgradeneeded = () => { const d = r.result; ['patients', 'visits', 'meta'].forEach(s => d.objectStoreNames.contains(s) || d.createObjectStore(s, { keyPath: 'id' })); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  all(store) { return new Promise(res => { const out = {}; const q = this.db.transaction(store).objectStore(store).openCursor(); q.onsuccess = () => { const c = q.result; if (c) { out[c.value.id] = c.value; c.continue(); } else res(out); }; }); },
  put(store, obj) { obj.updatedAt = new Date().toISOString(); this[store][obj.id] = obj; return new Promise(res => { const tx = this.db.transaction(store, 'readwrite'); tx.objectStore(store).put(JSON.parse(JSON.stringify(obj))); tx.oncomplete = res; }); },
  del(store, id) { delete this[store][id]; return new Promise(res => { const tx = this.db.transaction(store, 'readwrite'); tx.objectStore(store).delete(id); tx.oncomplete = res; }); },
  async load() { this.patients = await this.all('patients'); this.visits = await this.all('visits'); this.meta = await this.all('meta'); },
  setting(k, d) { return this.meta.settings?.[k] ?? d; },
  async saveSetting(k, v) { const s = this.meta.settings || { id: 'settings' }; s[k] = v; await this.put('meta', s); },
};
const visitsOf = pid => Object.values(DB.visits).filter(v => v.pid === pid).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
const lastDone = pid => visitsOf(pid).filter(v => v.status === 'complete').at(-1);

let saveTimer = null;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (S.p) await DB.put('patients', S.p);
    if (S.v) await DB.put('visits', S.v);
    const el = $('#savedAt'); if (el) el.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 350);
}

// ---------------------------------------------------------------- app state
const S = { p: null, v: null, step: 0, tab: 'A', ptab: 'overview', q: '', filt: 'all' };

// ---------------------------------------------------------------- CDAAT scoring
function cdScores(v) {
  const t = v?.cdaat?.t || {};
  const cnt = code => SECBY[code].items.filter(i => t[i.id]).length;
  const tot = code => SECBY[code].items.length;
  const r = {};
  CD.forEach(s => r[s.code] = [cnt(s.code), tot(s.code)]);
  return r;
}
function cdTags(v) {
  if (!v?.cdaat) return '';
  const c = v.cdaat.concl || {}; let h = '';
  DOSHA.forEach(([k, , , , L]) => { if (c[k] === 'vriddha') h += `<span class="tag ${L.toLowerCase()}">${L}↑</span>`; if (c[k] === 'kshina') h += `<span class="tag ${L.toLowerCase()}">${L}↓</span>`; });
  if (v.cdaat.ama === 'sama') h += '<span class="tag sama">SAMA</span>';
  if (v.cdaat.ama === 'nirama') h += '<span class="tag nir">NIRAMA</span>';
  return h;
}

// ---------------------------------------------------------------- field renderers
// ctx: 'p' = patient, 'v' = visit
const obj = ctx => ctx === 'p' ? S.p : S.v;
const val = (ctx, k) => getP(obj(ctx), k);
const F = {
  text(ctx, k, label, o = {}) { return `<div class="f"><label>${label}${o.req ? ' <span class="req">*</span>' : ''}</label><input class="in" data-c="${ctx}" data-k="${k}" value="${esc(val(ctx, k))}" placeholder="${esc(o.ph || '')}" ${o.list ? `list="${o.list}"` : ''} ${o.type ? `type="${o.type}" inputmode="${o.type === 'tel' ? 'tel' : 'text'}"` : ''} autocomplete="off">${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`; },
  area(ctx, k, label, ph = '') { return `<div class="f"><label>${label}</label><textarea class="in" data-c="${ctx}" data-k="${k}" placeholder="${esc(ph)}">${esc(val(ctx, k))}</textarea></div>`; },
  num(ctx, k, label, o = {}) { return `<div class="f"><label>${label}</label><input class="in ${o.cls || ''}" data-c="${ctx}" data-k="${k}" data-num="1" type="number" inputmode="decimal" step="any" value="${esc(val(ctx, k))}" placeholder="${esc(o.ph || '')}">${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`; },
  time(ctx, k, label) { return `<div class="f"><label>${label}</label><input class="in" data-c="${ctx}" data-k="${k}" type="time" value="${esc(val(ctx, k))}"></div>`; },
  date(ctx, k, label) { return `<div class="f"><label>${label}</label><input class="in" data-c="${ctx}" data-k="${k}" type="date" value="${esc(val(ctx, k))}"></div>`; },
  sel(ctx, k, label, opts) { const cur = val(ctx, k) || ''; return `<div class="f"><label>${label}</label><select class="sel" data-c="${ctx}" data-k="${k}"><option value="">—</option>${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`; },
  chips(ctx, k, label, opts, multi = false) {
    const cur = val(ctx, k);
    const on = o => multi ? (Array.isArray(cur) && cur.includes(o)) : cur === o;
    return `<div class="f">${label ? `<label>${label}</label>` : ''}<div class="chipset">${opts.map(o => `<button class="chip ${on(o) ? 'on' : ''}" data-chip data-c="${ctx}" data-k="${k}" data-v="${esc(o)}" ${multi ? 'data-multi="1"' : ''}>${esc(o)}</button>`).join('')}</div></div>`;
  },
  ticks(ctx, label, items) { return `<div class="f">${label ? `<label>${label}</label>` : ''}<div class="ticks">${items.map(([k, l]) => `<div class="tk ${val(ctx, k) ? 'on' : ''}" data-tick data-c="${ctx}" data-k="${k}"><span class="box"></span><span>${l}</span></div>`).join('')}</div></div>`; },
  slider(ctx, k, label, prev) { const v = val(ctx, k) ?? ''; return `<div class="f"><label>${label}</label><div class="slider"><input type="range" min="0" max="10" step="1" data-c="${ctx}" data-k="${k}" data-num="1" data-slider value="${v === '' ? 0 : v}"><b data-sv="${k}">${v === '' ? '–' : v}</b></div>${prev != null ? `<div class="hint">Last visit: <b>${prev}</b> / 10</div>` : '<div class="hint">0 = none · 10 = worst</div>'}</div>`; },
};

// ---------------------------------------------------------------- icons
const svg = d => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.8c1.9.7 3.1 2.5 3.5 5.2"/>'),
  plus: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chart: svg('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>'),
  cog: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
};

// ---------------------------------------------------------------- shell
function shell({ title, sub, back, right = '', nav = true, body, bar = '', progress = null, steps = '' }) {
  return `<header class="top"><div class="row">${back ? `<a class="back" href="${back}">‹</a>` : ''}
    ${title === '__brand' ? `<div style="flex:1"><div class="brand">VAIDYA<span>.OS</span></div><div class="tagl">The digital operating system for Ayurvedic healthcare</div></div>` : `<div style="flex:1;min-width:0"><div class="ttl">${esc(title)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`}${right}</div>
    ${progress != null ? `<div class="prog"><i style="width:${progress}%"></i></div>` : ''}</header>${steps}
  <main>${body}</main>${bar}${nav ? navbar() : ''}`;
}
function navbar() {
  const h = location.hash || '#/today';
  const on = p => h.startsWith(p) ? 'on' : '';
  return `<nav class="nav"><div class="in">
   <a href="#/today" class="${on('#/today')}"><span class="i">${IC.home}</span>Today</a>
   <a href="#/patients" class="${on('#/patients') || on('#/p/')}"><span class="i">${IC.users}</span>Patients</a>
   <a href="#/new" class="plus"><span class="i">${IC.plus}</span>New</a>
   <a href="#/insights" class="${on('#/insights')}"><span class="i">${IC.chart}</span>Insights</a>
   <a href="#/settings" class="${on('#/settings')}"><span class="i">${IC.cog}</span>Settings</a></div></nav>`;
}
function render(html, keepScroll = false) {
  const y = window.scrollY;
  $('#app').innerHTML = html;
  const top = $('.top'); if (top) document.documentElement.style.setProperty('--toph', top.offsetHeight + 'px');
  $$('.steps').forEach(s => { const on = s.querySelector('.on'); if (on) s.scrollLeft = Math.max(0, on.offsetLeft - 16); });
  window.scrollTo(0, keepScroll ? y : 0);
}

// ---------------------------------------------------------------- views: today
function patientRow(p, extra = '') {
  const lv = lastDone(p.id); const n = visitsOf(p.id).filter(v => v.status === 'complete').length;
  return `<a class="lrow" href="#/p/${p.id}"><div class="av">${esc(initials(p.name))}</div><div class="m"><b>${esc(p.name || 'Unnamed')}${p.age ? `, ${esc(p.age)}` : ''} ${esc((p.sex || '')[0] || '')}</b>
   <small>OPD ${esc(p.opd || '—')} · ${lv ? 'Last ' + fmtD(lv.date) : 'No visit yet'} · ${n} visit${n === 1 ? '' : 's'}${extra}</small></div><div class="chips">${cdTags(lv)}</div></a>`;
}
function dueList() {
  const t = today();
  return Object.values(DB.patients).filter(p => { const vs = visitsOf(p.id).filter(v => v.status === 'complete'); const l = vs.at(-1); return l && l.next && l.next <= t; })
    .sort((a, b) => lastDone(a.id).next.localeCompare(lastDone(b.id).next));
}
function vToday() {
  const t = today();
  const todays = [...new Map(Object.values(DB.visits).filter(v => v.date === t && v.status === 'complete').map(v => [v.pid, v])).values()];
  const drafts = Object.values(DB.visits).filter(v => v.status === 'draft' && DB.patients[v.pid]?.name);
  const due = dueList();
  const last = DB.setting('lastBackup');
  const old = !last || (Date.now() - new Date(last)) > 7 * 864e5;
  const pcount = Object.keys(DB.patients).length;
  const body = `
   <div class="stats"><div class="stat"><b>${todays.length}</b><span>Seen today</span></div><div class="stat"><b>${due.length}</b><span>Follow-ups due</span></div><div class="stat"><b>${pcount}</b><span>Patients</span></div></div>
   ${old && pcount ? `<a class="card" href="#/settings" style="display:block;border-color:#E9CF98;background:#FFF9EC"><div class="ci" style="font-size:14px"><b style="color:#8A6420">Backup reminder</b><br>${last ? 'Last backup ' + fmtD(last.slice(0, 10)) : 'No backup yet'}. Tap to back up your data.</div></a>` : ''}
   ${drafts.length ? `<div class="h">Drafts <small>unfinished</small></div>${drafts.map(v => `<a class="lrow" href="#/visit/${v.id}"><div class="av">${esc(initials(DB.patients[v.pid].name))}</div><div class="m"><b>${esc(DB.patients[v.pid].name)}</b><small>${v.type === 'first' ? 'First visit' : 'Follow-up'} · ${fmtD(v.date)}</small></div><span class="tag draft">DRAFT</span></a>`).join('')}` : ''}
   <div class="h">Follow-ups due</div>${due.length ? due.map(p => patientRow(p, ` · <b style="color:var(--gold-d)">due ${fmtD(lastDone(p.id).next)}</b>`)).join('') : '<div class="empty">No follow-ups due.</div>'}
   <div class="h">Seen today</div>${todays.length ? todays.map(v => patientRow(DB.patients[v.pid])).join('') : '<div class="empty">No completed visits today.</div>'}
   <div class="pad"><a class="btn gold" href="#/new" style="width:100%">＋ New patient</a></div>`;
  render(shell({ title: '__brand', body, right: `<span class="sync">Offline · on this phone</span>` }));
}

// ---------------------------------------------------------------- views: patients
function vPatients() {
  const q = S.q.toLowerCase().trim();
  const due = new Set(dueList().map(p => p.id));
  let list = Object.values(DB.patients).filter(p => p.name);
  if (q) list = list.filter(p => [p.name, p.opd, p.phone].some(x => (x || '').toLowerCase().includes(q)));
  const f = S.filt;
  if (f === 'due') list = list.filter(p => due.has(p.id));
  if (f === 'sama') list = list.filter(p => lastDone(p.id)?.cdaat?.ama === 'sama');
  if (f === 'nirama') list = list.filter(p => lastDone(p.id)?.cdaat?.ama === 'nirama');
  DOSHA.forEach(([k]) => { if (f === k) list = list.filter(p => lastDone(p.id)?.cdaat?.concl?.[k] === 'vriddha'); });
  list.sort((a, b) => (lastDone(b.id)?.date || b.createdAt || '').localeCompare(lastDone(a.id)?.date || a.createdAt || ''));
  const fl = [['all', 'All'], ['due', 'Follow-up due'], ['vata', 'Vata ↑'], ['pitta', 'Pitta ↑'], ['kapha', 'Kapha ↑'], ['sama', 'Sama'], ['nirama', 'Nirama']];
  const body = `<div class="search"><span>🔍</span><input id="q" placeholder="Search name, OPD no. or phone" value="${esc(S.q)}" autocomplete="off"></div>
   <div class="filters">${fl.map(([k, l]) => `<button class="chip ${S.filt === k ? 'on' : ''}" data-act="filt" data-v="${k}">${l}</button>`).join('')}</div>
   <div id="plist">${list.length ? list.map(p => patientRow(p)).join('') : '<div class="empty">No patients found.</div>'}</div>`;
  render(shell({ title: 'Patients', sub: `${Object.values(DB.patients).filter(p => p.name).length} patients · stored on this phone`, body }));
  const qi = $('#q'); qi.addEventListener('input', () => { S.q = qi.value; const pos = qi.selectionStart; vPatients(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
}

// ---------------------------------------------------------------- new patient / visits
function nextOPD() {
  const pre = DB.setting('opdPrefix', today().slice(0, 4) + '/');
  const nums = Object.values(DB.patients).map(p => p.opd || '').filter(o => o.startsWith(pre)).map(o => parseInt(o.slice(pre.length)) || 0);
  return pre + String((Math.max(0, ...nums) + 1)).padStart(4, '0');
}
async function newPatient() {
  const p = { id: uid(), createdAt: new Date().toISOString(), opd: nextOPD(), firstDate: today(), past: {}, allergy: {}, family: {} };
  await DB.put('patients', p);
  const v = makeVisit(p.id, 'first');
  await DB.put('visits', v);
  location.hash = `#/visit/${v.id}`;
}
function makeVisit(pid, type) {
  const v = { id: uid(), pid, type, date: today(), status: 'draft', createdAt: new Date().toISOString(), cc: [{}], ph: { meals: {} }, mens: {}, vit: {}, ex: {}, cdaat: { t: {}, crav: {}, concl: {}, amad: {} }, inv: [], dx: {}, rx: [], pk: [], pa: {} };
  if (type === 'follow') {
    const last = lastDone(pid);
    if (last) {
      v.cc = (last.cc || []).filter(c => c.text).map(c => ({ text: c.text, dur: c.dur, unit: c.unit, prev: c.sev }));
      if (!v.cc.length) v.cc = [{}];
      v.cdaat = JSON.parse(JSON.stringify(last.cdaat || v.cdaat));
      v.rx = JSON.parse(JSON.stringify(last.rx || []));
      v.dx = JSON.parse(JSON.stringify(last.dx || {}));
      v.pa = JSON.parse(JSON.stringify(last.pa || {}));
      v.prevVit = last.vit || {};
      v.prevId = last.id;
    }
  }
  return v;
}
async function newFollow(pid) { const v = makeVisit(pid, 'follow'); await DB.put('visits', v); location.hash = `#/visit/${v.id}`; }

// ---------------------------------------------------------------- stepper
function stepsFor(v) {
  const p = DB.patients[v.pid];
  if (v.type === 'first') {
    const st = [['reg', 'Register'], ['cc', 'Complaints'], ['past', 'Past history'], ['all', 'Allergy'], ['fam', 'Family'], ['ph', 'Personal'], ['mens', 'Menstrual'], ['vit', 'Vitals'], ['ex', 'Examination'], ['cdaat', 'CDAAT'], ['inv', 'Investigations'], ['tx', 'Treatment'], ['rev', 'Review']];
    return p.sex === 'Female' ? st : st.filter(s => s[0] !== 'mens');
  }
  return [['cc', 'Complaints'], ['vit', 'Vitals'], ['cdaat', 'CDAAT'], ['fu', 'Notes'], ['inv', 'Investigations'], ['tx', 'Treatment'], ['rev', 'Review']];
}
function vVisit(id, stepKey) {
  const v = DB.visits[id]; if (!v) return go('#/today');
  S.v = v; S.p = DB.patients[v.pid];
  const st = stepsFor(v);
  let i = Math.max(0, st.findIndex(s => s[0] === stepKey)); if (!stepKey) i = 0;
  S.step = i;
  const [key, name] = st[i];
  const steps = `<div class="steps">${st.map((s, j) => `<a class="stp ${j === i ? 'on' : j < i ? 'done' : ''}" href="#/visit/${v.id}/${s[0]}">${j + 1}. ${s[1]}</a>`).join('')}</div>`;
  const body = STEP[key]();
  const prev = i > 0 ? `#/visit/${v.id}/${st[i - 1][0]}` : null;
  const next = i < st.length - 1 ? `#/visit/${v.id}/${st[i + 1][0]}` : null;
  const bar = `<div class="bar"><div class="in">${prev ? `<a class="btn sec" href="${prev}" style="flex:0 0 30%">‹ Back</a>` : ''}${next ? `<a class="btn pri" href="${next}">Next · ${st[i + 1][1]} ›</a>` : `<button class="btn gold" data-act="finish">✓ Save visit</button>`}</div></div>`;
  render(shell({ title: S.p.name || 'New patient', sub: `${v.type === 'first' ? 'First visit' : 'Follow-up'} · ${fmtD(v.date)} · <span id="savedAt" class="saved">${v.status === 'draft' ? 'Draft · auto-saved' : 'Completed'}</span>`, back: v.status === 'complete' ? `#/p/${S.p.id}` : '#/today', body: `<div style="padding-bottom:84px">${body}</div>`, bar, nav: false, progress: Math.round((i + 1) / st.length * 100), steps }));
  if (key === 'vit') calcVitals();
  if (key === 'ph') calcSleep();
}

const STEP = {
  reg() {
    return `<div class="sec"><div class="st">Registration</div><div class="sth">Filled once for each patient.</div>
     ${F.text('p', 'name', 'Name', { req: 1, ph: 'Full name' })}
     <div class="grid2">${F.num('p', 'age', 'Age (years)')}${F.text('p', 'opd', 'OPD No.', { req: 1 })}</div>
     ${F.chips('p', 'sex', 'Sex', ['Male', 'Female', 'Other'])}
     ${F.text('p', 'phone', 'Phone', { type: 'tel', ph: '10-digit mobile' })}
     ${F.text('p', 'address', 'Address', { ph: 'Village / city, district' })}
     ${F.sel('p', 'occupation', 'Occupation', OCC)}${F.text('p', 'occDetail', 'Occupation details', { ph: 'Optional' })}
     <div class="grid2">${F.sel('p', 'education', 'Education', EDU)}${F.sel('p', 'ses', 'Socio-economic status', SES)}</div>
     ${F.date('p', 'firstDate', 'Date of first visit')}
     ${F.ticks('p', '', [['consent', 'Patient consents to treatment and to keeping a digital record']])}
     <div id="dupWarn"></div></div>`;
  },
  cc() {
    const fu = S.v.type === 'follow';
    return `<div class="sec"><div class="st">${fu ? 'Complaints – today' : 'Chief complaints'}</div><div class="sth">${fu ? 'Re-score each complaint. Last visit’s score is shown below each slider.' : 'Short words. Severity is the baseline for tracking improvement.'}</div>
     ${S.v.cc.map((c, i) => `<div class="rep">${S.v.cc.length > 1 ? `<button class="x" data-act="delrow" data-k="cc" data-i="${i}">✕</button>` : ''}
       ${F.text('v', `cc.${i}.text`, `Complaint ${i + 1}`, { ph: 'e.g. Pain both legs, L > R' })}
       <div class="grid2">${F.num('v', `cc.${i}.dur`, 'Duration')}${F.sel('v', `cc.${i}.unit`, 'Unit', ['Days', 'Weeks', 'Months', 'Years'])}</div>
       ${F.slider('v', `cc.${i}.sev`, 'Severity (0–10)', c.prev)}</div>`).join('')}
     <button class="add" data-act="addrow" data-k="cc">＋ Add complaint</button></div>`;
  },
  past() {
    return `<div class="sec"><div class="st">Past history</div>
     ${F.ticks('p', 'Known illnesses', [['past.dm', 'Diabetes'], ['past.htn', 'Hypertension'], ['past.thy', 'Thyroid disorder'], ['past.asthma', 'Asthma'], ['past.cardiac', 'Cardiac disease'], ['past.kidney', 'Kidney disease']])}
     ${F.text('p', 'past.other', 'Other illness')}
     ${F.area('p', 'past.surgery', 'Surgery / hospital stay', 'What and when')}
     ${F.area('p', 'past.meds', 'Current medicines (modern and Ayurvedic)', 'Name, dose')}</div>`;
  },
  all() {
    const a = S.p.allergy || {};
    return `<div class="sec"><div class="st">Allergy history</div><div class="sth">Any allergy shows a red banner on the patient profile.</div>
     ${F.ticks('p', '', [['allergy.none', 'No known allergy']])}
     ${a.none ? '' : `${F.text('p', 'allergy.drug', 'Drug allergy', { ph: 'Name of drug' })}${F.text('p', 'allergy.food', 'Food allergy')}${F.text('p', 'allergy.other', 'Other allergy')}`}</div>`;
  },
  fam() {
    return `<div class="sec"><div class="st">Family history</div>
     ${F.ticks('p', '', [['family.same', 'Same complaint in family'], ['family.dm', 'Diabetes'], ['family.htn', 'Hypertension']])}
     ${F.chips('p', 'family.rel', 'Relation', ['Father', 'Mother', 'Sibling', 'Grandparent', 'Other'], true)}
     ${F.text('p', 'family.other', 'Other / details')}</div>`;
  },
  ph() {
    return `<div class="sec"><div class="st">Ahara</div><div class="sth">Time, what is eaten, and quantity for each meal.</div>
     ${MEALS.map(([k, l, ph]) => `<div class="meal"><div class="mn">${l}</div><div>
        <div class="grid2"><input class="in" type="time" data-c="v" data-k="ph.meals.${k}.t" value="${esc(val('v', `ph.meals.${k}.t`))}"><select class="sel" data-c="v" data-k="ph.meals.${k}.q"><option value="">Quantity</option>${QTY.map(q => `<option ${val('v', `ph.meals.${k}.q`) === q ? 'selected' : ''}>${q}</option>`).join('')}</select></div>
        <input class="in" style="margin-top:8px" data-c="v" data-k="ph.meals.${k}.f" value="${esc(val('v', `ph.meals.${k}.f`))}" placeholder="${esc(ph || 'Food items')}" list="foods"></div></div>`).join('')}
     ${F.chips('v', 'ph.diet', 'Diet type', ['Vegetarian', 'Non-vegetarian', 'Eggetarian'])}
     ${F.num('v', 'ph.water', 'Water intake (litres / day)')}
     ${F.text('v', 'ph.viruddha', 'Viruddha ahara (if any)', { ph: 'e.g. milk with salty / sour food' })}
     <div class="st">Vihara</div>
     <div class="grid2">${F.time('v', 'ph.wake', 'Wake-up time')}${F.time('v', 'ph.sleep', 'Sleep time')}</div><div id="sleepCalc"></div>
     <div class="lab" style="margin-top:16px">Divaswapna (day sleep)</div>
     <div class="grid2">${F.num('v', 'ph.ds.freq', 'Days / week')}${F.sel('v', 'ph.ds.dur', 'Duration', ['< 30 min', '30–60 min', '> 1 hr'])}</div>
     ${F.chips('v', 'ph.ds.time', 'Time of day', ['After lunch', 'Afternoon', 'Evening'])}
     ${F.num('v', 'ph.rj', 'Ratrijagarana – nights / week', { hint: 'Awake past usual sleep time' })}
     <div class="lab" style="margin-top:16px">Vyayama (exercise)</div>
     ${F.chips('v', 'ph.ex.type', '', ['Walking', 'Yoga', 'Gym', 'Sport', 'Manual work', 'None'], true)}
     <div class="grid2">${F.num('v', 'ph.ex.freq', 'Days / week')}${F.num('v', 'ph.ex.dur', 'Minutes / session')}</div>
     <div class="lab" style="margin-top:16px">Screen time</div>
     ${F.num('v', 'ph.scr.hrs', 'Hours / day')}
     ${F.chips('v', 'ph.scr.dev', 'Device', ['Phone', 'Laptop / computer', 'TV', 'Tablet'], true)}
     ${F.sel('v', 'ph.scr.pat', 'Pattern', ['Continuous', 'Break every 30 min', 'Break every 60 min', 'Irregular'])}
     ${F.ticks('v', '', [['ph.scr.bed', 'Uses screen in bed before sleep']])}
     <div class="st">Agni, koshtha, elimination</div>
     ${F.chips('v', 'ph.agni', 'Agni', ['Sama', 'Vishama', 'Tikshna', 'Manda'])}
     ${F.chips('v', 'ph.koshtha', 'Koshtha', ['Mridu', 'Madhyama', 'Krura'])}
     ${F.num('v', 'ph.mala.freq', 'Mala – times / day')}
     ${F.chips('v', 'ph.mala.type', '', ['Hard', 'Loose', 'Sticky', 'Incomplete evacuation'], true)}
     <div class="grid2">${F.num('v', 'ph.mutra.day', 'Mutra – day')}${F.num('v', 'ph.mutra.night', 'Mutra – night')}</div>
     ${F.ticks('v', 'Vegadharana · Vyasana', [['ph.vega', 'Habitual suppression of natural urges'], ['ph.tob', 'Tobacco'], ['ph.alc', 'Alcohol']])}
     ${F.num('v', 'ph.tea', 'Tea / coffee – cups / day')}
     ${F.text('v', 'ph.vyOther', 'Other habit')}</div>`;
  },
  mens() {
    return `<div class="sec"><div class="st">Menstrual and obstetric history</div>
     ${F.date('v', 'mens.lmp', 'LMP')}
     <div class="grid2">${F.num('v', 'mens.cycle', 'Cycle (days)')}${F.num('v', 'mens.days', 'Bleeding (days)')}</div>
     ${F.chips('v', 'mens.flow', 'Flow', ['Scanty', 'Normal', 'Heavy'])}
     ${F.chips('v', 'mens.sym', 'Symptoms', ['Pain', 'Clots', 'Irregular'], true)}
     <div class="lab" style="margin-top:14px">Obstetric</div><div class="grid3" style="grid-template-columns:repeat(4,1fr)">${['G', 'P', 'L', 'A'].map(x => F.num('v', 'mens.' + x, x)).join('')}</div></div>`;
  },
  vit() {
    const pv = S.v.prevVit || {};
    const ph = k => pv[k] != null && pv[k] !== '' ? { ph: 'last ' + pv[k] } : {};
    return `<div class="sec"><div class="st">Vitals</div><div class="sth">Values outside the usual range are highlighted for re-check.</div>
     <div class="grid2">${F.num('v', 'vit.pulse', 'Pulse (/min)', ph('pulse'))}${F.num('v', 'vit.rr', 'Resp. rate (/min)', ph('rr'))}</div>
     <div class="grid2">${F.num('v', 'vit.sys', 'BP systolic', ph('sys'))}${F.num('v', 'vit.dia', 'BP diastolic', ph('dia'))}</div>
     <div class="grid2">${F.num('v', 'vit.temp', 'Temperature (°F)', ph('temp'))}${F.num('v', 'vit.spo2', 'SpO₂ (%)', ph('spo2'))}</div>
     <div class="grid2">${F.num('v', 'vit.ht', 'Height (cm)', ph('ht'))}${F.num('v', 'vit.wt', 'Weight (kg)', ph('wt'))}</div>
     <div id="bmi"></div>
     ${F.chips('v', 'vit.nadi', 'Nadi', ['Vata', 'Pitta', 'Kapha'], true)}</div>`;
  },
  ex() {
    const sys = SYSTEMS.filter(([k]) => val('v', 'ex.sys.' + k));
    return `<div class="sec"><div class="st">General examination</div>
     ${F.ticks('v', '', [['ex.pallor', 'Pallor'], ['ex.icterus', 'Icterus'], ['ex.oedema', 'Oedema'], ['ex.lymph', 'Lymph nodes'], ['ex.cyanosis', 'Cyanosis'], ['ex.clubbing', 'Clubbing']])}
     ${F.chips('v', 'ex.jihva', 'Jihva', ['Clean', 'Coated', 'Dry'])}
     <div class="st">Systemic examination</div><div class="sth">Tick only the systems you examine.</div>
     ${F.ticks('v', '', SYSTEMS.map(([k, l]) => ['ex.sys.' + k, l]))}
     ${sys.map(([k, l]) => F.area('v', 'ex.note.' + k, l + ' – findings')).join('')}</div>`;
  },
  cdaat() { return cdaatView(); },
  fu() {
    return `<div class="sec"><div class="st">Follow-up notes</div>
     ${F.area('v', 'fu.new', 'New complaints (if any)')}
     ${F.ticks('v', '', [['fu.adv', 'Adverse effect of medicine / procedure']])}
     ${val('v', 'fu.adv') ? F.area('v', 'fu.advText', 'Adverse effect – details') : ''}
     ${F.area('v', 'fu.notes', 'Notes', 'Progress, observations')}</div>`;
  },
  inv() {
    return `<div class="sec"><div class="st">Investigations</div><div class="sth">Repeated tests are shown as a trend on the patient profile.</div>
     ${S.v.inv.map((x, i) => `<div class="rep"><button class="x" data-act="delrow" data-k="inv" data-i="${i}">✕</button>
       ${F.text('v', `inv.${i}.test`, 'Test', { list: 'tests' })}
       <div class="grid2">${F.text('v', `inv.${i}.val`, 'Value')}${F.date('v', `inv.${i}.date`, 'Date')}</div></div>`).join('')}
     <button class="add" data-act="addrow" data-k="inv">＋ Add investigation</button>
     ${F.area('v', 'invNote', 'Advised investigations', 'Tests to be done')}</div>`;
  },
  tx() {
    const tpl = DB.setting('paTemplates', {});
    return `<div class="sec"><div class="st">Diagnosis</div>
     ${F.text('v', 'dx.ayur', 'Ayurveda diagnosis', { list: 'dxlist' })}
     ${F.text('v', 'dx.code', 'NAMASTE / ICD-11 TM2 code (optional)')}
     ${F.text('v', 'dx.modern', 'Modern diagnosis')}
     <div class="st">Prescription</div>${allergyWarn()}
     ${S.v.rx.map((r, i) => `<div class="rep"><button class="x" data-act="delrow" data-k="rx" data-i="${i}">✕</button>
       ${F.text('v', `rx.${i}.med`, `Medicine ${i + 1}`, { list: 'meds' })}
       <div class="grid2">${F.sel('v', `rx.${i}.form`, 'Form', FORMS)}${F.text('v', `rx.${i}.dose`, 'Dose', { ph: 'e.g. 3 g / 2 tab' })}</div>
       <div class="grid2">${F.sel('v', `rx.${i}.freq`, 'Times / day', ['Once', 'Twice', 'Thrice', 'Four times', 'As needed'])}${F.text('v', `rx.${i}.dur`, 'Duration', { ph: 'e.g. 15 days' })}</div>
       ${F.sel('v', `rx.${i}.kala`, 'Aushadha sevana kala', KALA)}${F.sel('v', `rx.${i}.anu`, 'Anupana', ANUPANA)}</div>`).join('')}
     <button class="add" data-act="addrow" data-k="rx">＋ Add medicine</button>
     <div class="st">Panchakarma</div>
     ${S.v.pk.map((r, i) => `<div class="rep"><button class="x" data-act="delrow" data-k="pk" data-i="${i}">✕</button>
       ${F.sel('v', `pk.${i}.proc`, 'Procedure', PK)}
       <div class="grid2">${F.date('v', `pk.${i}.date`, 'Start date')}${F.num('v', `pk.${i}.days`, 'Days')}</div>
       ${F.text('v', `pk.${i}.det`, 'Drug / dose / details')}
       ${F.chips('v', `pk.${i}.resp`, 'Response', PKRESP)}
       ${val('v', `pk.${i}.resp`) === 'Complication' ? F.text('v', `pk.${i}.comp`, 'Complication details') : ''}</div>`).join('')}
     <button class="add" data-act="addrow" data-k="pk">＋ Add procedure</button>
     <div class="st">Pathya – apathya</div>
     ${Object.keys(tpl).length ? `<div class="f"><label>Use a saved template</label><div class="chipset">${Object.keys(tpl).map(n => `<button class="chip" data-act="usetpl" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
     ${F.area('v', 'pa.pathya', 'Pathya (advised)', 'Diet and lifestyle advised – one item per line')}
     ${F.area('v', 'pa.apathya', 'Apathya (avoid)', 'One item per line')}
     <button class="add" data-act="savetpl">☆ Save these lists as a template</button>
     <div class="st">Next visit</div>
     ${F.chips('v', 'nextIn', '', ['7 days', '15 days', '1 month', '2 months'])}
     ${F.date('v', 'next', 'Next visit date')}</div>`;
  },
  rev() { return reviewView(); },
};
function allergyWarn() {
  const a = S.p.allergy || {}; const s = [a.drug, a.food, a.other].filter(Boolean).join(', ');
  return s ? `<div class="warn">⚠ Allergy recorded: <b>${esc(s)}</b></div>` : '';
}
function calcVitals() {
  const v = S.v.vit || {}; const bmiEl = $('#bmi'); if (!bmiEl) return;
  const h = num(v.ht), w = num(v.wt);
  if (h && w) { const b = w / ((h / 100) ** 2); const cat = b < 18.5 ? 'Underweight' : b < 23 ? 'Normal' : b < 25 ? 'Overweight' : 'Obese'; bmiEl.innerHTML = `<div class="calc">BMI <b>${b.toFixed(1)}</b> · ${cat} <span class="hint">(Asian cut-offs)</span></div>`; } else bmiEl.innerHTML = '';
  const lim = { pulse: [50, 110], rr: [10, 24], sys: [90, 160], dia: [50, 100], temp: [95, 100.4], spo2: [94, 100] };
  Object.entries(lim).forEach(([k, [lo, hi]]) => { const el = $(`[data-k="vit.${k}"]`); if (!el) return; const x = num(v[k]); el.classList.toggle('flag', x != null && (x < lo || x > hi)); });
}
function calcSleep() {
  const el = $('#sleepCalc'); if (!el) return; const w = S.v.ph?.wake, s = S.v.ph?.sleep;
  if (w && s) { let m = (+w.slice(0, 2) * 60 + +w.slice(3)) - (+s.slice(0, 2) * 60 + +s.slice(3)); if (m <= 0) m += 1440; el.innerHTML = `<div class="calc">Night sleep: <b>${Math.floor(m / 60)} h ${m % 60} min</b></div>`; } else el.innerHTML = '';
}

// ---------------------------------------------------------------- CDAAT view
function cdaatView() {
  const tab = S.tab; const sc = cdScores(S.v);
  const tabs = [...CD.map(s => [s.letter, s.letter, s.grp === 'nir']), ['CR', 'Cravings', false], ['SUM', 'Summary', false]];
  const done = l => { const s = CD.find(x => x.letter === l); return s && sc[s.code][0] > 0; };
  let h = `<div class="steps" style="top:calc(var(--toph) + 49px)">${tabs.map(([k, l, n]) => `<button class="stp ${n ? 'nir' : ''} ${tab === k ? 'on' : done(k) ? 'done' : ''}" data-act="cdtab" data-v="${k}">${l}${k.length === 1 ? ' · ' + (CD.find(x => x.letter === k).title.replace(/ –.*/, '')) : ''}</button>`).join('')}</div>`;
  if (tab === 'CR') {
    h += `<div class="sechead"><div><b>Cravings · Abhilasha</b><small>AH Su 11/43 · Su Su 15/29–30</small></div></div>
     <div class="rule">Ask: “What food, drink and climate do you like or crave now?”<br><span style="font-family:'Noto Sans Gujarati',var(--sans);font-style:normal;font-size:14px">“અત્યારે કેવું ખાવા-પીવાનું અને કેવું વાતાવરણ ગમે છે?”</span></div>
     ${CRAV.map(([k, l, s]) => `<div class="qrow ${S.v.cdaat.crav?.[k] ? 'on' : ''}" data-tick data-c="v" data-k="cdaat.crav.${k}"><span class="box"></span><div class="t"><div class="en">${l}</div><div class="sk">Suggests <b>${s}</b></div></div></div>`).join('')}`;
  } else if (tab === 'SUM') {
    h += cdSummary();
  } else {
    const s = CD.find(x => x.letter === tab);
    const [n, t] = sc[s.code];
    h += `<div class="${s.grp === 'nir' ? 'nirsec' : ''}"><div class="sechead"><div><b>${s.letter} · ${esc(s.title)}</b><small>${esc(s.kind)}</small></div>${s.grp === 'x' ? '' : `<div class="score" data-score="${s.code}">${n} / ${t}</div>`}</div>
     <div class="rule">${esc(s.rule)}</div>
     ${s.items.map(it => `<div class="qrow ${S.v.cdaat.t[it.id] ? 'on' : ''}" data-tick data-cd="${s.code}" data-c="v" data-k="cdaat.t.${it.id}"><span class="box"></span><div class="t">
       <div class="en"><span class="mt ${it.m === 'E' ? 'e' : ''}">${it.m === 'E' ? 'E' : 'A'}</span>${esc(it.en)}</div><div class="gu">${esc(it.gu)}</div><div class="sk"><i>${esc(it.sk)}</i> · ${esc(it.ref)}</div></div></div>`).join('')}
     <div class="pad"><button class="btn sec" style="width:100%" data-act="cdnext">Next section ›</button></div></div>`;
  }
  return h;
}
function gaugeSVG(color, pos) { // pos: -1 kshaya, 0 sama, 1 vriddhi, null unknown
  const r = 44, cx = 55, cy = 55, pt = (a, rr = r) => { a = (180 - a) * Math.PI / 180; return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (a1, a2, o) => { const [x1, y1] = pt(a1), [x2, y2] = pt(a2); return `<path d="M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}" stroke="${color}" stroke-opacity="${o}" stroke-width="10" fill="none"/>`; };
  const ang = pos == null ? 90 : 90 + pos * 60; const [nx, ny] = pt(ang, 30);
  return `<svg width="110" height="64" viewBox="0 0 110 64">${arc(1, 59, .35)}${arc(61, 119, .65)}${arc(121, 179, 1)}${pos == null ? '' : `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#0E2730" stroke-width="3" stroke-linecap="round"/>`}<circle cx="${cx}" cy="${cy}" r="5" fill="#D9A441"/></svg>`;
}
function cdSummary() {
  const v = S.v, sc = cdScores(v), c = v.cdaat.concl || {};
  const map = { vata: ['V', 'VK', 'SV', 'NV'], pitta: ['P', 'PK', 'SP', 'NP'], kapha: ['K', 'KK', 'SK', 'NK'] };
  const pos = k => c[k] === 'vriddha' ? 1 : c[k] === 'kshina' ? -1 : c[k] === 'sama' ? 0 : null;
  const cr = v.cdaat.crav || {};
  const crs = CRAV.filter(([k]) => cr[k]).map(x => x[2]);
  return `<div class="gauges">${DOSHA.map(([k, n, d, col]) => `<div class="gauge">${gaugeSVG(col, pos(k))}<b style="color:${col}">${d}</b><small>${n.toUpperCase()}</small></div>`).join('')}</div>
   <div class="pad"><table class="sc"><thead><tr><th>Dosha</th><th>Vriddhi</th><th>Kshaya</th><th>Sama</th><th>Nirama</th></tr></thead><tbody>
    ${DOSHA.map(([k, n]) => { const [a, b, s, nn] = map[k]; return `<tr><td><b>${n}</b></td><td>${sc[a][0]}/${sc[a][1]}</td><td>${sc[b][0]}/${sc[b][1]}</td><td>${sc[s][0]}/${sc[s][1]}</td><td>${sc[nn][0]}/${sc[nn][1]}</td></tr>`; }).join('')}
    <tr><td><b>General</b></td><td colspan="2"></td><td>${sc.G[0]}/${sc.G[1]}</td><td>${sc.NG[0]}/${sc.NG[1]}</td></tr></tbody></table>
    ${crs.length ? `<div class="calc">Cravings suggest: <b>${crs.join(', ')}</b></div>` : ''}
    <div class="hint" style="margin-top:10px">Scores only count signs. Select your conclusion below (Ch Su 18/52–53; AH Su 11/43–44).</div>
    ${DOSHA.map(([k, n]) => `<div class="concl">${F.chips('v', `cdaat.concl.${k}`, n + ' – state', ['vriddha', 'kshina', 'sama'])}${F.chips('v', `cdaat.amad.${k}`, n + ' – ama', ['sama', 'nirama', 'not assessed'])}</div>`).join('')}
    <div class="concl">${F.chips('v', 'cdaat.ama', 'Overall ama state', ['sama', 'nirama'])}${F.chips('v', 'cdaat.stool', 'Stool-in-water test (O1)', ['sinks', 'floats', 'not done'])}</div>
    <details style="margin-top:14px"><summary class="lab" style="cursor:pointer">Interpretation rules</summary><div class="rules">
     <p><b>Vriddhi:</b> own features increased (Ch Su 18/53); increased doshas show features by strength (AH Su 11/44).</p>
     <p><b>Kshaya:</b> loss of normal function or increase of the opposite (Ch Su 18/52); in Vata kshaya, Kapha vriddhi signs appear (AH Su 11/15).</p>
     <p><b>Samya:</b> balanced doshas do their normal work (AH Su 11/44); balance is known by health (Su Su 15/38–39).</p>
     <p><b>Cravings:</b> increased doshas → desire for opposite qualities; decreased → for similar (AH Su 11/43).</p>
     <p><b>Overlap:</b> low appetite (Kapha ↑ / Pitta ↓), poor sleep (Vata ↑, Pitta ↑, Kapha ↓), giddiness (Vata ↑, Kapha ↓) – decide by the whole cluster.</p>
     <p><b>Sama / nirama:</b> sama signs → sama; their opposite → nirama (AH Su 13/24). Stool sinking in water → ama (Ch Chi 15/94).</p>
     <p><b>Why it matters:</b> sama doshas should not be expelled forcibly (AH Su 13/28); examine sama and nirama first, then treat (Ch Chi 15/95).</p></div></details></div>`;
}

// ---------------------------------------------------------------- review & finish
function visitSummaryHTML(v, p) {
  const sc = cdScores(v); const c = v.cdaat?.concl || {};
  const cc = (v.cc || []).filter(x => x.text);
  const vit = v.vit || {};
  const bmi = vit.ht && vit.wt ? (vit.wt / ((vit.ht / 100) ** 2)).toFixed(1) : '';
  const rx = (v.rx || []).filter(r => r.med);
  const rows = [];
  if (cc.length) rows.push(['Complaints', cc.map(x => `${esc(x.text)}${x.dur ? ` – ${esc(x.dur)} ${esc((x.unit || '').toLowerCase())}` : ''}${x.sev != null && x.sev !== '' ? ` (severity ${x.sev}/10${x.prev != null && x.prev !== '' ? `, last ${x.prev}` : ''})` : ''}`).join('<br>')]);
  const vs = [vit.pulse && `Pulse ${vit.pulse}`, vit.sys && `BP ${vit.sys}/${vit.dia || '–'}`, vit.temp && `Temp ${vit.temp}°F`, vit.rr && `RR ${vit.rr}`, vit.spo2 && `SpO₂ ${vit.spo2}%`, vit.wt && `Wt ${vit.wt} kg`, bmi && `BMI ${bmi}`, vit.nadi?.length && `Nadi ${vit.nadi.join('-')}`].filter(Boolean);
  if (vs.length) rows.push(['Vitals', vs.join(' · ')]);
  const ph = v.ph || {}; const pv = [ph.agni && `Agni ${ph.agni}`, ph.koshtha && `Koshtha ${ph.koshtha}`, ph.mala?.type?.length && `Mala ${ph.mala.type.join(', ')}`].filter(Boolean);
  if (pv.length) rows.push(['Agni · Koshtha', pv.join(' · ')]);
  const dz = DOSHA.map(([k, n]) => c[k] ? `${n} ${c[k]}${v.cdaat.amad?.[k] && v.cdaat.amad[k] !== 'not assessed' ? ` (${v.cdaat.amad[k]})` : ''}` : '').filter(Boolean);
  rows.push(['CDAAT', `${dz.length ? dz.join(' · ') + '<br>' : ''}Scores – Vata ${sc.V[0]}↑/${sc.VK[0]}↓ · Pitta ${sc.P[0]}↑/${sc.PK[0]}↓ · Kapha ${sc.K[0]}↑/${sc.KK[0]}↓ · Sama ${sc.G[0]}/10 · Nirama ${sc.NG[0]}/10${v.cdaat?.ama ? `<br>Ama state: <b>${v.cdaat.ama}</b>` : ''}${v.cdaat?.stool ? ` · Stool test: ${v.cdaat.stool}` : ''}`]);
  if (v.dx?.ayur || v.dx?.modern) rows.push(['Diagnosis', [v.dx.ayur && `${esc(v.dx.ayur)}${v.dx.code ? ` [${esc(v.dx.code)}]` : ''}`, v.dx.modern && `Modern: ${esc(v.dx.modern)}`].filter(Boolean).join('<br>')]);
  const inv = (v.inv || []).filter(x => x.test);
  if (inv.length) rows.push(['Investigations', inv.map(x => `${esc(x.test)}: ${esc(x.val || '')}${x.date ? ` (${fmtD(x.date)})` : ''}`).join('<br>')]);
  if (v.fu?.adv) rows.push(['Adverse effect', esc(v.fu.advText || 'Yes')]);
  if (v.fu?.notes) rows.push(['Notes', esc(v.fu.notes)]);
  return { rows, rx, pk: (v.pk || []).filter(x => x.proc) };
}
function reviewView() {
  const v = S.v, p = S.p; const { rows, rx, pk } = visitSummaryHTML(v, p);
  const miss = []; if (!p.name) miss.push('Name'); if (!p.opd) miss.push('OPD No.');
  const dupOPD = Object.values(DB.patients).some(x => x.id !== p.id && x.opd && x.opd === p.opd);
  return `<div class="sec"><div class="st">Review</div>
   ${miss.length ? `<div class="warn">Please fill: <b>${miss.join(', ')}</b> (Registration)</div>` : ''}
   ${dupOPD ? `<div class="warn">OPD No. ${esc(p.opd)} is already used by another patient.</div>` : ''}
   <table class="sc" style="margin-top:8px"><tbody>${rows.map(([a, b]) => `<tr><td style="width:32%;color:var(--mute)">${a}</td><td>${b}</td></tr>`).join('')}
   ${rx.length ? `<tr><td style="color:var(--mute)">Prescription</td><td>${rx.map(r => `<b>${esc(r.med)}</b> ${esc(r.dose || '')} ${esc((r.freq || '').toLowerCase())} · ${esc(r.kala || '')} · ${esc(r.anu || '')} · ${esc(r.dur || '')}`).join('<br>')}</td></tr>` : ''}
   ${pk.length ? `<tr><td style="color:var(--mute)">Panchakarma</td><td>${pk.map(r => `${esc(r.proc)}${r.days ? ` × ${r.days} days` : ''}${r.resp ? ` – ${esc(r.resp)}` : ''}`).join('<br>')}</td></tr>` : ''}
   ${v.next ? `<tr><td style="color:var(--mute)">Next visit</td><td><b>${fmtD(v.next)}</b></td></tr>` : ''}</tbody></table>
   <div class="inl" style="margin-top:16px"><button class="btn sec" data-act="print" data-v="rx">🖨 Prescription</button><button class="btn sec" data-act="print" data-v="sum">🖨 Visit summary</button></div>
   <div class="inl" style="margin-top:10px"><button class="btn sec" data-act="share">↗ Share (WhatsApp)</button></div></div>`;
}
async function finish() {
  const p = S.p, v = S.v;
  if (!p.name || !p.opd) { toast('Please fill Name and OPD No.'); return go(`#/visit/${v.id}/${v.type === 'first' ? 'reg' : 'rev'}`); }
  v.status = 'complete'; v.completedAt = new Date().toISOString();
  await DB.put('patients', p); await DB.put('visits', v);
  toast('Visit saved'); go(`#/p/${p.id}`);
}

// ---------------------------------------------------------------- print & share
function letterhead() {
  const n = DB.setting('clinic', 'Ayurveda Clinic'), d = DB.setting('doctor', ''), a = DB.setting('clinicAddr', ''), ph = DB.setting('clinicPhone', '');
  return `<div class="clinic"><div style="text-align:left"><h1>${esc(n)}</h1>${d ? `<p>${esc(d)}</p>` : ''}</div><div>${esc(a)}${ph ? '<br>' + esc(ph) : ''}</div></div>`;
}
function doPrint(kind, v = S.v) {
  const p = DB.patients[v.pid]; const { rows, rx, pk } = visitSummaryHTML(v, p);
  const pinfo = `<table><tr><td><b>${esc(p.name)}</b> · ${esc(p.age || '')} ${esc((p.sex || '')[0] || '')}</td><td>OPD ${esc(p.opd)}</td><td>${fmtD(v.date)}</td></tr></table>`;
  const pa = v.pa || {}; const li = s => (s || '').split('\n').filter(x => x.trim()).map(x => `<li>${esc(x)}</li>`).join('');
  let h = `<div class="pr">${letterhead()}${pinfo}`;
  if (kind === 'sum') h += `<h2>Visit summary</h2><table>${rows.map(([a, b]) => `<tr><th style="width:26%">${a}</th><td>${b}</td></tr>`).join('')}</table>`;
  else { if (v.dx?.ayur) h += `<p style="margin-top:8px"><b>Diagnosis:</b> ${esc(v.dx.ayur)}</p>`; }
  if (rx.length) h += `<h2>Rx</h2><table><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Times</th><th>Kala</th><th>Anupana</th><th>Duration</th></tr>${rx.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.med)}</b>${r.form ? `<br><small>${esc(r.form)}</small>` : ''}</td><td>${esc(r.dose || '')}</td><td>${esc(r.freq || '')}</td><td>${esc(r.kala || '')}</td><td>${esc(r.anu || '')}</td><td>${esc(r.dur || '')}</td></tr>`).join('')}</table>`;
  if (pk.length) h += `<h2>Panchakarma</h2><table>${pk.map(r => `<tr><td>${esc(r.proc)}</td><td>${r.date ? fmtD(r.date) : ''}${r.days ? ` · ${r.days} days` : ''}</td><td>${esc(r.det || '')}</td></tr>`).join('')}</table>`;
  if (pa.pathya || pa.apathya) h += `<h2>Pathya – Apathya</h2><table><tr><th style="width:50%">Pathya (advised)</th><th>Apathya (avoid)</th></tr><tr><td><ul style="margin-left:16px">${li(pa.pathya)}</ul></td><td><ul style="margin-left:16px">${li(pa.apathya)}</ul></td></tr></table>`;
  if (v.invNote) h += `<h2>Advised investigations</h2><p>${esc(v.invNote)}</p>`;
  if (v.next) h += `<p style="margin-top:10px"><b>Next visit:</b> ${fmtD(v.next)}</p>`;
  h += `<div class="foot"><span>Generated with VAIDYA.OS</span><span>Signature ____________________</span></div></div>`;
  $('#print').innerHTML = h;
  setTimeout(() => window.print(), 100);
}
function shareText(v = S.v) {
  const p = DB.patients[v.pid]; const rx = (v.rx || []).filter(r => r.med);
  let s = `${DB.setting('clinic', 'Ayurveda Clinic')}\n${p.name} · OPD ${p.opd} · ${fmtD(v.date)}\n`;
  if (v.dx?.ayur) s += `Diagnosis: ${v.dx.ayur}\n`;
  if (rx.length) s += '\nMedicines:\n' + rx.map((r, i) => `${i + 1}. ${r.med} – ${r.dose || ''} ${r.freq || ''}, ${r.kala || ''}${r.anu ? ', with ' + r.anu : ''}${r.dur ? ', ' + r.dur : ''}`).join('\n') + '\n';
  if (v.pa?.pathya) s += '\nPathya: ' + v.pa.pathya.split('\n').filter(Boolean).join(', ') + '\n';
  if (v.pa?.apathya) s += 'Avoid: ' + v.pa.apathya.split('\n').filter(Boolean).join(', ') + '\n';
  if (v.next) s += `\nNext visit: ${fmtD(v.next)}`;
  return s;
}
async function doShare(v = S.v) {
  const text = shareText(v);
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const p = DB.patients[v.pid]; const ph = (p.phone || '').replace(/\D/g, '');
  window.open(`https://wa.me/${ph.length === 10 ? '91' + ph : ph}?text=${encodeURIComponent(text)}`, '_blank');
}

// ---------------------------------------------------------------- patient profile
function vProfile(pid, tab) {
  const p = DB.patients[pid]; if (!p) return go('#/patients');
  S.p = p; S.v = null; S.ptab = tab || S.ptab || 'overview';
  const vs = visitsOf(pid).filter(v => v.status === 'complete');
  const lv = vs.at(-1);
  const a = p.allergy || {}; const al = [a.drug, a.food, a.other].filter(Boolean).join(', ');
  const tabs = [['overview', 'Overview'], ['visits', `Visits (${vs.length})`], ['trends', 'Trends'], ['inv', 'Investigations'], ['tx', 'Treatment'], ['info', 'Details']];
  let body = `${al ? `<div class="allergy">⚠ Allergy: ${esc(al)}</div>` : ''}<div class="ptabs">${tabs.map(([k, l]) => `<a class="${S.ptab === k ? 'on' : ''}" href="#/p/${pid}/${k}">${l}</a>`).join('')}</div>`;
  body += PTAB[S.ptab](p, vs, lv);
  const bar = `<div class="bar"><div class="in">${p.phone ? `<a class="btn sec" href="tel:${esc(p.phone)}" style="flex:0 0 28%">☎ Call</a>` : ''}<button class="btn pri" data-act="follow" data-v="${pid}">＋ New visit</button></div></div>`;
  render(shell({ title: p.name, sub: `${esc(p.age || '')} ${esc(p.sex || '')} · OPD ${esc(p.opd)}${p.phone ? ' · ' + esc(p.phone) : ''}`, back: '#/patients', body: `<div style="padding-bottom:80px">${body}</div>`, bar, nav: false }));
}
const PTAB = {
  overview(p, vs, lv) {
    if (!lv) { const d = visitsOf(p.id).find(v => v.status === 'draft'); return `<div class="empty">No completed visit yet.${d ? `<br><br><a class="btn sec" href="#/visit/${d.id}">Continue draft</a>` : ''}</div>`; }
    const c = lv.cdaat?.concl || {};
    const pos = k => c[k] === 'vriddha' ? 1 : c[k] === 'kshina' ? -1 : c[k] === 'sama' ? 0 : null;
    const rx = (lv.rx || []).filter(r => r.med);
    return `<div class="h">Latest CDAAT <small>${fmtD(lv.date)}</small></div>
     <div class="gauges">${DOSHA.map(([k, n, d, col]) => `<div class="gauge">${gaugeSVG(col, pos(k))}<b style="color:${col}">${d}</b><small>${n.toUpperCase()}${c[k] ? ' · ' + c[k] : ''}</small></div>`).join('')}</div>
     <div style="text-align:center;margin:6px 0 4px">${cdTags(lv)}</div>
     <div class="card"><div class="ci"><dl class="kv">
      <dt>Diagnosis</dt><dd>${esc(lv.dx?.ayur || '—')}${lv.dx?.modern ? `<br><small style="color:var(--mute)">${esc(lv.dx.modern)}</small>` : ''}</dd>
      <dt>Complaints</dt><dd>${(lv.cc || []).filter(x => x.text).map(x => `${esc(x.text)} <b style="color:var(--teal)">${x.sev ?? '–'}/10</b>`).join('<br>') || '—'}</dd>
      <dt>Medicines</dt><dd>${rx.map(r => esc(r.med)).join(', ') || '—'}</dd>
      <dt>Next visit</dt><dd>${lv.next ? fmtD(lv.next) : '—'}</dd>
      <dt>Past history</dt><dd>${pastText(p) || '—'}</dd></dl></div></div>
     <div class="pad inl"><button class="btn sec" data-act="printv" data-v="${lv.id}" data-k="rx">🖨 Prescription</button><button class="btn sec" data-act="sharev" data-v="${lv.id}">↗ Share</button></div>`;
  },
  visits(p, vs) {
    const drafts = visitsOf(p.id).filter(v => v.status === 'draft');
    return (drafts.map(v => `<a class="vcard" href="#/visit/${v.id}"><div class="dt"><b>${dd(v.date)}</b><small>${mon(v.date)}</small></div><div class="d"><b>Draft · ${v.type === 'first' ? 'First visit' : 'Follow-up'}</b>Tap to continue</div><span class="tag draft">DRAFT</span></a>`).join('') +
      vs.slice().reverse().map((v, i) => `<a class="vcard" href="#/vd/${v.id}"><div class="dt"><b>${dd(v.date)}</b><small>${mon(v.date)} ${v.date.slice(2, 4)}</small></div><div class="d"><b>Visit ${vs.length - i} · ${v.type === 'first' ? 'First' : 'Follow-up'}</b>${(v.cc || []).filter(x => x.text).map(x => `${esc(x.text)} ${x.sev ?? '–'}/10`).join(' · ')}${v.fu?.notes ? `<br>${esc(v.fu.notes)}` : ''}</div><div class="chips">${cdTags(v)}</div></a>`).join('')) || '<div class="empty">No visits yet.</div>';
  },
  trends(p, vs) {
    if (vs.length < 2) return '<div class="empty">Trends appear after two or more completed visits.</div>';
    const lab = vs.map(v => `${dd(v.date)} ${mon(v.date)}`);
    const avg = v => { const s = (v.cc || []).map(x => num(x.sev)).filter(x => x != null); return s.length ? s.reduce((a, b) => a + b) / s.length : null; };
    const sc = vs.map(cdScores);
    let h = chart('Complaint severity (average, 0–10)', lab, [['Severity', '#B4442E', vs.map(avg)]], 10);
    h += chart('CDAAT – vriddhi scores', lab, DOSHA.map(([k, n, , col], j) => [n + ' vriddhi', col, sc.map(s => s[['V', 'P', 'K'][j]][0])]));
    h += chart('CDAAT – sama vs nirama (general)', lab, [['Sama', '#A65A32', sc.map(s => s.G[0])], ['Nirama', '#4F8A5F', sc.map(s => s.NG[0])]], 10);
    const wt = vs.map(v => num(v.vit?.wt)); if (wt.filter(x => x != null).length > 1) h += chart('Weight (kg)', lab, [['Weight', '#1F4E5F', wt]]);
    const bp = vs.map(v => num(v.vit?.sys)); if (bp.filter(x => x != null).length > 1) h += chart('BP systolic', lab, [['Systolic', '#1F4E5F', bp], ['Diastolic', '#7FA3B0', vs.map(v => num(v.vit?.dia))]]);
    const a = vs.at(-2), b = vs.at(-1), sa = cdScores(a), sb = cdScores(b);
    const rowc = (l, x, y, lowerBetter = true) => { const d = (x != null && y != null) ? y - x : null; const cls = d == null || d === 0 ? '' : ((d < 0) === lowerBetter ? 'dn' : 'up'); return `<tr><td>${l}</td><td>${x ?? '–'}</td><td>${y ?? '–'}</td><td class="${cls}">${d == null ? '' : d > 0 ? '▲ ' + d : d < 0 ? '▼ ' + (-d) : '='}</td></tr>`; };
    h += `<div class="h">Last visit vs latest</div><div class="pad"><table class="sc cmp"><thead><tr><th></th><th>${fmtD(a.date)}</th><th>${fmtD(b.date)}</th><th>Change</th></tr></thead><tbody>
      ${rowc('Avg severity', avg(a)?.toFixed(1) * 1 || avg(a), avg(b)?.toFixed(1) * 1 || avg(b))}${DOSHA.map(([k, n], j) => rowc(n + ' vriddhi', sa[['V', 'P', 'K'][j]][0], sb[['V', 'P', 'K'][j]][0])).join('')}
      ${rowc('Sama (general)', sa.G[0], sb.G[0])}${rowc('Nirama (general)', sa.NG[0], sb.NG[0], false)}${rowc('Weight', num(a.vit?.wt), num(b.vit?.wt))}</tbody></table><div class="hint">Green = better, red = worse.</div></div>`;
    return h;
  },
  inv(p, vs) {
    const all = vs.flatMap(v => (v.inv || []).filter(x => x.test).map(x => ({ ...x, vd: v.date })));
    if (!all.length) return '<div class="empty">No investigations recorded.</div>';
    const by = {}; all.forEach(x => (by[x.test] = by[x.test] || []).push(x));
    return Object.entries(by).map(([t, xs]) => { xs.sort((a, b) => (a.date || a.vd).localeCompare(b.date || b.vd)); const nums = xs.map(x => parseFloat(x.val)); return `<div class="h">${esc(t)}</div>${xs.length > 1 && nums.every(n => !isNaN(n)) ? chart('', xs.map(x => fmtD(x.date || x.vd)), [[t, '#1F4E5F', nums]]) : ''}<div class="pad" style="padding-top:0"><table class="sc"><tbody>${xs.map(x => `<tr><td>${fmtD(x.date || x.vd)}</td><td><b>${esc(x.val)}</b></td></tr>`).join('')}</tbody></table></div>`; }).join('');
  },
  tx(p, vs) {
    const items = vs.slice().reverse().filter(v => (v.rx || []).some(r => r.med) || (v.pk || []).some(r => r.proc));
    if (!items.length) return '<div class="empty">No treatment recorded.</div>';
    return items.map(v => `<div class="h">${fmtD(v.date)}</div><div class="card"><div class="ci" style="font-size:14px">${(v.rx || []).filter(r => r.med).map(r => `<b>${esc(r.med)}</b> – ${esc(r.dose || '')} ${esc(r.freq || '')} · ${esc(r.kala || '')} · ${esc(r.anu || '')} · ${esc(r.dur || '')}`).join('<br>')}${(v.pk || []).filter(r => r.proc).map(r => `<br>🜂 ${esc(r.proc)}${r.days ? ` × ${r.days} d` : ''}${r.resp ? ` – ${esc(r.resp)}` : ''}`).join('')}</div></div>`).join('');
  },
  info(p) {
    const lv = visitsOf(p.id).find(v => v.type === 'first');
    return `<div class="card"><div class="ci"><dl class="kv">
     <dt>OPD No.</dt><dd>${esc(p.opd)}</dd><dt>Age / Sex</dt><dd>${esc(p.age || '')} ${esc(p.sex || '')}</dd><dt>Phone</dt><dd>${esc(p.phone || '—')}</dd>
     <dt>Address</dt><dd>${esc(p.address || '—')}</dd><dt>Occupation</dt><dd>${esc([p.occupation, p.occDetail].filter(Boolean).join(' – ') || '—')}</dd>
     <dt>Education</dt><dd>${esc(p.education || '—')}</dd><dt>SES</dt><dd>${esc(p.ses || '—')}</dd><dt>First visit</dt><dd>${fmtD(p.firstDate)}</dd>
     <dt>Consent</dt><dd>${p.consent ? 'Yes' : 'Not recorded'}</dd><dt>Past history</dt><dd>${pastText(p) || '—'}</dd>
     <dt>Family history</dt><dd>${esc([p.family?.same && 'Same complaint', p.family?.dm && 'Diabetes', p.family?.htn && 'Hypertension', p.family?.other].filter(Boolean).join(', ') || '—')}${p.family?.rel?.length ? ' (' + p.family.rel.join(', ') + ')' : ''}</dd></dl></div></div>
     <div class="pad">${lv ? `<a class="btn sec" href="#/visit/${lv.id}/reg" style="width:100%">✎ Edit registration & history</a>` : ''}
     <button class="btn danger" style="width:100%;margin-top:10px" data-act="delpatient" data-v="${p.id}">Delete patient</button></div>`;
  },
};
function pastText(p) { const x = p.past || {}; return esc([x.dm && 'Diabetes', x.htn && 'Hypertension', x.thy && 'Thyroid', x.asthma && 'Asthma', x.cardiac && 'Cardiac', x.kidney && 'Kidney', x.other].filter(Boolean).join(', ')); }
function chart(title, labels, series, ymaxFixed) {
  const W = 330, H = 150, L = 28, R = 10, T = 12, B = 26;
  const all = series.flatMap(s => s[2]).filter(x => x != null);
  if (!all.length) return '';
  let ymax = ymaxFixed ?? Math.max(...all), ymin = ymaxFixed != null ? 0 : Math.min(...all);
  if (ymax === ymin) { ymax += 1; ymin = Math.max(0, ymin - 1); }
  const n = labels.length, xs = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)), ys = y => T + (H - T - B) * (1 - (y - ymin) / (ymax - ymin));
  const grid = [0, .5, 1].map(f => { const y = ymin + (ymax - ymin) * f; return `<line x1="${L}" x2="${W - R}" y1="${ys(y)}" y2="${ys(y)}" stroke="#E7ECED"/><text x="2" y="${ys(y) + 4}" font-size="10" fill="#8A979C">${Math.round(y * 10) / 10}</text>`; }).join('');
  const step = Math.ceil(n / 5);
  const xl = labels.map((l, i) => i % step === 0 || i === n - 1 ? `<text x="${xs(i)}" y="${H - 6}" font-size="10" fill="#8A979C" text-anchor="middle">${esc(l)}</text>` : '').join('');
  const lines = series.map(([nm, col, d]) => { const pts = d.map((y, i) => y == null ? null : `${xs(i)},${ys(y)}`).filter(Boolean); return `<polyline fill="none" stroke="${col}" stroke-width="2.5" points="${pts.join(' ')}"/>${d.map((y, i) => y == null ? '' : `<circle cx="${xs(i)}" cy="${ys(y)}" r="3.5" fill="#fff" stroke="${col}" stroke-width="2"/>`).join('')}`; }).join('');
  return `<div class="chart">${title ? `<h4>${esc(title)}</h4>` : ''}<svg viewBox="0 0 ${W} ${H}" width="100%">${grid}${xl}${lines}</svg>${series.length > 1 ? `<div class="lg">${series.map(([nm, col]) => `<span><i style="background:${col}"></i>${esc(nm)}</span>`).join('')}</div>` : ''}</div>`;
}
function vVisitDetail(id) {
  const v = DB.visits[id]; if (!v) return go('#/patients');
  S.v = v; S.p = DB.patients[v.pid];
  const { rows, rx, pk } = visitSummaryHTML(v, S.p);
  const ph = v.ph || {};
  const meals = MEALS.filter(([k]) => ph.meals?.[k]?.f || ph.meals?.[k]?.t).map(([k, l]) => `${l}: ${esc(ph.meals[k].t || '')} ${esc(ph.meals[k].f || '')} ${ph.meals[k].q ? '(' + ph.meals[k].q + ')' : ''}`);
  const body = `<div class="pad"><table class="sc"><tbody>${rows.map(([a, b]) => `<tr><td style="width:32%;color:var(--mute)">${a}</td><td>${b}</td></tr>`).join('')}
    ${meals.length ? `<tr><td style="color:var(--mute)">Ahara</td><td>${meals.join('<br>')}</td></tr>` : ''}
    ${rx.length ? `<tr><td style="color:var(--mute)">Prescription</td><td>${rx.map(r => `<b>${esc(r.med)}</b> ${esc(r.dose || '')} · ${esc(r.kala || '')} · ${esc(r.anu || '')} · ${esc(r.dur || '')}`).join('<br>')}</td></tr>` : ''}
    ${pk.length ? `<tr><td style="color:var(--mute)">Panchakarma</td><td>${pk.map(r => esc(r.proc) + (r.resp ? ' – ' + esc(r.resp) : '')).join('<br>')}</td></tr>` : ''}
    ${v.next ? `<tr><td style="color:var(--mute)">Next visit</td><td>${fmtD(v.next)}</td></tr>` : ''}</tbody></table>
    <div class="inl" style="margin-top:14px"><button class="btn sec" data-act="printv" data-v="${v.id}" data-k="rx">🖨 Prescription</button><button class="btn sec" data-act="printv" data-v="${v.id}" data-k="sum">🖨 Summary</button></div>
    <div class="inl" style="margin-top:10px"><button class="btn sec" data-act="sharev" data-v="${v.id}">↗ Share</button><a class="btn sec" href="#/visit/${v.id}">✎ Edit visit</a></div>
    <button class="btn danger" style="width:100%;margin-top:10px" data-act="delvisit" data-v="${v.id}">Delete visit</button></div>`;
  render(shell({ title: `${S.p.name} · ${fmtD(v.date)}`, sub: v.type === 'first' ? 'First visit' : 'Follow-up', back: `#/p/${S.p.id}/visits`, body, nav: false }));
}

// ---------------------------------------------------------------- insights
function vInsights() {
  const vs = Object.values(DB.visits).filter(v => v.status === 'complete');
  const ps = Object.values(DB.patients).filter(p => p.name);
  const m = today().slice(0, 7);
  const thisM = vs.filter(v => v.date.startsWith(m));
  const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const dx = {}; vs.forEach(v => { const k = (v.dx?.ayur || '').trim(); if (k) dx[k] = (dx[k] || 0) + 1; });
  const topdx = Object.entries(dx).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const imp = ps.map(p => { const x = visitsOf(p.id).filter(v => v.status === 'complete'); if (x.length < 2) return null; const avg = v => { const s = (v.cc || []).map(c => num(c.sev)).filter(c => c != null); return s.length ? s.reduce((a, b) => a + b) / s.length : null; }; const a = avg(x[0]), b = avg(x.at(-1)); return a != null && b != null ? a - b : null; }).filter(x => x != null);
  const st = {}; ps.forEach(p => { const l = lastDone(p.id); DOSHA.forEach(([k, n]) => { if (l?.cdaat?.concl?.[k] === 'vriddha') st[n] = (st[n] || 0) + 1; }); });
  const body = `<div class="stats"><div class="stat"><b>${ps.length}</b><span>Patients</span></div><div class="stat"><b>${thisM.length}</b><span>Visits this month</span></div><div class="stat"><b>${imp.length ? (imp.reduce((a, b) => a + b) / imp.length).toFixed(1) : '–'}</b><span>Avg improvement*</span></div></div>
   <div class="pad" style="padding-top:0"><div class="hint">* Average fall in complaint severity (0–10) from first to latest visit, in ${imp.length} patient${imp.length === 1 ? '' : 's'} with 2+ visits.</div></div>
   ${chart('Visits per month', months.map(x => MON[+x.slice(5) - 1]), [['Visits', '#1F4E5F', months.map(x => vs.filter(v => v.date.startsWith(x)).length)]])}
   <div class="h">Common diagnoses</div>${topdx.length ? `<div class="pad" style="padding-top:0"><table class="sc"><tbody>${topdx.map(([k, n]) => `<tr><td>${esc(k)}</td><td style="text-align:right"><b>${n}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No diagnoses recorded yet.</div>'}
   <div class="h">Vriddha dosha (latest visit)</div><div class="pad" style="padding-top:0"><table class="sc"><tbody>${DOSHA.map(([k, n]) => `<tr><td>${n} vriddhi</td><td style="text-align:right"><b>${st[n] || 0}</b></td></tr>`).join('')}</tbody></table></div>
   <div class="pad"><button class="btn sec" style="width:100%" data-act="csv">⬇ Export visits as CSV (research)</button><div class="hint">Choose with or without names and phone numbers.</div></div>`;
  render(shell({ title: 'Insights', sub: 'Clinic overview', body }));
}

// ---------------------------------------------------------------- settings, backup
function vSettings() {
  const pinOn = !!localStorage.getItem('cdaat_pin');
  const tpl = DB.setting('paTemplates', {});
  const body = `<div class="sec">
   <div class="st">Clinic (for printouts)</div>
   ${sfield('clinic', 'Clinic name', 'Ayurveda Clinic')}${sfield('doctor', 'Doctor name & qualification', 'Dr. …, BAMS')}${sfield('clinicAddr', 'Address')}${sfield('clinicPhone', 'Phone')}
   ${sfield('opdPrefix', 'OPD number prefix', today().slice(0, 4) + '/', 'Next number is added automatically, e.g. 2026/0001')}
   <div class="st">Security</div>
   <div class="calc">App lock is <b>${pinOn ? 'ON' : 'OFF'}</b>. ${pinOn ? 'The app asks for your PIN when opened and after 5 minutes away.' : 'Set a PIN to protect patient data.'}</div>
   <div class="inl" style="margin-top:10px"><button class="btn sec" data-act="setpin">${pinOn ? 'Change PIN' : 'Set PIN'}</button>${pinOn ? '<button class="btn ghost" data-act="nopin">Remove PIN</button>' : ''}</div>
   <div class="st">Backup & restore</div>
   <div class="calc">Data is stored only on this phone. ${DB.setting('lastBackup') ? 'Last backup: <b>' + fmtD(DB.setting('lastBackup').slice(0, 10)) + '</b>' : '<b>No backup yet.</b>'}<br>Keep the backup file in Google Drive or send it to yourself. Use the same file to move data to another phone or doctor.</div>
   <div class="inl" style="margin-top:10px"><button class="btn pri" data-act="backup">⬇ Back up now</button><button class="btn sec" data-act="restore">⬆ Restore / merge</button></div>
   <input type="file" id="restoreFile" accept=".json,application/json" class="hidden">
   <div class="st">Pathya–apathya templates</div>
   ${Object.keys(tpl).length ? Object.keys(tpl).map(n => `<div class="lrow" style="padding:10px 0"><div class="m"><b>${esc(n)}</b></div><button class="chip" data-act="deltpl" data-v="${esc(n)}">Delete</button></div>`).join('') : '<div class="hint">Save a template from the Treatment step of any visit.</div>'}
   <div class="st">About</div>
   <div class="rules"><p><b>VAIDYA.OS v${APPV}</b> – the digital operating system for Ayurvedic healthcare. An offline health record for Ayurvedic OPD. CDAAT items are taken from the Clinical Dosha & Ama Assessment Tool handbook (Charaka, Sushruta, Ashtanga Hridaya, Ashtanga Sangraha). Scores are a counting aid; the clinical conclusion is the doctor’s.</p>
   <p>Storage used: <span id="usage">…</span></p></div>
   <button class="btn danger" style="width:100%;margin-top:14px" data-act="wipe">Erase all data on this phone</button></div>`;
  render(shell({ title: 'Settings', body }));
  navigator.storage?.estimate?.().then(e => { const u = $('#usage'); if (u) u.textContent = (e.usage / 1048576).toFixed(1) + ' MB'; });
  $('#restoreFile').addEventListener('change', e => restore(e.target.files[0]));
}
function sfield(k, l, ph = '', hint = '') { return `<div class="f"><label>${l}</label><input class="in" data-set="${k}" value="${esc(DB.setting(k, ''))}" placeholder="${esc(ph)}">${hint ? `<div class="hint">${hint}</div>` : ''}</div>`; }

const b64 = { enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))), dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };
async function deriveKey(pw, salt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function backup() {
  const pw = await ask('Backup password', 'Protect the backup file with a password (recommended). Leave empty for no password. You will need it to restore.', 'password');
  if (pw === null) return;
  const data = JSON.stringify({ app: 'cdaat-ehr', v: APPV, at: new Date().toISOString(), patients: Object.values(DB.patients), visits: Object.values(DB.visits), settings: DB.meta.settings || {} });
  let out;
  if (pw && crypto.subtle) { const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)); const key = await deriveKey(pw, salt); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data)); out = JSON.stringify({ app: 'cdaat-ehr', enc: true, salt: b64.enc(salt), iv: b64.enc(iv), data: b64.enc(ct) }); }
  else out = data;
  const name = `VAIDYA-OS-backup-${today()}.json`;
  const file = new File([out], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name !== 'AbortError') dl(file); else return; } } else dl(file);
  await DB.saveSetting('lastBackup', new Date().toISOString()); toast('Backup created'); vSettings();
}
function dl(file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); }
async function restore(f) {
  if (!f) return; let j;
  try { j = JSON.parse(await f.text()); } catch { return toast('Not a valid backup file'); }
  if (j.enc) { const pw = await ask('Backup password', 'Enter the password used for this backup.', 'password'); if (!pw) return; try { const key = await deriveKey(pw, b64.dec(j.salt)); const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(j.iv) }, key, b64.dec(j.data)); j = JSON.parse(new TextDecoder().decode(pt)); } catch { return toast('Wrong password'); } }
  if (j.app !== 'cdaat-ehr') return toast('Not a VAIDYA.OS backup');
  let np = 0, nv = 0;
  for (const p of j.patients || []) { const cur = DB.patients[p.id]; if (!cur || (p.updatedAt || '') > (cur.updatedAt || '')) { await DB.put('patients', p); np++; } }
  for (const v of j.visits || []) { const cur = DB.visits[v.id]; if (!cur || (v.updatedAt || '') > (cur.updatedAt || '')) { await DB.put('visits', v); nv++; } }
  if (!DB.meta.settings && j.settings) await DB.put('meta', { ...j.settings, id: 'settings' });
  toast(`Restored: ${np} patients, ${nv} visits updated`); vSettings();
}
async function exportCSV() {
  const named = await confirmBox('Include names and phone numbers?', 'Choose “No” for a de-identified file for research.', 'Yes, include', 'No');
  const cols = ['patient_id', 'opd', ...(named ? ['name', 'phone'] : []), 'age', 'sex', 'visit_date', 'visit_type', 'complaints', 'avg_severity', 'agni', 'koshtha', 'pulse', 'bp', 'weight', 'bmi', ...CD.map(s => 'cdaat_' + s.code), ...DOSHA.map(d => d[0] + '_state'), 'ama_state', 'stool_test', 'dx_ayurveda', 'dx_code', 'dx_modern', 'medicines', 'panchakarma', 'ticked_items'];
  const rows = [cols];
  Object.values(DB.visits).filter(v => v.status === 'complete').sort((a, b) => a.date.localeCompare(b.date)).forEach(v => {
    const p = DB.patients[v.pid]; if (!p) return; const sc = cdScores(v); const vit = v.vit || {};
    const sev = (v.cc || []).map(x => num(x.sev)).filter(x => x != null);
    rows.push([p.id, p.opd, ...(named ? [p.name, p.phone] : []), p.age, p.sex, v.date, v.type, (v.cc || []).filter(x => x.text).map(x => x.text).join('; '), sev.length ? (sev.reduce((a, b) => a + b) / sev.length).toFixed(1) : '', v.ph?.agni, v.ph?.koshtha, vit.pulse, vit.sys ? `${vit.sys}/${vit.dia || ''}` : '', vit.wt, vit.ht && vit.wt ? (vit.wt / ((vit.ht / 100) ** 2)).toFixed(1) : '', ...CD.map(s => sc[s.code][0]), ...DOSHA.map(d => v.cdaat?.concl?.[d[0]] || ''), v.cdaat?.ama, v.cdaat?.stool, v.dx?.ayur, v.dx?.code, v.dx?.modern, (v.rx || []).filter(r => r.med).map(r => r.med).join('; '), (v.pk || []).filter(r => r.proc).map(r => r.proc).join('; '), Object.keys(v.cdaat?.t || {}).filter(k => v.cdaat.t[k]).join(' ')]);
  });
  const csv = rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const file = new File(['﻿' + csv], `VAIDYA-OS-visits-${today()}.csv`, { type: 'text/csv' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  dl(file);
}

// ---------------------------------------------------------------- dialogs & lock
function ask(title, msg, type = 'text') {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="sheet"><h3>${esc(title)}</h3><p class="hint" style="font-size:14px;margin-bottom:10px">${esc(msg)}</p><input class="in" type="${type}" id="askIn" autocomplete="off"><div class="inl" style="margin-top:14px"><button class="btn ghost" data-r="0">Cancel</button><button class="btn pri" data-r="1">OK</button></div></div>`;
    document.body.appendChild(m); setTimeout(() => $('#askIn').focus(), 50);
    m.addEventListener('click', e => { const r = e.target.dataset.r; if (r === undefined && e.target !== m) return; const v = r === '1' ? $('#askIn').value : null; m.remove(); res(v); });
  });
}
function confirmBox(title, msg, yes = 'Yes', no = 'Cancel') {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="sheet"><h3>${esc(title)}</h3><p class="hint" style="font-size:14px">${esc(msg)}</p><div class="inl" style="margin-top:16px"><button class="btn sec" data-r="0">${esc(no)}</button><button class="btn pri" data-r="1">${esc(yes)}</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { const r = e.target.dataset.r; if (r === undefined) { if (e.target === m) { m.remove(); res(null); } return; } m.remove(); res(r === '1'); });
  });
}
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return b64.enc(b); }
function pinPad(title, onDone) {
  let pin = '';
  const el = document.createElement('div'); el.className = 'lock';
  const draw = (err = '') => { el.innerHTML = `<div class="brand">VAIDYA<span>.OS</span></div><div style="color:#8FA3A9;font-size:12px;letter-spacing:.06em;margin-top:-8px">The digital operating system for Ayurvedic healthcare</div><div style="color:#B9C7CB;margin-top:10px">${esc(title)}</div><div class="dots">${[0, 1, 2, 3].map(i => `<i class="${i < pin.length ? 'f' : ''}"></i>`).join('')}</div><div class="err">${esc(err)}</div><div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('')}</div>`; };
  draw(); document.body.appendChild(el);
  el.addEventListener('click', async e => { const k = e.target.dataset.k; if (k == null) return; if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k; draw(); if (pin.length === 4) { const r = await onDone(pin); if (r === true) el.remove(); else { pin = ''; draw(r || 'Wrong PIN'); } } });
  return el;
}
let locked = false;
function lockApp() {
  const h = localStorage.getItem('cdaat_pin'); if (!h || locked) return;
  locked = true;
  pinPad('Enter PIN', async pin => { if (await sha('cdaat:' + pin) === h) { locked = false; return true; } return 'Wrong PIN'; });
}
async function setPin() {
  let first = null;
  const el = pinPad('Choose a 4-digit PIN', async pin => {
    if (!first) { first = pin; return 'Now enter the same PIN again'; }
    if (pin !== first) { first = null; return 'PINs did not match – choose again'; }
    localStorage.setItem('cdaat_pin', await sha('cdaat:' + pin)); toast('PIN set'); vSettings(); return true;
  });
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 5 * 60e3) lockApp(); });

// ---------------------------------------------------------------- events
document.addEventListener('click', async e => {
  const chip = e.target.closest('[data-chip]');
  if (chip) {
    e.preventDefault();
    const o = obj(chip.dataset.c), k = chip.dataset.k, v = chip.dataset.v;
    if (chip.dataset.multi) { let a = getP(o, k); if (!Array.isArray(a)) a = []; a = a.includes(v) ? a.filter(x => x !== v) : [...a, v]; setP(o, k, a); chip.classList.toggle('on'); }
    else { const cur = getP(o, k); const nv = cur === v ? '' : v; setP(o, k, nv); $$(`[data-chip][data-k="${k}"]`).forEach(c => c.classList.toggle('on', c.dataset.v === nv)); }
    if (k === 'sex') { autosave(); const y = window.scrollY; rerouteKeep(); window.scrollTo(0, y); return; }
    if (k === 'nextIn' && getP(o, k)) { const d = new Date(); const x = getP(o, k); if (x.includes('day')) d.setDate(d.getDate() + parseInt(x)); else d.setMonth(d.getMonth() + parseInt(x)); setP(o, 'next', d.toISOString().slice(0, 10)); const n = $('[data-k="next"]'); if (n) n.value = o.next; }
    if (k.startsWith('pk.') && k.endsWith('.resp')) { autosave(); const y = window.scrollY; vVisit(S.v.id, 'tx'); window.scrollTo(0, y); return; }
    if (k.startsWith('cdaat.concl') && $('.gauges')) { autosave(); const y = window.scrollY; vVisit(S.v.id, 'cdaat'); window.scrollTo(0, y); return; }
    return autosave();
  }
  const tk = e.target.closest('[data-tick]');
  if (tk) {
    const o = obj(tk.dataset.c), k = tk.dataset.k; const nv = !getP(o, k); setP(o, k, nv); tk.classList.toggle('on', nv);
    if (tk.dataset.cd) { const [n, t] = cdScores(S.v)[tk.dataset.cd]; const s = $(`[data-score="${tk.dataset.cd}"]`); if (s) s.textContent = `${n} / ${t}`; }
    autosave();
    if (k === 'allergy.none' || k.startsWith('ex.sys.') || k === 'fu.adv') { const y = window.scrollY; rerouteKeep(); window.scrollTo(0, y); }
    return;
  }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, v = a.dataset.v;
  if (act === 'filt') { S.filt = v; vPatients(); }
  else if (act === 'addrow') { S.v[a.dataset.k].push(a.dataset.k === 'pk' ? { date: today() } : a.dataset.k === 'inv' ? { date: today() } : {}); autosave(); const y = window.scrollY; rerouteKeep(); window.scrollTo(0, y); }
  else if (act === 'delrow') { S.v[a.dataset.k].splice(+a.dataset.i, 1); if (a.dataset.k === 'cc' && !S.v.cc.length) S.v.cc.push({}); autosave(); const y = window.scrollY; rerouteKeep(); window.scrollTo(0, y); }
  else if (act === 'cdtab') { S.tab = v; vVisit(S.v.id, 'cdaat'); }
  else if (act === 'cdnext') { const ord = [...CD.map(s => s.letter), 'CR', 'SUM']; S.tab = ord[Math.min(ord.length - 1, ord.indexOf(S.tab) + 1)]; vVisit(S.v.id, 'cdaat'); }
  else if (act === 'finish') finish();
  else if (act === 'print') doPrint(v);
  else if (act === 'share') doShare();
  else if (act === 'printv') doPrint(a.dataset.k, DB.visits[v]);
  else if (act === 'sharev') doShare(DB.visits[v]);
  else if (act === 'follow') { const d = visitsOf(v).find(x => x.status === 'draft'); if (d && await confirmBox('Unfinished draft', 'This patient has an unfinished visit. Continue it?', 'Continue draft', 'Start new')) go(`#/visit/${d.id}`); else newFollow(v); }
  else if (act === 'usetpl') { const t = DB.setting('paTemplates', {})[v]; if (t) { S.v.pa = { ...t }; autosave(); const y = window.scrollY; rerouteKeep(); window.scrollTo(0, y); toast('Template applied'); } }
  else if (act === 'savetpl') { if (!S.v.pa?.pathya && !S.v.pa?.apathya) return toast('Write pathya / apathya first'); const n = await ask('Template name', 'e.g. Amavata, Amlapitta'); if (n) { const t = DB.setting('paTemplates', {}); t[n] = { pathya: S.v.pa.pathya || '', apathya: S.v.pa.apathya || '' }; await DB.saveSetting('paTemplates', t); toast('Template saved'); const y = window.scrollY; rerouteKeep(); window.scrollTo(0, y); } }
  else if (act === 'deltpl') { const t = DB.setting('paTemplates', {}); delete t[v]; await DB.saveSetting('paTemplates', t); vSettings(); }
  else if (act === 'setpin') setPin();
  else if (act === 'nopin') { if (await confirmBox('Remove PIN?', 'The app will open without a PIN.', 'Remove')) { localStorage.removeItem('cdaat_pin'); vSettings(); } }
  else if (act === 'backup') backup();
  else if (act === 'restore') $('#restoreFile').click();
  else if (act === 'csv') exportCSV();
  else if (act === 'delvisit') { if (await confirmBox('Delete this visit?', 'This cannot be undone. Take a backup first if unsure.', 'Delete')) { const pid = DB.visits[v].pid; await DB.del('visits', v); toast('Visit deleted'); go(`#/p/${pid}/visits`); } }
  else if (act === 'delpatient') { if (await confirmBox('Delete patient and all visits?', 'This cannot be undone. Take a backup first if unsure.', 'Delete')) { for (const x of visitsOf(v)) await DB.del('visits', x.id); await DB.del('patients', v); toast('Patient deleted'); go('#/patients'); } }
  else if (act === 'wipe') { if (await confirmBox('Erase ALL data?', 'Every patient and visit on this phone will be deleted. Take a backup first.', 'Erase everything')) { for (const id of Object.keys(DB.visits)) await DB.del('visits', id); for (const id of Object.keys(DB.patients)) await DB.del('patients', id); toast('All data erased'); vSettings(); } }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.set) { DB.saveSetting(el.dataset.set, el.value); return; }
  if (!el.dataset.k || !el.dataset.c) return;
  let v = el.value; if (el.dataset.num) v = v === '' ? '' : +v;
  setP(obj(el.dataset.c), el.dataset.k, v);
  if ('slider' in el.dataset) { const b = $(`[data-sv="${el.dataset.k}"]`); if (b) b.textContent = v; }
  if (el.dataset.k.startsWith('vit.')) calcVitals();
  if (el.dataset.k === 'ph.wake' || el.dataset.k === 'ph.sleep') calcSleep();
  if (el.dataset.k === 'name' || el.dataset.k === 'phone') dupCheck();
  if (el.dataset.k === 'name') { const t = $('.top .ttl'); if (t) t.textContent = el.value || 'New patient'; }
  autosave();
});
document.addEventListener('change', e => { if (e.target.tagName === 'SELECT' && e.target.dataset.k) e.target.dispatchEvent(new Event('input', { bubbles: true })); });
function dupCheck() {
  const p = S.p, el = $('#dupWarn'); if (!el) return;
  const d = Object.values(DB.patients).find(x => x.id !== p.id && x.name && p.name && x.name.trim().toLowerCase() === p.name.trim().toLowerCase() && (!p.phone || !x.phone || x.phone === p.phone));
  el.innerHTML = d ? `<div class="warn">A patient with this name already exists: <a href="#/p/${d.id}" style="text-decoration:underline">${esc(d.name)} · OPD ${esc(d.opd)}</a></div>` : '';
}

// ---------------------------------------------------------------- router
function go(h) { if (location.hash === h) route(); else location.hash = h; }
function rerouteKeep() { route(true); }
function route() {
  const h = location.hash || '#/today';
  const [, a, b, c] = h.split('/');
  if (a !== 'visit') S.tab = 'A';
  if (a === 'today' || !a) vToday();
  else if (a === 'patients') vPatients();
  else if (a === 'new') newPatient();
  else if (a === 'p') vProfile(b, c);
  else if (a === 'visit') vVisit(b, c);
  else if (a === 'vd') vVisitDetail(b);
  else if (a === 'insights') vInsights();
  else if (a === 'settings') vSettings();
  else vToday();
}
window.addEventListener('hashchange', () => route());

// ---------------------------------------------------------------- start
(async function start() {
  try {
    await DB.open(); await DB.load();
    // remove abandoned empty registrations (no name, older than 1 day)
    for (const p of Object.values(DB.patients)) if (!p.name && Date.now() - new Date(p.createdAt) > 864e5) { for (const v of visitsOf(p.id)) await DB.del('visits', v.id); await DB.del('patients', p.id); }
    navigator.storage?.persist?.();
    const dl1 = document.createElement('div'); dl1.innerHTML = `<datalist id="tests">${TESTS.map(t => `<option value="${t}">`).join('')}</datalist><datalist id="meds"></datalist><datalist id="dxlist"></datalist><datalist id="foods"></datalist>`; document.body.appendChild(dl1);
    refreshLists();
    route(); lockApp();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty">Could not open storage on this browser.<br>${esc(err.message)}</div>`;
  }
})();
function refreshLists() {
  const vs = Object.values(DB.visits);
  const uniq = a => [...new Set(a.filter(Boolean).map(x => x.trim()))].sort();
  $('#meds').innerHTML = uniq(vs.flatMap(v => (v.rx || []).map(r => r.med))).map(m => `<option value="${esc(m)}">`).join('');
  $('#dxlist').innerHTML = uniq(vs.map(v => v.dx?.ayur)).map(m => `<option value="${esc(m)}">`).join('');
  $('#foods').innerHTML = uniq(vs.flatMap(v => Object.values(v.ph?.meals || {}).map(m => m.f))).slice(0, 200).map(m => `<option value="${esc(m)}">`).join('');
}
window.addEventListener('hashchange', refreshLists);
