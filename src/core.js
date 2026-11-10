'use strict';
/* ============================================================
   Life Organiser — core: constants, store, state, shell, routing,
   menus, dialogs, Home / Tasks / Archive / Search views.
   Item types live in types/*.js and register into TYPE_VIEWS.
   ============================================================ */

/* ---------- constants ---------- */
const TOUCH = matchMedia('(pointer:coarse)').matches;
const COLORS = {blue:'#007aff',indigo:'#5856d6',violet:'#af52de',rose:'#ff2d55',red:'#ff3b30',orange:'#ff9500',amber:'#ffb300',green:'#34c759',teal:'#30b0c7',slate:'#8e8e93'};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Every drag in the app: the mouse uses the scripted drag (a native link drag makes Chrome offer "Create split view"),
   and no text gets selected from the moment an item is picked up until it is dropped. */
if(window.Sortable){ const make = Sortable.create.bind(Sortable);
  const on = () => { document.body.classList.add('no-select'); try{ getSelection().removeAllRanges(); }catch(e){} };
  const off = () => document.body.classList.remove('no-select');
  Sortable.create = (el, o={}) => make(el, {forceFallback:true, fallbackOnBody:true, ...o,
    onChoose(e){ on(); o.onChoose?.(e); }, onUnchoose(e){ off(); o.onUnchoose?.(e); },
    onStart(e){ on(); o.onStart?.(e); }, onEnd(e){ off(); o.onEnd?.(e); }}); }
/* Right-click does nothing unless a feature offers its own menu there (menu items, cards). Text fields keep the
   browser's menu for copy, paste and spelling. */
document.addEventListener('contextmenu', e => { if(e.defaultPrevented || e.target.closest?.('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return; e.preventDefault(); });
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const CUR_YEAR = new Date().getFullYear();
const HOME_DAYS = 30;          // collection dates show on Home this many days ahead
const TASK_DAYS = 14;          // task due dates show on Home this many days ahead

const ICON = {
  kanban:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="4" width="4.5" height="14" rx="1.3"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.3"/><rect x="16" y="4" width="4.5" height="11.5" rx="1.3"/></svg>',
  note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M10 12.5h5.5M10 16h5.5"/></svg>',
  collection:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/></svg>',
  tracker:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 17.5 9 11l4 3.5 7.5-8.5"/></svg>',
  bills:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="9" cy="14.5" r="1.3" fill="currentColor"/><circle cx="15" cy="14.5" r="1.3" fill="currentColor"/></svg>',
  checklist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 7 2 2 3.5-3.5M4 15.5l2 2 3.5-3.5M13 7.5h7M13 16h7"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/></svg>',
  tasks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  archive:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>',
  sidebar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M9.5 4.5v15"/></svg>',
  grip:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chev:'<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m7 9 5 5 5-5"/></svg>',
  rtUl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
  rtOl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5 5 4v4M3.8 14.2c.3-.6 2.2-.8 2.2.3 0 .9-2.2 1.6-2.2 2.5H6.2" stroke-width="1.5"/></svg>',
  rtCk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="m4.5 7 1.2 1.2L8 5.8"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><path d="M13 7h8M13 17h8"/></svg>',
  rtQ:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6v12"/><path d="M10 8h10M10 12h10M10 16h6"/></svg>',
  rtLink:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  rtClear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5h12M12 5 9 19M4 4l16 16"/></svg>',
  chevD:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m7 9 5 5 5-5"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m7 14 5-5 5 5"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 2.5 21.5 8.5l-2 .9-3.6 3.6.6 4.6-1.6 1.6-4-4-5 5-1.2-1.2 5-5-4-4 1.6-1.6 4.6.6 3.6-3.6z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 7 2 2 3-3M4 15l2 2 3-3M13 8h7M13 16h7"/></svg>',
  move:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8.5h13.5M15 5l3.5 3.5L15 12M19 15.5H5.5M9 12l-3.5 3.5L9 19"/></svg>',
  notes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h14v16H5zM9 9h6M9 13h6"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  bang:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v9M12 19h.01"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h1.8v18H5zM7.5 4h11l-2.5 4.5 2.5 4.5h-11z"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  sort:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m8 10 4-4 4 4M8 14l4 4 4-4"/></svg>',
};
/* Item types. Kanban, Bills, Tracker and Page are created from New item; a Kanban holds stacks, a Page holds
   blocks (Text, Checklist, Table), and those live as items with a `parent`. */
ICON.page = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M7.5 8h9M7.5 12h9M7.5 16h5" stroke-linecap="round"/></svg>';
ICON.stack = ICON.kanban;
const TYPES = {
  kanban:    {label:'Kanban',     color:'slate',  desc:'Stacks of To Do / In Progress / Done columns you drag cards across.'},
  bills:     {label:'Bills',      color:'orange', desc:'Recurring bills and renewals on a yearly timeline, with paid ticks.'},
  tracker:   {label:'Tracker',    color:'indigo', desc:'Dated numbers with a chart: loan rate, balances, weight.'},
  page:      {label:'Page',       color:'amber',  desc:'A page you build from blocks: text, checklists and tables.'},
  stack:     {label:'Stack',      color:'slate',  part:true},
  note:      {label:'Text',       color:'amber',  part:true},
  checklist: {label:'Checklist',  color:'teal',   part:true},
  collection:{label:'Table',      color:'green',  part:true},
};
const isTop = i => !i.parent;                    // stacks and page blocks have a parent
const topOf = i => i?.parent ? itemById(i.parent) || i : i;   // the sidebar item something belongs to
const TYPE_VIEWS = {};
const CHANGELOG = '__CHANGELOG__';
function toggleShowDone(){ S.showDone = !S.showDone; ls.set('lo.showDone', S.showDone?'1':'0'); render(true); }   // filled in by build.py from CHANGELOG.md
const APP_VERSION = '__VERSION__';   // filled by types/*.js

/* ---------- utils ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => { const a='abcdefghijklmnopqrstuvwxyz0123456789'; let s=''; const r=crypto.getRandomValues(new Uint8Array(15)); for(const b of r) s+=a[b%36]; return s; }; // 15 chars: PocketBase-compatible ids
const nowIso = () => new Date().toISOString();
const clone = o => o===undefined ? undefined : JSON.parse(JSON.stringify(o));
const colorOf = k => COLORS[k] || k || COLORS.slate;
const ls = {get(k,d=null){try{const v=localStorage.getItem(k); return v===null?d:v}catch(e){return d}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const ymd = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today = () => ymd(new Date());
function dayDiff(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); const a=new Date(y,m-1,d); const t=new Date(); t.setHours(0,0,0,0); return Math.round((a-t)/864e5); }
function dateLabel(s){ const [y,m,d]=s.split('-').map(Number); return d+' '+MON[m-1]+(y!==CUR_YEAR?' '+y:''); }
/* full date, dd mmm yy (e.g. 15 Nov 26) */
const fullDate = s => { const d=new Date(s+'T00:00:00'); return String(d.getDate()).padStart(2,'0')+' '+MON[d.getMonth()]+' '+String(d.getFullYear()).slice(2); };
/* due label: full date plus how far away, e.g. "15 Nov 26 · In 6d" */
function dueLabel(s){
  const n = dayDiff(s), full = fullDate(s);
  const r = n<0 ? {rel:(-n)+'d overdue', cls:'overdue'} : n===0 ? {rel:'Today', cls:'soon'} : n===1 ? {rel:'Tomorrow', cls:'soon'} : {rel:'In '+n+'d', cls:''};
  return {...r, full, t: full+' · '+r.rel};
}
const shortDate = iso => { const d=new Date(iso); return d.getDate()+' '+MON[d.getMonth()]+(d.getFullYear()!==CUR_YEAR?' '+d.getFullYear():''); };
const stamp = iso => { const d=new Date(iso); return shortDate(iso)+', '+d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}); };
const plural = (n, w) => n+' '+w+(n===1?'':'s');
function fmtNum(v, dec){ if(v===''||v===null||v===undefined||isNaN(v)) return '—'; return Number(v).toLocaleString('en-AU',{minimumFractionDigits:dec??0, maximumFractionDigits:dec??2}); }

/* ---------- state ---------- */
const S = {
  folders:[], items:[], tasks:[], rows:[], flags:null,
  loaded:{folders:false, items:false, tasks:false, rows:false},
  route:{v:'home', id:null}, q:'', dragging:false,
  collapsed:new Set(JSON.parse(ls.get('lo.collapsed','[]'))),
  tasksView:{sort:ls.get('lo.sort','priority'), mode:ls.get('lo.tasksMode','board'), quick:'open', boards:new Set(), bb:false},
  /* Done column: hidden by default on phones, shown on desktop; per device */
  showDone: ls.get('lo.showDone', matchMedia('(max-width:760px)').matches ? '0' : '1') === '1',
  archiveYear:null,
};
const itemById = id => S.items.find(i=>i.id===id);
const folderById = id => S.folders.find(f=>f.id===id);
const itemsIn = fid => S.items.filter(i=>(i.folderId||'')===(fid||'')).sort((a,b)=>(a.order??0)-(b.order??0));
const sortedFolders = () => S.folders.slice().sort((a,b)=>(a.order??0)-(b.order??0));
const kanbans = () => S.items.filter(i=>i.type==='stack');                       // every stack, across all Kanbans
const stacksOf = kid => S.items.filter(i=>i.type==='stack' && i.parent===kid).sort((a,b)=>(a.order??0)-(b.order??0)||(a.name||'').localeCompare(b.name||''));
const blocksOf = pid => S.items.filter(i=>i.parent===pid && i.type!=='stack').sort((a,b)=>(a.order??0)-(b.order??0));

/* ---------- store: the only code that knows about the database.
   Swap this object for a PocketBase version later; the rest of the app stays the same. ---------- */
const Store = {
  db:null, chains:{},
  async connect(){
    if(!window.claude || typeof window.claude.use!=='function'){ this.db = DemoDB(); this.demo = true; return true; }
    this.db = await window.claude.use('db'); return !!this.db;
  },
  watch(col, onData, onErr){ return this.db.collection(col).onSnapshot(s => onData(s.docs.map(d=>({...d.data(), id:d.id})), s.metadata?.fromCache), onErr); },
  watchDoc(path, onData, onErr){ return this.db.doc(path).onSnapshot(s => onData(s.exists ? s.data() : null), onErr); },
  run(path, fn, onFail){
    if(!this.db){ toast('Not connected, so this change was not saved.', null, true); onFail&&onFail(); render(); return Promise.resolve(); }
    const prev = this.chains[path] || Promise.resolve();
    const next = prev.then(() => fn(this.db.doc(path))).catch(e => {
      console.warn(e);
      if(onFail){ onFail(); render(true); refreshOverlays(); }
      toast(e && e.code==='quota_exceeded' ? 'Storage is full. Delete some items, then try again.' : (onFail ? 'Couldn’t save that change, so it was undone. Check your connection.' : 'Couldn’t save that change. Check your connection.'), null, true);
    });
    this.chains[path] = next; return next;
  },
};
const STAMPED = new Set(['items','tasks','rows','folders']);
/* local-first writes with rollback */
function docSet(col, data){
  const arr = S[col]; const i = arr.findIndex(x=>x.id===data.id); const prev = i>-1 ? clone(arr[i]) : null;
  if(i>-1) arr[i]=data; else arr.push(data);
  const {id, ...body} = data;
  Store.run(col+'/'+id, r=>r.set(body), () => { const j=S[col].findIndex(x=>x.id===id); if(prev){ if(j>-1) S[col][j]=prev; } else if(j>-1) S[col].splice(j,1); });
}
function docPatch(col, id, patch){
  const x = S[col].find(y=>y.id===id); if(!x) return;
  if(STAMPED.has(col) && !('updated' in patch)) patch.updated = nowIso();
  const before = {}; Object.keys(patch).forEach(k=>before[k] = x[k]===undefined ? '' : clone(x[k]));
  Object.assign(x, patch);
  Store.run(col+'/'+id, r=>r.update(patch), () => { const y=S[col].find(z=>z.id===id); if(y) Object.assign(y, before); });
}
function docDel(col, id){
  const i = S[col].findIndex(x=>x.id===id); if(i<0) return; const snap = S[col][i]; S[col].splice(i,1);
  Store.run(col+'/'+id, r=>r.delete(), () => { if(!S[col].find(x=>x.id===id)) S[col].push(snap); });
  return snap;
}
const touchItem = id => { const it=itemById(id); if(it) docPatch('items', id, {updated:nowIso()}); };

/* ---------- toast with optional Undo ---------- */
let toastT;
function toast(msg, undo, bad){
  const t = $('#toast'); t.innerHTML = '';
  const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
  if(undo){ const b=document.createElement('button'); b.type='button'; b.textContent='Undo'; b.onclick=()=>{ undo(); t.classList.remove('show'); clearTimeout(toastT); render(true); refreshOverlays(); }; t.appendChild(b); }
  t.classList.toggle('has-action', !!undo); t.classList.toggle('bad', !!bad); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), undo ? 6000 : 2800);
}

