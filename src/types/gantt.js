/* ============================================================
   Gantt chart — its own item type: sections of tasks drawn as bars on a timeline.
   Data (kept compatible with the Kanban, so the two can be merged later by re-parenting):
     item      {type:'gantt', name, folderId, ...}
     section   items doc {type:'gsection', parent:ganttId, name, order, pal?}      (like a Kanban stack)
     task      `tasks` doc {id, boardId:sectionId, title, start, due, notes, priority, col:'todo'|'doing'|'done', checklist, log, pos,
                            created, updated, doneAt?} plus Gantt-only {deps:[taskId…] (finish-to-start predecessors), progress:0-100, milestone:bool}
   Everything that counts Kanban tasks skips tasks whose boardId is a gsection (see isGanttTask in core.js).
   Layout: one scroller holds the sticky header, a sticky left table (Name, Start, Due, Days) and the timeline, so both
   panes scroll vertically together. Desktop: mouse drags (bars, ends, dependency dots, empty rows to create a bar).
   Phone: press and hold a bar, then drag; tap opens the task window, double-tap the menu.
   ============================================================ */
TYPE_VIEWS.gantt = (() => {
  const DAY_MS = 864e5;
  const pad2 = n => String(n).padStart(2, '0');
  const dn = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m-1, d) / DAY_MS); };
  const iso = n => { const d = new Date(n * DAY_MS); return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); };
  const ud = n => new Date(n * DAY_MS);
  const dow = n => (ud(n).getUTCDay() + 6) % 7;   // Monday = 0
  const isoWeek = n => { const d = ud(n), wd = (d.getUTCDay() + 6) % 7;
    const th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd + 3)), y1 = new Date(Date.UTC(th.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((th - y1) / DAY_MS - 3 + ((y1.getUTCDay() + 6) % 7)) / 7); };
  const phone = () => matchMedia('(max-width:860px)').matches;
  const K = () => TYPE_VIEWS.kanban;
  const byPos = (a, b) => (a.pos ?? 0) - (b.pos ?? 0) || (a.created || '').localeCompare(b.created || '');
  const taskOf = id => S.tasks.find(x => x.id===id);
  const STATUS = ['todo', 'doing', 'done'];
  const STATUS_NAME = {todo:'To do', doing:'In progress', done:'Done'};
  /* zoom presets: pixels per day. Header style follows the pixels per day, so Auto fit can use any value in between. */
  const ZOOMS = {week:{label:'Week', dw:[38, 34]}, month:{label:'Month', dw:[17, 15]}, quarter:{label:'Quarter', dw:[5, 4.5]}, year:{label:'Year', dw:[1.7, 1.6]}};
  const ZKEYS = Object.keys(ZOOMS);
  const SEC_PALS = ['blue', 'green', 'lav', 'coral', 'peach', 'pink'];
  const EXTEND = 182;   // days added when you scroll near either end of the chart
  const lsGet = (k, d) => ls.get(k, d);
  let collapsed; try{ collapsed = new Set(JSON.parse(lsGet('lo.gcCollapsed', '[]'))); }catch(e){ collapsed = new Set(); }
  const st = {
    zoom: ZOOMS[lsGet('lo.gcZoom', 'month')] ? lsGet('lo.gcZoom', 'month') : 'month', fit:null,
    grid: lsGet('lo.gcGrid', '1') !== '0', gw: +lsGet('lo.gcGw', 0) || 0,
    sel:null, selDep:null, reveal:null,
  };
  const views = {};   // per Gantt: {lo, hi, ax (day at the left edge of the timeline, fractional), sy}
  let G = null;       // geometry of the last draw
  let suppressClick = false, tap = null, drag = null, th = null, modelNow = null;

  /* ---------- measuring ---------- */
  let ctx2d = null;
  function textW(s){
    if(!ctx2d){ try{ ctx2d = document.createElement('canvas').getContext('2d'); }catch(e){} }
    if(!ctx2d) return s.length * 7;
    ctx2d.font = '500 12.5px ' + getComputedStyle(document.body).fontFamily;
    return ctx2d.measureText(s).width;
  }
  const rowH = () => TOUCH ? 44 : 36, headH = () => TOUCH ? 60 : 56, barH = () => TOUCH ? 28 : 22;
  const curDw = () => st.fit ?? ZOOMS[st.zoom].dw[phone() ? 1 : 0];
  const nearZoom = dw => ZKEYS.reduce((b, k) => Math.abs(Math.log(ZOOMS[k].dw[phone() ? 1 : 0] / dw)) < Math.abs(Math.log(ZOOMS[b].dw[phone() ? 1 : 0] / dw)) ? k : b, 'month');

  /* ---------- tasks, dates ---------- */
  const span = t => { const s = t.start ? dn(t.start) : null, d = t.due ? dn(t.due) : null; if(s===null && d===null) return null;
    const a = s ?? d, b = d ?? s; return {a:Math.min(a, b), b:Math.max(a, b)}; };
  const durOf = t => { const sp = span(t); return sp ? sp.b - sp.a + 1 : null; };
  const secPal = (sec, i) => TILE_PALS.some(x => x[0]===sec.pal) ? sec.pal : SEC_PALS[i % SEC_PALS.length];
  function datesText(a, b, sep=' – '){ return a===b ? fullDate(iso(a)) : dateRange(iso(a), iso(b), sep); }
  function accName(t){
    const sp = span(t), parts = [t.title || 'Untitled', STATUS_NAME[t.col] || 'To do'];
    parts.push(sp ? (t.milestone ? 'milestone, ' + fullDate(iso(sp.a)) : datesText(sp.a, sp.b, ' to ')) : 'no dates');
    if((t.progress || 0) > 0 && !t.milestone) parts.push(t.progress + '% complete');
    const n = (t.deps || []).filter(id => taskOf(id)).length; if(n) parts.push('depends on ' + plural(n, 'task'));
    if(t.due && t.col!=='done' && dayDiff(t.due) < 0) parts.push(plural(-dayDiff(t.due), 'day') + ' overdue');
    return parts.join(', ');
  }
  /* a task patch for new dates (day numbers); a milestone is always one day */
  function datePatch(t, a, b){
    if(t.milestone && a!==null && b!==null) a = b = b;
    return {start: a===null ? '' : iso(a), due: b===null ? '' : iso(b)};
  }
  function commitDates(t, a, b, how){
    const before = {start:t.start || '', due:t.due || ''}, p = datePatch(t, a, b);
    if(p.start===before.start && p.due===before.due) return false;
    docPatch('tasks', t.id, p); touchItem(gidOf(t)); render(true);
    toast(`${how}: ${a===null ? 'no dates' : datesText(a, b)}`, () => docPatch('tasks', t.id, before));
    return true;
  }
  const gidOf = t => itemById(t.boardId)?.parent;
  const ganttOf = () => { const it = currentItem(); return it?.type==='gantt' ? it : null; };
  const allTasks = g => { const ids = new Set(sectionsOf(g.id).map(s => s.id)); return S.tasks.filter(t => ids.has(t.boardId)); };
  const openCount = g => allTasks(g).filter(t => t.col!=='done').length;
  /* dependency checks */
  function reaches(fromId, targetId, seen=new Set()){   // is targetId a (transitive) predecessor of fromId?
    if(seen.has(fromId)) return false; seen.add(fromId);
    for(const p of (taskOf(fromId)?.deps || [])){ if(p===targetId || reaches(p, targetId, seen)) return true; }
    return false;
  }
  function addDep(pred, succ){
    if(pred.id===succ.id) return false;
    if((succ.deps || []).includes(pred.id)){ toast('Those two are already linked'); return false; }
    if(reaches(pred.id, succ.id)){ toast('That would make a loop, so it wasn’t linked', null, true); return false; }
    const before = clone(succ.deps || []);
    docPatch('tasks', succ.id, {deps:[...before, pred.id]}); render(true);
    toast(`Linked: “${pred.title || 'Untitled'}” then “${succ.title || 'Untitled'}”`, () => docPatch('tasks', succ.id, {deps:before}));
    return true;
  }
  function removeDep(predId, succId, quiet){
    const succ = taskOf(succId); if(!succ) return; const before = clone(succ.deps || []);
    docPatch('tasks', succId, {deps:before.filter(x => x!==predId)}); st.selDep = null; render(true);
    if(!quiet) toast('Link removed', () => docPatch('tasks', succId, {deps:before}));
  }
  const violated = (pred, succ) => { const a = span(pred), b = span(succ); return !!(a && b && b.a <= a.b); };

  /* ---------- creating and changing tasks ---------- */
  function newTask(sec, title, x={}){
    const id = uid(), last = S.tasks.filter(t => t.boardId===sec.id).reduce((m, t) => Math.max(m, t.pos ?? 0), 0), now = nowIso();
    docSet('tasks', {id, boardId:sec.id, col:'todo', pos:last + 1024, title:(title || '').trim() || 'New task', notes:'', start:'', due:'', priority:'low', flag:'', flagWho:'',
      checklist:[], log:[], deps:[], progress:0, milestone:false, created:now, updated:now, ...x});
    touchItem(sec.parent);
    return id;
  }
  function addTaskTo(sec, title){
    const id = newTask(sec, title); st.sel = id; render(true);
    toast('Task added', () => { docDel('tasks', id); render(true); });
    return id;
  }
  function removeTask(t, opts={}){
    const snap = clone(t), succs = S.tasks.filter(x => (x.deps || []).includes(t.id)).map(x => ({id:x.id, deps:clone(x.deps)}));
    succs.forEach(x => docPatch('tasks', x.id, {deps:x.deps.filter(d => d!==t.id)}));
    docDel('tasks', t.id); if(st.sel===t.id) st.sel = null; touchItem(gidOf(snap)); render(true);
    toast('Deleted “' + (snap.title || 'Untitled') + '”', () => { docSet('tasks', snap); succs.forEach(x => docPatch('tasks', x.id, {deps:x.deps})); render(true); });
  }
  function duplicateTask(t){
    const id = uid(), now = nowIso(), sec = itemById(t.boardId);
    const siblings = S.tasks.filter(x => x.boardId===t.boardId).sort(byPos), i = siblings.findIndex(x => x.id===t.id), next = siblings[i + 1];
    const pos = next ? ((t.pos ?? 0) + (next.pos ?? 0)) / 2 : (t.pos ?? 0) + 1024;
    docSet('tasks', {...clone(t), id, title:(t.title || 'Untitled') + ' copy', pos, checklist:(t.checklist || []).map(c => ({...c, id:uid()})), log:[], created:now, updated:now, doneAt:''});
    touchItem(sec?.parent); st.sel = id; render(true);
    toast('Duplicated', () => { docDel('tasks', id); render(true); });
  }
  function cycleStatus(t){
    const next = STATUS[(STATUS.indexOf(t.col) + 1) % 3] || 'todo', before = {col:t.col, progress:t.progress || 0, doneAt:t.doneAt || ''};
    const p = {col:next};
    if(next==='done'){ p.progress = 100; p.doneAt = nowIso(); } else if(t.col==='done'){ p.doneAt = ''; if(next==='todo') p.progress = 0; else if((t.progress || 0)===100) p.progress = 50; }
    docPatch('tasks', t.id, p); render(true);
    toast(`${t.title || 'Task'}: ${STATUS_NAME[next]}`, () => docPatch('tasks', t.id, before));
  }
  function setProgress(t, v){
    v = Math.max(0, Math.min(100, Math.round(v))); if(v===(t.progress || 0)) return;
    const before = {progress:t.progress || 0, col:t.col, doneAt:t.doneAt || ''}, p = {progress:v};
    if(v===100 && t.col!=='done'){ p.col = 'done'; p.doneAt = nowIso(); } else if(v>0 && v<100 && t.col==='todo') p.col = 'doing'; else if(v<100 && t.col==='done'){ p.col = 'doing'; p.doneAt = ''; }
    docPatch('tasks', t.id, p); render(true);
    toast('Progress ' + v + '%', () => docPatch('tasks', t.id, before));
  }
  function toggleMilestone(t){
    const before = {milestone:!!t.milestone, start:t.start || '', due:t.due || ''}, now = !t.milestone, p = {milestone:now};
    if(now){ const d = t.due || t.start; if(d){ p.start = d; p.due = d; } }
    docPatch('tasks', t.id, p); render(true);
    toast(now ? 'Now a milestone' : 'Milestone off', () => docPatch('tasks', t.id, before));
  }
  function renameTask(t, v){
    v = (v || '').replace(/\s+/g, ' ').trim(); if(!v || v===t.title) return;
    const before = t.title; docPatch('tasks', t.id, {title:v}); render(true); toast('Renamed', () => docPatch('tasks', t.id, {title:before}));
  }
  function setDateField(t, field, value){
    let a = t.start ? dn(t.start) : null, b = t.due ? dn(t.due) : null, v = value ? dn(value) : null;
    if(field==='start'){ a = v; if(a!==null && (b===null || b < a)) b = t.milestone || b===null || b < a ? a : b; if(a===null && t.milestone) b = null; }
    else { b = v; if(b!==null && (a===null || a > b)) a = t.milestone || a===null || a > b ? b : a; if(b===null && t.milestone) a = null; }
    if(t.milestone && a!==null && b!==null) a = b = field==='start' ? a : b;
    commitDates(t, a, b, field==='start' ? 'Start' : 'Due date');
  }
  function setDuration(t, n){
    const sp = span(t); n = Math.max(1, Math.round(n)); if(!sp || t.milestone || !isFinite(n)) return;
    const a = t.start ? sp.a : sp.b - n + 1; commitDates(t, a, a + n - 1, 'Duration');
  }
  function nudge(t, dir, endOnly){
    const sp = span(t); if(!sp) return;
    let a = sp.a, b = sp.b;
    if(endOnly && !t.milestone){ b = Math.max(a, b + dir); } else { a += dir; b += dir; }
    commitDates(t, a, b, endOnly ? 'Due date' : 'Moved');
  }

  /* ---------- sections ---------- */
  async function addSection(g, opener){
    const n = await promptModal({title:'Add section', label:'Name', placeholder:'e.g. Build', action:'Add', opener}); if(!n) return;
    const id = uid(); docSet('items', {id, type:'gsection', parent:g.id, name:n, order:sectionsOf(g.id).length, created:nowIso(), updated:nowIso()});
    touchItem(g.id); collapsed.delete(id); render(true); toast('Added section “' + n + '”', () => { docDel('items', id); render(true); });
  }
  function moveSection(sec, d){
    const sib = sectionsOf(sec.parent), i = sib.indexOf(sec), j = i + d; if(i<0 || j<0 || j>=sib.length) return;
    const before = sib.map(s => ({id:s.id, order:s.order ?? 0}));
    [sib[i], sib[j]] = [sib[j], sib[i]]; sib.forEach((s, k) => { if(s.order!==k) docPatch('items', s.id, {order:k}); }); render(true);
    toast('Section moved', () => { before.forEach(x => docPatch('items', x.id, {order:x.order})); render(true); });
  }
  async function deleteSection(sec, opener){
    const kids = S.tasks.filter(t => t.boardId===sec.id), others = sectionsOf(sec.parent).filter(s => s.id!==sec.id);
    const snap = clone(sec), ks = clone(kids);
    const doDelete = (moveTo) => {
      const moved = [];
      if(moveTo){ let pos = S.tasks.filter(t => t.boardId===moveTo.id).reduce((m, t) => Math.max(m, t.pos ?? 0), 0); kids.slice().sort(byPos).forEach(t => { moved.push({id:t.id, boardId:t.boardId, pos:t.pos ?? 0}); pos += 1024; docPatch('tasks', t.id, {boardId:moveTo.id, pos}); }); }
      else kids.forEach(t => { docDel('tasks', t.id); S.tasks.filter(x => (x.deps || []).includes(t.id)).forEach(x => docPatch('tasks', x.id, {deps:x.deps.filter(d => d!==t.id)})); });
      docDel('items', sec.id); touchItem(sec.parent); render(true);
      toast(moveTo ? `Section removed, tasks moved to “${moveTo.name}”` : 'Deleted section “' + snap.name + '”', () => {
        docSet('items', snap);
        if(moveTo) moved.forEach(x => docPatch('tasks', x.id, {boardId:x.boardId, pos:x.pos})); else ks.forEach(t => docSet('tasks', t));
        render(true); });
    };
    if(!kids.length){ if(await confirmModal({title:`Delete “${sec.name}”?`, body:'The section is empty.', action:'Delete section', opener})) doDelete(null); return; }
    if(!others.length){ if(await confirmModal({title:`Delete “${sec.name}”?`, body:`This also deletes its ${plural(kids.length, 'task')}. You can undo for a few seconds.`, action:'Delete section', opener})) doDelete(null); return; }
    const to = others[0];
    const m = openModal(`<h2 id="mTitle">Delete “${esc(sec.name)}”?</h2><p class="note">It has ${plural(kids.length, 'task')}. Move them to “${esc(to.name)}”, or delete them with the section. You can undo for a few seconds.</p>
      <div class="row-end gc-delrow"><button class="btn" data-x="no">Cancel</button><button class="btn" data-x="move">Move tasks</button><button class="pill danger" data-x="del" autofocus>Delete tasks too</button></div>`, {opener});
    m.onclick = e => { const b = e.target.closest('[data-x]'); if(!b) return; closeModal(); if(b.dataset.x==='move') doDelete(to); if(b.dataset.x==='del') doDelete(null); };
  }

  /* ---------- menus ---------- */
  function taskMenuItems(t){
    const n = (t.deps || []).length, m = S.tasks.filter(x => (x.deps || []).includes(t.id)).length;
    return [{label:'Open', value:'open'}, {label:'Rename…', value:'rename', kbd:TOUCH ? '' : 'F2'}, {label:'Duplicate', value:'dup'},
      {label:t.milestone ? 'Milestone: turn off' : 'Make a milestone', value:'ms'},
      {label:'Add dependency…', value:'dep'},
      {label:'Remove dependencies', value:'undep', disabled:!(n + m)},
      ...(span(t) ? [{label:'Clear dates', value:'nodates'}] : []),
      {sep:true}, {label:'Delete', value:'del', danger:true}];
  }
  function taskAction(v, t, anchor){
    if(v==='open') return openSheet(t.id, anchor);
    if(v==='rename') return renamePrompt(t, anchor);
    if(v==='dup') return duplicateTask(t);
    if(v==='ms') return toggleMilestone(t);
    if(v==='dep') return pickPred(t, anchor);
    if(v==='nodates') return commitDates(t, null, null, 'Dates cleared');
    if(v==='undep'){
      const succs = S.tasks.filter(x => (x.deps || []).includes(t.id)).map(x => ({id:x.id, deps:clone(x.deps)})), mine = clone(t.deps || []);
      docPatch('tasks', t.id, {deps:[]}); succs.forEach(x => docPatch('tasks', x.id, {deps:x.deps.filter(d => d!==t.id)})); render(true);
      return toast('Dependencies removed', () => { docPatch('tasks', t.id, {deps:mine}); succs.forEach(x => docPatch('tasks', x.id, {deps:x.deps})); render(true); }); }
    if(v==='del') return removeTask(t);
  }
  async function renamePrompt(t, opener){ const n = await promptModal({title:'Rename task', label:'Name', value:t.title || '', opener}); if(n) renameTask(t, n); }
  /* choose which task this one waits for */
  function pickPred(t, anchor){
    const g = itemById(itemById(t.boardId)?.parent); if(!g) return;
    const opts = allTasks(g).filter(x => x.id!==t.id && !(t.deps || []).includes(x.id) && !reaches(x.id, t.id)).sort((a, b) => (span(a)?.a ?? 1e9) - (span(b)?.a ?? 1e9));
    if(!opts.length) return toast('No other task can be linked here');
    openMenu(anchor, [{head:'Starts after this task finishes'}, ...opts.slice(0, 40).map(x => ({label:x.title || 'Untitled', value:x.id}))], v => addDep(taskOf(v), t), 'Add dependency');
  }
  function secMenu(sec, anchor){
    const sib = sectionsOf(sec.parent), i = sib.indexOf(sec);
    openMenu(anchor, [{label:'Rename…', value:'rename'}, {label:'Add task', value:'add'}, {label:'Colour…', value:'pal'}, {label:'Move up', value:'up', disabled:i===0}, {label:'Move down', value:'down', disabled:i===sib.length-1}, {sep:true}, {label:'Delete section…', value:'del', danger:true}], async v => {
      if(v==='rename'){ const n = await promptModal({title:'Rename section', label:'Name', value:sec.name, opener:anchor}); if(n){ const b = sec.name; docPatch('items', sec.id, {name:n}); render(true); toast('Renamed', () => { docPatch('items', sec.id, {name:b}); render(true); }); } }
      if(v==='add') return addTaskUI(sec, anchor);
      if(v==='pal'){ const cur = TILE_PALS.some(x => x[0]===sec.pal) ? sec.pal : '';
        const sw = (k, name) => `<i class="sw pal-${k}" aria-hidden="true"></i><span>${esc(name)}</span>`;
        setTimeout(() => openMenu(anchor, [{head:'Section colour'}, {html:sw(SEC_PALS[i % SEC_PALS.length], 'Default'), label:'Default', value:'', checked:!cur}, {sep:true}, ...TILE_PALS.map(([k, n]) => ({html:sw(k, n), label:n, value:k, checked:cur===k}))],
          p => { const b = sec.pal || ''; docPatch('items', sec.id, {pal:p}); render(true); toast('Colour changed', () => { docPatch('items', sec.id, {pal:b}); render(true); }); }, 'Section colour', 'menu-pal'), 30); }
      if(v==='up' || v==='down') moveSection(sec, v==='up' ? -1 : 1);
      if(v==='del') deleteSection(sec, anchor);
    }, 'Section options');
  }
  const menuAt = (x, y) => ({getBoundingClientRect:() => ({left:x, right:x, top:y, bottom:y, width:0, height:0}), setAttribute(){}, focus(){}});
  function addTaskUI(sec, opener){
    if(!sec){ const g = ganttOf(); sec = g && sectionsOf(g.id)[0]; if(!sec) return; }
    collapsed.delete(sec.id); ls.set('lo.gcCollapsed', JSON.stringify([...collapsed]));
    if(TOUCH || phone()){
      promptModal({title:'New task', label:'Name', placeholder:'Task name', action:'Add', opener}).then(n => { if(n){ addTaskTo(sec, n); } });
      return;
    }
    render(true);
    requestAnimationFrame(() => { const el = document.querySelector(`.gc-addin[data-add="${CSS.escape(sec.id)}"]`); if(el){ el.focus({preventScroll:true}); el.scrollIntoView({block:'nearest'}); } });
  }

  /* ---------- the chart ---------- */
  function model(g){
    const secs = sectionsOf(g.id), rows = [], idx = {}, by = {};
    secs.forEach((sec, si) => {
      const ts = S.tasks.filter(t => t.boardId===sec.id).sort(byPos); by[sec.id] = ts;
      rows.push({k:'sec', sec, si, ts});
      if(!collapsed.has(sec.id)){ ts.forEach(t => { idx[t.id] = rows.length; rows.push({k:'task', t, sec, si}); }); rows.push({k:'add', sec, si}); }
    });
    return {secs, rows, idx, by};
  }
  const stIcon = c => c==='done' ? '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="currentColor"/><path d="m6.2 10.2 2.6 2.6 5-5.4" fill="none" stroke="var(--panel)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : c==='doing' ? '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 3.6a6.4 6.4 0 0 1 0 12.8z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  const chev = '<svg class="gc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const dateTxt = s => s ? fullDate(s) : '';

  function headerHTML(lo, hi, dw, T){
    const top = [], bot = [], stick = '';
    const monthEnd = n => { const d = ud(n); return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / DAY_MS); };
    const X = n => ((n - lo) * dw).toFixed(2);
    if(dw >= 26){            // days
      for(let n = lo; n <= hi;){ const d = ud(n), e = Math.min(hi + 1, monthEnd(n));
        top.push(`<div class="gc-ht" style="left:${X(n)}px;width:${((e - n) * dw).toFixed(2)}px"><span>${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}</span></div>`); n = e; }
      for(let n = lo; n <= hi; n++) bot.push(`<div class="gc-hb${dow(n) > 4 ? ' we' : ''}${n===T ? ' now' : ''}" style="left:${X(n)}px;width:${dw}px"><span class="gc-dw">${'MTWTFSS'[dow(n)]}</span>${ud(n).getUTCDate()}</div>`);
    } else if(dw >= 9){      // weeks
      for(let n = lo; n <= hi;){ const d = ud(n), e = Math.min(hi + 1, monthEnd(n));
        top.push(`<div class="gc-ht" style="left:${X(n)}px;width:${((e - n) * dw).toFixed(2)}px"><span>${d.getUTCFullYear()} ${MON[d.getUTCMonth()]}</span></div>`); n = e; }
      for(let n = lo; n <= hi; n += 7){ const w = 7 * dw, e = ud(n + 6);
        bot.push(`<div class="gc-hb tk" style="left:${X(n)}px;width:${w}px">${w >= 66 ? `W${isoWeek(n)} ${ud(n).getUTCDate()}-${e.getUTCDate()}` : w >= 44 ? 'W' + isoWeek(n) : ''}</div>`); }
    } else if(dw >= 3){      // quarters over months
      for(let n = lo; n <= hi;){ const d = ud(n), y = d.getUTCFullYear(), q = Math.floor(d.getUTCMonth() / 3), e = Math.min(hi + 1, Math.round(Date.UTC(y, q * 3 + 3, 1) / DAY_MS));
        top.push(`<div class="gc-ht" style="left:${X(n)}px;width:${((e - n) * dw).toFixed(2)}px"><span>${y} Q${q + 1}</span></div>`); n = e; }
      for(let n = lo; n <= hi;){ const d = ud(n), e = Math.min(hi + 1, monthEnd(n));
        bot.push(`<div class="gc-hb tk" style="left:${X(n)}px;width:${((e - n) * dw).toFixed(2)}px">${MON[d.getUTCMonth()]}</div>`); n = e; }
    } else {                 // years over months
      for(let n = lo; n <= hi;){ const d = ud(n), y = d.getUTCFullYear(), e = Math.min(hi + 1, Math.round(Date.UTC(y + 1, 0, 1) / DAY_MS));
        top.push(`<div class="gc-ht" style="left:${X(n)}px;width:${((e - n) * dw).toFixed(2)}px"><span>${y}</span></div>`); n = e; }
      for(let n = lo; n <= hi;){ const d = ud(n), e = Math.min(hi + 1, monthEnd(n)), w = (e - n) * dw;
        bot.push(`<div class="gc-hb tk" style="left:${X(n)}px;width:${w.toFixed(2)}px">${w >= 26 ? MON[d.getUTCMonth()] : w >= 12 ? MON[d.getUTCMonth()][0] : ''}</div>`); n = e; }
    }
    return `<div class="gc-htop">${top.join('')}</div><div class="gc-hbot">${bot.join('')}<i class="gc-hdot" style="left:${((T - lo) * dw + dw / 2).toFixed(2)}px"></i></div>`;
  }
  /* month boundary lines for the coarse zooms; day/week lines are a CSS gradient */
  function linesHTML(lo, hi, dw){
    if(dw >= 9) return '';
    const out = [];
    for(let n = lo; n <= hi;){ const d = ud(n), e = Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / DAY_MS); out.push(`<i style="left:${((n - lo) * dw).toFixed(2)}px"></i>`); n = e; }
    return out.join('');
  }

  function barHTML(t, sec, si, sp, T, P){
    const dw = G.dw, ms = !!t.milestone, bh = G.bh;
    const x0 = (sp.a - G.lo) * dw, x1 = (sp.b + 1 - G.lo) * dw, w = Math.max(10, x1 - x0 - 1);
    const done = t.col==='done', prog = ms ? 0 : Math.max(0, Math.min(100, t.progress || 0));
    const od = t.due && !done && dayDiff(t.due) < 0;
    const title = t.title || 'Untitled', need = textW(title) + 22;
    const inside = !ms && need <= w - 2;
    const dots = TOUCH ? '' : '<i class="gc-dot l" data-dot="l" aria-hidden="true"></i><i class="gc-dot r" data-dot="r" aria-hidden="true"></i>';
    const grips = TOUCH || ms || w < 26 ? '' : '<i class="gc-h l" aria-hidden="true"></i><i class="gc-h r" aria-hidden="true"></i>';
    if(ms){
      const cx = x0 + dw / 2;
      return `<div class="gc-bar ms${done ? ' is-done' : ''}${od ? ' od' : ''}${st.sel===t.id ? ' sel' : ''}" data-id="${esc(t.id)}" style="left:${(cx - bh / 2 - 1).toFixed(2)}px;width:${bh + 2}px" title="${esc(title + ' · ' + fullDate(iso(sp.a)))}"><span class="gc-bg"><i class="gc-dia"></i></span>${dots}<span class="gc-ol" aria-hidden="true">${esc(title)}</span></div>`;
    }
    return `<div class="gc-bar${inside ? ' in' : ''}${done ? ' is-done' : ''}${od ? ' od' : ''}${st.sel===t.id ? ' sel' : ''}" data-id="${esc(t.id)}" style="left:${x0.toFixed(2)}px;width:${w.toFixed(2)}px" title="${esc(title + ' · ' + datesText(sp.a, sp.b) + (prog ? ' · ' + prog + '%' : ''))}">`
      + `<span class="gc-bg"><i class="gc-fill" style="width:${prog}%"></i></span>${grips}${dots}${inside ? `<span class="gc-bl" aria-hidden="true">${esc(title)}</span>` : `<span class="gc-ol" aria-hidden="true">${esc(title)}</span>`}</div>`;
  }

  function rowHTML(r, i, T, P, cols, ctr){
    const {sec, si} = r, pal = secPal(sec, si), sc = `--sc:var(--${pal}-b)`;
    if(r.k==='sec'){
      const open = !collapsed.has(sec.id), ds = r.ts.map(span).filter(Boolean);
      const summ = ds.length ? (() => { const a = Math.min(...ds.map(x => x.a)), b = Math.max(...ds.map(x => x.b)); return `<i class="gc-sum" style="left:${((a - G.lo) * G.dw).toFixed(2)}px;width:${Math.max(6, (b + 1 - a) * G.dw).toFixed(2)}px"></i>`; })() : '';
      return `<div class="gc-row sec" role="row" data-srow="${esc(sec.id)}" data-sid="${esc(sec.id)}" style="${sc}" tabindex="${ctr===i ? 0 : -1}" aria-label="Section ${esc(sec.name)}, ${plural(r.ts.length, 'task')}, ${open ? 'expanded' : 'collapsed'}">
        <div class="gc-g" role="gridcell"><button class="gc-sh" data-sec="${esc(sec.id)}" aria-expanded="${open}" tabindex="-1">${chev}<i class="gc-sdot" aria-hidden="true"></i><b>${esc(sec.name)}</b><span class="gc-n">${r.ts.length}</span></button>
          <button class="gc-more" data-secmenu="${esc(sec.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(sec.name)} section options" title="Section options">${ICON.more}</button></div>
        <div class="gc-track" role="gridcell" aria-hidden="true">${summ}</div></div>`;
    }
    if(r.k==='add'){
      return `<div class="gc-row add" data-sid="${esc(sec.id)}" style="${sc}"><div class="gc-g">${TOUCH || P ? `<button class="gc-addb" data-addb="${esc(sec.id)}" tabindex="-1">${ICON.plus}<span>Add task</span></button>`
        : `<span class="gc-addic" aria-hidden="true">${ICON.plus}</span><input class="gc-addin" data-add="${esc(sec.id)}" placeholder="Add task" aria-label="Add a task to ${esc(sec.name)}" maxlength="200" enterkeyhint="done">`}</div><div class="gc-track" aria-hidden="true"></div></div>`;
    }
    const t = r.t, sp = span(t), done = t.col==='done';
    const dur = sp ? sp.b - sp.a + 1 : null, od = t.due && !done && dayDiff(t.due) < 0;
    const sel = st.sel===t.id;
    const nm = TOUCH ? `<span class="gc-nm" data-nm="${esc(t.id)}">${esc(t.title || 'Untitled')}</span>`
      : `<input class="gc-nm" data-name="${esc(t.id)}" value="${esc(t.title || '')}" placeholder="Task name" aria-label="Task name" maxlength="200" tabindex="-1" autocomplete="off">`;
    const dcell = (f, v, label) => `<label class="gc-d ${f}${od && f==='due' ? ' overdue' : ''}"><span class="gc-dt">${v ? esc(dateTxt(v)) : '<i>–</i>'}</span><input type="date" class="gc-di" data-f="${f}" value="${esc(v || '')}" aria-label="${label} of ${esc(t.title || 'task')}" tabindex="-1"></label>`;
    const cells = dcell('start', t.start, 'Start') + dcell('due', t.due, 'Due')
      + (`<span class="gc-du">${t.milestone ? '<i>◆</i>' : sp ? `<input class="gc-dn" type="number" min="1" inputmode="numeric" data-dn="${esc(t.id)}" value="${dur}" aria-label="Duration in days of ${esc(t.title || 'task')}" tabindex="-1">` : '<i>–</i>'}</span>`);
    return `<div class="gc-row task${sel ? ' sel' : ''}${done ? ' is-done' : ''}" role="row" aria-selected="${sel}" data-row="${esc(t.id)}" data-sid="${esc(sec.id)}" style="${sc}" tabindex="${ctr===i ? 0 : -1}" aria-label="${esc(accName(t))}">
      <div class="gc-g" role="gridcell">${TOUCH || P ? '' : `<span class="gc-grip" title="Drag to reorder" aria-hidden="true">${ICON.grip}</span>`}<button class="gc-st st-${t.col}" data-st="${esc(t.id)}" tabindex="-1" aria-label="${esc((t.title || 'Task') + ': ' + (STATUS_NAME[t.col] || 'To do') + '. Change status')}" title="${esc(STATUS_NAME[t.col] || 'To do')}">${stIcon(t.col)}</button>${nm}
        ${TOUCH ? '' : `<button class="gc-more" data-more="${esc(t.id)}" aria-haspopup="menu" aria-expanded="false" tabindex="-1" aria-label="${esc(t.title || 'Task')} options" title="Task options">${ICON.more}</button>`}${cells}</div>
      <div class="gc-track" role="gridcell" aria-hidden="true">${sp ? barHTML(t, sec, r.si, sp, T, P) : `<span class="gc-hint">${TOUCH ? 'Press and hold, then drag to set dates' : 'Drag here to set dates'}</span>`}</div></div>`;
  }

  /* dependency arrows: elbow paths from a bar's right end to the next bar's left end; red when the order is broken */
  function roundPath(pts, r){
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for(let i = 1; i < pts.length - 1; i++){
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1), rr = Math.min(r, l1 / 2, l2 / 2);
      if(rr < .5){ d += `L${x1},${y1}`; continue; }
      d += `L${x1 - (x1 - x0) / l1 * rr},${y1 - (y1 - y0) / l1 * rr}Q${x1},${y1} ${x1 + (x2 - x1) / l2 * rr},${y1 + (y2 - y1) / l2 * rr}`;
    }
    const e = pts[pts.length - 1]; return d + `L${e[0]},${e[1]}`;
  }
  function depsHTML(M, over={}){
    const out = [], rh = G.rh;
    const geo = t => { const o = over[t.id], sp = o || span(t); if(!sp || !(t.id in M.idx)) return null;
      const y = M.idx[t.id] * rh + rh / 2;
      if(t.milestone){ const cx = (sp.a - G.lo) * G.dw + G.dw / 2, h = G.bh / 2 + 1; return {l:cx - h, r:cx + h, y}; }
      return {l:(sp.a - G.lo) * G.dw, r:(sp.b + 1 - G.lo) * G.dw - 1, y}; };
    for(const t of S.tasks){
      if(!(t.deps || []).length || !(t.id in M.idx)) continue;
      for(const pid of t.deps){
        const p = taskOf(pid); if(!p || !(p.id in M.idx)) continue;
        const a = geo(p), b = geo(t); if(!a || !b) continue;
        const x1 = a.r, y1 = a.y, x2 = b.l, y2 = b.y, g = 11, sgn = y2 > y1 ? 1 : -1;
        const pts = x2 >= x1 + g * 2 ? [[x1, y1], [x1 + g, y1], [x1 + g, y2], [x2 - 1, y2]]
          : [[x1, y1], [x1 + g, y1], [x1 + g, y1 + sgn * rh / 2], [x2 - g, y1 + sgn * rh / 2], [x2 - g, y2], [x2 - 1, y2]];
        const key = pid + '>' + t.id, bad = violated(p, {...t, ...(over[t.id] ? {start:iso(over[t.id].a), due:iso(over[t.id].b)} : {})}) && !over[p.id] ? true : (over[t.id] || over[p.id]) ? (() => { const pa = over[p.id] || span(p), sa = over[t.id] || span(t); return !!(pa && sa && sa.a <= pa.b); })() : false;
        const d = roundPath(pts, 5);
        out.push(`<g class="gc-dep${bad ? ' bad' : ''}${st.selDep===key ? ' sel' : ''}" data-dep="${esc(key)}" tabindex="${TOUCH ? -1 : 0}" role="button" aria-label="Dependency: ${esc(p.title || 'Untitled')} then ${esc(t.title || 'Untitled')}${bad ? ', out of order' : ''}. Press Delete to remove."><path class="hit" d="${d}"/><path class="ln" d="${d}"/><path class="ah" d="M${x2 - 1},${y2}l-6,-3.6v7.2z"/></g>`);
      }
    }
    return out.join('');
  }
  function drawDeps(over){ const svg = $('.gc-deps', G.root); if(svg && modelNow) svg.innerHTML = depsHTML(modelNow, over || {}) + (svg.querySelector('.gc-tmp') ? svg.querySelector('.gc-tmp').outerHTML : ''); }

  function draw(g, root){
    const revealId = st.reveal && taskOf(st.reveal) ? st.reveal : null; st.reveal = null;   // from a search result: expand its section and select it
    if(revealId){ st.sel = revealId; collapsed.delete(taskOf(revealId).boardId); }
    const P = phone(), M = modelNow = model(g), T = dn(today()), ROW = rowH(), HEAD = headH();
    const V = views[g.id] || (views[g.id] = {ax:null, sy:0, lo:null, hi:null, sx:0});
    const dw = curDw(), boxW = Math.max(300, root.clientWidth || 600);
    const gw = !st.grid ? 0 : Math.max(P ? 140 : 220, Math.min(st.gw || (P ? 172 : boxW >= 1000 ? 500 : 440), boxW - (P ? 110 : 260)));
    const cols = gw >= 470 ? 'full' : gw >= 380 ? 'dates' : 'name';
    const dated = M.rows.filter(r => r.k==='task').map(r => span(r.t)).filter(Boolean);
    let mn = T, mx = T; dated.forEach(x => { mn = Math.min(mn, x.a); mx = Math.max(mx, x.b); });
    if(V.lo===null){ V.lo = mn - 100; V.hi = mx + 140; }
    V.lo = Math.min(V.lo, mn - 30); V.hi = Math.max(V.hi, mx + 30);
    let lo = V.lo - dow(V.lo), hi = V.hi + (6 - dow(V.hi));
    const need = Math.ceil(((boxW - gw) * 2.2) / dw);   // never narrower than about two screens
    if(hi - lo + 1 < need){ const extra = need - (hi - lo + 1); hi += Math.ceil(extra / 2); lo -= Math.ceil(extra / 2); lo -= dow(lo); hi += 6 - dow(hi); }
    V.lo = lo; V.hi = hi;
    const W = (hi - lo + 1) * dw;
    G = {g, root, lo, hi, dw, gw, W, T, rh:ROW, hh:HEAD, bh:barH(), P, cols};
    const ctr = (() => { const i = M.rows.findIndex(r => r.k==='task' && r.t.id===st.sel); return i>=0 ? i : M.rows.findIndex(r => r.k==='task' || r.k==='sec'); })();
    const rowsHTML = (() => { let out = '', open = null;
      M.rows.forEach((r, i) => {
        if(r.k==='sec'){ if(open) out += '</div>'; out += `<div class="gc-sec" data-sec-wrap="${esc(r.sec.id)}">`; open = true; }
        out += rowHTML(r, i, T, P, cols, ctr);
      }); if(open) out += '</div>'; return out; })();
    const hasAny = M.secs.length > 0;
    const zl = st.fit ? 'Custom' : ZOOMS[st.zoom].label;
    const colHead = '<span class="gc-ch d">Start</span><span class="gc-ch d">Due</span><span class="gc-ch n">Days</span>';
    root.innerHTML = `<div class="gc lm-${dw >= 26 ? 'day' : dw >= 9 ? 'week' : 'month'}${P ? ' ph' : ''}${TOUCH ? ' touch' : ''}${st.grid ? '' : ' nogrid'}" data-cols="${cols}" style="--gw:${gw}px;--dw:${dw}px;--row:${ROW}px;--hh:${HEAD}px;--w:${W}px;--bh:${G.bh}px">
      <div class="gc-tools" role="toolbar" aria-label="Gantt chart controls">
        <button class="chip-btn gc-b" data-a="today">Today</button>
        <button class="chip-btn gc-b" data-a="zoom" aria-haspopup="menu" aria-expanded="false" aria-label="Zoom: ${zl}">${zl}${ICON.chevD}</button>
        <button class="chip-btn gc-b" data-a="fit">Auto fit</button>
        <span class="gc-sp"></span>
        <button class="chip-btn gc-b gc-ib" data-a="grid" aria-pressed="${st.grid}" aria-label="Table" title="Show or hide the table">${ICON.sidebar}<span class="gc-bt">Table</span></button>
        <button class="chip-btn gc-b" data-a="addsec">${ICON.plus}Section</button>
        <button class="pill gc-b" data-a="addtask">${ICON.plus}Add task</button>
      </div>
      ${hasAny ? `<div class="gc-box">
        <div class="gc-zoomb" role="group" aria-label="Zoom"><button data-a="zout" aria-label="Zoom out" title="Zoom out">−</button><button data-a="zin" aria-label="Zoom in" title="Zoom in">+</button></div>
        ${st.grid ? `<div class="gc-split" role="separator" aria-orientation="vertical" aria-label="Resize the table" aria-valuenow="${Math.round(gw)}" tabindex="0" style="left:${gw}px"><i></i></div>` : ''}
        <div class="gc-scroll" role="grid" aria-label="Gantt chart. Up and down arrows move between rows; Enter opens a task; ${TOUCH ? 'press and hold a bar to move it' : 'Alt with left or right arrow moves the bar a day, add Shift to move the due date only'}; Delete removes the task." aria-rowcount="${M.rows.length}">
          <div class="gc-in" style="width:${gw + W}px">
            <div class="gc-head" aria-hidden="true"><div class="gc-corner"><span class="gc-ch nm">Name</span>${colHead}</div><div class="gc-hin" style="width:${W}px">${headerHTML(lo, hi, dw, T)}</div></div>
            <div class="gc-body" style="min-height:${M.rows.length * ROW}px">
              <div class="gc-lines" aria-hidden="true">${linesHTML(lo, hi, dw)}</div>
              <i class="gc-now" style="left:calc(var(--gw) + ${((T - lo) * dw + dw / 2).toFixed(2)}px)" aria-hidden="true"></i>
              <svg class="gc-deps" width="${W}" height="${M.rows.length * ROW}" aria-label="Dependencies">${depsHTML(M)}</svg>
              ${rowsHTML}
              <div class="gc-pad" aria-hidden="true"><div class="gc-g"></div></div>
            </div>
          </div>
        </div>
      </div>` : `<div class="panel empty-state"><b>No sections yet</b>A section groups tasks, like Design or Build. <button class="pill" data-a="addsec" style="margin-top:12px">${ICON.plus} Add a section</button></div>`}
    </div>`;
    const sc = G.sc = $('.gc-scroll', root);
    bind(root);
    if(!sc) return;
    for(const sec of $$('.gc-sec', sc)) Sortable.create(sec, {
      group:'gc-rows:' + g.id, draggable:'.gc-row.task', handle: TOUCH || P ? '.gc-g' : '.gc-grip', filter:'input,button.gc-st,button.gc-more,label', preventOnFilter:false, direction:'vertical', animation:RM ? 0 : 150,
      delay:320, delayOnTouchOnly:true, touchStartThreshold:6, fallbackTolerance:4, ghostClass:'gc-ghostrow', chosenClass:'gc-chosen',
      scrollFn:(dx, dy) => { if(dy) sc.scrollTop += dy; },
      onStart(){ S.dragging = true; }, onEnd(e){ S.dragging = false; suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); saveOrder(g, e); }});
    /* scroll position: kept across redraws by the day at the left edge */
    const visW = () => sc.clientWidth - gw;
    if(revealId){ const t = taskOf(revealId), sp = t && span(t); if(sp) V.ax = sp.a - visW() / 3 / dw; const i = M.idx[revealId]; if(i!==undefined) V.sy = Math.max(0, i * ROW - sc.clientHeight / 2); }
    if(V.ax===null || V.ax===undefined) V.ax = dated.length && (T - mn) * dw < visW() * .5 ? mn - 3 : T - visW() / 3 / dw;
    if(V.focus!==undefined && V.focus!==null){ V.ax = V.focus.day - V.focus.frac * visW() / dw; V.focus = null; }
    sc.scrollLeft = Math.max(0, (V.ax - lo) * dw); sc.scrollTop = V.sy || 0;
    let raf = 0;
    sc.addEventListener('scroll', () => { if(raf) return; raf = requestAnimationFrame(() => { raf = 0; if(G?.sc!==sc) return; V.ax = lo + sc.scrollLeft / dw; V.sy = sc.scrollTop; edgeCheck(g, sc); }); }, {passive:true});
    if(st.selFocus){ const el = st.selFocus; st.selFocus = null; const r = sc.querySelector(el); r?.focus({preventScroll:true}); }
  }
  function saveOrder(g, e){
    const before = {};
    const rowsOf = wrap => $$('.gc-row.task', wrap).map(r => r.dataset.row);
    const changes = [];
    for(const wrap of $$('.gc-sec', G.sc)){
      const sid = wrap.dataset.secWrap, ids = rowsOf(wrap);
      ids.forEach((id, i) => { const t = taskOf(id); if(!t) return; const pos = (i + 1) * 1024; if(t.boardId!==sid || t.pos!==pos){ before[id] = {boardId:t.boardId, pos:t.pos ?? 0}; changes.push([id, {boardId:sid, pos}]); } });
    }
    if(!changes.length){ render(true); return; }
    changes.forEach(([id, p]) => docPatch('tasks', id, p)); touchItem(g.id); render(true);
    toast('Moved', () => { Object.entries(before).forEach(([id, b]) => docPatch('tasks', id, b)); render(true); });
  }
  /* near an end of the chart: add half a year, keeping what you're looking at where it is */
  function edgeCheck(g, sc){
    const V = views[g.id]; if(!V || drag || th || S.dragging) return;
    const near = Math.max(240, sc.clientWidth * .5);
    if(sc.scrollLeft < near){ V.lo -= EXTEND; render(true); }
    else if(sc.scrollLeft + sc.clientWidth > sc.scrollWidth - near){ V.hi += EXTEND; render(true); }
  }
  const dayAtX = cx => { const r = G.sc.getBoundingClientRect(); return G.lo + Math.floor((cx - r.left - G.gw + G.sc.scrollLeft) / G.dw); };
  function scrollToDay(n, smooth, frac=1/3){
    const sc = G?.sc; if(!sc) return;
    sc.scrollTo({left:Math.max(0, (n - G.lo) * G.dw - (sc.clientWidth - G.gw) * frac), behavior: smooth && !RM ? 'smooth' : 'auto'});
  }
  function setZoom(key, dw, focus){
    const V = views[G.g.id], sc = G.sc;
    if(sc){ const frac = focus ?? .5; V.focus = {day:G.lo + (sc.scrollLeft + (sc.clientWidth - G.gw) * frac) / G.dw, frac}; }
    V.lo = V.hi = null; st.zoom = key; st.fit = dw ?? null; ls.set('lo.gcZoom', st.zoom); render(true);
  }
  function stepZoom(dir, focus){
    const P = phone() ? 1 : 0, cur = curDw(), asc = [...ZKEYS].reverse();   // year, quarter, month, week: smallest to largest
    const k = dir > 0 ? asc.find(key => ZOOMS[key].dw[P] > cur * 1.05) : [...asc].reverse().find(key => ZOOMS[key].dw[P] < cur / 1.05);
    if(!k) return;
    setZoom(k, null, focus);
  }
  function autoFit(){
    const sc = G.sc, M = modelNow; if(!sc) return;
    const ds = M.rows.filter(r => r.k==='task').map(r => span(r.t)).filter(Boolean);
    if(!ds.length) return toast('Give a task some dates first, then Auto fit shows them all');
    const a = Math.min(...ds.map(x => x.a)), b = Math.max(...ds.map(x => x.b)), n = b - a + 1;
    const vis = sc.clientWidth - G.gw - 56, dw = Math.max(1, Math.min(60, vis / n));
    const V = views[G.g.id]; V.focus = {day:a - 14 / dw, frac:0}; V.lo = V.hi = null; st.fit = dw; st.zoom = nearZoom(dw); render(true);
  }

  /* ---------- events ---------- */
  function bind(root){
    root.addEventListener('click', onClick);
    root.addEventListener('contextmenu', onContext);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKey);
    root.addEventListener('focusin', e => { const r = e.target.closest('.gc-row[data-row]'); if(r && st.sel!==r.dataset.row && !e.target.closest('.gc-bar')){ /* selection follows focus without redrawing */ $$('.gc-row.sel', root).forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-selected', 'false'); }); r.classList.add('sel'); r.setAttribute('aria-selected', 'true'); $$('.gc-bar.sel', root).forEach(b => b.classList.remove('sel')); r.querySelector('.gc-bar')?.classList.add('sel'); st.sel = r.dataset.row; } });
    if(!TOUCH){
      root.addEventListener('pointerdown', onPointerDown);
      G.sc?.addEventListener('wheel', onWheel, {passive:false});
    }
    if(TOUCH && G.sc){
      G.sc.addEventListener('touchstart', onTouchStart, {passive:true});
      G.sc.addEventListener('touchmove', onTouchMove, {passive:false});
      G.sc.addEventListener('touchend', onTouchEnd, {passive:false});
      G.sc.addEventListener('touchcancel', onTouchEnd, {passive:false});
    }
    const sp = $('.gc-split', root);
    if(sp){ sp.addEventListener('pointerdown', splitDown); sp.addEventListener('keydown', e => { if(e.key==='ArrowLeft' || e.key==='ArrowRight'){ e.preventDefault(); e.stopPropagation(); setGw(G.gw + (e.key==='ArrowRight' ? 24 : -24), true); } }); }
  }
  const selectTask = (id, keepFocus) => { if(st.sel===id) return; st.sel = id; st.selDep = null; };

  function onClick(e){
    if(suppressClick){ e.stopPropagation(); return; }
    const a = e.target.closest('[data-a]');
    if(a){ e.stopPropagation(); return toolAction(a.dataset.a, a, e); }
    const dep = e.target.closest('.gc-dep');
    if(dep){ e.stopPropagation(); st.selDep = dep.dataset.dep; st.sel = null; $$('.gc-dep.sel', G.root).forEach(x => x.classList.remove('sel')); dep.classList.add('sel'); dep.focus({preventScroll:true}); return; }
    const sh = e.target.closest('[data-sec]');
    if(sh){ e.stopPropagation(); const id = sh.dataset.sec; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); ls.set('lo.gcCollapsed', JSON.stringify([...collapsed])); render(true); restoreFocus(`[data-sec="${CSS.escape(id)}"]`); return; }
    const sm = e.target.closest('[data-secmenu]');
    if(sm){ e.stopPropagation(); const sec = itemById(sm.dataset.secmenu); if(sec) secMenu(sec, sm); return; }
    const ab = e.target.closest('[data-addb]'); if(ab){ e.stopPropagation(); addTaskUI(itemById(ab.dataset.addb), ab); return; }
    const stb = e.target.closest('[data-st]'); if(stb){ e.stopPropagation(); const t = taskOf(stb.dataset.st); if(t){ st.sel = t.id; cycleStatus(t); } return; }
    const mb = e.target.closest('[data-more]'); if(mb){ e.stopPropagation(); const t = taskOf(mb.dataset.more); if(t){ st.sel = t.id; openMenu(mb, taskMenuItems(t), v => taskAction(v, t, mb), 'Task options'); } return; }
    const di = e.target.closest('.gc-di'); if(di){ e.stopPropagation(); try{ di.showPicker?.(); }catch(err){} return; }
    if(e.target.closest('.gc-dn, .gc-addin, input[data-name]')) { const nm = e.target.closest('input[data-name]'); if(nm){ st.sel = nm.dataset.name; } return; }
    const sr = e.target.closest('.gc-row.sec'); if(sr && !e.target.closest('button')){ e.stopPropagation(); sr.querySelector('[data-sec]')?.click(); return; }
    const row = e.target.closest('.gc-row.task'); if(!row) return;
    e.stopPropagation();
    const id = row.dataset.row, t = taskOf(id); if(!t) return;
    if(st.sel!==id){ st.sel = id; st.selDep = null; $$('.gc-row.sel, .gc-bar.sel', G.root).forEach(x => { x.classList.remove('sel'); if(x.matches('.gc-row')) x.setAttribute('aria-selected', 'false'); }); row.classList.add('sel'); row.setAttribute('aria-selected', 'true'); row.querySelector('.gc-bar')?.classList.add('sel'); }
    const bar = $('.gc-bar', row);
    if(TOUCH){
      if(tap && tap.id===id){ clearTimeout(tap.timer); tap = null; const r = (e.target.closest('.gc-bar') || row).getBoundingClientRect(); const x = Math.min(Math.max(e.clientX || r.left + 12, 12), innerWidth - 12);
        openMenu(menuAt(x, r.top + 20), taskMenuItems(t), v => taskAction(v, t, bar || row), 'Task options'); return; }
      clearTimeout(tap?.timer); tap = {id, timer:setTimeout(() => { tap = null; if(row.isConnected) openSheet(id, bar || row); }, 260)}; return;
    }
    if(e.target.closest('.gc-bar, .gc-track, .gc-d, .gc-du')) openSheet(id, bar || row);
  }
  function onContext(e){
    const sec = e.target.closest('.gc-row.sec');
    if(sec){ e.preventDefault(); e.stopPropagation(); if(TOUCH) return; const s = itemById(sec.dataset.srow); if(s) secMenu(s, pointAnchor(e)); return; }
    const dep = e.target.closest('.gc-dep');
    if(dep){ e.preventDefault(); e.stopPropagation(); if(TOUCH) return; const [p, s] = dep.dataset.dep.split('>'); st.selDep = dep.dataset.dep;
      openMenu(pointAnchor(e), [{label:'Remove dependency', value:'rm', danger:true}], () => removeDep(p, s), 'Dependency'); return; }
    const row = e.target.closest('.gc-row.task'); if(!row) return;
    e.preventDefault(); e.stopPropagation(); if(TOUCH) return;
    const t = taskOf(row.dataset.row); if(!t) return;
    openMenu(pointAnchor(e), taskMenuItems(t), v => taskAction(v, t, $('.gc-bar', row) || row), 'Task options');
  }
  function onChange(e){
    const el = e.target;
    if(el.matches('input[data-name]')){ const t = taskOf(el.dataset.name); if(t){ const v = el.value.trim(); if(!v){ el.value = t.title || ''; return; } renameTask(t, v); } return; }
    if(el.matches('.gc-di')){ const t = taskOf(el.closest('.gc-row').dataset.row); if(t) setDateField(t, el.dataset.f, el.value); return; }
    if(el.matches('.gc-dn')){ const t = taskOf(el.dataset.dn); if(t) setDuration(t, +el.value); return; }
  }
  function toolAction(a, btn, e){
    const g = G.g;
    if(a==='today') return scrollToDay(G.T, true);
    if(a==='fit') return autoFit();
    if(a==='zin') return stepZoom(1);
    if(a==='zout') return stepZoom(-1);
    if(a==='zoom') return openMenu(btn, ZKEYS.map(k => ({label:ZOOMS[k].label, value:k, checked:!st.fit && st.zoom===k})), k => { setZoom(k, null); restoreFocus('[data-a="zoom"]'); }, 'Zoom');
    if(a==='grid'){ st.grid = !st.grid; ls.set('lo.gcGrid', st.grid ? '1' : '0'); render(true); restoreFocus('[data-a="grid"]'); return; }
    if(a==='addsec') return addSection(g, btn);
    if(a==='addtask'){ const sel = st.sel && taskOf(st.sel), sec = (sel && itemById(sel.boardId)) || sectionsOf(g.id)[0]; if(!sec) return addSection(g, btn); return addTaskUI(sec, btn); }
  }
  function onKey(e){
    const tg = e.target;
    if(tg.matches('.gc-addin')){
      if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); const v = tg.value.trim(), sec = itemById(tg.dataset.add); if(v && sec){ tg.value = ''; addTaskTo(sec, v); requestAnimationFrame(() => { const n = document.querySelector(`.gc-addin[data-add="${CSS.escape(sec.id)}"]`); n?.focus({preventScroll:true}); n?.scrollIntoView({block:'nearest'}); }); } }
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); tg.value = ''; tg.blur(); }
      return;
    }
    if(tg.matches('input[data-name]')){
      if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); tg.blur(); }
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); const t = taskOf(tg.dataset.name); tg.value = t?.title || ''; tg.blur(); }
      e.stopPropagation(); return;
    }
    if(tg.matches('input, textarea')){ if(e.key==='Enter' && tg.matches('.gc-dn')){ e.preventDefault(); tg.blur(); } return; }
    const dep = tg.closest('.gc-dep');
    if(dep && (e.key==='Delete' || e.key==='Backspace')){ e.preventDefault(); e.stopPropagation(); const [p, s] = dep.dataset.dep.split('>'); removeDep(p, s); return; }
    const row = tg.closest('.gc-row[tabindex]'); if(!row) return;
    const rows = $$('.gc-row.task, .gc-row.sec', G.root);
    const i = rows.indexOf(row);
    if(e.key==='ArrowDown' || e.key==='ArrowUp'){
      if(e.altKey) return;
      e.preventDefault(); e.stopPropagation(); const n = rows[i + (e.key==='ArrowDown' ? 1 : -1)]; if(!n) return;
      rows.forEach(r => r.tabIndex = -1); n.tabIndex = 0; n.focus({preventScroll:true}); n.scrollIntoView({block:'nearest'}); return; }
    if(row.classList.contains('sec')){
      const id = row.dataset.srow;
      if(e.key==='Enter' || e.key===' ' || (e.key==='ArrowRight' && collapsed.has(id)) || (e.key==='ArrowLeft' && !collapsed.has(id))){ e.preventDefault(); e.stopPropagation(); row.querySelector('[data-sec]').click(); }
      if((e.key==='Delete' || e.key==='Backspace') && tg===row){ e.preventDefault(); e.stopPropagation(); const s = itemById(id); if(s) deleteSection(s, row); }
      if(e.key==='ContextMenu' || (e.shiftKey && e.key==='F10')){ e.preventDefault(); e.stopPropagation(); const s = itemById(id); if(s) secMenu(s, row.querySelector('[data-secmenu]') || row); }
      return;
    }
    const t = taskOf(row.dataset.row); if(!t) return;
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); e.stopPropagation(); openSheet(t.id, row); return; }
    if(e.altKey && (e.key==='ArrowLeft' || e.key==='ArrowRight')){ e.preventDefault(); e.stopPropagation(); st.selFocus = `.gc-row[data-row="${CSS.escape(t.id)}"]`; nudge(t, e.key==='ArrowRight' ? 1 : -1, e.shiftKey); return; }
    if((e.key==='Delete' || e.key==='Backspace') && tg===row){ e.preventDefault(); e.stopPropagation(); const n = rows[i + 1] || rows[i - 1]; removeTask(t); if(n?.dataset.row) st.sel = n.dataset.row; st.selFocus = n?.dataset.row ? `.gc-row[data-row="${CSS.escape(n.dataset.row)}"]` : null; render(true); return; }
    if(e.key==='F2'){ e.preventDefault(); e.stopPropagation(); const nm = row.querySelector('input[data-name]'); if(nm){ nm.focus(); nm.select(); } else renamePrompt(t, row); return; }
    if(e.key==='ContextMenu' || (e.shiftKey && e.key==='F10')){ e.preventDefault(); e.stopPropagation(); const mb = row.querySelector('[data-more]'); openMenu(mb || row, taskMenuItems(t), v => taskAction(v, t, row), 'Task options'); }
  }

  /* ---------- wheel: ⌘ or Ctrl + wheel (and a trackpad pinch) zooms around the pointer ---------- */
  let wheelAcc = 0, wheelT = 0;
  function onWheel(e){
    if(!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    wheelAcc += e.deltaY; const now = performance.now();
    if(Math.abs(wheelAcc) < 40 || now - wheelT < 220) return;
    const r = G.sc.getBoundingClientRect(), frac = Math.max(0, Math.min(1, (e.clientX - r.left - G.gw) / Math.max(1, r.width - G.gw)));
    stepZoom(wheelAcc < 0 ? 1 : -1, frac); wheelAcc = 0; wheelT = now;
  }

  /* ---------- splitter ---------- */
  function setGw(w, save){
    const box = G.sc.clientWidth; w = Math.max(G.P ? 140 : 220, Math.min(w, box - (G.P ? 110 : 260)));
    st.gw = w; G.gw = w; const el = $('.gc', G.root); el.style.setProperty('--gw', w + 'px');
    const cols = w >= 470 ? 'full' : w >= 380 ? 'dates' : 'name';
    const sp = $('.gc-split', G.root); sp.style.left = w + 'px'; sp.setAttribute('aria-valuenow', Math.round(w));
    $('.gc-in', G.root).style.width = (w + G.W) + 'px';
    el.dataset.cols = cols; G.cols = cols;
    if(save) ls.set('lo.gcGw', Math.round(w));
  }
  function splitDown(e){
    if(e.button!==undefined && e.button!==0) return; e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = G.gw, el = e.currentTarget; try{ el.setPointerCapture(e.pointerId); }catch(err){}
    document.body.classList.add('no-select'); el.classList.add('on');
    const move = ev => setGw(w0 + ev.clientX - x0, false);
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); document.body.classList.remove('no-select'); el.classList.remove('on'); ls.set('lo.gcGw', Math.round(st.gw)); render(true); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  /* ---------- dragging bars ---------- */
  function tip(text, x, y){
    let el = $('#gcTip'); if(!el){ el = document.createElement('div'); el.id = 'gcTip'; el.className = 'gt-tip'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
    el.textContent = text; el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, x + 14)) + 'px'; el.style.top = Math.max(8, y - 38) + 'px';
  }
  const untip = () => $('#gcTip')?.remove();
  /* One drag controller for mouse and touch. kind: 'move' | 'start' | 'end' | 'create'. Returns {move(cx,cy), end(), cancel()} */
  function startDrag(kind, t, bar, x0, track){
    const sc = G.sc, sl0 = sc.scrollLeft, sp0 = span(t);
    const orig = bar ? bar.getAttribute('style') : '', origCls = bar ? bar.className : '';
    let a0 = sp0?.a ?? null, b0 = sp0?.b ?? null, na = a0, nb = b0, moved = false, lastX = x0, raf = 0, done = false, d0 = null;
    if(kind==='create'){ d0 = dayAtX(x0); a0 = b0 = d0; na = nb = d0; bar = document.createElement('div'); bar.className = 'gc-bar ghost'; bar.innerHTML = '<span class="gc-bg"><i class="gc-fill" style="width:0"></i></span>'; track.appendChild(bar); }
    document.body.classList.add('no-select', 'gc-dragging'); S.dragging = true; bar.classList.add('dragging');
    const place = () => {
      const o = {}; o[t.id] = {a:na, b:nb};
      if(t.milestone){ const cx = (na - G.lo) * G.dw + G.dw / 2; bar.style.left = (cx - G.bh / 2 - 1) + 'px'; }
      else { bar.style.left = ((na - G.lo) * G.dw) + 'px'; bar.style.width = Math.max(10, (nb + 1 - na) * G.dw - 1) + 'px'; }
      drawDeps(o);
    };
    const calc = cx => {
      lastX = cx;
      if(kind==='create'){ const d = dayAtX(cx); na = Math.min(d0, d); nb = Math.max(d0, d); }
      else {
        const delta = Math.round(((cx - x0) + (sc.scrollLeft - sl0)) / G.dw);
        if(kind==='move' || t.milestone){ na = a0 + delta; nb = b0 + delta; }
        else if(kind==='start'){ na = Math.min(a0 + delta, b0); nb = b0; }
        else { na = a0; nb = Math.max(b0 + delta, a0); }
      }
      place();
      tip(t.milestone ? fullDate(iso(nb)) : datesText(na, nb), cx, bar.getBoundingClientRect().top + 8);
    };
    const auto = () => { raf = 0; if(done) return; const r = sc.getBoundingClientRect(), edge = G.P ? 26 : 44; let v = 0;
      if(lastX > r.right - edge) v = Math.min(18, (lastX - (r.right - edge)) / 3); else if(lastX < r.left + G.gw + edge) v = -Math.min(18, ((r.left + G.gw + edge) - lastX) / 3);
      if(v){ sc.scrollLeft += v; calc(lastX); raf = requestAnimationFrame(auto); } };
    const ctl = {
      move(cx){ if(!moved){ if(Math.abs(cx - x0) < 3 && kind!=='create') return; moved = true; } calc(cx); if(!raf) raf = requestAnimationFrame(auto); },
      finish(){ done = true; cancelAnimationFrame(raf); document.body.classList.remove('no-select', 'gc-dragging'); S.dragging = false; untip(); bar.classList.remove('dragging'); drag = null; },
      end(){ ctl.finish();
        if(!moved){ if(kind==='create') bar.remove(); return; }
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
        if(kind==='create'){ bar.remove(); if(!commitDates(t, na, nb, 'Dates set')) render(true); return; }
        if(!commitDates(t, na, nb, kind==='move' ? 'Moved' : kind==='start' ? 'Start' : 'Due date')){ bar.setAttribute('style', orig); bar.className = origCls; render(true); } },
      cancel(){ const was = moved; ctl.finish(); if(kind==='create') bar.remove(); else { bar.setAttribute('style', orig); bar.className = origCls; }
        if(was){ suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); } render(true); },
    };
    drag = ctl; return ctl;
  }
  const escCancel = ctl => { const key = ev => { if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); document.removeEventListener('keydown', key, true); ctl.cancel(); ctl.escaped = true; } }; document.addEventListener('keydown', key, true); return () => document.removeEventListener('keydown', key, true); };

  function onPointerDown(e){
    if(e.button!==0 || drag) return;
    if(e.target.closest('input, button, .gc-split, .gc-zoomb, label')) return;
    const dep = e.target.closest('.gc-dep'); if(dep) return;
    const dot = e.target.closest('.gc-dot');
    if(dot){ e.preventDefault(); return linkDrag(e, dot); }
    const bar = e.target.closest('.gc-bar');
    if(bar){
      const t = taskOf(bar.dataset.id); if(!t) return;
      const h = e.target.closest('.gc-h'), kind = h ? (h.classList.contains('l') ? 'start' : 'end') : 'move';
      e.preventDefault(); const ctl = startDrag(kind, t, bar, e.clientX);
      return trackPointer(e, ctl, bar);
    }
    const track = e.target.closest('.gc-row.task .gc-track');
    if(track){ const t = taskOf(track.closest('.gc-row').dataset.row); if(t && !span(t)){ e.preventDefault(); const ctl = startDrag('create', t, null, e.clientX, track); return trackPointer(e, ctl, track); } }
    const hin = e.target.closest('.gc-head .gc-hin');
    if(hin){ e.preventDefault(); const sc = G.sc, x0 = e.clientX, sl0 = sc.scrollLeft; document.body.classList.add('no-select', 'gc-panning');
      const move = ev => { sc.scrollLeft = sl0 - (ev.clientX - x0); };
      const up = () => { document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', up, true); document.body.classList.remove('no-select', 'gc-panning'); };
      document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', up, true); }
  }
  function trackPointer(e, ctl, el){
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
    const off = escCancel(ctl);
    const mv = ev => ctl.move(ev.clientX);
    const clean = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); off(); };
    const up = () => { clean(); if(!ctl.escaped) ctl.end(); };
    const cancel = () => { clean(); if(!ctl.escaped) ctl.cancel(); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel);
  }
  /* drag from a bar's end dot onto another task to link them (finish to start) */
  function linkDrag(e, dot){
    const bar = dot.closest('.gc-bar'), t = taskOf(bar.dataset.id); if(!t) return;
    const side = dot.dataset.dot, svg = $('.gc-deps', G.root), M = modelNow;
    const sr = svg.getBoundingClientRect(), dr = dot.getBoundingClientRect();
    const x1 = dr.left + dr.width / 2 - sr.left, y1 = dr.top + dr.height / 2 - sr.top;
    let tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path'); tmp.setAttribute('class', 'gc-tmp'); svg.appendChild(tmp);
    document.body.classList.add('no-select', 'gc-linking'); bar.classList.add('linking'); S.dragging = true; G.root.querySelector('.gc')?.classList.add('is-linking');
    let target = null;
    const pick = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); const row = el?.closest?.('.gc-row.task'); const id = row?.dataset.row;
      $$('.gc-bar.tgt', G.root).forEach(b => b.classList.remove('tgt')); $$('.gc-row.tgt', G.root).forEach(b => b.classList.remove('tgt'));
      target = id && id!==t.id ? taskOf(id) : null;
      if(target){ (side==='r' ? !(target.deps || []).includes(t.id) && !reaches(t.id, target.id) : !(t.deps || []).includes(target.id) && !reaches(target.id, t.id)) ? (row.classList.add('tgt'), row.querySelector('.gc-bar')?.classList.add('tgt')) : row.classList.add('tgt', 'no'); } };
    const mv = ev => { const x = ev.clientX - sr.left, y = ev.clientY - sr.top; tmp.setAttribute('d', roundPath([[x1, y1], [x1 + (x > x1 ? 10 : -10), y1], [x1 + (x > x1 ? 10 : -10), y], [x, y]], 4)); pick(ev); tip(side==='r' ? 'Then…' : 'After…', ev.clientX, ev.clientY); };
    const clean = () => { document.removeEventListener('pointermove', mv, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('keydown', key, true);
      tmp.remove(); untip(); document.body.classList.remove('no-select', 'gc-linking'); bar.classList.remove('linking'); S.dragging = false; $$('.tgt', G.root).forEach(b => b.classList.remove('tgt', 'no')); G.root.querySelector('.gc')?.classList.remove('is-linking'); };
    const up = ev => { pick(ev); const tg = target; clean(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); if(tg){ if(side==='r') addDep(t, tg); else addDep(tg, t); } };
    const key = ev => { if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); target = null; clean(); } };
    document.addEventListener('pointermove', mv, true); document.addEventListener('pointerup', up, true); document.addEventListener('keydown', key, true);
    mv(e);
  }

  /* ---------- touch: press and hold a bar (or an empty row), then drag ---------- */
  const HOLD_MS = 380;
  function onTouchStart(e){
    if(th){ clearTimeout(th.timer); th = null; }
    if(e.touches.length!==1 || window.__sheetOpen || menuEl) return;
    const tc = e.touches[0], bar = e.target.closest('.gc-bar'), track = e.target.closest('.gc-row.task .gc-track');
    let t = null, kind = 'move';
    if(bar){ t = taskOf(bar.dataset.id); const r = bar.getBoundingClientRect(), z = Math.min(20, r.width / 3);
      if(!t.milestone && r.width >= 56){ if(tc.clientX - r.left < z) kind = 'start'; else if(r.right - tc.clientX < z) kind = 'end'; } }
    else if(track){ t = taskOf(track.closest('.gc-row').dataset.row); if(!t || span(t)) return; kind = 'create'; }
    else return;
    if(!t) return;
    th = {x0:tc.clientX, y0:tc.clientY, t, bar, track, kind, active:false, ctl:null};
    th.timer = setTimeout(() => { if(!th) return; th.active = true; try{ navigator.vibrate?.(12); }catch(err){} (bar || track).classList.add('holding');
      th.ctl = startDrag(kind, t, bar, th.x0, track); suppressClick = true; }, HOLD_MS);
  }
  function onTouchMove(e){
    if(!th) return; const tc = e.touches[0];
    if(!th.active){ if(Math.hypot(tc.clientX - th.x0, tc.clientY - th.y0) > 9){ clearTimeout(th.timer); th = null; } return; }
    e.preventDefault(); th.ctl?.move(tc.clientX);
  }
  function onTouchEnd(e){
    if(!th) return; clearTimeout(th.timer); const h = th; th = null;
    (h.bar || h.track)?.classList.remove('holding');
    if(!h.active) return;
    if(e.cancelable) e.preventDefault();
    if(e.type==='touchcancel') h.ctl?.cancel(); else h.ctl?.end();
    setTimeout(() => { suppressClick = false; }, 60);
  }

  /* ---------- task window (shares the #sheet element with Kanban) ---------- */
  const sheet = $('#sheet');
  let openId = null, opener = null, timers = {}, refreshPending = false;
  const sheetOpen = () => !!openId;
  const cur = () => openId ? taskOf(openId) : null;
  const flush = () => { Object.values(timers).forEach(f => f.flush()); window.__typingTask = null; };
  function debounced(key, fn){ clearTimeout(timers[key]?.t); window.__typingTask = openId; timers[key] = {t:setTimeout(() => { fn(); delete timers[key]; if(!Object.keys(timers).length) window.__typingTask = null; }, 450), flush(){ clearTimeout(this.t); fn(); delete timers[key]; }}; }
  const markSaved = () => { const s = $('#gSaved'); if(s) s.textContent = 'Saved'; clearTimeout(markSaved.t); markSaved.t = setTimeout(() => { const x = $('#gSaved'); if(x) x.textContent = ''; }, 1800); };
  const grow = el => { if(!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  const prop = (id, label, value) => `<div class="prop"><span class="prop-l" id="${id}L">${label}</span><button class="prop-v" id="${id}" aria-haspopup="menu" aria-expanded="false" aria-labelledby="${id}L ${id}">${value}${ICON.chev}</button></div>`;
  function quickDates(){ const d = new Date(), add = n => { const x = new Date(d); x.setDate(x.getDate() + n); return ymd(x); }, toMon = ((8 - d.getDay()) % 7) || 7; return [['Today', add(0)], ['Tomorrow', add(1)], ['Next Monday', add(toMon)], ['In a week', add(7)]]; }
  function openSheet(id, op){
    const t = taskOf(id); if(!t) return;
    closeMenu(false);
    openId = id; opener = op || null; window.__sheetOpen = true; renderSheet();
    sheet.classList.add('show'); setBackgroundInert(); document.body.classList.add('sheet-open');
    requestAnimationFrame(() => { grow($('#gTitle')); grow($('#gNotes')); sheet.focus({preventScroll:true}); });
  }
  function closeSheet(silent){
    if(!openId) return; flush(); closeMenu(false);
    const id = openId; openId = null; window.__sheetOpen = false;
    sheet.classList.remove('show'); setBackgroundInert(); document.body.classList.remove('sheet-open'); sheet.innerHTML = ''; render(true);
    if(silent) return;
    if(!restoreFocus(`.gc-row[data-row="${CSS.escape(id)}"]`) && opener?.isConnected) opener.focus({preventScroll:true});
  }
  const typing = () => sheet.contains(document.activeElement) && document.activeElement.matches('input,textarea');
  function refreshSheet(){ if(!openId) return; if(typing() || Object.keys(timers).length){ refreshPending = true; return; } renderSheet(); }
  function renderSheet(){
    const t = cur(); if(!t){ closeSheet(true); return; }
    const sec = itemById(t.boardId), g = itemById(sec?.parent), sp = span(t);
    const si = sectionsOf(g?.id).indexOf(sec);
    sheet.style.setProperty('--board', `var(--${secPal(sec || {}, Math.max(0, si))}-b)`);
    const sc = $('.sh-body', sheet)?.scrollTop || 0, fk = sheet.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const preds = (t.deps || []).map(taskOf).filter(Boolean), succs = S.tasks.filter(x => (x.deps || []).includes(t.id));
    const dl = s => s ? `${ICON.cal}<span class="lbl-t">${esc(dueLabel(s).full)}</span>` : '<span class="lbl-t muted">No date</span>';
    const depRow = (x, mine) => `<div class="gp-dep"><span class="gp-dt">${esc(x.title || 'Untitled')}</span><span class="gp-dd">${span(x) ? esc(mine ? 'ends ' + fullDate(iso(span(x).b)) : 'starts ' + fullDate(iso(span(x).a))) : 'no dates'}${(mine ? violated(x, t) : violated(t, x)) ? ' · <b class="gp-bad">out of order</b>' : ''}</span><button class="icon-btn mini" data-rmdep="${esc(mine ? x.id + '>' + t.id : t.id + '>' + x.id)}" aria-label="Remove link with ${esc(x.title || 'task')}" title="Remove link">${ICON.x}</button></div>`;
    sheet.innerHTML = `
      <div class="sh-grab" aria-hidden="true"></div>
      <div class="sh-top">
        <textarea class="t-input" id="gTitle" rows="1" aria-label="Task title" placeholder="Task name">${esc(t.title)}</textarea>
        <span class="saved" id="gSaved" role="status" aria-live="polite"></span>
        <button class="icon-btn" id="gClose" aria-label="Close" title="Close (Esc)">${ICON.x}</button>
      </div>
      <div class="sh-body">
        <div class="props" role="group" aria-label="Task details">
          ${prop('gSec', 'Section', `<span class="lbl-t">${esc(sec?.name || '')}</span>`)}
          ${prop('gStat', 'Status', `<span class="sdot st-${t.col}" aria-hidden="true"></span><span class="lbl-t">${STATUS_NAME[t.col] || 'To do'}</span>`)}
          ${prop('gStart', 'Start', dl(t.start))}
          ${prop('gDue', 'Due', dl(t.due))}
          <div class="prop gp-prog"><label class="prop-l" for="gProg">Progress</label><input type="range" id="gProg" min="0" max="100" step="5" value="${t.progress || 0}" aria-valuetext="${t.progress || 0} percent" ${t.milestone ? 'disabled' : ''}><output id="gProgV" for="gProg">${t.milestone ? '–' : (t.progress || 0) + '%'}</output></div>
          <div class="prop"><span class="prop-l" id="gMsL">Milestone</span><button class="switch" id="gMs" role="switch" aria-checked="${!!t.milestone}" aria-labelledby="gMsL"><span class="sw-track" aria-hidden="true"></span><span>${t.milestone ? 'On' : 'Off'}</span></button></div>
          <input type="date" id="gStartIn" class="sr-only" tabindex="-1" aria-hidden="true" value="${esc(t.start || '')}">
          <input type="date" id="gDueIn" class="sr-only" tabindex="-1" aria-hidden="true" value="${esc(t.due || '')}">
        </div>
        <section class="sh-sec"><textarea class="notes" id="gNotes" rows="2" placeholder="Add notes, links, reference numbers…" aria-label="Notes">${esc(t.notes || '')}</textarea></section>
        <section class="sh-sec" aria-labelledby="gDepL">
          <div class="sh-h"><h3 id="gDepL">Dependencies</h3></div>
          ${preds.length ? `<p class="gp-sub">Starts after</p>${preds.map(x => depRow(x, true)).join('')}` : ''}
          ${succs.length ? `<p class="gp-sub">Then</p>${succs.map(x => depRow(x, false)).join('')}` : ''}
          ${!preds.length && !succs.length ? '<p class="gp-none">Not linked to any other task yet.</p>' : ''}
          <button class="btn gp-add" id="gAddDep">${ICON.plus}Add dependency</button>
        </section>
        <div class="sh-foot"><span>Created ${esc(stamp(t.created))}${t.doneAt && t.col==='done' ? ' · Done ' + esc(stamp(t.doneAt)) : ''}</span><button class="btn danger" id="gDelete">Delete task</button></div>
      </div>`;
    grow($('#gTitle')); grow($('#gNotes'));
    const body = $('.sh-body', sheet); if(body) body.scrollTop = sc;
    if(fk) restoreFocus(fk, sheet);
  }
  sheet.addEventListener('input', e => {
    const t = cur(); if(!t) return; const id = e.target.id;
    if(id==='gTitle'){ grow(e.target); const v = e.target.value.replace(/\n/g, ' '); debounced('title', () => { docPatch('tasks', t.id, {title:v}); markSaved(); render(); }); }
    if(id==='gNotes'){ grow(e.target); const v = e.target.value; debounced('notes', () => { docPatch('tasks', t.id, {notes:v}); markSaved(); }); }
    if(id==='gProg'){ const o = $('#gProgV'); if(o) o.textContent = e.target.value + '%'; }
  });
  sheet.addEventListener('change', e => {
    const t = cur(); if(!t) return;
    if(e.target.id==='gProg'){ setProgress(t, +e.target.value); renderSheet(); markSaved(); }
    if(e.target.id==='gStartIn'){ setDateField(t, 'start', e.target.value); renderSheet(); markSaved(); }
    if(e.target.id==='gDueIn'){ setDateField(t, 'due', e.target.value); renderSheet(); markSaved(); }
  });
  sheet.addEventListener('focusout', () => setTimeout(() => { if(refreshPending && openId && !typing() && !Object.keys(timers).length){ refreshPending = false; renderSheet(); } }, 450));
  sheet.addEventListener('keydown', e => { if(!openId) return; if(e.key==='Enter' && e.target.id==='gTitle'){ e.preventDefault(); $('#gNotes')?.focus(); } });
  const pickDate = id => { const i = $('#' + id); if(!i) return; try{ i.showPicker(); }catch(e){ i.classList.remove('sr-only'); i.removeAttribute('aria-hidden'); i.focus(); } };
  sheet.addEventListener('click', e => {
    const t = cur(); if(!t) return;
    if(e.target.closest('#gClose')) return closeSheet();
    const secb = e.target.closest('#gSec');
    if(secb){ const g = itemById(itemById(t.boardId)?.parent); return openMenu(secb, sectionsOf(g?.id).map(s => ({label:s.name, value:s.id, checked:s.id===t.boardId})), v => {
      if(v===t.boardId) return; const b = {boardId:t.boardId, pos:t.pos ?? 0}; const last = S.tasks.filter(x => x.boardId===v).reduce((m, x) => Math.max(m, x.pos ?? 0), 0);
      docPatch('tasks', t.id, {boardId:v, pos:last + 1024}); renderSheet(); render(true); markSaved(); toast('Moved to ' + itemById(v)?.name, () => { docPatch('tasks', t.id, b); render(true); }); }, 'Section'); }
    const sb = e.target.closest('#gStat');
    if(sb) return openMenu(sb, STATUS.map(c => ({label:STATUS_NAME[c], value:c, checked:c===t.col})), v => {
      if(v===t.col) return; const b = {col:t.col, progress:t.progress || 0, doneAt:t.doneAt || ''}; const p = {col:v};
      if(v==='done'){ p.progress = 100; p.doneAt = nowIso(); } else if(t.col==='done'){ p.doneAt = ''; if(v==='todo') p.progress = 0; else if((t.progress || 0)===100) p.progress = 50; }
      docPatch('tasks', t.id, p); renderSheet(); render(true); markSaved(); toast(STATUS_NAME[v], () => { docPatch('tasks', t.id, b); render(true); }); }, 'Status');
    for(const [bid, f, inId, none] of [['gStart', 'start', 'gStartIn', 'No start date'], ['gDue', 'due', 'gDueIn', 'No due date']]){
      const b = e.target.closest('#' + bid);
      if(b) return openMenu(b, [...quickDates().map(([l, v]) => ({label:`${l} · ${dateLabel(v)}`, value:v, checked:t[f]===v})), {sep:true}, {label:'Pick a date…', value:'pick'}, ...(t[f] ? [{label:none, value:'clear'}] : [])], v => {
        if(v==='pick') return pickDate(inId); setDateField(t, f, v==='clear' ? '' : v); renderSheet(); markSaved(); }, f==='start' ? 'Start date' : 'Due date');
    }
    if(e.target.closest('#gMs')){ toggleMilestone(t); renderSheet(); markSaved(); return; }
    const rm = e.target.closest('[data-rmdep]'); if(rm){ const [p, s] = rm.dataset.rmdep.split('>'); removeDep(p, s); renderSheet(); markSaved(); return; }
    const ad = e.target.closest('#gAddDep'); if(ad){ const g = itemById(itemById(t.boardId)?.parent); const opts = allTasks(g).filter(x => x.id!==t.id && !(t.deps || []).includes(x.id) && !reaches(x.id, t.id));
      if(!opts.length) return toast('No other task can be linked here');
      return openMenu(ad, [{head:'Starts after this task finishes'}, ...opts.slice(0, 40).map(x => ({label:x.title || 'Untitled', value:x.id}))], v => { if(addDep(taskOf(v), t)){ renderSheet(); markSaved(); } }, 'Add dependency'); }
    if(e.target.closest('#gDelete')){ flush(); const snap = t; closeSheet(true); removeTask(snap); }
  });
  /* phone: drag the grabber or top bar down to close */
  { let y0 = null, dy = 0;
    sheet.addEventListener('touchstart', e => { if(!openId) return; const h = e.target.closest('.sh-grab,.sh-top'); y0 = h && !e.target.closest('button,textarea,input') ? e.touches[0].clientY : null; dy = 0; }, {passive:true});
    sheet.addEventListener('touchmove', e => { if(y0===null || !openId) return; dy = Math.max(0, e.touches[0].clientY - y0); }, {passive:true});
    sheet.addEventListener('touchend', () => { if(openId && y0!==null && dy > 80) closeSheet(); y0 = null; }, {passive:true}); }

  /* ---------- view ---------- */
  const view = (g, root) => draw(g, root);
  /* the N key: a new task in the selected task's section (or the first) */
  function newShortcut(g){ const sel = st.sel && taskOf(st.sel), sec = (sel && itemById(sel.boardId)) || sectionsOf(g.id)[0]; if(sec) addTaskUI(sec, null); else addSection(g, null); }
  /* Delete on a selected arrow when focus is elsewhere in the page */
  document.addEventListener('keydown', e => {
    if((e.key!=='Delete' && e.key!=='Backspace') || !st.selDep || !G || !G.root?.isConnected || window.__sheetOpen || modalOpen() || menuEl) return;
    if(e.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    const [p, s] = st.selDep.split('>'); if(!taskOf(s)) return; e.preventDefault(); removeDep(p, s);
  });
  document.addEventListener('pointerdown', e => { if(st.selDep && !e.target.closest?.('.gc-dep') && G?.root?.isConnected){ st.selDep = null; $$('.gc-dep.sel', G.root).forEach(x => x.classList.remove('sel')); } }, true);
  function reveal(id){ st.reveal = id; }
  return {wide:true, render:view, newShortcut, addSection, openCount, openSheet, closeSheet, refreshSheet, sheetOpen, reveal, focusStart(){}};
})();
