/* ============================================================
   Timeline — a Kanban's tasks on a calendar (Gantt), grouped by stack.
   Uses the same filters as the board. Bars: start → due; a due date alone is a milestone (diamond);
   a start alone is an open bar that fades out. Neutral colours: status is shown by shape and fill.
   Desktop: drag a bar to move it, drag an end to change that date, Alt+arrows from the keyboard.
   Phone: tap opens the task, double-tap opens the card menu; dates are edited in the task window.
   Columns and dates are independent: nothing here changes a task's column or its board order.
   ============================================================ */
TYPE_VIEWS.timeline = (() => {
  const K = () => TYPE_VIEWS.kanban;
  const ZOOMS = {
    week:    {label:'Week',    dw:[36, 30], snap:1},
    month:   {label:'Month',   dw:[13, 9],  snap:1},
    quarter: {label:'Quarter', dw:[4, 3],   snap:7},
  };
  const DAY_MS = 864e5, LAB_W = 220, ROW_H = [36, 40], HEAD_H = 52, OPEN_W = 300;
  const pad2 = n => String(n).padStart(2, '0');
  const dn = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m-1, d) / DAY_MS); };
  const iso = n => { const d = new Date(n * DAY_MS); return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); };
  const ud = n => new Date(n * DAY_MS);
  const dow = n => (ud(n).getUTCDay() + 6) % 7;   // Monday = 0
  const narrow = () => matchMedia('(max-width:860px)').matches;
  let collapsed; try{ collapsed = new Set(JSON.parse(ls.get('lo.tlCollapsed', '[]'))); }catch(e){ collapsed = new Set(); }
  const st = {zoom: ZOOMS[ls.get('lo.tlZoom', 'month')] ? ls.get('lo.tlZoom', 'month') : 'month', key:null, anchor:null, focusDay:null, sy:0, tray:false};
  let G = null;             // geometry of the last render: {lo, hi, dw, lab, T, sc, root}
  let suppressClick = false, tap = null, drag = null;

  /* ---------- text measuring, for "does the label fit inside the bar" ---------- */
  let ctx2d = null;
  function textW(s){
    if(!ctx2d){ try{ ctx2d = document.createElement('canvas').getContext('2d'); }catch(e){} }
    if(!ctx2d) return s.length * 7;
    ctx2d.font = '500 12.5px ' + getComputedStyle(document.body).fontFamily;
    return ctx2d.measureText(s).width;
  }

  /* ---------- a task's place on the chart ---------- */
  function span(t){
    const s = t.start ? dn(t.start) : null, d = t.due ? dn(t.due) : null;
    return {s, d, kind: s!==null && d!==null ? 'range' : d!==null ? 'ms' : 'open'};
  }
  function geo(kind, s, d){   // every bar looks the same: first date to last date; one date = a one-day bar
    const {lo, dw} = G; const a = s ?? d, b = d ?? s;
    return {left:(a-lo)*dw + 1, width:Math.max(10, (b-a+1)*dw - 2)};
  }
  const isOverdue = (t, d) => t.col!=='done' && d!==null && d < G.T;
  function datesText(kind, s, d, sep){
    if(kind==='range') return dateRange(iso(s), iso(d), sep);
    if(kind==='ms') return (sep===' to ' ? 'due ' : 'Due ') + fullDate(iso(d));
    return (sep===' to ' ? 'from ' : 'From ') + fullDate(iso(s)) + (sep===' to ' ? ', no due date' : '');
  }
  function accName(t){
    const {s, d, kind} = span(t); const f = flagOf(t.flag);
    const parts = [t.title || 'Untitled', K().colName(t.col), datesText(kind, s, d, ' to ')];
    if(isOverdue(t, d)) parts.push(plural(G.T - d, 'day') + ' overdue');
    parts.push((PRIO[t.priority] || PRIO.low).label + ' priority');
    if(f) parts.push('flag: ' + f.label + (t.flagWho && flagAsk(f) ? ', ' + t.flagWho : ''));
    return parts.join(', ');
  }

  function barHTML(t, ph){
    const {s, d, kind} = span(t); const g = geo(kind, s, d);
    const done = t.col==='done', f = flagOf(t.flag);
    const inner = `${f ? `<i class="gt-fd" style="--fc:${colorOf(f.color)}"></i>` : ''}${done ? `<span class="gt-tick">${ICON.check}</span>` : prioIcon(t.priority)}<span class="gt-tt">${esc(t.title || 'Untitled')}</span>`;
    const need = textW(t.title || 'Untitled') + 22 + (f ? 12 : 0) + 16;
    const inside = need <= g.width;   // the title sits inside the bar when it fits, otherwise right after it, on the same line
    const handles = TOUCH || ph || g.width < 24 ? '' : `<i class="gt-h l"></i><i class="gt-h r"></i>`;   // a very short bar is all grip: it moves (use the task window or ⌥⇧← → for its length)
    const lbl = inside ? `<span class="gt-bl">${inner}</span>` : `<span class="gt-ol" aria-hidden="true">${inner}</span>`;
    return `<button class="gt-bar${inside ? ' in' : ''}${done ? ' is-done' : ''}" data-id="${esc(t.id)}" style="left:${g.left}px;width:${g.width}px" aria-label="${esc(accName(t))}" title="${esc((t.title||'Untitled') + ' · ' + datesText(kind, s, d, ' – '))}">${handles}${lbl}</button>`;
  }

  function rowHTML(t, ph){
    const {s, d, kind} = span(t); const g = geo(kind, s, d);
    const x0 = g.left, x1 = g.left + g.width;
    const done = t.col==='done';
    const title = `${done ? `<span class="gt-tick">${ICON.check}</span>` : prioIcon(t.priority)}<span class="gt-tt">${esc(t.title || 'Untitled')}</span>`;
    return `<div class="gt-row${done ? ' is-done' : ''}" data-row="${esc(t.id)}" data-x0="${Math.round(x0)}" data-x1="${Math.round(x1)}">
      ${ph ? '' : `<div class="gt-lab" title="Drag to reorder" aria-hidden="true"><span class="gt-grip" aria-hidden="true">${ICON.grip}</span>${title}</div>`}
      <div class="gt-track">${barHTML(t, ph)}<span class="gt-arr" hidden aria-hidden="true">${ph ? `<span class="gt-at">${esc(t.title || 'Untitled')}</span>` : ''}</span></div>
    </div>`;
  }

  /* ---------- header: months (or quarters) over days, weeks or months ---------- */
  function headHTML(){
    const {lo, hi, dw, T, lab} = G; const z = st.zoom; const top = [], bot = [];
    const stick = `style="left:${lab + 8}px"`;
    const tx = (T - lo) * dw + dw/2;   // a tick label the Today chip would sit on is left out
    const under = (n, txt) => { const a = (n - lo) * dw + 6, b = a + txt.length * 7.5; return a < tx + 28 && b > tx - 28 ? ' hid' : ''; };
    if(z==='quarter'){
      for(let n = lo; n <= hi;){ const d = ud(n), y = d.getUTCFullYear(), q = Math.floor(d.getUTCMonth()/3);
        const end = Math.min(hi + 1, Math.round(Date.UTC(y, q*3 + 3, 1) / DAY_MS));
        top.push(`<div class="gt-ht" style="left:${(n-lo)*dw}px;width:${(end-n)*dw}px"><span ${stick}>Q${q+1} ${y}</span></div>`); n = end; }
      for(let n = lo; n <= hi;){ const d = ud(n), y = d.getUTCFullYear(), m = d.getUTCMonth();
        const end = Math.min(hi + 1, Math.round(Date.UTC(y, m + 1, 1) / DAY_MS));
        bot.push(`<div class="gt-hb tk${under(n, MON[m])}" style="left:${(n-lo)*dw}px;width:${(end-n)*dw}px">${MON[m]}</div>`); n = end; }
    } else {
      for(let n = lo; n <= hi;){ const d = ud(n), y = d.getUTCFullYear(), m = d.getUTCMonth();
        const end = Math.min(hi + 1, Math.round(Date.UTC(y, m + 1, 1) / DAY_MS));
        top.push(`<div class="gt-ht" style="left:${(n-lo)*dw}px;width:${(end-n)*dw}px"><span ${stick}>${z==='week' ? MONTH[m] : MON[m]} ${y}</span></div>`); n = end; }
      if(z==='week') for(let n = lo; n <= hi; n++){ const w = dow(n) > 4;
        bot.push(`<div class="gt-hb${w ? ' we' : ''}${n===T ? ' now' : ''}${dow(n)===0 ? ' tk' : ''}" style="left:${(n-lo)*dw}px;width:${dw}px">${ud(n).getUTCDate()}</div>`); }
      else for(let n = lo; n <= hi; n++) if(dow(n)===0) bot.push(`<div class="gt-hb tk${under(n, String(ud(n).getUTCDate()))}" style="left:${(n-lo)*dw}px;width:${7*dw}px">${ud(n).getUTCDate()}</div>`);
    }
    return `<div class="gt-head" aria-hidden="true">${lab ? `<div class="gt-corner"></div>` : ''}<div class="gt-hin">
      <div class="gt-htop">${top.join('')}</div><div class="gt-hbot">${bot.join('')}</div>
      <span class="gt-chip" style="left:${(T-lo)*dw + dw/2}px">Today</span></div></div>`;
  }

  /* ---------- row order ---------- */
  const dateOrder = (a, b) => (a.start || a.due).localeCompare(b.start || b.due) || (a.due || '9999').localeCompare(b.due || '9999') || (a.title || '').localeCompare(b.title || '', undefined, {sensitivity:'base'});
  function rowsOf(bid, dated){ const rows = dated.filter(t => t.boardId===bid).sort(dateOrder);
    return rows.some(t => t.tlPos!=null) ? rows.sort((a, b) => (a.tlPos ?? Infinity) - (b.tlPos ?? Infinity)) : rows; }   // stable: tasks not placed yet keep their date order
  function saveRowOrder(ids){ const before = ids.map(id => ({id, tlPos:taskOf(id)?.tlPos ?? null}));
    ids.forEach((id, i) => { const t = taskOf(id); if(t && t.tlPos!==(i+1)*1024) docPatch('tasks', id, {tlPos:(i+1)*1024}); });
    return before; }

  /* ---------- render ---------- */
  function draw(stacks, root, {k, bb=false, done=true, test=null}={}){   // not called render: that's the app's re-render
    const ph = narrow(); const z = ZOOMS[st.zoom];
    const ids = new Set(stacks.map(b => b.id));
    const colOk = t => { const c = t.col==='upcoming' ? 'todo' : t.col; if(c==='backburner') return bb; if(c==='done') return done && !test; return true; };
    const tasks = S.tasks.filter(t => ids.has(t.boardId) && colOk(t) && !K().archived(t) && (!test || test(t)));
    const dated = tasks.filter(t => t.start || t.due), undated = tasks.filter(t => !t.start && !t.due && t.col!=='done');   // finished tasks with no dates have nothing to schedule
    const T = dn(today());
    const padD = st.zoom==='quarter' ? 60 : st.zoom==='month' ? 30 : 14;
    let lo = T - 45, hi = T + 120;
    for(const t of dated){ const {s, d} = span(t); lo = Math.min(lo, (s ?? d) - padD); hi = Math.max(hi, (d ?? s) + padD); }
    if(st.zoom==='quarter'){ const d = ud(lo); lo = Math.round(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth()/3)*3, 1) / DAY_MS); }
    else { const d = ud(lo); lo = Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS); lo -= dow(lo); }
    { const d = ud(hi); hi = Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / DAY_MS) - 1; }
    const dw = z.dw[ph ? 1 : 0], lab = ph ? 0 : LAB_W, W = (hi - lo + 1) * dw;
    G = {lo, hi, dw, lab, T, root, ph, snap:z.snap};
    const order = (a, b) => (a.start || a.due).localeCompare(b.start || b.due) || (a.due || '9999').localeCompare(b.due || '9999') || (a.title || '').localeCompare(b.title || '', undefined, {sensitivity:'base'});
    const secs = stacks.map(b => { const rows = rowsOf(b.id, dated); const open = !collapsed.has(b.id);
      return `<section class="gt-sec" data-sid="${esc(b.id)}" aria-label="${esc(b.name)}, ${plural(rows.length, 'task')}">
        <div class="gt-grp"><button class="gt-gh" data-tlgrp="${esc(b.id)}" aria-expanded="${open}"><svg class="gt-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg><b>${esc(b.name)}</b><span class="gt-n">${rows.length}</span></button></div>
        ${open ? rows.length ? rows.map(t => rowHTML(t, ph)).join('') : `<div class="gt-row gt-none"><div class="gt-lab"><span class="gt-tt">Nothing scheduled</span></div>${ph ? '<div class="gt-track"><span class="gt-ptx muted">Nothing scheduled</span></div>' : ''}</div>` : ''}
      </section>`; }).join('');
    G.order = order;
    const zoomSeg = `<div class="seg gt-zoom" role="group" aria-label="Zoom">${Object.entries(ZOOMS).map(([v, o]) => `<button data-tlz="${v}" aria-pressed="${st.zoom===v}">${o.label}</button>`).join('')}</div>`;
    const legend = ph ? '' : `<span class="gt-legend">${TOUCH ? '' : 'Drag a title to reorder · drag a bar to change dates'}</span>`;
    const trayItems = undated.slice().sort((a, b) => stacks.findIndex(x => x.id===a.boardId) - stacks.findIndex(x => x.id===b.boardId) || (a.pos ?? 0) - (b.pos ?? 0));
    const tray = `<section class="gt-tray${st.tray ? ' open' : ''}" aria-label="Tasks with no dates">
      <button class="gt-trh" data-tltray aria-expanded="${st.tray}" aria-controls="gtTray"><svg class="gt-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>No dates<span class="gt-n">${undated.length}</span>${!ph && !TOUCH && undated.length ? `<span class="gt-trhint">Drag one onto the timeline to set its due date</span>` : ''}</button>
      <div class="gt-tri" id="gtTray" ${st.tray ? '' : 'hidden'}>${trayItems.length ? trayItems.map(t => { const b = itemById(t.boardId);
        return `<button class="gt-ti" data-tray="${esc(t.id)}">${t.col==='done' ? `<span class="gt-tick">${ICON.check}</span>` : prioIcon(t.priority)}<span class="gt-tt">${esc(t.title || 'Untitled')}</span>${stacks.length > 1 ? `<span class="gt-ts">${esc(b?.name || '')}</span>` : ''}</button>`; }).join('') : `<p class="gt-empty">Every task here has a date.</p>`}</div>
    </section>`;
    const empty = !tasks.length;
    root.innerHTML = `<div class="gt${ph ? ' ph' : ''} z-${st.zoom}" style="--dw:${dw}px;--lab:${lab}px;--row:${ROW_H[ph ? 1 : 0]}px;--hh:${HEAD_H}px;--w:${W}px">
      <div class="gt-tools">${zoomSeg}<button class="btn gt-todayb" data-tltoday>Today</button>${legend}</div>
      ${empty ? `<div class="panel empty-state">Nothing matches these filters.</div>` : `<div class="gt-scroll" role="region" aria-label="Timeline, ${ZOOMS[st.zoom].label.toLowerCase()} view. Up and down arrows move between tasks; Enter opens one${TOUCH ? '' : '; Alt with left or right arrow moves its dates, add Shift to move the due date only; Alt with up or down arrow moves the task up or down'}." tabindex="-1">
        <div class="gt-in" style="width:${lab + W}px">
          ${headHTML()}
          <div class="gt-body">
            <div class="gt-grid" aria-hidden="true"><i class="gt-now" style="left:${(T-lo)*dw + dw/2}px"></i><i class="gt-drop" hidden></i></div>
            ${secs}
          </div>
        </div>
      </div>`}
      ${tray}
    </div>`;
    const sc = $('.gt-scroll', root); G.sc = sc;
    bind(root);
    if(!sc) return;
    /* drag rows up and down (desktop: by the title; phone: press and hold) — your order is kept per stack */
    for(const sec of $$('.gt-sec', sc)) if($$('.gt-row[data-row]', sec).length > 1) Sortable.create(sec, {
      draggable:'.gt-row[data-row]', handle: ph ? '.gt-row' : '.gt-lab', direction:'vertical', animation:RM ? 0 : 150,
      delay:280, delayOnTouchOnly:true, scrollFn:(dx, dy) => { if(dy) sc.scrollTop += dy; },   // rows move up and down only: never scroll the dates sideways
       touchStartThreshold:6, fallbackTolerance:4, ghostClass:'gt-ghostrow', chosenClass:'gt-chosen',
      onStart(){ S.dragging = true; }, onEnd(){ S.dragging = false; suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); saveRowOrder($$('.gt-row[data-row]', sec).map(x => x.dataset.row)); render(true); }});
    const vis = () => sc.clientWidth - lab;
    if(st.key!==k?.id){ st.key = k?.id; st.anchor = null; st.sy = 0; }
    if(st.focusDay!==null){ st.anchor = st.focusDay - vis()/3/dw; st.focusDay = null; }
    if(st.anchor===null) st.anchor = T + .5 - vis()/3/dw;
    sc.scrollLeft = Math.max(0, (st.anchor - lo) * dw); sc.scrollTop = st.sy;
    let raf = 0;
    sc.addEventListener('scroll', () => { if(raf) return; raf = requestAnimationFrame(() => { raf = 0; st.anchor = lo + sc.scrollLeft/dw; st.sy = sc.scrollTop; arrows(); }); }, {passive:true});
    arrows();
  }

  /* off-screen hint: a small arrow at the row's edge when its bar is out of sight */
  function arrows(){
    const sc = G?.sc; if(!sc || !sc.isConnected) return;
    const sl = sc.scrollLeft, vis = sc.clientWidth - G.lab;
    for(const row of $$('.gt-row[data-row]', sc)){
      const a = $('.gt-arr', row); if(!a) continue; const x0 = +row.dataset.x0, x1 = +row.dataset.x1;
      if(x1 < sl + 2){ a.hidden = false;
        a.className = 'gt-arr l'; a.style.left = (sl + (G.ph ? 8 : 6)) + 'px'; }
      else if(x1 >= sl + 2 && x0 > sl + vis - 2){ a.hidden = false; a.className = 'gt-arr r'; a.style.left = (sl + vis - (G.ph ? 8 : 30)) + 'px'; }   // phone: a pill with the title, right-aligned
      else a.hidden = true;
    }
  }
  function scrollToDay(n, smooth){ const sc = G?.sc; if(!sc) return; sc.scrollTo({left:Math.max(0, (n - G.lo) * G.dw - (sc.clientWidth - G.lab)/3), behavior: smooth && !RM ? 'smooth' : 'auto'}); }

  /* ---------- changing dates (drag, keyboard, tray) ---------- */
  const taskOf = id => S.tasks.find(x => x.id===id);
  function commit(t, ns, nd, how){
    const before = {start:t.start || '', due:t.due || ''};
    const p = K().datesPatch(t, {start: ns===null ? '' : iso(ns), due: nd===null ? '' : iso(nd)});
    if(p.start===before.start && p.due===before.due) return false;
    docPatch('tasks', t.id, p); render(true);
    const {s, d, kind} = span({...t, ...p});
    toast(`${how}: ${datesText(kind, s, d, ' – ')}`, () => docPatch('tasks', t.id, before));
    return true;
  }
  function nudge(t, dir, endOnly){
    const step = G.snap * dir; let {s, d} = span(t);
    if(endOnly){ if(d!==null) d = s!==null ? Math.max(s, d + step) : d + step; else if(dir > 0) d = s + step; else return; }
    else { if(s!==null) s += step; if(d!==null) d += step; }
    commit(t, s, d, endOnly ? 'Due date' : 'Moved');
  }

  function tip(text, x, y){
    let el = $('#gtTip'); if(!el){ el = document.createElement('div'); el.id = 'gtTip'; el.className = 'gt-tip'; document.body.appendChild(el); }
    el.textContent = text; el.style.left = Math.min(innerWidth - el.offsetWidth - 8, x + 14) + 'px'; el.style.top = Math.max(8, y - 38) + 'px';
  }
  const untip = () => $('#gtTip')?.remove();

  function startBarDrag(e, bar){
    const t = taskOf(bar.dataset.id); if(!t) return;
    const h = e.target.closest('.gt-h'); const part = h ? (h.classList.contains('l') ? 'start' : 'end') : 'move';
    const {s:s0, d:d0, kind:k0} = span(t);
    const sc = G.sc, x0 = e.clientX, sl0 = sc.scrollLeft;
    const orig = bar.getAttribute('style'), origCls = bar.className;
    let moved = false, ns = s0, nd = d0;
    try{ bar.setPointerCapture(e.pointerId); }catch(err){}
    const calc = cx => {
      const delta = Math.round(((cx - x0) + (sc.scrollLeft - sl0)) / G.dw / G.snap) * G.snap;
      const a0 = s0 ?? d0, b0 = d0 ?? s0;
      if(part==='move'){ ns = s0===null ? null : s0 + delta; nd = d0===null ? null : d0 + delta; }
      else if(part==='start'){ ns = Math.min(a0 + delta, b0); nd = d0; }
      else { ns = s0; nd = Math.max(b0 + delta, a0); }
      const kind = ns!==null && nd!==null ? 'range' : nd!==null ? 'ms' : 'open';
      const g = geo(kind, ns, nd); bar.style.left = g.left + 'px'; bar.style.width = g.width + 'px';
      tip(datesText(kind, ns, nd, ' – '), cx, bar.getBoundingClientRect().top + 8);
    };
    const move = ev => { if(!moved && Math.abs(ev.clientX - x0) < 4) return;
      if(!moved){ moved = true; document.body.classList.add('no-select', 'gt-dragging'); bar.classList.add('dragging'); S.dragging = true; }
      calc(ev.clientX); };
    const cleanup = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', cancel); document.removeEventListener('keydown', key, true);
      document.body.classList.remove('no-select', 'gt-dragging'); bar.classList.remove('dragging'); S.dragging = false; untip(); drag = null; };
    const restore = () => { bar.setAttribute('style', orig); bar.className = origCls; };
    const up = () => { cleanup(); if(!moved) return; suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      if(!commit(t, ns, nd, part==='move' ? 'Moved' : part==='start' ? 'Start' : 'Due date')){ restore(); render(true); } };
    const cancel = () => { cleanup(); if(moved){ restore(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); render(true); } };
    const key = ev => { if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); cancel(); } };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', cancel); document.addEventListener('keydown', key, true);
    drag = {cancel};
  }

  /* desktop: drag a "No dates" task onto the chart to give it a due date */
  function startTrayDrag(e, item){
    const t = taskOf(item.dataset.tray); if(!t) return;
    const x0 = e.clientX, y0 = e.clientY; let ghost = null, day = null;
    const line = $('.gt-drop', G.root);
    const dayAt = ev => { const sc = G.sc; if(!sc) return null; const r = sc.getBoundingClientRect();
      if(ev.clientX < r.left + G.lab || ev.clientX > r.right || ev.clientY < r.top + HEAD_H || ev.clientY > r.bottom) return null;
      return G.lo + Math.floor((ev.clientX - r.left - G.lab + sc.scrollLeft) / G.dw); };
    const move = ev => {
      if(!ghost){ if(Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        ghost = document.createElement('div'); ghost.className = 'gt-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.innerHTML = item.innerHTML; document.body.appendChild(ghost);
        document.body.classList.add('no-select', 'gt-dragging'); S.dragging = true; }
      ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 10}px)`;
      day = dayAt(ev);
      if(day===null){ if(line) line.hidden = true; untip(); }
      else { if(line){ line.hidden = false; line.style.left = ((day - G.lo) * G.dw + G.dw/2) + 'px'; } tip('Due ' + fullDate(iso(day)), ev.clientX, ev.clientY); }
    };
    const cleanup = () => { document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('keydown', key, true);
      ghost?.remove(); if(line) line.hidden = true; untip(); document.body.classList.remove('no-select', 'gt-dragging'); S.dragging = false; };
    const up = () => { const was = !!ghost; cleanup(); if(!was) return; suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      if(day!==null) commit(t, null, day, '“' + (t.title || 'Untitled') + '” due'); else render(true); };
    const key = ev => { if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); const was = !!ghost; cleanup(); day = null; if(was){ suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); render(true); } } };
    document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', up, true); document.addEventListener('keydown', key, true);
  }

  /* ---------- menus and opening ---------- */
  function menuFor(t, anchor, at){
    const items = K().cardMenuItems(t).filter(i => i.value!=='dup' && i.value!=='pin');   // pinning belongs to the board
    while(items.length && items[0].sep) items.shift();
    const clean = items.filter((it, i) => !(it.sep && items[i-1]?.sep));
    openMenu(at, clean, v => K().cardAction(v, t, anchor, null), 'Card');
  }
  const open = (id, el) => K().openSheet(id, el);

  function bind(root){
    root.addEventListener('click', e => {
      if(suppressClick){ e.stopPropagation(); return; }
      const z = e.target.closest('[data-tlz]');
      if(z){ e.stopPropagation(); if(z.dataset.tlz===st.zoom) return; const sc = G.sc;
        if(sc) st.focusDay = G.lo + (sc.scrollLeft + (sc.clientWidth - G.lab)/3) / G.dw;
        st.zoom = z.dataset.tlz; ls.set('lo.tlZoom', st.zoom); render(true); restoreFocus(`[data-tlz="${st.zoom}"]`); return; }
      if(e.target.closest('[data-tltoday]')){ e.stopPropagation(); scrollToDay(G.T + .5, true); return; }
      const gh = e.target.closest('[data-tlgrp]');
      if(gh){ e.stopPropagation(); const id = gh.dataset.tlgrp; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); ls.set('lo.tlCollapsed', JSON.stringify([...collapsed])); render(true); restoreFocus(`[data-tlgrp="${CSS.escape(id)}"]`); return; }
      if(e.target.closest('[data-tltray]')){ e.stopPropagation(); st.tray = !st.tray; render(true); restoreFocus('[data-tltray]'); return; }
      const ti = e.target.closest('[data-tray]'); if(ti){ e.stopPropagation(); open(ti.dataset.tray, ti); return; }
      const ar = e.target.closest('.gt-arr');
      if(ar){ e.stopPropagation(); const row = ar.closest('.gt-row'); const x = (+row.dataset.x0 + +row.dataset.x1)/2; scrollToDay(G.lo + x / G.dw, true); return; }
      const row = e.target.closest('.gt-row[data-row]'); if(!row) return;
      e.stopPropagation();
      const id = row.dataset.row, bar = $('.gt-bar', row);
      if(TOUCH){
        if(tap && tap.id===id){ clearTimeout(tap.timer); tap = null; const t = taskOf(id); if(!t) return;
          const r = (e.target.closest('.gt-bar, .gt-pt') || row).getBoundingClientRect(); const x = Math.min(Math.max(e.clientX || r.left + 12, 12), innerWidth - 12);
          menuFor(t, bar, {getBoundingClientRect:() => ({left:x, right:x, top:r.top + 20, bottom:r.top + 20, width:0, height:0}), setAttribute(){}, focus(){}}); return; }
        clearTimeout(tap?.timer); tap = {id, timer:setTimeout(() => { tap = null; if(row.isConnected) open(id, bar); }, 260)}; return;
      }
      if(e.target.closest('.gt-bar, .gt-lab')) open(id, bar);
    });
    root.addEventListener('contextmenu', e => {
      const row = e.target.closest('.gt-row[data-row]'); if(!row) return;
      e.preventDefault(); e.stopPropagation(); if(TOUCH) return;
      const t = taskOf(row.dataset.row); if(t) menuFor(t, $('.gt-bar', row), pointAnchor(e));
    });
    if(!TOUCH) root.addEventListener('pointerdown', e => {
      if(e.button!==0 || drag) return;
      const bar = e.target.closest('.gt-bar'); if(bar){ startBarDrag(e, bar); return; }
      const ti = e.target.closest('[data-tray]'); if(ti && G.sc) startTrayDrag(e, ti);
    });
    root.addEventListener('keydown', e => {
      const bar = e.target.closest?.('.gt-bar'); if(!bar) return;
      const t = taskOf(bar.dataset.id); if(!t) return;
      if((e.key==='ArrowDown' || e.key==='ArrowUp') && e.altKey){ e.preventDefault(); e.stopPropagation();
        const sec = bar.closest('.gt-sec'); const ids = $$('.gt-row[data-row]', sec).map(x => x.dataset.row); const i = ids.indexOf(t.id), j = i + (e.key==='ArrowDown' ? 1 : -1);
        if(j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; const before = saveRowOrder(ids); render(true);
        restoreFocus(`.gt-bar[data-id="${CSS.escape(t.id)}"]`); toast('Moved '+(e.key==='ArrowDown' ? 'down' : 'up'), () => before.forEach(x => docPatch('tasks', x.id, {tlPos:x.tlPos}))); return; }
      if((e.key==='ArrowDown' || e.key==='ArrowUp') && !e.altKey){ e.preventDefault(); e.stopPropagation();
        const all = $$('.gt-bar', root); const i = all.indexOf(bar); const n = all[i + (e.key==='ArrowDown' ? 1 : -1)]; if(n) n.focus(); return; }
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); e.stopPropagation(); open(t.id, bar); return; }
      if(e.altKey && (e.key==='ArrowLeft' || e.key==='ArrowRight')){ e.preventDefault(); e.stopPropagation(); nudge(t, e.key==='ArrowRight' ? 1 : -1, e.shiftKey); return; }
      if(e.key==='ContextMenu' || (e.shiftKey && e.key==='F10')){ e.preventDefault(); e.stopPropagation(); menuFor(t, bar, bar); }
    });
  }

  return {render:draw};
})();