/* ---------- focus helpers: survive re-renders ---------- */
const KEY_ATTRS = ['data-pay','data-active','data-upd','data-period','data-b','data-k','data-yr','data-edit','data-act','data-tick','data-pin','data-mv','data-cbox','data-ci','data-ct','data-cw','data-cf','data-cm','data-add','data-open','data-go','data-quick','data-sort','data-mode','data-fb','data-year','data-p','data-due','data-id','data-fid','data-row','data-field','data-ck','data-seg'];
function focusKey(el){
  if(!el || el===document.body || el===document.documentElement) return null;
  const own = e => { if(e.id) return '#'+CSS.escape(e.id); const parts=KEY_ATTRS.filter(a=>e.hasAttribute(a)).map(a=>`[${a}="${CSS.escape(e.getAttribute(a))}"]`); return parts.length ? e.tagName.toLowerCase()+parts.join('') : null; };
  const scope = el.closest('[data-key]');
  const o = own(el);
  if(scope && scope!==el) return o ? `[data-key="${CSS.escape(scope.dataset.key)}"] ${o}` : null;
  return o;
}
function restoreFocus(key, root=document){ if(!key) return false; try{ const el=root.querySelector(key); if(el && el!==document.activeElement){ el.focus({preventScroll:true}); return true; } }catch(e){} return false; }

/* ---------- overlays: menus, dialogs ---------- */
let menuEl=null, menuAnchor=null;
function closeMenu(refocus){
  if(!menuEl) return; menuEl.remove(); menuEl=null;
  document.removeEventListener('pointerdown', outsideMenu, true);
  menuAnchor?.setAttribute('aria-expanded','false');
  if(refocus && menuAnchor?.isConnected) menuAnchor.focus({preventScroll:true});
  menuAnchor=null;
}
function outsideMenu(e){ if(menuEl && !menuEl.contains(e.target) && e.target.closest('[aria-haspopup]')!==menuAnchor) closeMenu(false); }
/* items: {label, value, checked?, dot?, kbd?, danger?} | {sep:true} | {head:'text'} */
function openMenu(anchor, items, onPick, label, cls=''){
  if(menuEl && menuAnchor===anchor){ closeMenu(true); return; }
  closeMenu(false);
  const m = document.createElement('div'); m.className='menu '+cls; m.setAttribute('role','menu'); m.setAttribute('aria-label', label||'Menu');
  m.innerHTML = items.map((it,i)=> it.sep ? '<div class="menu-sep" role="separator"></div>' : it.head ? `<div class="menu-h" role="presentation">${esc(it.head)}</div>` :
    `<button role="${it.checked!==undefined?'menuitemradio':'menuitem'}" ${it.checked!==undefined?`aria-checked="${!!it.checked}"`:''} data-i="${i}" tabindex="-1" class="${it.danger?'danger':''}">`+
    `${it.checked!==undefined?`<span class="mk" aria-hidden="true">${it.checked?ICON.check:''}</span>`:''}${it.dot?`<span class="dot" style="--oc:${it.dot}"></span>`:''}${it.html ? `<span class="mi" ${it.label?`aria-label="${esc(it.label)}" title="${esc(it.label)}"`:''}>${it.html}</span>` : `<span>${esc(it.label)}</span>`}${it.kbd?`<span class="kbd" aria-hidden="true">${esc(it.kbd)}</span>`:''}</button>`).join('');
  document.body.appendChild(m); menuEl=m; menuAnchor=anchor; anchor.setAttribute('aria-expanded','true');
  const r = anchor.getBoundingClientRect(); const w=m.offsetWidth, h=m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.left, innerWidth-w-8))+'px';
  m.style.top = (r.bottom+6+h > innerHeight-8 ? Math.max(8, r.top-h-6) : r.bottom+6)+'px';
  const btns = $$('button', m);
  (btns.find(b=>b.getAttribute('aria-checked')==='true') || btns[0])?.focus();
  m.addEventListener('click', e => { const b=e.target.closest('button'); if(!b) return; const it=items[+b.dataset.i]; closeMenu(true); onPick(it.value, it); });
  m.addEventListener('keydown', e => {
    const i = btns.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){e.preventDefault(); btns[(i+1)%btns.length].focus()}
    else if(e.key==='ArrowUp'){e.preventDefault(); btns[(i-1+btns.length)%btns.length].focus()}
    else if(e.key==='Home'){e.preventDefault(); btns[0].focus()}
    else if(e.key==='End'){e.preventDefault(); btns[btns.length-1].focus()}
    else if(e.key==='Escape'){e.preventDefault(); e.stopPropagation(); closeMenu(true)}
    else if(e.key==='Tab'){e.preventDefault(); closeMenu(true)}
  });
  setTimeout(()=>document.addEventListener('pointerdown', outsideMenu, true));
}
const modal = () => $('#modal');
const modalOpen = () => modal().classList.contains('show');
let modalOpener = null;
/* While a task window or dialog is open the page behind is pinned in place. Otherwise iPhone Safari scrolls the page
   to make room for the keyboard, and taps afterwards land on the wrong spot. */
function lockPage(on){
  const b = document.body, locked = b.classList.contains('page-locked');
  if(on && !locked){ lockPage.y = Math.max(0, window.scrollY); b.style.top = `-${lockPage.y}px`; b.classList.add('page-locked'); }
  else if(!on && locked){ b.classList.remove('page-locked'); b.style.top = ''; window.scrollTo(0, lockPage.y||0); }
}
/* when the keyboard closes, put the visual viewport back where Safari's hit-testing expects it */
/* iPhone keyboard: keep the task window above it, and once it closes put the view back where taps expect it. */
(() => { const vv = window.visualViewport; if(!vv) return; let lastFocusOut = 0;
  document.addEventListener('focusout', () => { lastFocusOut = Date.now(); });
  const fit = () => {
    const sh = $('#sheet'); if(!sh || !matchMedia('(max-width:760px)').matches) return;
    if(!sh.classList.contains('show')){ sh.style.bottom = sh.style.maxHeight = ''; return; }
    if(vv.scale > 1.01) return;                                         // pinch zoom, not a keyboard
    let kb = Math.max(0, innerHeight - vv.height - vv.offsetTop); if(kb < 80) kb = 0;   // keyboard height; ignore toolbar wobble
    sh.style.bottom = kb ? `${kb + 8}px` : ''; sh.style.maxHeight = kb ? `${vv.height - 24}px` : '';
    clearTimeout(fit.t1); clearTimeout(fit.t2);
    if(!kb && vv.offsetTop > 0){ const back = () => { if(vv.offsetTop > 0) window.scrollTo(0, 0); }; fit.t1 = setTimeout(back, 100); fit.t2 = setTimeout(back, 350); }
  };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
  window.__recentFocusOut = () => Date.now() - lastFocusOut < 700;
})();
function setBackgroundInert(){
  const sheetOpen = $('#sheet').classList.contains('show') || !!window.__sheetOpen;
  $('.shell').inert = sheetOpen || modalOpen();
  $('#sheet').inert = !sheetOpen || modalOpen();
  modal().inert = !modalOpen();
  lockPage(sheetOpen || modalOpen());
  const scrim = $('#scrim');
  if(sheetOpen || modalOpen()){ scrim.hidden=false; requestAnimationFrame(()=>scrim.classList.add('show')); }
  else { scrim.classList.remove('show'); setTimeout(()=>{ if(!modalOpen() && !window.__sheetOpen) scrim.hidden=true; }, 220); }
}
function openModal(html, {opener, wide}={}){
  document.body.classList.remove('side-open');
  if(!modalOpen()) modalOpener = opener || document.activeElement;
  const m = modal(); m.innerHTML = html; m.classList.toggle('wide', !!wide);
  m.oninput = m.onchange = m.onkeydown = m.onclick = null;
  m.classList.add('show'); setBackgroundInert();
  requestAnimationFrame(()=>{ if(!m.contains(document.activeElement)) (m.querySelector('[autofocus]') || m.querySelector('input,button'))?.focus(); });
  return m;
}
function closeModal(){
  if(!modalOpen()) return;
  modal().classList.remove('show'); setBackgroundInert();
  const o = modalOpener; modalOpener = null;
  if(o?.isConnected && !o.closest('[inert]')) o.focus({preventScroll:true});
}
function confirmModal({title, body, action='Delete', danger=true, opener}){
  return new Promise(res => {
    const m = openModal(`<h2 id="mTitle">${esc(title)}</h2>${body?`<p class="note">${body}</p>`:''}<div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill ${danger?'danger':''}" data-x="yes" autofocus>${esc(action)}</button></div>`, {opener});
    m.onclick = e => { const b=e.target.closest('[data-x]'); if(!b) return; closeModal(); res(b.dataset.x==='yes'); };
    m.onkeydown = e => { if(e.key==='Escape'){ res(false); } };
  });
}
function promptModal({title, label, value='', action='Save', placeholder='', opener}){
  return new Promise(res => {
    const m = openModal(`<h2 id="mTitle">${esc(title)}</h2><label class="field"><span class="lbl">${esc(label)}</span><input class="txt-in" id="pIn" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="60" autofocus></label><div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">${esc(action)}</button></div>`, {opener});
    const done = ok => { const v=$('#pIn').value.trim(); if(ok && !v){ $('#pIn').focus(); return; } closeModal(); res(ok ? v : null); };
    m.onclick = e => { const b=e.target.closest('[data-x]'); if(b) done(b.dataset.x==='yes'); };
    m.onkeydown = e => { if(e.key==='Enter' && e.target.id==='pIn'){ e.preventDefault(); done(true); } if(e.key==='Escape') res(null); };
  });
}
function refreshOverlays(){ if(window.__sheetOpen && TYPE_VIEWS.kanban?.refreshSheet) TYPE_VIEWS.kanban.refreshSheet(); }

