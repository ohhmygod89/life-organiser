/* ============================================================
   Kanban — Life Board columns, cards and the task window.
   Tasks live in the `tasks` collection; task.boardId = the Kanban item id.
   ============================================================ */
TYPE_VIEWS.kanban = (() => {
  const COLS = [
    {id:'upcoming', name:'Upcoming', hint:'Later'},
    {id:'todo', name:'To Do', hint:''},
    {id:'doing', name:'In Progress', hint:''},
    {id:'done', name:'Done', hint:'Newest first'},
    {id:'backburner', name:'Back Burner', hint:'Parked'},
  ];
  const colName = id => COLS.find(c=>c.id===id)?.name || '';
  const DONE_LIMIT = 5;
  const showAllDone = {};
  let sortables = [], adding = null, draft = '', addSubmitting = false;

  const archived = t => t.col==='done' && doneYear(t) < CUR_YEAR;
  function tasksIn(bid, col){
    const l = S.tasks.filter(t=>t.boardId===bid && t.col===col && !archived(t));
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

  function cardHTML(t){
    const isDone = t.col==='done'; const parts = [];
    if(isDone && t.doneAt) parts.push(`<span class="okd">${ICON.check}Done ${esc(shortDate(t.doneAt))}</span>`);
    if(t.due && !isDone){ const d=dueLabel(t.due); parts.push(`<span class="${d.cls}">${ICON.cal}${esc(d.t)}</span>`); }
    const cl = t.checklist||[];
    if(cl.length && !isDone) parts.push(`<span aria-label="${cl.filter(c=>c.done).length} of ${cl.length} checklist items done">${ICON.list}${cl.filter(c=>c.done).length}/${cl.length}</span>`);
    if(!isDone && ((t.notes||'').trim() || (t.log||[]).length)) parts.push(`<span title="Has notes" aria-label="Has notes">${ICON.notes}</span>`);
    const back = colName(t.prevCol && t.prevCol!=='done' ? t.prevCol : 'todo');
    return `<article class="card ${isDone?'is-done':''}" data-id="${esc(t.id)}" data-key="card-${esc(t.id)}" tabindex="0" aria-label="${esc(t.title||'Untitled')}${t.priority&&!isDone?', '+PRIO[t.priority].label+' priority':''}">
      <button class="tick" data-tick="" title="${isDone?'Not done, back to '+back:'Mark done'}" aria-label="${isDone?'Mark not done':'Mark done'}: ${esc(t.title)}">${ICON.check}</button>
      ${!isDone && flagOf(t.flag) ? chipHTML(t) : ''}
      <div class="title">${!isDone?bangHTML(t.priority):''}${esc(t.title||'Untitled')}</div>
      ${cl.length && !isDone ? `<ul class="cl">${cl.slice(0,8).map(c=>`<li class="${c.done?'on':''}"><button class="cbox" data-cbox="${esc(c.id)}" role="checkbox" aria-checked="${!!c.done}" aria-label="${esc(c.text)}">${ICON.check}</button><span>${esc(c.text)}</span></li>`).join('')}${cl.length>8?`<li class="more-c">+${cl.length-8} more</li>`:''}</ul>` : ''}
      ${parts.length?`<div class="meta">${parts.join('')}</div>`:''}
    </article>`;
  }

  function view(it, root){
    sortables.forEach(s=>s.destroy()); sortables = [];
    if(adding && adding.board!==it.id) adding = null;
    root.innerHTML = `<div class="board" id="board">` + COLS.map(c => {
      let ts = tasksIn(it.id, c.id); const total = ts.length; let more = '';
      if(c.id==='done' && ts.length>DONE_LIMIT){ const all=showAllDone[it.id]; more=`<button class="more" data-act="more">${all?'Show fewer':'Show '+(ts.length-DONE_LIMIT)+' more'}</button>`; if(!all) ts=ts.slice(0,DONE_LIMIT); }
      const isAdding = adding?.col===c.id;
      return `<section class="col ${c.id}" aria-label="${c.name}, ${plural(total,'task')}">
        <div class="col-h"><h2>${c.name}</h2><span class="count">${total}</span>${c.hint?`<span class="hint">${c.hint}</span>`:''}</div>
        <div class="cards" data-col="${c.id}">${ts.map(cardHTML).join('')}<div class="drop-hint">${c.id==='done'?'Finished tasks land here':'Drop tasks here'}</div></div>
        ${more}
        ${c.id==='done' ? '<div style="height:8px"></div>' : `<div class="add-row">${isAdding?`<textarea class="add-input" id="kbAdd" rows="2" placeholder="Task name" aria-label="New task in ${c.name}">${esc(draft)}</textarea><div class="add-tip">Enter to add another · Esc to finish</div>`:`<button class="add-btn" data-add="${c.id}">${ICON.plus} Add task</button>`}</div>`}
      </section>`;
    }).join('') + `</div>`;
    $$('.cards', root).forEach(list => sortables.push(Sortable.create(list, {
      group:'cards', animation:RM?0:180, easing:'cubic-bezier(.2,.8,.2,1)', draggable:'.card', filter:'.tick,.cbox', preventOnFilter:false,
      delay:160, delayOnTouchOnly:true, touchStartThreshold:4, forceFallback:true, fallbackOnBody:true, fallbackClass:'dragging',
      scroll:true, bubbleScroll:true, scrollSensitivity:80,
      onStart(){ S.dragging=true }, onEnd(evt){ S.dragging=false; onDrop(evt); render(true); }
    })));
    if(adding){ const a=$('#kbAdd'); if(a){ a.focus({preventScroll:true}); a.setSelectionRange(a.value.length, a.value.length); } }
  }
  function onDrop(evt){
    const t = S.tasks.find(x=>x.id===evt.item.dataset.id); if(!t) return;
    const col = evt.to.dataset.col;
    if(col==='done'){ if(t.col!=='done') moveTo(t,'done'); return; }
    const ids = $$('.card', evt.to).map(c=>c.dataset.id); const i = ids.indexOf(t.id);
    const get = k => S.tasks.find(x=>x.id===k);
    const prev = i>0?get(ids[i-1]):null, next = i<ids.length-1?get(ids[i+1]):null;
    let pos = prev&&next ? (prev.pos+next.pos)/2 : prev ? prev.pos+1024 : next ? next.pos-1024 : 1024;
    if(col===t.col && pos===t.pos) return;
    if(prev && next && Math.abs(next.pos-prev.pos)<1e-6){ ids.forEach((k,j)=>{ if(k!==t.id) docPatch('tasks', k, {pos:(j+1)*1024}); }); pos=(i+1)*1024; }
    const p = {col, pos}; if(t.col==='done') p.prevCol = '';
    docPatch('tasks', t.id, p);
  }
  function addTask(it, col, title){
    if(!title.trim()) return;
    docSet('tasks', {id:uid(), boardId:it.id, col, pos:endPos(it.id,col), title:title.trim(), notes:'', due:'', priority:'', flag:'', flagWho:'', checklist:[], log:[], created:nowIso(), updated:nowIso()});
    touchItem(it.id);
  }
  function keyMove(t, key){
    const ci = COLS.findIndex(c=>c.id===t.col);
    if(key==='ArrowLeft'||key==='ArrowRight'){ const n=COLS[ci+(key==='ArrowRight'?1:-1)]; if(!n) return; moveTo(t, n.id); }
    else if(t.col!=='done'){ const l=tasksIn(t.boardId,t.col); const i=l.findIndex(x=>x.id===t.id); const j=i+(key==='ArrowDown'?1:-1); if(j<0||j>=l.length) return; const o=l[j], a=t.pos, b=o.pos; docPatch('tasks', t.id, {pos:b===a?b+(key==='ArrowDown'?1:-1):b}); docPatch('tasks', o.id, {pos:a}); }
    render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"]`);
  }

  function click(e, it){
    const tick = e.target.closest('[data-tick]');
    if(tick){ e.stopPropagation(); const t=S.tasks.find(x=>x.id===tick.closest('.card').dataset.id); if(t){ toggleDone(t); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"] [data-tick]`); } return; }
    const cb = e.target.closest('[data-cbox]');
    if(cb){ e.stopPropagation(); const t=S.tasks.find(x=>x.id===cb.closest('.card').dataset.id); if(t){ const id=cb.dataset.cbox; docPatch('tasks', t.id, {checklist:(t.checklist||[]).map(c=>c.id===id?{...c,done:!c.done}:c)}); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"] [data-cbox="${CSS.escape(id)}"]`); } return; }
    const add = e.target.closest('[data-add]'); if(add){ adding={board:it.id, col:add.dataset.add}; draft=''; render(true); return; }
    if(e.target.closest('[data-act="more"]')){ showAllDone[it.id]=!showAllDone[it.id]; render(true); return; }
    const card = e.target.closest('.card'); if(card) openSheet(card.dataset.id, card);
  }
  function input(e){ if(e.target.id==='kbAdd') draft = e.target.value; }
  function keydown(e, it){
    if(e.target.id==='kbAdd'){
      if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); const v=e.target.value; draft=''; e.target.value='';
        if(v.trim()){ addSubmitting=true; addTask(it, adding.col, v); render(true); addSubmitting=false; }
        else { const col=adding.col; adding=null; render(true); restoreFocus(`[data-add="${col}"]`); } }
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); const v=e.target.value; const col=adding.col; draft=''; e.target.value=''; if(v.trim()) addTask(it, col, v); adding=null; render(true); restoreFocus(`[data-add="${col}"]`); }
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
      const it=itemById(adding.board); const v=el.value; draft=''; el.value=''; if(it && v.trim()) addTask(it, adding.col, v); adding=null; render(true); }, 120);
  });
  function newShortcut(it){ adding={board:it.id, col:'todo'}; draft=''; render(true); }

  /* ---------- task window ---------- */
  const sheet = $('#sheet');
  let openId = null, opener = null, timers = {}, delArmed = null;
  const cur = () => S.tasks.find(x=>x.id===openId);
  function debounced(key, fn){ clearTimeout(timers[key]?.t); window.__typingTask = openId; timers[key] = {t:setTimeout(()=>{ fn(); delete timers[key]; if(!Object.keys(timers).length) window.__typingTask=null; }, 450), flush(){ clearTimeout(this.t); fn(); delete timers[key]; }}; }
  const flushAll = () => { Object.values(timers).forEach(f=>f.flush()); window.__typingTask=null; };
  function markSaved(){ const s=$('#savedNote'); if(s) s.textContent = 'Saved '+new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}); }
  function quickDates(){ const d=new Date(), add=n=>{const x=new Date(d); x.setDate(x.getDate()+n); return ymd(x)}; const toMon=((8-d.getDay())%7)||7; return [['Today',add(0),'Today'],['Tmrw',add(1),'Tomorrow'],['Mon',add(toMon),'Next Monday'],['+1 wk',add(7),'In one week']]; }
  function openSheet(id, op){
    if(!S.tasks.find(x=>x.id===id)) return;
    openId = id; opener = op || null; window.__sheetOpen = true; renderSheet();
    sheet.classList.add('show'); setBackgroundInert();
    requestAnimationFrame(()=>$('#fTitle')?.focus({preventScroll:true}));
  }
  function closeSheet(silent){
    if(!openId) return; flushAll(); closeMenu(false);
    const id = openId; openId = null; window.__sheetOpen = false;
    sheet.classList.remove('show'); setBackgroundInert(); render(true);
    if(silent) return;
    if(!restoreFocus(`.card[data-id="${CSS.escape(id)}"]`) && !restoreFocus(`[data-open="task:${CSS.escape(id)}"]`) && opener?.isConnected) opener.focus({preventScroll:true});
  }
  function refreshSheet(){ if(openId && !Object.keys(timers).length) renderSheet(); }
  function renderSheet(){
    const t = cur(); if(!t){ closeSheet(true); return; }
    const b = itemById(t.boardId); const cl = t.checklist||[]; const doneN = cl.filter(c=>c.done).length; const f = flagOf(t.flag);
    sheet.style.setProperty('--board', itemColor(b));
    const sc = $('.sheet-body', sheet)?.scrollTop || 0;
    const fk = sheet.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const saved = $('#savedNote')?.textContent || '';
    sheet.innerHTML = `
      <div class="sheet-h">
        <button class="pop" id="hBoard" aria-haspopup="menu" aria-expanded="false" title="Move to another Kanban" style="--oc:${itemColor(b)}"><span class="dot"></span><span class="lbl-t">${esc(b?.name||'')}</span>${ICON.chev}<span class="sr-only">, move to another Kanban</span></button>
        <button class="pop st-${t.col}" id="hCol" aria-haspopup="menu" aria-expanded="false" title="Change column"><span class="sr-only">Column: </span><span class="lbl-t">${colName(t.col)}</span>${ICON.chev}</button>
        ${archived(t)?`<span class="arch-note">Archived ${doneYear(t)}</span>`:''}
        <span class="saved" id="savedNote" role="status" aria-live="polite">${esc(saved)}</span>
        <button class="icon-btn" id="closeSheet" aria-label="Close" title="Close (Esc)">${ICON.x}</button>
      </div>
      <div class="sheet-body">
        <div class="main-c">
          <textarea class="t-input" id="fTitle" rows="1" aria-label="Task title">${esc(t.title)}</textarea>
          <label class="field"><span class="lbl">Notes</span><textarea class="notes" id="fNotes" placeholder="Details, links, reference numbers…">${esc(t.notes||'')}</textarea></label>
          <div><div class="lbl" id="clLbl" style="display:flex;gap:8px">Checklist ${cl.length?`<span style="font-weight:500">${doneN}/${cl.length}</span>`:''}</div>
            ${cl.length?`<div class="progress" style="margin:8px 0 4px" aria-hidden="true"><i style="width:${doneN/cl.length*100}%;background:var(--board)"></i></div>`:''}
            <div role="group" aria-labelledby="clLbl">${cl.map(c=>`<div class="ci ${c.done?'done':''}" data-key="ci-${esc(c.id)}"><button class="cbox" data-ci="${esc(c.id)}" role="checkbox" aria-checked="${!!c.done}" aria-label="Done: ${esc(c.text)}" style="width:22px;height:22px">${ICON.check}</button><input type="text" data-ct="${esc(c.id)}" value="${esc(c.text)}" aria-label="Checklist item"><button class="x" data-del-c="${esc(c.id)}" aria-label="Remove ${esc(c.text)}">${ICON.x}</button></div>`).join('')}</div>
            <div class="inline-add" style="margin-top:8px"><input class="field-in" id="fCheckNew" placeholder="Add an item, then Enter" aria-label="New checklist item"><button class="btn" id="fCheckAdd">Add</button></div></div>
          <div><div class="lbl">Updates</div>
            <div class="inline-add" style="margin-top:8px"><input class="field-in" id="fLogNew" placeholder="Log a dated update, e.g. Called the insurer" aria-label="New update"><button class="btn" id="fLogAdd">Log</button></div>
            <div class="log">${(t.log||[]).slice().reverse().map(l=>`<div class="log-i"><button class="x" data-del-l="${esc(l.id)}" aria-label="Remove update from ${esc(stamp(l.t))}">${ICON.x}</button><time>${esc(stamp(l.t))}</time><p>${esc(l.text)}</p></div>`).join('')}</div></div>
        </div>
        <div class="side-c">
          <div class="field"><span class="lbl" id="pLbl">Priority</span><div class="seg full" role="group" aria-labelledby="pLbl">${['','low','med','high'].map(p=>`<button data-p="${p}" aria-pressed="${(t.priority||'')===p}">${p?`<span class="bang p-${p}" aria-hidden="true" style="margin-right:3px">${PRIO[p].bang}</span>${PRIO[p].short}`:'None'}</button>`).join('')}</div></div>
          <div class="field"><span class="lbl" id="dLbl">Due date</span>
            <div class="due-row"><input type="date" id="fDue" value="${esc(t.due||'')}" aria-labelledby="dLbl">${t.due?`<button class="x" data-due="" aria-label="Clear due date" title="Clear">${ICON.x}</button>`:''}</div>
            <div class="seg full" role="group" aria-label="Quick due dates">${quickDates().map(([l,v,full])=>`<button data-due="${v}" aria-pressed="${t.due===v}" aria-label="${full}">${l}</button>`).join('')}</div></div>
          <div class="field"><span class="lbl" id="fLbl">Status flag</span>
            <button class="pop wide" id="hFlag" aria-haspopup="menu" aria-expanded="false" aria-describedby="fLbl" style="--oc:${f?colorOf(f.color):'transparent'}">${f?'<span class="dot"></span>':''}<span class="lbl-t">${esc(f?f.label:'None')}</span>${ICON.chev}</button>
            ${f&&f.who?`<input id="fWho" type="text" placeholder="Who are you waiting on?" value="${esc(t.flagWho||'')}" aria-label="Who are you waiting on?">`:''}</div>
          <div class="side-f"><span>Created ${esc(stamp(t.created))}${t.doneAt&&t.col==='done'?'<br>Done '+esc(stamp(t.doneAt)):''}</span><button class="btn danger" id="fDelete">Delete task</button></div>
        </div>
      </div>`;
    const ti = $('#fTitle'); ti.style.height='auto'; ti.style.height=ti.scrollHeight+'px';
    const body = $('.sheet-body', sheet); if(body) body.scrollTop = sc;
    if(fk) restoreFocus(fk, sheet);
  }
  sheet.addEventListener('input', e => {
    const t = cur(); if(!t) return; const id = e.target.id;
    if(id==='fTitle'){ e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; const v=e.target.value.replace(/\n/g,' '); debounced('title', ()=>{ docPatch('tasks', t.id, {title:v}); markSaved(); render(); }); }
    if(id==='fNotes'){ const v=e.target.value; debounced('notes', ()=>{ docPatch('tasks', t.id, {notes:v}); markSaved(); }); }
    if(id==='fWho'){ const v=e.target.value; debounced('who', ()=>{ docPatch('tasks', t.id, {flagWho:v}); markSaved(); }); }
    const ct = e.target.dataset.ct; if(ct){ const v=e.target.value; debounced('c'+ct, ()=>{ const x=cur(); if(!x) return; docPatch('tasks', x.id, {checklist:(x.checklist||[]).map(c=>c.id===ct?{...c,text:v}:c)}); markSaved(); }); }
  });
  sheet.addEventListener('change', e => { const t=cur(); if(t && e.target.id==='fDue'){ docPatch('tasks', t.id, {due:e.target.value}); renderSheet(); markSaved(); render(); } });
  function addCheck(){ const v=$('#fCheckNew').value.trim(); if(!v) return; const t=cur(); docPatch('tasks', t.id, {checklist:[...(t.checklist||[]), {id:uid(), text:v, done:false}]}); renderSheet(); markSaved(); $('#fCheckNew').focus(); }
  function addLog(){ const v=$('#fLogNew').value.trim(); if(!v) return; const t=cur(); docPatch('tasks', t.id, {log:[...(t.log||[]), {id:uid(), t:nowIso(), text:v}]}); renderSheet(); markSaved(); $('#fLogNew').focus(); }
  sheet.addEventListener('keydown', e => {
    if(e.key!=='Enter') return;
    if(e.target.id==='fTitle'){ e.preventDefault(); $('#fNotes')?.focus(); }
    if(e.target.id==='fCheckNew'){ e.preventDefault(); addCheck(); }
    if(e.target.id==='fLogNew'){ e.preventDefault(); addLog(); }
  });
  sheet.addEventListener('click', e => {
    const t = cur(); if(!t) return;
    if(e.target.closest('#closeSheet')) return closeSheet();
    const hb = e.target.closest('#hBoard');
    if(hb) return openMenu(hb, kanbans().map(x=>({label:x.name, value:x.id, dot:itemColor(x), checked:x.id===t.boardId})), v => {
      if(v===t.boardId) return; const from=t.boardId, fromPos=t.pos;
      docPatch('tasks', t.id, {boardId:v, pos:endPos(v,t.col,t.id)}); renderSheet(); render(); markSaved();
      toast('Moved to '+itemById(v)?.name, () => docPatch('tasks', t.id, {boardId:from, pos:fromPos}));
    }, 'Move to Kanban');
    const hc = e.target.closest('#hCol');
    if(hc) return openMenu(hc, COLS.map(c=>({label:c.name, value:c.id, checked:c.id===t.col})), v => { if(v!==t.col){ moveTo(t, v); renderSheet(); render(); markSaved(); } }, 'Column');
    const hf = e.target.closest('#hFlag');
    if(hf) return openMenu(hf, [{label:'None', value:'', checked:!t.flag}, ...flags().map(fl=>({label:fl.label, value:fl.id, dot:colorOf(fl.color), checked:t.flag===fl.id}))], v => { docPatch('tasks', t.id, {flag:v}); renderSheet(); markSaved(); render(); if(flagOf(v)?.who) $('#fWho')?.focus(); }, 'Status flag');
    const pb = e.target.closest('[data-p]'); if(pb){ docPatch('tasks', t.id, {priority:pb.dataset.p}); renderSheet(); markSaved(); render(); return; }
    const db = e.target.closest('[data-due]'); if(db){ docPatch('tasks', t.id, {due:db.dataset.due}); renderSheet(); markSaved(); render(); if(!db.dataset.due) $('#fDue')?.focus(); return; }
    const ci = e.target.closest('[data-ci]'); if(ci){ const id=ci.dataset.ci; docPatch('tasks', t.id, {checklist:(t.checklist||[]).map(c=>c.id===id?{...c,done:!c.done}:c)}); renderSheet(); markSaved(); render(); return; }
    if(e.target.closest('#fCheckAdd')) return addCheck();
    if(e.target.closest('#fLogAdd')) return addLog();
    const dc = e.target.closest('[data-del-c]');
    if(dc){ const id=dc.dataset.delC; const before=clone(t.checklist||[]); const item=before.find(c=>c.id===id); docPatch('tasks', t.id, {checklist:before.filter(c=>c.id!==id)}); renderSheet(); markSaved(); $('#fCheckNew')?.focus(); toast('Removed “'+(item?.text||'item')+'”', ()=>docPatch('tasks', t.id, {checklist:before})); return; }
    const dl = e.target.closest('[data-del-l]');
    if(dl){ const id=dl.dataset.delL; const before=clone(t.log||[]); docPatch('tasks', t.id, {log:before.filter(l=>l.id!==id)}); renderSheet(); markSaved(); $('#fLogNew')?.focus(); toast('Update removed', ()=>docPatch('tasks', t.id, {log:before})); return; }
    const del = e.target.closest('#fDelete');
    if(del){
      if(delArmed!==t.id){ delArmed=t.id; del.classList.add('armed'); del.textContent='Click again to delete'; setTimeout(()=>{ if(delArmed===t.id){ delArmed=null; if(del.isConnected){ del.classList.remove('armed'); del.textContent='Delete task'; } } }, 3000); return; }
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

  return {wide:true, render:view, click, input, keydown, newShortcut, openSheet, closeSheet, refreshSheet, openFlagsModal, focusStart(){}};
})();
