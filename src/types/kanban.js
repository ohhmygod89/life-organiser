/* ============================================================
   Kanban — Life Board columns, cards and the task window.
   Tasks live in the `tasks` collection; task.boardId = the Kanban item id.
   ============================================================ */
TYPE_VIEWS.kanban = (() => {
  const COLS = [
    {id:'todo', name:'To Do', hint:''},
    {id:'doing', name:'In Progress', hint:''},
    {id:'done', name:'Done', hint:'Newest first'},
    {id:'backburner', name:'Back Burner', hint:'Parked'},
  ];
  const colName = id => id==='upcoming' ? 'To Do' : (COLS.find(c=>c.id===id)?.name || '');
  const DONE_LIMIT = 5;
  const showAllDone = {};
  let sortables = [], adding = null, draft = '', addSubmitting = false;

  const archived = t => t.col==='done' && doneYear(t) < CUR_YEAR;
  function tasksIn(bid, col){
    const l = S.tasks.filter(t=>t.boardId===bid && (t.col===col || (col==='todo' && t.col==='upcoming')) && !archived(t));
    return col==='done' ? l.sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||'')) : l.sort((a,b)=>(a.pos??0)-(b.pos??0));
  }
  function endPos(bid, col, except){ const l=tasksIn(bid,col).filter(x=>x.id!==except); return (l.length?Math.max(...l.map(x=>x.pos||0)):0)+1024; }
  function moveTo(t, col, {silent}={}){
    if(t.col===col) return;
    const snap = {col:t.col, pos:t.pos??1024, doneAt:t.doneAt||'', prevCol:t.prevCol||''};
    const p = {col, pos:endPos(t.boardId, col, t.id)};
    if(col==='done'){ p.doneAt = nowIso(); p.prevCol = t.col; }
    docPatch('tasks', t.id, p);
    if(!silent) toast(col==='done' ? 'Marked done' : 'Moved to '+colName(col), () => docPatch('tasks', t.id, clone(snap)));
  }
  const toggleDone = t => moveTo(t, t.col==='done' ? (t.prevCol && t.prevCol!=='done' ? t.prevCol : 'todo') : 'done');

  /* subtask chip on cards: just who it's waiting on (or the short flag name), full text on hover */
  const subChip = c => { const f=flagOf(c.flag); return `<span class="chip one sub" style="--fc:${colorOf(f.color)}" title="${esc(f.label)}${c.flagWho?' · '+esc(c.flagWho):''}">${esc(f.who&&c.flagWho ? c.flagWho : flagShort(f))}</span>`; };
  function cardHTML(t, compact){
    const isDone = t.col==='done'; const parts = [];
    if(isDone && t.doneAt) parts.push(`<span class="okd">${ICON.check}Done ${esc(shortDate(t.doneAt))}</span>`);
    if(t.due && !isDone){ const d=dueLabel(t.due); parts.push(`<span class="${d.cls}">${ICON.cal}${esc(d.t)}</span>`); }
    const cl = t.checklist||[];
    if(cl.length && !isDone) parts.push(`<span aria-label="${cl.filter(c=>c.done).length} of ${cl.length} checklist items done">${ICON.list}${cl.filter(c=>c.done).length}/${cl.length}</span>`);
    if(!isDone && ((t.notes||'').trim() || (t.log||[]).length)) parts.push(`<span title="Has notes" aria-label="Has notes">${ICON.notes}</span>`);
    const back = colName(t.prevCol && t.prevCol!=='done' ? t.prevCol : 'todo');
    const showCl = cl.length && !isDone; const lim = compact ? 4 : 8;
    const src = effFlag(t)?.from;   // that subtask's flag is already shown at the top of the card
    return `<article class="card ${isDone?'is-done':''} ${compact?'compact':''}" data-id="${esc(t.id)}" data-key="card-${esc(t.id)}" tabindex="0" aria-label="${esc(t.title||'Untitled')}${t.priority&&!isDone?', '+PRIO[t.priority].label+' priority':''}">
      <button class="tick" data-tick="" title="${isDone?'Not done, back to '+back:'Mark done'}" aria-label="${isDone?'Mark not done':'Mark done'}: ${esc(t.title)}">${ICON.check}</button>
      <button class="mv" data-mv="" aria-haspopup="menu" aria-expanded="false" title="Move to column" aria-label="Move ${esc(t.title)} to another column">${ICON.move}</button>
      ${!isDone ? chipHTML(t,'one') : ''}
      <div class="title">${!isDone?bangHTML(t.priority):''}${esc(t.title||'Untitled')}</div>
      ${showCl ? `<ul class="cl">${cl.slice(0,lim).map(c=>`<li class="${c.done?'on':''}"><button class="cbox" data-cbox="${esc(c.id)}" role="checkbox" aria-checked="${!!c.done}" aria-label="${esc(c.text)}">${ICON.check}</button><span class="ct">${esc(c.text)}${!c.done && flagOf(c.flag) && c!==src ? subChip(c) : ''}</span></li>`).join('')}${cl.length>lim?`<li class="more-c">+${cl.length-lim} more</li>`:''}</ul>` : ''}
      ${parts.length?`<div class="meta">${parts.join('')}</div>`:''}
    </article>`;
  }
  function addRowHTML(bid, c){
    const isAdding = adding?.board===bid && adding?.col===c.id;
    return isAdding ? `<div class="add-row"><textarea class="add-input" id="kbAdd" rows="2" placeholder="Task name" aria-label="New task in ${c.name}">${esc(draft)}</textarea><div class="add-tip">Enter to add another · Esc to finish</div></div>`
      : `<div class="add-row"><button class="add-btn" data-add="${c.id}">${ICON.plus} Add task</button></div>`;
  }
  function bindSortables(root){
    sortables.forEach(s=>s.destroy()); sortables = [];
    $$('.cards', root).forEach(list => sortables.push(Sortable.create(list, {
      group:'cards', animation:RM?0:140, easing:'cubic-bezier(.2,.8,.2,1)', draggable:'.card', filter:'.tick,.cbox,.mv', preventOnFilter:false,
      delay:200, delayOnTouchOnly:true, touchStartThreshold:6, forceFallback:true, fallbackOnBody:true, fallbackClass:'dragging', fallbackTolerance:3,
      emptyInsertThreshold:60, swapThreshold:.6, invertSwap:false, direction:'vertical', ghostClass:'ghost-card',
      scroll:true, bubbleScroll:true, scrollSensitivity:44, scrollSpeed:9,
      onStart(){ S.dragging=true; document.body.classList.add('is-dragging'); }, onEnd(evt){ S.dragging=false; document.body.classList.remove('is-dragging'); onDrop(evt); render(true); }
    })));
    if(adding){ const a=$('#kbAdd'); if(a){ a.focus({preventScroll:true}); a.setSelectionRange(a.value.length, a.value.length); a.scrollIntoView({block:'nearest', inline:'nearest'}); } }
  }

  function view(it, root){ lanes([it], root, {bb:true, single:true}); }

  /* Stacked view: one band per Kanban, all sharing one sideways scroller so the columns line up. */
  const LANE_DONE = 3;
  function lanes(boards, root, {bb=false, test=null, single=false}={}){
    const cols = COLS.filter(c => (bb || c.id!=='backburner') && (!test || c.id!=='done'));
    if(adding && !boards.some(b=>b.id===adding.board)) adding = null;
    const keep = t => !test || test(t);
    root.innerHTML = `<div class="lanes" data-hs="lanes" style="--n:${cols.length}"><div class="lanes-in">` + boards.map(b => {
      const open = S.tasks.filter(t=>t.boardId===b.id && !['done','backburner'].includes(t.col) && keep(t)).length;
      return `<section class="lane" style="--board:${itemColor(b)}" aria-label="${esc(b.name)}" data-key="lane-${esc(b.id)}">
        ${single ? '' : `<div class="lane-h"><div class="lane-hi"><span class="lane-dot" aria-hidden="true"></span><h2>${esc(b.name)}</h2><span class="count">${plural(open,'open task')}</span>
          <a class="link lane-open" href="#i-${esc(b.id)}">Open</a></div></div>`}
        <div class="lane-cols">${cols.map(c => {
          let ts = tasksIn(b.id, c.id).filter(keep); const total = ts.length; let more = '';
          const lim = single ? DONE_LIMIT : LANE_DONE; if(c.id==='done' && ts.length>lim){ const all=showAllDone['lane-'+b.id]; more=`<button class="more" data-act="more" data-board="lane-${esc(b.id)}">${all?'Show fewer':'Show '+(ts.length-lim)+' more'}</button>`; if(!all) ts=ts.slice(0,lim); }
          return `<div class="lcol col ${c.id}" aria-label="${esc(b.name)}, ${c.name}, ${plural(total,'task')}">
            <div class="lcol-h"><span>${c.name}</span><span class="count">${total||''}</span>${c.id==='done'?'':`<button class="lcol-add" data-add="${c.id}" aria-label="Add task to ${esc(b.name)}, ${c.name}" title="Add task">${ICON.plus}</button>`}</div>
            ${adding?.board===b.id && adding?.col===c.id ? addRowHTML(b.id, c) : ''}
            <div class="cards" data-col="${c.id}" data-board="${esc(b.id)}">${ts.map(t=>cardHTML(t,true)).join('')}<div class="drop-hint">None</div></div>
            ${more}
          </div>`;
        }).join('')}</div>
      </section>`;
    }).join('') + `</div></div>`;
    bindSortables(root);
  }

  function onDrop(evt){
    const t = S.tasks.find(x=>x.id===evt.item.dataset.id); if(!t) return;
    const col = evt.to.dataset.col, bid = evt.to.dataset.board || t.boardId;
    if(bid!==t.boardId){
      const from={boardId:t.boardId, col:t.col, pos:t.pos??1024, doneAt:t.doneAt||'', prevCol:t.prevCol||''};
      const p = {boardId:bid, col, pos:endPos(bid, col, t.id)}; if(col==='done' && t.col!=='done'){ p.doneAt=nowIso(); p.prevCol=t.col; }
      docPatch('tasks', t.id, p); touchItem(bid);
      toast('Moved to '+(itemById(bid)?.name||'board')+' · '+colName(col), () => docPatch('tasks', t.id, clone(from)));
      return;
    }
    if(col==='done'){ if(t.col!=='done') moveTo(t,'done'); return; }
    const ids = $$('.card', evt.to).map(c=>c.dataset.id); const i = ids.indexOf(t.id);
    const get = k => S.tasks.find(x=>x.id===k);
    const prev = i>0?get(ids[i-1]):null, next = i<ids.length-1?get(ids[i+1]):null;
    let pos = prev&&next ? (prev.pos+next.pos)/2 : prev ? prev.pos+1024 : next ? next.pos-1024 : 1024;
    if(col===t.col && pos===t.pos) return;
    if(prev && next && Math.abs(next.pos-prev.pos)<1e-6){ ids.forEach((k,j)=>{ if(k!==t.id) docPatch('tasks', k, {pos:(j+1)*1024}); }); pos=(i+1)*1024; }
    const p = {col, pos}; if(t.col==='done') p.prevCol = '';
    if(col!==t.col) toast('Moved to '+colName(col), ()=>docPatch('tasks', t.id, {col:t.col, pos:t.pos??1024}));
    docPatch('tasks', t.id, p);
  }
  function addTask(bid, col, title){
    if(!title.trim()) return;
    const l=tasksIn(bid,col); const top=l.length?Math.min(...l.map(x=>x.pos||0))-1024:1024;   // the add box sits at the top, so new tasks go there too
    docSet('tasks', {id:uid(), boardId:bid, col, pos:top, title:title.trim(), notes:'', due:'', priority:'', flag:'', flagWho:'', checklist:[], log:[], created:nowIso(), updated:nowIso()});
    touchItem(bid);
  }
  function keyMove(t, key){
    const ci = COLS.findIndex(c=>c.id===t.col);
    if(key==='ArrowLeft'||key==='ArrowRight'){ const n=COLS[ci+(key==='ArrowRight'?1:-1)]; if(!n) return; moveTo(t, n.id); }
    else if(t.col!=='done'){ const l=tasksIn(t.boardId,t.col); const i=l.findIndex(x=>x.id===t.id); const j=i+(key==='ArrowDown'?1:-1); if(j<0||j>=l.length) return; const o=l[j], a=t.pos, b=o.pos; docPatch('tasks', t.id, {pos:b===a?b+(key==='ArrowDown'?1:-1):b}); docPatch('tasks', o.id, {pos:a}); }
    render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"]`);
  }

  function click(e){
    const cardOf = el => S.tasks.find(x=>x.id===el.closest('.card').dataset.id);
    const tick = e.target.closest('[data-tick]');
    if(tick){ e.stopPropagation(); const t=cardOf(tick); if(t){ toggleDone(t); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"] [data-tick]`); } return true; }
    const mv = e.target.closest('[data-mv]');
    if(mv){ e.stopPropagation(); const t=cardOf(mv); if(t) openMenu(mv, COLS.map(c=>({label:c.name, value:c.id, checked:c.id===t.col})), v => { if(v!==t.col){ moveTo(t, v); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"]`); } }, 'Move to column'); return true; }
    const cb = e.target.closest('[data-cbox]');
    if(cb){ e.stopPropagation(); const t=cardOf(cb); if(t){ const id=cb.dataset.cbox; docPatch('tasks', t.id, {checklist:(t.checklist||[]).map(c=>c.id===id?{...c,done:!c.done}:c)}); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"] [data-cbox="${CSS.escape(id)}"]`); } return true; }
    const add = e.target.closest('[data-add]');
    if(add){ const bid = add.closest('[data-board]')?.dataset.board || add.closest('.col')?.querySelector('.cards')?.dataset.board; if(bid){ adding={board:bid, col:add.dataset.add}; draft=''; render(true); } return true; }
    const more = e.target.closest('[data-act="more"]'); if(more){ const k=more.dataset.board; showAllDone[k]=!showAllDone[k]; render(true); return true; }
    const card = e.target.closest('.card'); if(card){ openSheet(card.dataset.id, card); return true; }
    return false;
  }
  function input(e){ if(e.target.id==='kbAdd') draft = e.target.value; }
  function keydown(e){
    if(e.target.id==='kbAdd'){
      if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); const v=e.target.value; draft=''; e.target.value='';
        if(v.trim()){ addSubmitting=true; addTask(adding.board, adding.col, v); render(true); addSubmitting=false; }
        else { const col=adding.col; adding=null; render(true); restoreFocus(`[data-add="${col}"]`); } }
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); const v=e.target.value; const col=adding.col; draft=''; e.target.value=''; if(v.trim()) addTask(adding.board, col, v); adding=null; render(true); restoreFocus(`[data-add="${col}"]`); }
      return;
    }
    const card = e.target.classList.contains('card') ? e.target : null;
    if(card){
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openSheet(card.dataset.id, card); return; }
      if(e.altKey && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){ e.preventDefault(); const t=S.tasks.find(x=>x.id===card.dataset.id); if(t) keyMove(t, e.key); }
    }
  }
  $('#content').addEventListener('focusout', e => {
    if(e.target.id!=='kbAdd') return; const el=e.target;
    setTimeout(()=>{ if(addSubmitting || !el.isConnected || !adding || document.activeElement===el) return;
      const v=el.value; draft=''; el.value=''; if(itemById(adding.board) && v.trim()) addTask(adding.board, adding.col, v); adding=null; render(true); }, 120);
  });
  function newShortcut(it){ adding={board:it.id, col:'todo'}; draft=''; render(true); }

  /* ---------- task window ----------
     Layout: top bar (board · saved · close), title, a property list (Status, Priority, Due, Flag),
     notes, subtasks (each can carry its own flag), updates, footer. One column at every width. */
  const sheet = $('#sheet');
  let openId = null, opener = null, timers = {}, delArmed = null;
  const cur = () => S.tasks.find(x=>x.id===openId);
  function debounced(key, fn){ clearTimeout(timers[key]?.t); window.__typingTask = openId; timers[key] = {t:setTimeout(()=>{ fn(); delete timers[key]; if(!Object.keys(timers).length) window.__typingTask=null; }, 450), flush(){ clearTimeout(this.t); fn(); delete timers[key]; }}; }
  const flushAll = () => { Object.values(timers).forEach(f=>f.flush()); window.__typingTask=null; };
  function markSaved(){ const s=$('#savedNote'); if(s) s.textContent = 'Saved'; clearTimeout(markSaved.t); markSaved.t=setTimeout(()=>{ const x=$('#savedNote'); if(x) x.textContent=''; }, 1800); }
  function quickDates(){ const d=new Date(), add=n=>{const x=new Date(d); x.setDate(x.getDate()+n); return ymd(x)}; const toMon=((8-d.getDay())%7)||7; return [['Today',add(0)],['Tomorrow',add(1)],['Next Monday',add(toMon)],['In a week',add(7)]]; }
  const grow = el => { if(!el) return; el.style.height='auto'; el.style.height=el.scrollHeight+'px'; };
  function openSheet(id, op){
    if(!S.tasks.find(x=>x.id===id)) return;
    openId = id; opener = op || null; window.__sheetOpen = true; renderSheet();
    sheet.classList.add('show'); setBackgroundInert(); document.body.classList.add('sheet-open');
    requestAnimationFrame(()=>{ grow($('#fTitle')); grow($('#fNotes')); (matchMedia('(pointer:coarse)').matches ? $('#closeSheet') : $('#fTitle'))?.focus({preventScroll:true}); });
  }
  function closeSheet(silent){
    if(!openId) return; flushAll(); closeMenu(false);
    const id = openId; openId = null; window.__sheetOpen = false;
    sheet.classList.remove('show'); setBackgroundInert(); document.body.classList.remove('sheet-open'); render(true);
    if(silent) return;
    if(!restoreFocus(`.card[data-id="${CSS.escape(id)}"]`) && !restoreFocus(`[data-open="task:${CSS.escape(id)}"]`) && opener?.isConnected) opener.focus({preventScroll:true});
  }
  function refreshSheet(){ if(openId && !Object.keys(timers).length) renderSheet(); }
  function propRow(id, label, value, extra=''){
    return `<div class="prop"><span class="prop-l" id="${id}L">${label}</span><button class="prop-v ${extra}" id="${id}" aria-haspopup="menu" aria-expanded="false" aria-labelledby="${id}L ${id}">${value}${ICON.chev}</button></div>`;
  }
  function renderSheet(){
    const t = cur(); if(!t){ closeSheet(true); return; }
    const b = itemById(t.boardId); const cl = t.checklist||[]; const doneN = cl.filter(c=>c.done).length; const f = flagOf(t.flag);
    sheet.style.setProperty('--board', itemColor(b));
    const sc = $('.sh-body', sheet)?.scrollTop || 0;
    const fk = sheet.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const d = t.due ? dueLabel(t.due) : null;
    sheet.innerHTML = `
      <div class="sh-grab" aria-hidden="true"></div>
      <div class="sh-top">
        <button class="pop" id="hBoard" aria-haspopup="menu" aria-expanded="false" title="Move to another Kanban" style="--oc:${itemColor(b)}"><span class="dot"></span><span class="lbl-t">${esc(b?.name||'')}</span>${ICON.chev}<span class="sr-only">, move to another Kanban</span></button>
        ${archived(t)?`<span class="arch-note">Archived ${doneYear(t)}</span>`:''}
        <span class="saved" id="savedNote" role="status" aria-live="polite"></span>
        <button class="icon-btn" id="closeSheet" aria-label="Close" title="Close (Esc)">${ICON.x}</button>
      </div>
      <div class="sh-body">
        <textarea class="t-input" id="fTitle" rows="1" aria-label="Task title" placeholder="Task name">${esc(t.title)}</textarea>
        <div class="props" role="group" aria-label="Task details">
          ${propRow('pCol','Status', `<span class="sdot st-${t.col}" aria-hidden="true"></span><span class="lbl-t">${colName(t.col)}</span>`)}
          ${propRow('pPri','Priority', t.priority ? `${prioIcon(t.priority)}<span class="lbl-t">${PRIO[t.priority].label}</span>` : `<span class="lbl-t muted">None</span>`)}
          ${propRow('pDue','Due', d ? `${ICON.cal}<span class="lbl-t ${d.cls}">${esc(dateLabel(t.due))} · ${esc(d.t)}</span>` : `<span class="lbl-t muted">No date</span>`)}
          ${propRow('pFlag','Flag', f ? `<span class="fdot" style="--fc:${colorOf(f.color)}"></span><span class="lbl-t">${esc(f.label)}</span>` : `<span class="lbl-t muted">None</span>`)}
          ${f&&f.who?`<div class="prop"><label class="prop-l" for="fWho">Waiting on</label><input class="prop-in" id="fWho" type="text" placeholder="Who?" value="${esc(t.flagWho||'')}"></div>`:''}
          ${(() => { const e=effFlag(t); const ef=e&&e.from&&flagOf(e.flag); return ef ? `<p class="prop-note"><span class="fdot" style="--fc:${colorOf(ef.color)}"></span>Card shows ${esc(ef.label)}${e.who&&ef.who?' · '+esc(e.who):''}, from subtask “${esc(e.from.text)}”</p>` : ''; })()}
          <input type="date" id="fDue" class="sr-only" tabindex="-1" aria-hidden="true" value="${esc(t.due||'')}">
        </div>
        <section class="sh-sec">
          <textarea class="notes" id="fNotes" rows="2" placeholder="Add notes, links, reference numbers…" aria-label="Notes">${esc(t.notes||'')}</textarea>
        </section>
        <section class="sh-sec" aria-labelledby="clLbl">
          <div class="sh-h"><h3 id="clLbl">Subtasks</h3>${cl.length?`<span class="sh-n">${doneN}/${cl.length}</span><div class="progress" aria-hidden="true"><i style="width:${doneN/cl.length*100}%;background:var(--board)"></i></div>`:''}</div>
          <div class="subs">${cl.map(c=>{ const cf=flagOf(c.flag); return `<div class="ci ${c.done?'done':''}" data-key="ci-${esc(c.id)}">
              <button class="cbox" data-ci="${esc(c.id)}" role="checkbox" aria-checked="${!!c.done}" aria-label="Done: ${esc(c.text)}">${ICON.check}</button>
              <div class="ci-m"><input type="text" data-ct="${esc(c.id)}" value="${esc(c.text)}" aria-label="Subtask">
                ${cf?`<div class="ci-f"><button class="chip sm" data-cf="${esc(c.id)}" aria-haspopup="menu" aria-expanded="false" style="--fc:${colorOf(cf.color)}" title="Change flag">${esc(flagShort(cf))}</button>${cf.who?`<input type="text" class="ci-who" data-cw="${esc(c.id)}" value="${esc(c.flagWho||'')}" placeholder="Who?" aria-label="Who is this subtask waiting on?">`:''}</div>`:''}</div>
              <button class="icon-btn mini" data-cm="${esc(c.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Options for ${esc(c.text)}">${ICON.more}</button>
            </div>`; }).join('')}
            <div class="ci add"><span class="cbox ghost" aria-hidden="true">${ICON.plus}</span><input type="text" id="fCheckNew" placeholder="Add subtask" aria-label="New subtask" enterkeyhint="done"></div>
          </div>
        </section>
        <section class="sh-sec" aria-labelledby="lgLbl">
          <div class="sh-h"><h3 id="lgLbl">Updates</h3></div>
          ${(t.log||[]).length?`<div class="log">${(t.log||[]).slice().sort((a,b)=>(a.t||'').localeCompare(b.t||'')).map(l=>`<div class="log-i"><time>${esc(stamp(l.t))}</time><p>${esc(l.text)}</p><button class="x" data-del-l="${esc(l.id)}" aria-label="Remove update from ${esc(stamp(l.t))}">${ICON.x}</button></div>`).join('')}</div>`:''}
          <div class="ci add"><span class="cbox ghost" aria-hidden="true">${ICON.plus}</span><input type="text" id="fLogNew" placeholder="Log an update, e.g. Called the insurer" aria-label="New update" enterkeyhint="send"></div>
        </section>
        <div class="sh-foot"><span>Created ${esc(stamp(t.created))}${t.doneAt&&t.col==='done'?' · Done '+esc(stamp(t.doneAt)):''}</span><button class="btn danger" id="fDelete">Delete task</button></div>
      </div>`;
    grow($('#fTitle')); grow($('#fNotes'));
    const body = $('.sh-body', sheet); if(body) body.scrollTop = sc;
    if(fk) restoreFocus(fk, sheet);
  }
  /* phone: drag the grabber or top bar down to close */
  { let y0=null, dy=0;
    sheet.addEventListener('touchstart', e => { const h=e.target.closest('.sh-grab,.sh-top'); y0 = h && !e.target.closest('button') ? e.touches[0].clientY : null; dy=0; }, {passive:true});
    sheet.addEventListener('touchmove', e => { if(y0===null) return; dy=Math.max(0, e.touches[0].clientY-y0); sheet.style.transition='none'; sheet.style.transform=`translateY(${dy}px)`; }, {passive:true});
    sheet.addEventListener('touchend', () => { if(y0===null) return; sheet.style.transition=''; sheet.style.transform=''; if(dy>80) closeSheet(); y0=null; }, {passive:true}); }
  const patchCl = (t, id, fn) => docPatch('tasks', t.id, {checklist:(t.checklist||[]).map(c=>c.id===id?fn(c):c)});
  sheet.addEventListener('input', e => {
    const t = cur(); if(!t) return; const id = e.target.id;
    if(id==='fTitle'){ grow(e.target); const v=e.target.value.replace(/\n/g,' '); debounced('title', ()=>{ docPatch('tasks', t.id, {title:v}); markSaved(); render(); }); }
    if(id==='fNotes'){ grow(e.target); const v=e.target.value; debounced('notes', ()=>{ docPatch('tasks', t.id, {notes:v}); markSaved(); }); }
    if(id==='fWho'){ const v=e.target.value; debounced('who', ()=>{ docPatch('tasks', t.id, {flagWho:v}); markSaved(); render(); }); }
    const ct = e.target.dataset.ct; if(ct){ const v=e.target.value; debounced('c'+ct, ()=>{ const x=cur(); if(!x) return; patchCl(x, ct, c=>({...c,text:v})); markSaved(); render(); }); }
    const cw = e.target.dataset.cw; if(cw){ const v=e.target.value; debounced('w'+cw, ()=>{ const x=cur(); if(!x) return; patchCl(x, cw, c=>({...c,flagWho:v})); markSaved(); render(); }); }
  });
  sheet.addEventListener('change', e => { const t=cur(); if(t && e.target.id==='fDue'){ docPatch('tasks', t.id, {due:e.target.value}); renderSheet(); markSaved(); render(); } });
  function addCheck(){ const el=$('#fCheckNew'); const v=el.value.trim(); if(!v) return; const t=cur(); docPatch('tasks', t.id, {checklist:[...(t.checklist||[]), {id:uid(), text:v, done:false}]}); renderSheet(); markSaved(); render(); $('#fCheckNew').focus(); }
  function addLog(){ const v=$('#fLogNew').value.trim(); if(!v) return; const t=cur(); docPatch('tasks', t.id, {log:[...(t.log||[]), {id:uid(), t:nowIso(), text:v}]}); renderSheet(); markSaved(); $('#fLogNew').focus(); }
  sheet.addEventListener('keydown', e => {
    if(e.key!=='Enter') return;
    if(e.target.id==='fTitle'){ e.preventDefault(); $('#fNotes')?.focus(); }
    if(e.target.id==='fCheckNew'){ e.preventDefault(); addCheck(); }
    if(e.target.id==='fLogNew'){ e.preventDefault(); addLog(); }
    if(e.target.dataset.ct){ e.preventDefault(); $('#fCheckNew')?.focus(); }
  });
  function flagItems(cur){ return [{label:'None', value:'', checked:!cur}, ...flags().map(fl=>({label:fl.label, value:fl.id, dot:colorOf(fl.color), checked:cur===fl.id}))]; }
  function pickDate(){ const i=$('#fDue'); if(!i) return; try{ i.showPicker(); }catch(e){ i.classList.remove('sr-only'); i.removeAttribute('aria-hidden'); i.focus(); } }
  sheet.addEventListener('click', e => {
    const t = cur(); if(!t) return;
    if(e.target.closest('#closeSheet')) return closeSheet();
    const hb = e.target.closest('#hBoard');
    if(hb) return openMenu(hb, kanbans().map(x=>({label:x.name, value:x.id, dot:itemColor(x), checked:x.id===t.boardId})), v => {
      if(v===t.boardId) return; const from=t.boardId, fromPos=t.pos;
      docPatch('tasks', t.id, {boardId:v, pos:endPos(v,t.col,t.id)}); renderSheet(); render(); markSaved();
      toast('Moved to '+itemById(v)?.name, () => docPatch('tasks', t.id, {boardId:from, pos:fromPos}));
    }, 'Move to Kanban');
    const pc = e.target.closest('#pCol');
    if(pc) return openMenu(pc, COLS.map(c=>({label:c.name, value:c.id, checked:c.id===t.col})), v => { if(v!==t.col){ moveTo(t, v); renderSheet(); render(); markSaved(); } }, 'Status');
    const pp = e.target.closest('#pPri');
    if(pp) return openMenu(pp, ['high','med','low',''].map(p=>({label:p?PRIO[p].label:'None', value:p, checked:(t.priority||'')===p})), v => { docPatch('tasks', t.id, {priority:v}); renderSheet(); markSaved(); render(); }, 'Priority');
    const pd = e.target.closest('#pDue');
    if(pd) return openMenu(pd, [...quickDates().map(([l,v])=>({label:`${l} · ${dateLabel(v)}`, value:v, checked:t.due===v})), {sep:true}, {label:'Pick a date…', value:'pick'}, ...(t.due?[{label:'No due date', value:'clear'}]:[])], v => {
      if(v==='pick') return pickDate();
      docPatch('tasks', t.id, {due:v==='clear'?'':v}); renderSheet(); markSaved(); render(); }, 'Due date');
    const pf = e.target.closest('#pFlag');
    if(pf) return openMenu(pf, flagItems(t.flag), v => { docPatch('tasks', t.id, {flag:v}); renderSheet(); markSaved(); render(); if(flagOf(v)?.who) $('#fWho')?.focus(); }, 'Flag');
    const cfb = e.target.closest('[data-cf]');
    if(cfb){ const id=cfb.dataset.cf; const c=(t.checklist||[]).find(x=>x.id===id); return openMenu(cfb, flagItems(c?.flag), v => { patchCl(t, id, x=>({...x, flag:v})); renderSheet(); markSaved(); render(); if(flagOf(v)?.who) $(`[data-cw="${CSS.escape(id)}"]`)?.focus(); }, 'Subtask flag'); }
    const cm = e.target.closest('[data-cm]');
    if(cm){ const id=cm.dataset.cm; const c=(t.checklist||[]).find(x=>x.id===id); if(!c) return;
      return openMenu(cm, [{head:'Flag'}, ...flagItems(c.flag), {sep:true}, {label:'Delete subtask', value:'del', danger:true}], v => {
        if(v==='del'){ const before=clone(t.checklist||[]); docPatch('tasks', t.id, {checklist:before.filter(x=>x.id!==id)}); renderSheet(); markSaved(); render(); toast('Removed “'+(c.text||'subtask')+'”', ()=>docPatch('tasks', t.id, {checklist:before})); return; }
        patchCl(t, id, x=>({...x, flag:v})); renderSheet(); markSaved(); render(); if(flagOf(v)?.who) $(`[data-cw="${CSS.escape(id)}"]`)?.focus();
      }, 'Subtask options'); }
    const ci = e.target.closest('[data-ci]'); if(ci){ patchCl(t, ci.dataset.ci, c=>({...c,done:!c.done})); renderSheet(); markSaved(); render(); return; }
    if(e.target.closest('.ci.add')){ e.target.closest('.ci.add').querySelector('input')?.focus(); return; }
    const dl = e.target.closest('[data-del-l]');
    if(dl){ const id=dl.dataset.delL; const before=clone(t.log||[]); docPatch('tasks', t.id, {log:before.filter(l=>l.id!==id)}); renderSheet(); markSaved(); toast('Update removed', ()=>docPatch('tasks', t.id, {log:before})); return; }
    const del = e.target.closest('#fDelete');
    if(del){
      if(delArmed!==t.id){ delArmed=t.id; del.classList.add('armed'); del.textContent='Tap again to delete'; setTimeout(()=>{ if(delArmed===t.id){ delArmed=null; if(del.isConnected){ del.classList.remove('armed'); del.textContent='Delete task'; } } }, 3000); return; }
      delArmed=null; flushAll(); const snap = clone(cur()); docDel('tasks', snap.id); closeSheet();
      toast('Deleted “'+snap.title+'”', ()=>docSet('tasks', snap));
    }
  });

  /* ---------- status flags (shared by every Kanban) ---------- */
  function openFlagsModal(op){
    let fl = flags().map(f=>({...f}));
    const draw = () => {
      const m = openModal(`<h2 id="mTitle">Status flags</h2>
        <p class="note">A flag sits on a card alongside its column, so a task can be In Progress and also Waiting on someone. Tick “Ask who” to add a name field. Flags are shared by every Kanban.</p>
        <div style="display:flex;flex-direction:column;gap:10px">${fl.map((f,i)=>`<div class="flag-row" data-i="${i}">
          <input class="txt-in" type="text" value="${esc(f.label)}" data-k="label" aria-label="Flag name">
          <label><input type="checkbox" data-k="who" ${f.who?'checked':''}>Ask who</label>
          <button class="x" data-rm aria-label="Remove ${esc(f.label)}">${ICON.x}</button>
          <div class="swatches" role="group" aria-label="Colour for ${esc(f.label)}">${Object.entries(COLORS).map(([k,v])=>`<button class="sw sm" data-fsw="${i}:${k}" style="--c:${v}" aria-label="${k}" aria-pressed="${k===f.color}"></button>`).join('')}</div></div>`).join('')}</div>
        <button class="btn" id="flagAdd" style="align-self:flex-start">Add flag</button>
        <div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">Save</button></div>`, {opener:op});
      m.oninput = m.onchange = e => { const row=e.target.closest('.flag-row'); const k=e.target.dataset.k; if(!row||!k) return; fl[row.dataset.i][k] = e.target.type==='checkbox' ? e.target.checked : e.target.value; };
      m.onclick = e => {
        const sw = e.target.closest('[data-fsw]'); if(sw){ const [i,k]=sw.dataset.fsw.split(':'); fl[+i].color=k; $$('.sw', sw.parentElement).forEach(s=>s.setAttribute('aria-pressed', s===sw)); return; }
        if(e.target.closest('[data-rm]')){ fl.splice(+e.target.closest('.flag-row').dataset.i,1); draw(); return; }
        if(e.target.closest('#flagAdd')){ fl.push({id:uid(), label:'New flag', color:'blue'}); draw(); requestAnimationFrame(()=>{ const ins=$$('.flag-row .txt-in', modal()); ins[ins.length-1]?.select(); }); return; }
        const b = e.target.closest('[data-x]'); if(!b) return;
        if(b.dataset.x==='yes'){ const prev=S.flags; const out=fl.filter(f=>f.label.trim()).map(f=>({id:f.id, label:f.label.trim(), color:f.color, ...(f.who?{who:true}:{})})); S.flags=out; Store.run('meta/settings', r=>r.set({flags:out}), ()=>{ S.flags=prev; }); toast('Flags saved'); render(true); }
        closeModal();
      };
    };
    draw();
  }

  return {wide:true, render:view, lanes, click, input, keydown, newShortcut, openSheet, closeSheet, refreshSheet, openFlagsModal, focusStart(){}};
})();