/* ---------- routing ---------- */
function parseHash(){
  const h = location.hash.slice(1);
  if(h.startsWith('i-')) return {v:'item', id:h.slice(2)};
  if(['tasks','archive','home'].includes(h)) return {v:h, id:null};
  return {v:'home', id:null};
}
function go(hash){
  if(location.hash === '#'+hash){ S.route = parseHash(); render(true); return; }
  location.hash = hash;
}
window.addEventListener('hashchange', () => {
  S.route = parseHash(); S.q=''; const si=$('#q'); if(si) si.value='';
  document.body.classList.remove('side-open');
  if(window.__sheetOpen) TYPE_VIEWS.kanban.closeSheet(true);
  render(true); $('#content').scrollTop=0; window.scrollTo({top:0});
});

/* ---------- render ---------- */
let contentPending = false;
function isEditing(){ const a=document.activeElement; return !!a && $('#content').contains(a) && a.matches('input:not([type=checkbox]):not([type=date]),textarea,[contenteditable="true"],[contenteditable="plaintext-only"]'); }
function render(force){
  renderSide(); renderBar();
  if(S.dragging){ contentPending=true; return; }
  if(!force && isEditing()){ contentPending=true; return; }
  if(S.rendering){ contentPending=true; return; }
  contentPending=false;
  const fk = (!modalOpen() && !window.__sheetOpen && !menuEl) ? focusKey(document.activeElement) : null;
  const c = $('#content'); const hs = $$('[data-hs]', c).map(el=>[el.dataset.hs, el.scrollLeft]); const wy = window.scrollY, cy = c.scrollTop;
  S.rendering = true; try{ renderContent(); } finally { S.rendering = false; }
  for(const [k,x] of hs){ const el = c.querySelector(`[data-hs="${CSS.escape(k)}"]`); if(el && x) el.scrollLeft = x; }
  if(c.scrollTop!==cy) c.scrollTop = cy; if(window.scrollY!==wy) window.scrollTo(0, wy);
  if(fk && $('#content').contains(document.activeElement)===false) restoreFocus(fk, $('#content'));
}
$('#content').addEventListener('focusout', () => setTimeout(()=>{ if(contentPending && !isEditing() && !S.dragging) render(true); }, 160));

function currentItem(){ return S.route.v==='item' ? itemById(S.route.id) : null; }
/* old links: #tasks / #archive open the first Kanban; a stack or a block opens the item it belongs to */
function resolveRoute(){
  if(!S.loaded.items) return false;
  if(S.route.v==='tasks' || S.route.v==='archive'){ const k = itemsOf(i=>i.type==='kanban')[0]; if(k){ S.tasksView.mode = S.route.v==='archive' ? 'archive' : S.tasksView.mode==='archive' ? 'board' : S.tasksView.mode; location.replace('#i-'+k.id); S.route={v:'item', id:k.id}; return false; } }
  const it = currentItem(); if(it?.parent){ location.replace('#i-'+it.parent); S.route={v:'item', id:it.parent}; }
  return false;
}
/* Kanbans (categories) all share one standard colour; other item types keep their type colour. */
function itemColor(it){ return 'var(--icon)'; }   // every icon is one neutral colour

/* ----- sidebar ----- */
let navSortables = [];
function navItemHTML(it){
  const cur = S.route.v==='item' && S.route.id===it.id && !S.q;
  let ct = '';
  if(it.type==='kanban'){ const ids = stacksOf(it.id).map(s=>s.id); ct = S.tasks.filter(t=>ids.includes(t.boardId) && !['done','backburner'].includes(t.col)).length || ''; }
  else if(it.type==='bills') ct = TYPE_VIEWS.bills.pending(it, 30).length || '';
  return `<a class="nav-item" draggable="false" href="#i-${esc(it.id)}" data-id="${esc(it.id)}" ${cur?'aria-current="page"':''} style="--c:${itemColor(it)}"><span class="ti" aria-hidden="true">${ICON[it.type]}</span><span class="nm">${esc(it.name||'Untitled')}</span>${ct!==''?`<span class="ct" aria-label="${esc(String(ct))}">${ct}</span>`:''}${TOUCH&&cur?`<button class="icon-btn mini nav-more" data-act="item-menu" data-iid="${esc(it.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(it.name)} options">${ICON.more}</button>`:''}</a>`;
}
/* Sidebar: Home · custom items (Kanbans, Bills, Trackers; drag to reorder) · folders of Pages (drag folders, and
   drag pages within or between folders) · unfiled Pages. Right-click an item or folder for its options. */
const TYPE_GROUP = {kanban:'custom', bills:'custom', tracker:'custom', page:'page'};
const byOrder = (a,b) => (a.order??0)-(b.order??0) || (a.name||'').localeCompare(b.name||'');
const itemsOf = (pred) => S.items.filter(i=>isTop(i) && pred(i)).sort(byOrder);
function renderSide(){
  const el = $('#nav');
  const navLink = (v,l,ic) => `<a class="nav-item" href="#${v}" ${S.route.v===v&&!S.q?'aria-current="page"':''}><span class="ti plain" aria-hidden="true">${ic}</span><span class="nm">${l}</span></a>`;
  const navable = i => !!TYPE_GROUP[i.type];
  const inFolder = fid => itemsOf(i=>navable(i) && (i.folderId||'')===fid);
  const root = itemsOf(i=>navable(i) && (!i.folderId || !folderById(i.folderId)));
  let html = `<div class="nav-group">${navLink('home','Home',ICON.home)}</div>`;
  /* items without a folder first, then the folders; drag anything anywhere */
  html += `<div class="nav-group nav-root"><div class="nav-list" data-list="items" data-fid="">${root.map(navItemHTML).join('')}${root.length?'':'<div class="nav-empty nav-drop-root">Drop here for no folder</div>'}</div></div>`;
  html += `<div class="nav-folders">${sortedFolders().map(f=>{ const open=!S.collapsed.has(f.id); const its=inFolder(f.id);
    return `<div class="nav-group nav-folder" data-fid="${esc(f.id)}" data-key="f-${esc(f.id)}"><div class="nav-h" data-folder="${esc(f.id)}"><button class="fold" data-act="fold" data-fid="${esc(f.id)}" aria-expanded="${open}">${ICON.chevD}<span>${esc(f.name)}</span></button>${TOUCH?`<button class="icon-btn mini" data-act="folder-menu" data-fid="${esc(f.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(f.name)} options">${ICON.more}</button>`:''}</div>
      <div class="nav-list" data-list="items" data-fid="${esc(f.id)}" ${open?'':'hidden'}>${its.map(navItemHTML).join('')}${its.length?'':`<div class="nav-empty">Drag items here</div>`}</div></div>`; }).join('')}</div>`;
  html += `<div class="side-foot"><button class="nav-item" data-act="new-item"><span class="ti plain" aria-hidden="true">${ICON.plus}</span><span class="nm">New item</span>${TOUCH?'':'<kbd aria-hidden="true">N</kbd>'}</button><button class="nav-item" data-act="new-folder"><span class="ti plain" aria-hidden="true">${ICON.plus}</span><span class="nm">New folder</span></button></div>`;
  const fk = el.contains(document.activeElement) ? focusKey(document.activeElement) : null;
  navSortables.forEach(s=>s.destroy()); navSortables=[];
  el.innerHTML = html;
  const opts = {animation:RM?0:150, delay:250, delayOnTouchOnly:true, fallbackTolerance:4, ghostClass:'ghost', onStart(){ S.dragging=true; document.body.classList.add('nav-dragging'); }, onEnd(){ S.dragging=false; document.body.classList.remove('nav-dragging'); saveNavOrder(); render(true); }};
  $$('.nav-list', el).forEach(list => navSortables.push(Sortable.create(list, {...opts, group:'nav-'+list.dataset.list, draggable:'.nav-item'})));
  const fl = $('.nav-folders', el); if(fl) navSortables.push(Sortable.create(fl, {...opts, draggable:'.nav-folder', handle:'.nav-h'}));
  if(fk) restoreFocus(fk, el);
}
function saveNavOrder(){
  $$('#nav .nav-list').forEach(list => {
    const fid = list.dataset.fid;
    $$('.nav-item[data-id]', list).forEach((a,i) => { const it=itemById(a.dataset.id); if(!it) return; const p = {};
      if(it.order!==i) p.order = i; if(fid!==undefined && (it.folderId||'')!==fid) p.folderId = fid;
      if(Object.keys(p).length) docPatch('items', it.id, {...p, updated:it.updated||nowIso()}); });
  });
  $$('#nav .nav-folder').forEach((g,i) => { const f=folderById(g.dataset.fid); if(f && f.order!==i) docPatch('folders', f.id, {order:i}); });
}
/* right-click (or the ••• on touch) */
/* a menu opened at the pointer (right-click) */
const pointAnchor = e => ({getBoundingClientRect:()=>({left:e.clientX, right:e.clientX, top:e.clientY, bottom:e.clientY, width:0, height:0}), setAttribute(){}, focus(){}});
function navContextMenu(e){
  const a = e.target.closest('.nav-item[data-id]'), h = e.target.closest('.nav-h[data-folder]');
  if(!a && !h) return;
  e.preventDefault();
  const at = pointAnchor(e);
  if(a) itemMenu(at, itemById(a.dataset.id)); else folderMenu(at, h.dataset.folder);
}
$('#side').addEventListener('contextmenu', navContextMenu);

/* ----- top bar ----- */
function renderBar(){
  const it = currentItem(); const f = it && folderById(it.folderId);
  let crumbs;
  if(S.q) crumbs = `<b>Search</b>`;
  else if(it) crumbs = `${f?`<span>${esc(f.name)}</span><span class="sep" aria-hidden="true">›</span>`:''}<b>${esc(it.name||'Untitled')}</b>`;
  else crumbs = `<b>${{home:'Home',tasks:'All tasks',archive:'Archive'}[S.route.v]||'Home'}</b>`;
  $('#crumbs').innerHTML = crumbs;
}

/* ----- content ----- */
function renderContent(){
  const c = $('#content');
  if(!S.loaded.items){ c.innerHTML = `<div class="wrap"><div class="empty-state">Loading your organiser…</div></div>`; return; }
  if(S.q) return renderSearch(c);
  resolveRoute();
  if(S.route.v==='item'){
    const it = currentItem();
    if(!it){ c.innerHTML = `<div class="wrap"><div class="empty-state"><b>This item doesn’t exist any more</b>It may have been deleted. <a class="link" href="#home">Go to Home</a></div></div>`; return; }
    const V = TYPE_VIEWS[it.type];
    document.documentElement.style.setProperty('--board', itemColor(it));
    c.innerHTML = `<div class="wrap ${V.wide?'wide':V.narrow?'narrow':''}" data-key="item-${esc(it.id)}">${headHTML(it)}<div id="tv"></div></div>`;
    V.render(it, $('#tv'));
    if(S.pendingFocus===it.id){ S.pendingFocus=null; requestAnimationFrame(()=>V.focusStart?.(it)); }
    return;
  }
  document.documentElement.style.setProperty('--board', '#0071e3');
  renderHome(c);
}
function headHTML(it){
  const f = folderById(it.folderId);
  return `<div class="ihead"><span class="ti" style="--c:${itemColor(it)}" aria-hidden="true">${ICON[it.type]}</span>
    <div class="ihead-t"><p class="eyebrow">${TYPES[it.type].label}${it.updated?' · Edited '+esc(shortDate(it.updated)):''}</p>
    <input class="title-in" id="itemTitle" value="${esc(it.name||'')}" placeholder="Untitled" aria-label="${TYPES[it.type].label} name" maxlength="80"></div></div>`;
}

/* ----- Home ----- */
function openTasks(){ return S.tasks.filter(t => { const b=itemById(t.boardId); return b && !b.hidden && t.col!=='done' && t.col!=='backburner'; }); }
const QUICK = [
  {id:'open', label:'Open tasks', test:()=>true, c:'#007aff', ic:'list'},
  {id:'overdue', label:'Overdue', test:t=>t.due && dayDiff(t.due)<0, c:'#ff3b30', ic:'bang'},
  {id:'week', label:'Due in 7 days', test:t=>t.due && dayDiff(t.due)>=0 && dayDiff(t.due)<=7, c:'#30b0c7', ic:'cal'},
  {id:'waiting', label:'Flagged', test:t=>!!effFlag(t), c:'#ff9500', ic:'flag'},
];
function comingUp(){
  const out = [];
  for(const t of openTasks()) if(t.due && dayDiff(t.due)<=TASK_DAYS) out.push({kind:'task', date:t.due, title:t.title, item:itemById(t.boardId), task:t});
  for(const it of S.items.filter(i=>i.type==='collection')){
    const dateFields = (it.fields||[]).filter(f=>f.type==='date' && f.home);
    if(!dateFields.length) continue;
    const boxFields = (it.fields||[]).filter(f=>f.type==='checkbox');
    const titleField = (it.fields||[]).find(f=>f.type==='text');
    for(const r of S.rows.filter(r=>r.itemId===it.id)){
      if(boxFields.some(f=>r.values?.[f.id])) continue;     // ticked (e.g. Used) rows drop off Home
      for(const f of dateFields){ const v=r.values?.[f.id]; if(v && dayDiff(v)<=HOME_DAYS && dayDiff(v)>=-7) out.push({kind:'row', date:v, title:(titleField&&r.values?.[titleField.id])||'Untitled', what:f.name, item:topOf(it), row:r}); }
    }
  }
  for(const it of S.items.filter(i=>i.type==='bills'))
    for(const p of TYPE_VIEWS.bills.pending(it, HOME_DAYS)) out.push({kind:'bill', date:p.d.date, title:[p.b.category,p.b.asset].filter(Boolean).join(' · ')||'Bill', what:(p.d.inst||p.b.institution||'')+(p.d.amount!==''&&p.d.amount!==undefined?' · $'+fmtNum(p.d.amount,2):''), item:it});
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function sparkPath(points, w, h, step){
  if(points.length<2) return '';
  const xs = points.map(p=>new Date(p.date).getTime()), ys = points.map(p=>Number(p.value));
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const X = x => x1===x0 ? w : (x-x0)/(x1-x0)*w, Y = y => y1===y0 ? h/2 : h-2-(y-y0)/(y1-y0)*(h-4);
  let d = `M${X(xs[0]).toFixed(1)},${Y(ys[0]).toFixed(1)}`;
  for(let i=1;i<xs.length;i++){ if(step) d += `H${X(xs[i]).toFixed(1)}`; d += `${step?'V':'L'+X(xs[i]).toFixed(1)+','}${Y(ys[i]).toFixed(1)}`; }
  return d;
}
function renderHome(c){
  const d = new Date(); const pool = openTasks();
  const up = comingUp().slice(0,14);
  const billItems = S.items.filter(i=>i.type==='bills');
  const billsDue = billItems.reduce((n,i)=>n+TYPE_VIEWS.bills.pending(i,30).length, 0);
  const trackers = S.items.filter(i=>i.type==='tracker');
  const touched = i => S.items.filter(x=>x.parent===i.id).reduce((m,x)=>(x.updated||'')>m?x.updated:m, i.updated||i.created||'');   // a page counts its blocks' edits
  const recent = S.items.filter(isTop).map(i=>({...i, updated:touched(i)})).sort((a,b)=>b.updated.localeCompare(a.updated)).slice(0,6);
  c.innerHTML = `<div class="wrap">
    <div><p class="eyebrow">${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}</p><h1 class="big">Home</h1></div>
    <div class="stats ${billItems.length?'five':''}" role="group" aria-label="Summary">${QUICK.map(q=>{const n=pool.filter(q.test).length; return `<button class="stat" data-quick="${q.id}" style="--sc:${q.c}" ${!n&&q.id!=='open'?'disabled':''}><span class="s-top"><i class="s-ic" aria-hidden="true">${ICON[q.ic]}</i><b>${n}</b></span><span>${q.label}</span></button>`}).join('')}${billItems.length?`<button class="stat" data-open="item:${esc(billItems[0].id)}" style="--sc:#ff9500"><span class="s-top"><i class="s-ic" aria-hidden="true">${ICON.bills}</i><b>${billsDue}</b></span><span>Bills due in 30 days</span></button>`:''}</div>
    <div class="home-grid">
      <section class="panel" aria-labelledby="cuH"><div class="panel-h"><h2 id="cuH">Coming up</h2><span class="caption">Tasks due in ${TASK_DAYS} days · bills and collection dates in ${HOME_DAYS}</span></div>
        ${up.length ? `<div class="list-rows">${up.map(u=>{const dl=dueLabel(u.date); return `<button class="lrow" data-open="${u.kind}:${esc(u.kind==='task'?u.task.id:u.item.id)}"><span class="t">${u.kind==='task'?bangHTML(u.task.priority):''}${esc(u.title)}</span><span class="m"><i style="--c:${itemColor(u.item)}"></i>${esc(u.item.name)}${u.what?' · '+esc(u.what):''}</span><span class="r ${dl.cls}">${esc(dl.t)}</span></button>`}).join('')}</div>`
          : `<div class="empty-state">Nothing due soon. Give tasks a due date, or tick “Show on Home” on a date field in a collection.</div>`}
      </section>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        ${trackers.length?`<section aria-labelledby="trH"><div class="panel-h"><h2 id="trH">Trackers</h2></div><div class="tr-cards">${trackers.map(t=>{const pts=(t.points||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)); const last=pts[pts.length-1]; return `<a class="tr-card" href="#i-${esc(t.id)}" style="text-decoration:none;color:inherit"><span class="caption">${esc(t.name)}</span><span class="v">${last?(t.unit==='$'?'$'+fmtNum(last.value,t.decimals):fmtNum(last.value,t.decimals)+`<small>${esc(t.unit||'')}</small>`):'—'}</span><span class="caption">${last?'Since '+esc(dateLabel(last.date)):'No entries yet'}</span>${pts.length>1?`<svg viewBox="0 0 200 36" preserveAspectRatio="none" aria-hidden="true"><path d="${sparkPath(pts.slice(-24),200,36,t.step)}" fill="none" stroke="${itemColor(t)}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`:''}</a>`}).join('')}</div></section>`:''}
        <section class="panel" aria-labelledby="reH"><div class="panel-h"><h2 id="reH">Recently edited</h2></div>
          <div class="list-rows">${recent.map(i=>`<a class="lrow" href="#i-${esc(i.id)}" style="text-decoration:none;color:inherit"><span class="t">${esc(i.name||'Untitled')}</span><span class="m"><i style="--c:${itemColor(i)}"></i>${TYPES[i.type].label}${folderById(i.folderId)?' · '+esc(folderById(i.folderId).name):''}</span><span class="r">${i.updated?esc(shortDate(i.updated)):''}</span></a>`).join('')}</div></section>
      </div>
    </div></div>`;
}

/* ----- All tasks (across every Kanban) ----- */
const PRIO = {high:{label:'High',short:'High'},med:{label:'Medium',short:'Medium'},low:{label:'Low',short:'Low'}};
const PRANK = {high:0,med:1,low:2,'':3};
const DEFAULT_FLAGS = [{id:'waiting',label:'Waiting on someone',color:'amber',who:true},{id:'blocked',label:'Blocked',color:'red'},{id:'hold',label:'On hold',color:'slate'},{id:'decision',label:'Needs decision',color:'violet'}];
const flags = () => S.flags || DEFAULT_FLAGS;
const flagOf = id => flags().find(f=>f.id===id);
/* Priority = signal bars (1 low, 2 medium, 3 high); count carries the meaning, colour backs it up. */
const PLEVEL = {low:1, med:2, high:3};
const prioIcon = p => { const n=PLEVEL[p]||0; return `<svg class="pbars p-${p||'none'}" viewBox="0 0 14 12" aria-hidden="true">${[0,1,2].map(i=>`<rect x="${i*5}" y="${8-i*4}" width="3.4" height="${4+i*4}" rx="1" ${i<n?'':'class="off"'}/>`).join('')}</svg>`; };
const bangHTML = p => PRIO[p] ? `<span class="prio p-${p}" role="img" aria-label="${PRIO[p].label} priority" title="${PRIO[p].label} priority">${prioIcon(p)}</span>` : '';
const FLAG_SHORT = {waiting:'Waiting', blocked:'Blocked', hold:'On hold', decision:'Needs decision'};
const flagShort = f => FLAG_SHORT[f.id] || f.label;
/* one-line chip: short flag name plus who, cut off with … if long */
/* A task shows the most serious flag among its own flag and its open subtasks' flags. */
const FLAG_ORDER = ['blocked','waiting','decision','hold'];
const flagRank = id => { const i = FLAG_ORDER.indexOf(id); return i>=0 ? i : FLAG_ORDER.length + Math.max(0, flags().findIndex(f=>f.id===id)); };
function effFlag(t){
  let best = flagOf(t.flag) ? {flag:t.flag, who:t.flagWho||'', from:null} : null;
  if(t.col!=='done') for(const c of (t.checklist||[])) if(!c.done && flagOf(c.flag) && (!best || flagRank(c.flag) < flagRank(best.flag))) best = {flag:c.flag, who:c.flagWho||'', from:c};
  return best;
}
/* Flags that take a detail: Waiting asks who, Blocked and On hold ask why. */
const FLAG_ASK = {waiting:'Who?', blocked:'Why?', hold:'Why?', decision:'Why?'};
const flagAsk = f => !f ? '' : (FLAG_ASK[f.id] || (f.who ? 'Who?' : ''));
const flagAskLabel = f => flagAsk(f)==='Who?' ? 'Waiting on' : 'Reason';
const chipHTML = (t, cls='') => { const e=effFlag(t); const f=e&&flagOf(e.flag); if(!f) return ''; const who = flagAsk(f) && e.who ? e.who : '';
  return `<span class="chip ${cls}" style="--fc:${colorOf(f.color)}" title="${esc(f.label)}${who?' · '+esc(who):''}${e.from?' (subtask: '+esc(e.from.text)+')':''}">${esc(flagShort(f))}${who?` · ${esc(who)}`:''}</span>`; };
const byDue = (a,b) => (a.due||'9999').localeCompare(b.due||'9999');
function taskRow(t){
  const b = itemById(t.boardId); const d = t.due ? dueLabel(t.due) : null; const col = {upcoming:'To Do',todo:'To Do',doing:'In Progress',done:'Done',backburner:'Backburner'}[t.col];
  return `<button class="lrow" data-open="task:${esc(t.id)}"><span class="t">${bangHTML(t.priority)}${esc(t.title||'Untitled')}${chipHTML(t)}</span><span class="m"><i style="--c:${itemColor(b)}"></i>${esc(b?.name||'')} · <span class="status ${t.col}">${col}</span></span><span class="r ${d?d.cls:''}">${d?esc(d.t):''}</span></button>`;
}
const doneYear = t => t.doneAt ? new Date(t.doneAt).getFullYear() : CUR_YEAR;
/* ----- Kanban item: Board / List / Archive of its stacks ----- */
function renderKanban(k, root){
  const V = S.tasksView; const mode = V.mode || 'board';
  const stacks = stacksOf(k.id);
  const ids = new Set(stacks.map(b=>b.id));
  [...V.boards].forEach(id=>{ if(!ids.has(id)) V.boards.delete(id); });
  const shown = stacks.filter(b=>V.boards.size===0 || V.boards.has(b.id));
  const pool = S.tasks.filter(t=>ids.has(t.boardId) && t.col!=='done' && (V.bb || t.col!=='backburner') && (V.boards.size===0 || V.boards.has(t.boardId)));
  const q = QUICK.find(x=>x.id===V.quick) || QUICK[0];
  /* Board · List · Archive tabs and the Add stack button keep the same place in every view */
  const seg = `<div class="seg kb-tabs" role="group" aria-label="View">${[['board','Board'],['list','List'],['archive','Archive']].map(([m,l])=>`<button data-mode="${m}" aria-pressed="${mode===m}">${l}</button>`).join('')}</div>`;
  /* three filter groups: Show (quick filters) · Stacks · Include (Done, Backburner) */
  const groups = mode==='archive' ? '' : `<div class="fgroups">
    <div class="fgroup" role="group" aria-label="Show"><span class="fg-l">Show</span>${QUICK.map(x=>{const n=pool.filter(x.test).length, on=V.quick===x.id; return `<button class="chip-btn q" data-quick="${x.id}" aria-pressed="${on}" ${!n&&!on&&x.id!=='open'?'disabled':''}>${esc(x.label)} <b>${n}</b></button>`}).join('')}</div>
    <div class="fgroup" role="group" aria-label="Stacks"><span class="fg-l">Stacks</span><button class="chip-btn" data-fb="" aria-pressed="${V.boards.size===0}">All</button>${stacks.map(b=>`<button class="chip-btn" data-fb="${esc(b.id)}" aria-pressed="${V.boards.has(b.id)}">${esc(b.name)}</button>`).join('')}<button class="chip-btn add-stack" data-act="add-stack" title="Add a stack">${ICON.plus}Stack</button></div>
    <div class="fgroup" role="group" aria-label="Include"><span class="fg-l">Include</span><button class="chip-btn tog" data-act="done" aria-pressed="${S.showDone && V.quick==='open'}" ${V.quick==='open'?'':'disabled title="Done is hidden while a filter is on"'}>Done</button><button class="chip-btn tog" data-act="bb" aria-pressed="${V.bb}">Backburner</button></div>
  </div>`;
  /* one row: the filter groups, then Board · List · Archive at the right end (they never move between views) */
  const tabs = `<div class="kb-bar">${mode==='archive'?'<div class="fgroups"></div>':groups}${seg}</div>`;
  if(mode==='archive'){ root.innerHTML = `<div class="kb">${tabs}<div id="kbArch"></div></div>`; return renderArchive($('#kbArch'), stacksOf(k.id)); }
  if(!stacks.length){ root.innerHTML = `<div class="kb">${tabs}<div class="panel empty-state"><b>No stacks yet</b>A stack is a set of To Do, In Progress and Done columns, for example Home or Work. <button class="pill" data-act="add-stack" style="margin-top:12px">${ICON.plus} Add a stack</button></div></div>`; return; }
  if(mode==='board'){
    root.innerHTML = `<div class="kb tasks-board">${tabs}${shown.length ? '<div id="lanesRoot"></div>' : `<div class="panel empty-state">Pick a stack above.</div>`}</div>`;
    if(shown.length) TYPE_VIEWS.kanban.lanes(shown, $('#lanesRoot'), {bb:V.bb, done:S.showDone, test: V.quick==='open' ? null : q.test});
    return;
  }
  const list = pool.filter(q.test);
  const tie = (a,b) => byDue(a,b) || (a.updated||'').localeCompare(b.updated||'');
  let gs;
  if(V.sort==='priority'){ list.sort((a,b)=>(PRANK[a.priority||'']-PRANK[b.priority||''])||tie(a,b)); gs=['high','med','low',''].map(p=>({title:p?PRIO[p].label+' priority':'No priority', bang:p, items:list.filter(t=>(t.priority||'')===p)})); }
  else if(V.sort==='board'){ list.sort((a,b)=>(PRANK[a.priority||'']-PRANK[b.priority||''])||tie(a,b)); gs=stacks.map(b=>({title:b.name, items:list.filter(t=>t.boardId===b.id)})); }
  else if(V.sort==='due'){ list.sort((a,b)=>byDue(a,b)||(PRANK[a.priority||'']-PRANK[b.priority||''])); gs=[{title:'By due date', items:list}]; }
  else { list.sort((a,b)=>(b.updated||'').localeCompare(a.updated||'')); gs=[{title:'Recently updated', items:list}]; }
  gs = gs.filter(g=>g.items.length);
  root.innerHTML = `<div class="kb">${tabs}
    <div class="toolbar"><span class="lbl" id="sLbl">Sort</span><div class="seg" role="group" aria-labelledby="sLbl">${[['priority','Priority'],['due','Due date'],['board','Stack'],['updated','Recently updated']].map(([m,l])=>`<button data-sort="${m}" aria-pressed="${V.sort===m}">${l}</button>`).join('')}</div></div>
    ${gs.length ? gs.map(g=>`<section class="panel"><div class="panel-h"><h2>${g.bang?bangHTML(g.bang):''}${esc(g.title)}</h2><span class="caption">${g.items.length}</span></div><div class="list-rows">${g.items.map(taskRow).join('')}</div></section>`).join('')
      : `<div class="panel empty-state">${pool.length?'Nothing matches these filters.':'No open tasks. Nice work.'}</div>`}
  </div>`;
}
function kanbanClick(e, k){
  const V = S.tasksView;
  const md = e.target.closest('[data-mode]'); if(md){ V.mode=md.dataset.mode; ls.set('lo.tasksMode', md.dataset.mode); render(true); restoreFocus(`[data-mode="${md.dataset.mode}"]`); return true; }
  const so = e.target.closest('[data-sort]'); if(so && !e.target.closest('.tbl')){ V.sort=so.dataset.sort; ls.set('lo.sort',so.dataset.sort); render(true); return true; }
  const fb = e.target.closest('[data-fb]'); if(fb){ const id=fb.dataset.fb, B=V.boards; if(!id) B.clear(); else B.has(id)?B.delete(id):B.add(id); render(true); return true; }
  if(e.target.closest('[data-act="bb"]')){ V.bb=!V.bb; render(true); return true; }
  if(e.target.closest('[data-act="done"]')){ toggleShowDone(); return true; }
  if(e.target.closest('[data-act="add-stack"]')){ addStack(k, e.target.closest('[data-act]')); return true; }
  const sm = e.target.closest('[data-act="stack-menu"]');
  if(sm){ const st = itemById(sm.dataset.sid); if(st) openMenu(sm, [{label:'Rename…', value:'rename'}, {sep:true}, {label:'Remove stack…', value:'del', danger:true}], async v => {
      if(v==='rename'){ const n = await promptModal({title:'Rename stack', label:'Name', value:st.name, opener:sm}); if(n){ docPatch('items', st.id, {name:n}); render(true); } }
      if(v==='del') removeStack(st, sm); }, 'Stack options'); return true; }
  const yr = e.target.closest('[data-year]'); if(yr){ S.archiveYear=+yr.dataset.year; render(true); return true; }
  return false;
}

/* ----- Archive (finished tasks by year) ----- */
function renderArchive(c, stacks){
  const ids = new Set(stacks.map(s=>s.id));
  const done = S.tasks.filter(t=>t.col==='done' && ids.has(t.boardId));
  const years = [...new Set([CUR_YEAR, ...done.map(doneYear)])].sort((a,b)=>b-a);
  if(!S.archiveYear || !years.includes(S.archiveYear)) S.archiveYear = years[0];
  const items = done.filter(t=>doneYear(t)===S.archiveYear).sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||''));
  const months = [];
  items.forEach(t=>{ const m = t.doneAt ? MONTH[new Date(t.doneAt).getMonth()] : 'Undated'; let g=months.find(x=>x.m===m); if(!g){g={m,items:[]}; months.push(g)} g.items.push(t); });
  c.innerHTML = `<p class="sub" style="margin:0 0 12px">${S.archiveYear===CUR_YEAR?`Done tasks stay on the board until 1 January, then they live here under ${CUR_YEAR}.`:`Open a task and change its status to bring it back to the board.`}</p>
    <div class="seg" role="group" aria-label="Year" style="margin-bottom:14px">${years.map(y=>`<button data-year="${y}" aria-pressed="${y===S.archiveYear}">${y} · ${done.filter(t=>doneYear(t)===y).length}</button>`).join('')}</div>
    ${months.length ? months.map(g=>`<section class="panel"><div class="panel-h"><h2>${esc(g.m)}</h2><span class="caption">${g.items.length}</span></div><div class="list-rows">${g.items.map(t=>{const b=itemById(t.boardId); return `<button class="lrow" data-open="task:${esc(t.id)}"><span class="t">${esc(t.title)}</span><span class="m">${esc(b?.name||'')}</span><span class="r" style="color:var(--up)">${t.doneAt?esc(shortDate(t.doneAt)):''}</span></button>`}).join('')}</div></section>`).join('')
      : `<div class="panel empty-state">No finished tasks for ${S.archiveYear} yet.</div>`}`;
}

/* ----- Search across everything ----- */
function snippet(text, q){ const i=text.toLowerCase().indexOf(q); if(i<0) return ''; const s=Math.max(0,i-40); return (s?'…':'')+text.slice(s, i+q.length+60).replace(/\s+/g,' ')+(i+q.length+60<text.length?'…':''); }
function renderSearch(c){
  const q = S.q.trim().toLowerCase();
  const res = [];
  for(const it of S.items){
    const top = topOf(it);
    if((it.name||'').toLowerCase().includes(q)) res.push({k:'item', it:top, t:it.name, m:isTop(it) ? TYPES[it.type].label : top.name+' · '+TYPES[it.type].label});
    if(it.type==='note' && (it.body||'').toLowerCase().includes(q)) res.push({k:'item', it:top, t:top.name, m:snippet(it.body,q)});
    if(it.type==='checklist') (it.entries||[]).filter(e=>e.text.toLowerCase().includes(q)).forEach(e=>res.push({k:'item', it:top, t:e.text, m:top.name+' · checklist item'}));
    if(it.type==='bills') (it.bills||[]).filter(b=>[b.asset,b.category,b.institution,b.ref,b.notes].join(' ').toLowerCase().includes(q)).forEach(b=>res.push({k:'item', it, t:[b.category,b.asset].filter(Boolean).join(' · '), m:it.name+' · '+(b.institution||'')}));
    if(it.type==='tracker') (it.points||[]).filter(p=>(p.note||'').toLowerCase().includes(q)).forEach(p=>res.push({k:'item', it, t:p.note, m:it.name+' · '+dateLabel(p.date)}));
  }
  for(const t of S.tasks){ const hay=[t.title,t.notes,t.flagWho,...(t.checklist||[]).map(c=>c.text),...(t.log||[]).map(l=>l.text)].join(' ').toLowerCase(); if(hay.includes(q)){ const b=itemById(t.boardId); if(b) res.push({k:'task', t, it:b}); } }
  for(const r of S.rows){ const it=itemById(r.itemId); if(!it) continue; const vals=Object.values(r.values||{}).map(v=>String(v)); if(vals.join(' ').toLowerCase().includes(q)){ const tf=(it.fields||[]).find(f=>f.type==='text'); res.push({k:'row', it:topOf(it), r, t:(tf&&r.values?.[tf.id])||'Row', m:topOf(it).name}); } }
  const seen = new Set(); const uniq = res.filter(x=>{ const key=x.k+(x.t?.id||'')+(x.it?.id||'')+(x.r?.id||'')+(typeof x.t==='string'?x.t:''); if(seen.has(key)) return false; seen.add(key); return true; });
  c.innerHTML = `<div class="wrap narrow"><div><p class="eyebrow">Search</p><h1 class="big">“${esc(S.q.trim())}”</h1><p class="sub">${plural(uniq.length,'result')} across items, tasks, rows and notes. Press Esc to clear.</p></div>
    ${uniq.length?`<section class="panel"><div class="list-rows">${uniq.slice(0,80).map(x=> x.k==='task'
      ? `<button class="lrow" data-open="task:${esc(x.t.id)}"><span class="t">${esc(x.t.title)}${chipHTML(x.t)}</span><span class="m"><i style="--c:${itemColor(x.it)}"></i>${esc(x.it.name)} · Task</span></button>`
      : `<a class="lrow" href="#i-${esc(x.it.id)}" style="text-decoration:none;color:inherit"><span class="t">${esc(x.t||'Untitled')}</span><span class="m"><i style="--c:${itemColor(x.it)}"></i>${esc(x.m||'')}</span></a>`).join('')}</div></section>`
      : `<div class="panel empty-state">No matches. Try a shorter word.</div>`}</div>`;
}

/* ---------- content events (core views + delegate to type views) ---------- */
const content = $('#content');
content.addEventListener('click', e => {
  if(S.q && e.target.closest('a.lrow')){ S.q=''; $('#q').value=''; requestAnimationFrame(()=>render(true)); return; }   // a search result: leave search (even for the page already open)
  const it = currentItem(); const V = it && TYPE_VIEWS[it.type];
  const op = e.target.closest('[data-open]');
  if(op){ const [k,id]=op.dataset.open.split(':'); if(k==='task') TYPE_VIEWS.kanban.openSheet(id, op); else go('i-'+id); return; }
  const qk = e.target.closest('[data-quick]');
  if(qk){ const onK = it?.type==='kanban'; S.tasksView.quick = (onK && S.tasksView.quick===qk.dataset.quick) ? 'open' : qk.dataset.quick; if(onK && S.tasksView.mode==='archive') S.tasksView.mode='board';
    if(!onK){ const k=itemsOf(i=>i.type==='kanban')[0]; if(k) go('i-'+k.id); } else render(true); return; }
  if(it?.type==='kanban' && kanbanClick(e, it)) return;
  if(V) V.click?.(e, it);
});
content.addEventListener('input', e => { const it=currentItem(); if(it) TYPE_VIEWS[it.type]?.input?.(e, it); });
content.addEventListener('change', e => {
  const it = currentItem(); if(!it) return;
  if(e.target.id==='itemTitle'){ const v=e.target.value.trim()||'Untitled'; if(v!==it.name){ docPatch('items', it.id, {name:v}); renderSide(); renderBar(); } return; }
  TYPE_VIEWS[it.type]?.change?.(e, it);
});
content.addEventListener('keydown', e => {
  const it = currentItem();
  if(e.target.id==='itemTitle' && e.key==='Enter'){ e.preventDefault(); e.target.blur(); return; }
  if(it) TYPE_VIEWS[it.type]?.keydown?.(e, it);
});

/* ---------- sidebar events ---------- */
$('#side').addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if(!a) { if(e.target.closest('.nav-item')) document.body.classList.remove('side-open'); return; }
  const act = a.dataset.act;
  if(act==='fold'){ const id=a.dataset.fid; S.collapsed.has(id)?S.collapsed.delete(id):S.collapsed.add(id); ls.set('lo.collapsed', JSON.stringify([...S.collapsed])); renderSide(); restoreFocus(`[data-act="fold"][data-fid="${CSS.escape(id)}"]`); return; }
  if(act==='new-item') return openNewItem({opener:a});
  if(act==='new-folder') return newFolder(a);
  if(act==='folder-menu') return folderMenu(a, a.dataset.fid);
  if(act==='item-menu'){ e.preventDefault(); return itemMenu(a, itemById(a.dataset.iid)); }
  if(act==='app-menu') return appMenu(a);
});
$('#q').addEventListener('input', e => { S.q = e.target.value; render(true); });
$('#q').addEventListener('keydown', e => { if(e.key==='Escape'){ e.stopPropagation(); e.target.value=''; S.q=''; render(true); e.target.blur(); } if(e.key==='Enter') document.body.classList.remove('side-open'); });
$('#sideToggle').addEventListener('click', () => {
  if(matchMedia('(max-width:860px)').matches) document.body.classList.toggle('side-open');
  else { document.body.classList.toggle('side-collapsed'); ls.set('lo.sideCollapsed', document.body.classList.contains('side-collapsed')?'1':'0'); }
});
$('#sideScrim').addEventListener('click', () => document.body.classList.remove('side-open'));
$('#fab').addEventListener('click', () => document.body.classList.toggle('side-open'));
/* What's new: hover the version on desktop, tap it on a phone */
(() => {
  const btn = $('#verBtn'); if(!btn) return; let pop = null, t = null;
  const close = () => { pop?.remove(); pop = null; btn.setAttribute('aria-expanded','false'); };
  const open = () => {
    if(pop) return; const list = Array.isArray(CHANGELOG) ? CHANGELOG : [];
    pop = document.createElement('div'); pop.className = 'chlog'; pop.setAttribute('role','dialog'); pop.setAttribute('aria-label','What\'s new');
    pop.innerHTML = `<h3>What's new</h3>` + list.slice(0,3).map(v => `<section><h4>${esc(v.v)} <span>${esc(v.d)}</span></h4><ul>${v.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></section>`).join('');
    document.body.appendChild(pop); const r = btn.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
    btn.setAttribute('aria-expanded','true');
    pop.addEventListener('mouseenter', () => clearTimeout(t)); pop.addEventListener('mouseleave', () => { t = setTimeout(close, 250); });
  };
  let quiet = false;   // focus we set ourselves (after Esc) shouldn't reopen it
  if(!TOUCH){ btn.addEventListener('mouseenter', () => { clearTimeout(t); open(); }); btn.addEventListener('mouseleave', () => { t = setTimeout(close, 250); }); btn.addEventListener('focus', () => { if(!quiet) open(); }); btn.addEventListener('blur', () => { t = setTimeout(close, 250); }); }
  btn.addEventListener('click', e => { e.stopPropagation(); pop ? close() : open(); });
  document.addEventListener('click', e => { if(pop && !pop.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape' && pop){ close(); quiet = true; btn.focus(); setTimeout(() => { quiet = false; }, 0); } });
})();
/* keep the menu button's label right however the menu was opened or closed */
new MutationObserver(() => { const open = document.body.classList.contains('side-open'), f = $('#fab'); f.setAttribute('aria-expanded', open); f.setAttribute('aria-label', open ? 'Close menu' : 'Menu'); f.title = open ? 'Close menu' : 'Menu'; }).observe(document.body, {attributes:true, attributeFilter:['class']});
/* No zooming: block pinch (Safari gesture events), double-tap zoom (touch-action) and ctrl+wheel zoom. */
/* Safari keeps a page's zoom, and older builds let it auto-zoom into small text boxes. Pinching is blocked only at
   100%, so a zoomed-in page can always be pinched back out; and the page snaps back to 100% whenever it finds itself zoomed. */
const isZoomed = () => (window.visualViewport?.scale || 1) > 1.01;
['gesturestart','gesturechange'].forEach(ev => document.addEventListener(ev, e => { if(!isZoomed() && !(ev==='gesturechange' && e.scale<1)) e.preventDefault(); }, {passive:false}));
function resetZoom(){
  const wait = 2000 - (Date.now() - (resetZoom.last||0));   // at most one attempt every 2 s, so it can't loop if Safari ignores it
  if(wait > 0){ clearTimeout(resetZoom.t); resetZoom.t = setTimeout(resetZoom, wait); return; }
  if(!isZoomed() || window.__recentFocusOut?.() || document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
  const m = document.querySelector('meta[name=viewport]'); if(!m) return;
  const base = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  resetZoom.last = Date.now();
  m.content = base.replace('initial-scale=1','initial-scale=1.0,minimum-scale=1'); setTimeout(() => { m.content = base; }, 60);
}
window.visualViewport?.addEventListener('resize', () => { clearTimeout(resetZoom.t); resetZoom.t = setTimeout(resetZoom, 250); });
document.addEventListener('focusout', () => setTimeout(resetZoom, 800));   // after the keyboard has finished closing
window.addEventListener('pageshow', () => setTimeout(resetZoom, 100));
setTimeout(resetZoom, 300);
document.addEventListener('touchmove', e => { if((e.touches.length>1 && !isZoomed()) || S.dragging) e.preventDefault(); }, {passive:false});
document.addEventListener('wheel', e => { if(e.ctrlKey) e.preventDefault(); }, {passive:false});
(() => { let m = document.querySelector('meta[name=viewport]'); if(!m){ m=document.createElement('meta'); m.name='viewport'; document.head.appendChild(m); } m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'; })();

async function newFolder(opener){
  const name = await promptModal({title:'New folder', label:'Name', placeholder:'e.g. Finance, Travel, Health', action:'Create folder', opener});
  if(!name) return;
  docSet('folders', {id:uid(), name, order:S.folders.length, created:nowIso(), updated:nowIso()});
  render(true); toast('Folder “'+name+'” created');
}
function folderMenu(anchor, fid){
  const f = folderById(fid); if(!f) return;
  const fs = sortedFolders(); const i = fs.findIndex(x=>x.id===fid);
  openMenu(anchor, [
    {label:'New item here…', value:'new'}, {label:'Rename…', value:'rename'},
    ...(i>0?[{label:'Move up', value:'up'}]:[]), ...(i<fs.length-1?[{label:'Move down', value:'down'}]:[]),
    {sep:true}, {label:'Delete folder…', value:'del', danger:true}
  ], async v => {
    if(v==='new') return openNewItem({folderId:fid, opener:anchor});
    if(v==='rename'){ const n = await promptModal({title:'Rename folder', label:'Name', value:f.name, opener:anchor}); if(n){ docPatch('folders', fid, {name:n}); render(true); } }
    if(v==='up'||v==='down'){ const j = v==='up'?i-1:i+1; const other=fs[j]; const a=f.order??i, b=other.order??j; docPatch('folders', fid, {order:b===a?j:b}); docPatch('folders', other.id, {order:a===b?i:a}); render(true); }
    if(v==='del'){
      const its = itemsIn(fid);
      const ok = await confirmModal({title:`Delete “${f.name}”?`, body: its.length ? `Its ${plural(its.length,'item')} will move to Unfiled. Nothing inside is deleted.` : 'The folder is empty.', action:'Delete folder', opener:anchor});
      if(!ok) return;
      const snap = clone(f); const moved = its.map(x=>x.id);
      its.forEach(x=>docPatch('items', x.id, {folderId:''})); docDel('folders', fid); render(true);
      toast('Folder deleted', () => { docSet('folders', snap); moved.forEach(id=>docPatch('items', id, {folderId:fid})); });
    }
  }, 'Folder options');
}
function appMenu(anchor){
  const theme = ls.get('lo.theme','system');
  openMenu(anchor, [
    {label:'New item…', value:'new', ...(TOUCH?{}:{kbd:'N'})},
    {sep:true}, {head:'Appearance'},
    {label:'Match system', value:'t-system', checked:theme==='system'}, {label:'Light', value:'t-light', checked:theme==='light'}, {label:'Dark', value:'t-dark', checked:theme==='dark'},
    {sep:true}, {label:'Status flags…', value:'flags'}, {label:'Export…', value:'export'}, {label:'Import…', value:'import'}, ...(ls.get('lo.preImport','')?[{label:'Undo last import…', value:'undoimport'}]:[]), ...(Store.demo?[{label:'Reset demo data', value:'reset'}]:[]), ...(TOUCH?[]:[{label:'Keyboard shortcuts', value:'keys', kbd:'?'}]),
    {sep:true}, {head:bkLastLabel()}, {head:'Version '+APP_VERSION},
  ], v => {
    if(v==='new') openNewItem({opener:anchor});
    if(v==='folder') newFolder(anchor);
    if(v.startsWith('t-')){ setTheme(v.slice(2)); }
    if(v==='flags') TYPE_VIEWS.kanban.openFlagsModal(anchor);
    if(v==='export') openExport(anchor);
    if(v==='import') openImport(anchor);
    if(v==='undoimport') bkUndoLast();
    if(v==='reset') Store.db.reset();
    if(v==='keys') openKeys(anchor);
  }, 'Life Organiser options');
}
function setTheme(t){ ls.set('lo.theme', t); if(t==='system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
/* ----- item options (right-click an item in the sidebar, or its ••• on touch) ----- */
function itemMenu(anchor, it){
  if(!it) return;
  openMenu(anchor, [
    {label:'Rename…', value:'rename'},
    {label:'Move to folder…', value:'move'},
    ...(it.type==='kanban'?[{label:'Add stack…', value:'stack'}, {label:'Status flags…', value:'flags'}]:[]),
    ...(it.type==='tracker'?[{label:'Tracker settings…', value:'tsettings'}]:[]),
    {sep:true}, {label:'Delete…', value:'del', danger:true}
  ], async v => {
    if(v==='rename'){ const n = await promptModal({title:'Rename', label:'Name', value:it.name||'', opener:anchor}); if(n){ docPatch('items', it.id, {name:n}); render(true); } }
    if(v==='move') openMenu(anchor, [{label:'No folder', value:'', checked:!it.folderId}, ...sortedFolders().map(f=>({label:f.name, value:f.id, checked:it.folderId===f.id}))], fid => { docPatch('items', it.id, {folderId:fid, order:itemsOf(i=>TYPE_GROUP[i.type] && (i.folderId||'')===fid).length}); render(true); toast('Moved to '+(folderById(fid)?.name||'No folder')); }, 'Move to folder');
    if(v==='stack') addStack(it, anchor);
    if(v==='flags') TYPE_VIEWS.kanban.openFlagsModal(anchor);
    if(v==='tsettings') TYPE_VIEWS.tracker.settingsModal(it, anchor);
    if(v==='del') deleteItem(it, anchor);
  }, 'Item options');
}
function folderMenu(anchor, fid){
  const f = folderById(fid); if(!f) return;
  openMenu(anchor, [
    {label:'New page here…', value:'new'}, {label:'Rename…', value:'rename'},
    {sep:true}, {label:'Delete folder…', value:'del', danger:true}
  ], async v => {
    if(v==='new') return openNewItem({folderId:fid, type:'page', opener:anchor});
    if(v==='rename'){ const n = await promptModal({title:'Rename folder', label:'Name', value:f.name, opener:anchor}); if(n){ docPatch('folders', fid, {name:n}); render(true); } }
    if(v==='del'){
      const its = S.items.filter(i=>isTop(i) && i.folderId===fid);
      const ok = await confirmModal({title:`Delete “${f.name}”?`, body: its.length ? `Its ${plural(its.length,'page')} will move out of the folder. Nothing inside is deleted.` : 'The folder is empty.', action:'Delete folder', opener:anchor});
      if(!ok) return;
      const snap = clone(f); const moved = its.map(x=>x.id);
      its.forEach(x=>docPatch('items', x.id, {folderId:''})); docDel('folders', fid); render(true);
      toast('Folder deleted', () => { docSet('folders', snap); moved.forEach(id=>docPatch('items', id, {folderId:fid})); });
    }
  }, 'Folder options');
}
async function addStack(k, opener){
  const n = await promptModal({title:'Add stack', label:'Name', placeholder:'e.g. Work', action:'Add', opener});
  if(!n) return;
  docSet('items', {id:uid(), type:'stack', parent:k.id, name:n, order:stacksOf(k.id).length, created:nowIso(), updated:nowIso()});
  render(true); toast('Added stack “'+n+'”');
}
async function removeStack(st, opener){
  const kids = S.tasks.filter(t=>t.boardId===st.id);
  const ok = await confirmModal({title:`Remove “${st.name}”?`, body:`This removes the stack${kids.length?' and its '+plural(kids.length,'task'):''}. You can undo for a few seconds.`, action:'Remove stack', opener});
  if(!ok) return;
  const snap = clone(st), ks = clone(kids);
  kids.forEach(t=>docDel('tasks', t.id)); docDel('items', st.id); render(true);
  toast('Removed “'+st.name+'”', () => { docSet('items', snap); ks.forEach(t=>docSet('tasks', t)); });
}
function colourModal(it, opener){
  let col = it.color || TYPES[it.type].color;
  const m = openModal(`<h2 id="mTitle">Colour</h2><div class="swatches" role="group" aria-label="Colour">${Object.entries(COLORS).map(([k,v])=>`<button class="sw" data-k="${k}" style="--c:${v}" aria-label="${k}" aria-pressed="${k===col}"></button>`).join('')}</div><div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">Save</button></div>`, {opener});
  m.onclick = e => { const sw=e.target.closest('.sw'); if(sw){ col=sw.dataset.k; $$('.sw',m).forEach(s=>s.setAttribute('aria-pressed', s===sw)); return; } const b=e.target.closest('[data-x]'); if(!b) return; closeModal(); if(b.dataset.x==='yes'){ docPatch('items', it.id, {color:col}); render(true); } };
}
async function deleteItem(it, opener){
  const parts = it.type==='kanban' ? stacksOf(it.id) : it.type==='page' ? blocksOf(it.id) : [];
  const tasks = it.type==='kanban' ? S.tasks.filter(t=>parts.some(p=>p.id===t.boardId)) : [];
  const rows = S.rows.filter(r=>r.itemId===it.id || parts.some(p=>p.id===r.itemId));
  const what = it.type==='kanban' ? plural(parts.length,'stack')+' and '+plural(tasks.length,'task') : it.type==='page' ? plural(parts.length,'block') : it.type==='tracker' ? plural((it.points||[]).length,'entry').replace('entrys','entries') : it.type==='bills' ? plural((it.bills||[]).length,'bill') : '';
  const ok = await confirmModal({title:`Delete “${it.name}”?`, body:`This deletes the ${TYPES[it.type].label.toLowerCase()}${what?' and its '+what:''}. You can undo for a few seconds.`, action:'Delete', opener});
  if(!ok) return;
  const snap = clone(it), ps = clone(parts), ts = clone(tasks), rs = clone(rows);
  ts.forEach(t=>docDel('tasks', t.id)); rs.forEach(r=>docDel('rows', r.id)); ps.forEach(p=>docDel('items', p.id)); docDel('items', it.id);
  if(S.route.id===it.id) go('home'); else render(true);
  toast('Deleted “'+it.name+'”', () => { docSet('items', snap); ps.forEach(p=>docSet('items', p)); ts.forEach(t=>docSet('tasks', t)); rs.forEach(r=>docSet('rows', r)); });
}

/* 1.0.0-beta.19, once: old Kanban boards become stacks inside one "Kanban"; every old note, checklist and table
   becomes a Page holding it as its first block. Edit dates are kept. */
function migrate19(){
  S.migrated19 = true;
  const keep = it => ({updated: it.updated || nowIso()});
  const boards = S.items.filter(i=>i.type==='kanban' && !i.container);
  if(boards.length){
    let k = S.items.find(i=>i.type==='kanban' && i.container);
    if(!k){ k = {id:uid(), type:'kanban', container:true, name:'Kanban', folderId:'', order:-1, created:nowIso(), updated:nowIso()}; docSet('items', k); }
    boards.sort((a,b)=>(a.order??0)-(b.order??0)).forEach((b,i)=>docPatch('items', b.id, {type:'stack', parent:k.id, order:i, folderId:'', hidden:false, ...keep(b)}));
  }
  S.items.filter(i=>['note','checklist','collection'].includes(i.type) && !i.parent).forEach(it => {
    const p = {id:uid(), type:'page', name:it.name||'Untitled', folderId:it.folderId||'', order:it.order??0, created:it.created||nowIso(), updated:it.updated||nowIso()};
    docSet('items', p); docPatch('items', it.id, {parent:p.id, order:0, folderId:'', ...keep(it)});
  });
}

/* beta.20: any item can sit in any folder, so items without a folder become one ordered list: the custom items keep
   their place above the pages, as the menu showed them before. Runs once (every top-level item then carries nav:1). */
function migrateNav20(){
  const top = S.items.filter(i=>isTop(i) && TYPE_GROUP[i.type]);
  if(!top.some(i=>!i.nav)) return;
  const rank = i => TYPE_GROUP[i.type]==='custom' ? 0 : 1;
  const lists = {}; top.forEach(i=>{ const f = i.folderId && folderById(i.folderId) ? i.folderId : ''; (lists[f] ||= []).push(i); });
  Object.values(lists).forEach(l => l.sort((a,b)=>rank(a)-rank(b) || byOrder(a,b)).forEach((i,n) => docPatch('items', i.id, {order:n, nav:1, updated:i.updated||nowIso()})));
}
/* ----- New item: always starts blank ----- */
function buildItem(type, name, folderId, parent){
  const base = {id:uid(), type, name, folderId:parent?'':(folderId||''), order: parent ? blocksOf(parent).length : itemsOf(i=>TYPE_GROUP[i.type] && (i.folderId||'')===(folderId||'')).length, ...(parent?{}:{nav:1}), created:nowIso(), updated:nowIso()};
  if(parent) base.parent = parent;
  if(type==='kanban') base.container = true;
  if(type==='note') base.body = '';
  if(type==='collection') Object.assign(base, TYPE_VIEWS.collection.template('blank'));
  if(type==='tracker') Object.assign(base, {unit:'', decimals:1, step:false, points:[]});
  if(type==='bills') base.bills = [];
  if(type==='checklist') base.entries = [];
  return base;
}
function openNewItem({folderId, type='page', opener}={}){
  let t = TYPES[type] && !TYPES[type].part ? type : 'page';
  let fid = folderId ?? (currentItem()?.folderId || '');
  const draw = () => {
    const nameVal = $('#niName')?.value || '';
    const tile = ([k,v]) => `<button class="type-opt" data-type="${k}" aria-pressed="${k===t}"><span class="ti" aria-hidden="true">${ICON[k]}</span><b>${v.label}</b><span>${esc(v.desc)}</span></button>`;
    const m = openModal(`<h2 id="mTitle">New item</h2>
      <label class="field"><span class="lbl">Name</span><input class="txt-in" id="niName" value="${esc(nameVal)}" placeholder="e.g. Home Loan Rate, Japan Trip" maxlength="80" autofocus></label>
      <div class="field"><span class="lbl" id="tyL">Type</span><div class="type-grid" role="group" aria-labelledby="tyL">${tile(['page', TYPES.page]).replace('class="type-opt"','class="type-opt wide"')}${Object.entries(TYPES).filter(([k,v])=>!v.part && k!=='page').map(tile).join('')}</div></div>
      ${S.folders.length?`<div class="field"><span class="lbl">Folder</span><button class="pop wide" id="niFolder" aria-haspopup="menu" aria-expanded="false"><span class="lbl-t">${esc(folderById(fid)?.name||'No folder')}</span>${ICON.chev}</button></div>`:''}
      <div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">Create ${TYPES[t].label.toLowerCase()}</button></div>`, {opener, wide:true});
    m.onclick = e => {
      const ty = e.target.closest('[data-type]'); if(ty){ t=ty.dataset.type; draw(); focusName(); return; }
      const fb = e.target.closest('#niFolder'); if(fb){ openMenu(fb, [{label:'No folder', value:'', checked:!fid}, ...sortedFolders().map(f=>({label:f.name, value:f.id, checked:fid===f.id}))], v=>{ fid=v; fb.querySelector('.lbl-t').textContent = folderById(v)?.name||'No folder'; }, 'Folder'); return; }
      const b = e.target.closest('[data-x]'); if(!b) return;
      if(b.dataset.x==='no') return closeModal();
      create();
    };
    m.onkeydown = e => { if(e.key==='Enter' && e.target.id==='niName'){ e.preventDefault(); create(); } };
  };
  const focusName = (sel) => requestAnimationFrame(()=>{ const n=$('#niName'); if(n){ n.focus(); if(sel) n.select(); else n.setSelectionRange(n.value.length, n.value.length); } });
  const create = () => {
    const name = $('#niName').value.trim() || 'Untitled '+TYPES[t].label.toLowerCase();
    const it = buildItem(t, name, fid);
    docSet('items', it);
    if(t==='kanban') docSet('items', {id:uid(), type:'stack', parent:it.id, name:'Tasks', order:0, created:nowIso(), updated:nowIso()});
    closeModal(); go('i-'+it.id);
  };
  draw(); focusName(true);
}

/* ----- touch gestures (phone) -----
   Swipe sideways anywhere to move the board. Screen edges are left to the browser. The menu opens from the floating button. */
(() => {
  const narrow = () => matchMedia('(max-width:860px)').matches;
  const side = $('#side');
  let g = null;
  const hScroller = el => { for(let n=el; n && n!==document.body; n=n.parentElement){ if(n.scrollWidth>n.clientWidth+2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return n; } return null; };
  const boardScroller = () => $('#content [data-hs]');
  function snapPoints(sc){ const r=sc.getBoundingClientRect(); const first=sc.querySelector('.col'); if(!first) return [0]; const row=first.parentElement; return $$(':scope > .col', row).map(el=>Math.max(0, Math.min(el.getBoundingClientRect().left - r.left + sc.scrollLeft - (parseFloat(getComputedStyle(sc).paddingLeft)||0), sc.scrollWidth-sc.clientWidth))); }
  document.addEventListener('touchstart', e => {
    g = null;
    if(e.touches.length!==1 || S.dragging || window.__sheetOpen || modalOpen() || menuEl) return;
    const t = e.touches[0], el = e.target;
    if(el.closest('input,textarea,select,[contenteditable="true"],.menu')) return;
    if(t.clientX < 24 || t.clientX > innerWidth-24) return;   // leave the screen edges to the browser's back / forward swipe
    const isOpen = document.body.classList.contains('side-open');
    g = {x0:t.clientX, y0:t.clientY, t0:Date.now(), axis:null, el, isOpen,
         own: hScroller(el), board: boardScroller(), mode:null};
    if(g.own === side) g.own = null;
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if(!g || S.dragging) { if(g && S.dragging) g=null; return; }
    const t = e.touches[0], dx = t.clientX-g.x0, dy = t.clientY-g.y0;
    if(!g.axis){ if(Math.abs(dx)<10 && Math.abs(dy)<10) return; g.axis = Math.abs(dx) > Math.abs(dy)*1.2 ? 'x' : 'y'; if(g.axis==='y'){ g=null; return; }
      const nw = narrow();
      if(g.isOpen) g.mode=null;
      else if(g.own && g.own!==g.board) g.mode=null;     // other sideways scrollers (filter chips, tables) scroll natively
      else if(g.board){ g.mode='board'; g.sl=g.board.scrollLeft; g.board.style.scrollSnapType='none'; }
      if(!g.mode){ g=null; return; }
    }
    if(g.mode==='board') g.board.scrollLeft = g.sl - dx;
    g.dx = dx; g.lastX = t.clientX; g.lastT = Date.now();
  }, {passive:true});
  function end(){
    if(!g || !g.mode){ g=null; return; }
    const dx = g.dx||0, dt = Math.max(1, Date.now()-g.t0), fast = Math.abs(dx)/dt > .45;
    if(g.mode==='board'){
      const sc = g.board, pts = snapPoints(sc), cur = sc.scrollLeft;
      let i = pts.reduce((bi,p,j)=>Math.abs(p-cur)<Math.abs(pts[bi]-cur)?j:bi, 0);
      if(fast || Math.abs(dx)>40){ const startI = pts.reduce((bi,p,j)=>Math.abs(p-g.sl)<Math.abs(pts[bi]-g.sl)?j:bi, 0); i = Math.max(0, Math.min(pts.length-1, startI + (dx<0?1:-1))); }
      sc.scrollTo({left:pts[i]??cur, behavior:RM?'auto':'smooth'});
      setTimeout(()=>{ sc.style.scrollSnapType=''; }, 420);
    }
    g = null;
  }
  document.addEventListener('touchend', end, {passive:true});
  document.addEventListener('touchcancel', end, {passive:true});
})();

/* ----- shortcuts ----- */
function openKeys(opener){
  const m = openModal(`<h2 id="mTitle">Keyboard shortcuts</h2>
    <p class="keys-h">Anywhere</p>
    <dl class="keys"><dt><kbd>/</kbd> or <kbd>⌘</kbd><kbd>K</kbd></dt><dd>Search everything</dd><dt><kbd>N</kbd></dt><dd>New task, row, entry or checklist item, depending on the page</dd><dt><kbd>⇧</kbd><kbd>N</kbd></dt><dd>New item</dd><dt><kbd>H</kbd> · <kbd>T</kbd></dt><dd>Home · All tasks</dd><dt><kbd>[</kbd></dt><dd>Show or hide the sidebar</dd><dt><kbd>Esc</kbd></dt><dd>Close a window or menu, clear search</dd></dl>
    <p class="keys-h">Kanban</p>
    <dl class="keys"><dt><kbd>Enter</kbd></dt><dd>Open the focused card</dd><dt><kbd>⌥</kbd> <kbd>←</kbd> <kbd>→</kbd></dt><dd>Move the card to the previous or next column</dd><dt><kbd>⌥</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Move the card up or down</dd></dl>
    <p class="note">On Windows use <kbd>Ctrl</kbd> for <kbd>⌘</kbd> and <kbd>Alt</kbd> for <kbd>⌥</kbd>.</p>
    <div class="row-end"><button class="pill" data-x>Done</button></div>`, {opener});
  m.onclick = e => { if(e.target.closest('[data-x]')) closeModal(); };
}
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){
    if(menuEl){ closeMenu(true); return; }
    if(modalOpen()){ closeModal(); return; }
    if(window.__sheetOpen){ TYPE_VIEWS.kanban.closeSheet(); return; }
    if(document.body.classList.contains('side-open')){ document.body.classList.remove('side-open'); return; }
    if(S.q){ S.q=''; $('#q').value=''; render(true); return; }
    return;
  }
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); if(!modalOpen() && !window.__sheetOpen){ if(matchMedia('(max-width:860px)').matches) document.body.classList.add('side-open'); $('#q').focus(); $('#q').select(); } return; }
  const tg = e.target; const typing = tg.closest && tg.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]');
  if(typing || e.metaKey || e.ctrlKey || e.altKey || modalOpen() || window.__sheetOpen || menuEl) return;
  if(e.key==='/'){ e.preventDefault(); if(matchMedia('(max-width:860px)').matches) document.body.classList.add('side-open'); $('#q').focus(); return; }
  if(e.key==='?'){ e.preventDefault(); openKeys(null); return; }
  if(e.key==='N'){ e.preventDefault(); openNewItem({}); return; }
  if(e.key==='n'){ e.preventDefault(); const it=currentItem(); if(it && TYPE_VIEWS[it.type].newShortcut) TYPE_VIEWS[it.type].newShortcut(it); else openNewItem({}); return; }
  if(e.key==='h'){ go('home'); return; }
  if(e.key==='t'){ go('tasks'); return; }
  if(e.key==='['){ $('#sideToggle').click(); return; }
});
$('#scrim').addEventListener('click', () => { if(modalOpen()) closeModal(); else if(window.__sheetOpen) TYPE_VIEWS.kanban.closeSheet(); });

/* ---------- boot ---------- */
async function start(){
  setTheme(ls.get('lo.theme','system'));
  if(ls.get('lo.sideCollapsed')==='1' && !matchMedia('(max-width:860px)').matches) document.body.classList.add('side-collapsed');
  S.route = parseHash();
  setBackgroundInert();
  render(true);
  if(!(await Store.connect())){
    S.loaded = {folders:true, items:true, tasks:true, rows:true};
    $('#content').innerHTML = `<div class="wrap"><div class="notice">Your organiser couldn’t load here. Open this page in Claude while signed in, so it can sync between your phone and computer.</div></div>`;
    renderSide(); return;
  }
  if(Store.demo){ const c=$('#demoChip'); if(c) c.hidden=false; }
  const slow = setTimeout(()=>toast('Still connecting… your items will appear when the connection comes through.'), 10000);
  const onErr = e => { clearTimeout(slow); toast(e?.code==='revoked' ? 'Access to this organiser was removed.' : 'Lost the connection. Reload the page to reconnect.', null, true); };
  const hold = {}; // keep local copies of docs being typed into so incoming snapshots don't overwrite them
  for(const col of ['folders','items','tasks','rows']){
    Store.watch(col, docs => {
      clearTimeout(slow);
      if(col==='items' && window.__typingItem){ const i=docs.findIndex(d=>d.id===window.__typingItem); const local=itemById(window.__typingItem); if(i>-1 && local) docs[i]=local; }
      if(col==='tasks' && window.__typingTask){ const i=docs.findIndex(d=>d.id===window.__typingTask); const local=S.tasks.find(t=>t.id===window.__typingTask); if(i>-1 && local) docs[i]=local; }
      S[col] = docs; S.loaded[col] = true;
      if(col==='items' && !S.migrated19){ migrate19(); migrateNav20(); }
      if(col==='tasks') docs.filter(t=>t.col==='upcoming').forEach(t=>docPatch('tasks', t.id, {col:'todo'}));   // Upcoming column retired in 1.0.0-beta.13
      render(); refreshOverlays();
      if(col==='tasks' && !S.nudgeSet){ S.nudgeSet=true; setTimeout(bkNudge, 4000); }
    }, onErr);
  }
  Store.watchDoc('meta/settings', d => { S.flags = Array.isArray(d?.flags) ? d.flags : null; render(); refreshOverlays(); }, onErr);
}
