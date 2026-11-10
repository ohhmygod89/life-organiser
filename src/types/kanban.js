/* ============================================================
   Kanban — Life Board columns, cards and the task window.
   Tasks live in the `tasks` collection; task.boardId = the Kanban item id.
   ============================================================ */
TYPE_VIEWS.kanban = (() => {
  const COLS = [
    {id:'todo', name:'To Do', hint:''},
    {id:'doing', name:'In Progress', hint:''},
    {id:'done', name:'Done', hint:'Newest first'},
    {id:'backburner', name:'Backburner', hint:'Parked'},
  ];
  const colName = id => id==='upcoming' ? 'To Do' : (COLS.find(c=>c.id===id)?.name || '');
  const DONE_LIMIT = 5;
  const showAllDone = {};
  let sortables = [], adding = null, draft = '', addSubmitting = false;

  const archived = t => t.col==='done' && doneYear(t) < CUR_YEAR;
  function tasksIn(bid, col){
    const l = S.tasks.filter(t=>t.boardId===bid && (t.col===col || (col==='todo' && t.col==='upcoming')) && !archived(t));
    return col==='done' ? l.sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||'')) : l.sort((a,b)=>grp(a)-grp(b) || (a.pos??0)-(b.pos??0));
  }
  /* Columns always sort: pinned first, then High → Medium → Low → none. You can drag to reorder within a group;
     anything new, newly pinned, re-prioritised or brought back from Done goes to the bottom of its group. */
  const grp = t => (t.pinned && t.col!=='done' ? 0 : 10) + PRANK[t.priority||''];
  function groupEnd(bid, col, g, except){ const l=tasksIn(bid,col).filter(x=>x.id!==except && grp(x)===g); return (l.length?Math.max(...l.map(x=>x.pos||0)):0)+1024; }
  function endPos(bid, col, except, t){ const x = t || S.tasks.find(y=>y.id===except) || {}; return groupEnd(bid, col, grp({...x, col}), except); }
  function moveTo(t, col, {silent}={}){
    if(t.col===col) return;
    const snap = {col:t.col, pos:t.pos??1024, doneAt:t.doneAt||'', prevCol:t.prevCol||''};
    const p = {col, pos:endPos(t.boardId, col, t.id, t)};
    if(col==='done'){ p.doneAt = nowIso(); p.prevCol = t.col; }
    docPatch('tasks', t.id, p);
    if(!silent) toast(col==='done' ? 'Marked done' : 'Moved to '+colName(col), () => docPatch('tasks', t.id, clone(snap)));
  }
  const toggleDone = t => moveTo(t, t.col==='done' ? (t.prevCol && t.prevCol!=='done' ? t.prevCol : 'todo') : 'done');

  /* subtask chip on cards: just who it's waiting on (or the short flag name), full text on hover */
  const subChip = c => { const f=flagOf(c.flag); const d = flagAsk(f) && c.flagWho ? c.flagWho : ''; const txt = d || flagShort(f);   // the colour dot says which flag; the space goes to who or why
    return `<span class="chip one sub" style="--fc:${colorOf(f.color)}" title="${esc(f.label)}${d?' · '+esc(d):''}">${esc(txt)}</span>`; };
  /* Card, top to bottom: title (priority bars) · flag chip · open subtasks (indented) · footer with the due date and
     notes on the left. Top right: the pin button (always shown when pinned, on hover otherwise). No done tick: tasks
     move to Done by drag or, on touch screens, the ⇄ button. Completed subtasks are left off the card. */
  function cardHTML(t, compact){
    const isDone = t.col==='done', cl = t.checklist||[];
    const left = [], right = [];
    if(isDone && t.doneAt) left.push(`<span class="okd">${ICON.check}Done ${esc(shortDate(t.doneAt))}</span>`);
    if(t.due && !isDone){ const d=dueLabel(t.due); const near = dayDiff(t.due) <= 7;   // overdue or due within a week: add how far away
      right.push(`<span class="due ${d.cls}" title="Due ${esc(d.t)}">${esc(d.full)}${near?` · ${esc(d.rel)}`:''}</span>`); }
    const mvBtn = '';   // moving is in the card menu (hold on phone, right-click on desktop)
    const open = cl.filter(c=>!c.done); const lim = compact ? 4 : 8;
    const src = effFlag(t)?.from;   // that subtask's flag is already shown under the title
    const pinned = !!t.pinned && !isDone;
    const mvTop = mvBtn && !left.length && !right.length;   // no footer: ⇄ sits beside the pin rather than adding an empty row
    return `<article class="card ${isDone?'is-done':''} ${compact?'compact':''} ${pinned?'pinned':''} ${mvTop?'mv-top':''}" data-id="${esc(t.id)}" data-key="card-${esc(t.id)}" tabindex="0" aria-label="${pinned?'Pinned: ':''}${esc(t.title||'Untitled')}${t.priority&&!isDone?', '+PRIO[t.priority].label+' priority':''}">
      ${isDone || (TOUCH && !pinned) ? '' : TOUCH ? `<span class="pin" aria-hidden="true">${ICON.pin}</span>` : `<button class="pin" data-pin="" aria-pressed="${pinned}" title="${pinned?'Unpin':'Pin to top of column'}" aria-label="${pinned?'Unpin':'Pin'}: ${esc(t.title)}">${ICON.pin}</button>`}
      ${mvBtn && !left.length && !right.length ? mvBtn : ''}
      <div class="card-head"><div class="title">${!isDone?prioBtn(t):''}<span class="tt">${esc(t.title||'Untitled')}</span></div>
      ${!isDone ? chipHTML(t,'one') : ''}</div>
      ${!isDone && open.length ? `<ul class="cl">${open.slice(0,lim).map(c=>`<li><button class="cbox" data-cbox="${esc(c.id)}" role="checkbox" aria-checked="false" aria-label="${esc(c.text)}">${ICON.check}</button><span class="ct"><span class="ctt" data-sid="${esc(c.id)}">${esc(c.text)}</span>${flagOf(c.flag) && c!==src ? subChip(c) : ''}</span></li>`).join('')}${open.length>lim?`<li class="more-c">+${open.length-lim} more</li>`:''}</ul>` : ''}
      ${mvBtn && (left.length||right.length) ? right.push(mvBtn) && '' : ''}
      ${left.length||right.length?`<div class="meta"><span class="ml">${left.join('')}</span><span class="mr">${right.join('')}</span></div>`:''}
    </article>`;
  }
  /* the priority bars are a button: a small menu of the four levels (icons only) */
  const prioBtn = t => true ? `<button class="prio-btn ${PRIO[t.priority]?'':'none'}" data-prio="" aria-haspopup="menu" aria-expanded="false" aria-label="Priority: ${PRIO[t.priority]?.label||'None'}" title="Priority: ${PRIO[t.priority]?.label||'None'}">${prioIcon(t.priority)}</button>` : '';
  function prioMenu(btn, t){
    openMenu(btn, ['high','med','low',''].map(p=>({html:prioIcon(p), label:PRIO[p]?.label||'No priority', value:p, checked:(t.priority||'')===p})), v => {
      if(v===(t.priority||'')) return; const before = {priority:t.priority||'', pos:t.pos};
      docPatch('tasks', t.id, {priority:v, pos:groupEnd(t.boardId, t.col, grp({...t, priority:v}), t.id)}); render(true);
      toast('Priority: '+(PRIO[v]?.label||'None'), ()=>docPatch('tasks', t.id, before));
    }, 'Priority', 'menu-icons');
  }
  /* desktop: click a card's title or a subtask to edit the text in place; the rest of the card opens the task window */
  let editing = null;
  function startEdit(el, e){
    const card = el.closest('.card'); const t = S.tasks.find(x=>x.id===card?.dataset.id); if(!t) return;
    const sid = el.dataset.sid || null; const before = el.textContent;
    try{ el.contentEditable = 'plaintext-only'; }catch(err){ el.contentEditable = 'true'; }
    if(el.contentEditable!=='plaintext-only') el.contentEditable = 'true';
    el.spellcheck = true; card.classList.add('editing'); el.focus({preventScroll:true});
    try{ const sel = getSelection(); let rng = null;
      if(document.caretRangeFromPoint) rng = document.caretRangeFromPoint(e.clientX, e.clientY);
      else if(document.caretPositionFromPoint){ const cp = document.caretPositionFromPoint(e.clientX, e.clientY); if(cp){ rng = document.createRange(); rng.setStart(cp.offsetNode, cp.offset); } }
      if(rng && el.contains(rng.startContainer)){ rng.collapse(true); sel.removeAllRanges(); sel.addRange(rng); } }catch(err){}
    editing = {el, t, sid, before};
    const done = save => {
      if(!editing || editing.el!==el) return; editing = null;
      el.removeEventListener('keydown', key); el.removeEventListener('blur', blur);
      el.removeAttribute('contenteditable'); card.classList.remove('editing');
      const v = el.textContent.replace(/\s+/g,' ').trim(); const cur = S.tasks.find(x=>x.id===t.id);
      if(save && v && v!==before.trim() && cur){
        if(sid) docPatch('tasks', cur.id, {checklist:(cur.checklist||[]).map(c=>c.id===sid?{...c, text:v}:c)});
        else docPatch('tasks', cur.id, {title:v});
      } else el.textContent = before;
      render(true);
    };
    const key = ev => { if(ev.key==='Enter'){ ev.preventDefault(); ev.stopPropagation(); done(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"]`); }
      else if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); done(false); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"]`); } else ev.stopPropagation(); };
    const blur = () => done(true);
    el.addEventListener('keydown', key); el.addEventListener('blur', blur);
  }
  /* right-click a card: Duplicate, then click the column (any stack) to drop the copy there */
  let placing = null;
  function cardMenuItems(t){
    const done = t.col==='done';
    return [...(done?[]:[{label:t.pinned?'Unpin':'Pin to top', value:'pin'}]),
      {sep:true}, ...COLS.filter(c=>c.id!==t.col).map(c=>({label:'Move to '+c.name, value:'col:'+c.id})),
      {sep:true}, {label:'Duplicate…', value:'dup'}, {label:'Open', value:'open'}];
  }
  function cardAction(v, t, card, e){
    if(v==='open') return openSheet(t.id, card);
    if(v==='dup') return startPlacing(t, card, e);
    if(v==='pin'){ const now=!t.pinned; docPatch('tasks', t.id, {pinned:now, pos:groupEnd(t.boardId, t.col, grp({...t, pinned:now}), t.id)}); render(true);
      return toast(now?'Pinned to the top of '+colName(t.col):'Unpinned', ()=>docPatch('tasks', t.id, {pinned:!now, pos:t.pos})); }
    if(v.startsWith('col:')){ moveTo(t, v.slice(4)); render(true); }
  }
  function cardMenu(e){
    const card = e.target.closest('.card'); if(!card || e.target.closest('[contenteditable]')) return;
    const t = S.tasks.find(x=>x.id===card.dataset.id); if(!t) return;
    e.preventDefault();
    openMenu(pointAnchor(e), cardMenuItems(t), v => cardAction(v, t, card, e), 'Card');
  }
  /* phone: press and hold a card (without moving) for the same menu; moving instead drags it */
  { let lp = null;
    const content = $('#content');
    content.addEventListener('touchstart', e => {
      const card = e.target.closest('.card'); if(!card || e.touches.length>1 || !card.closest('.kb') || e.target.closest('button,input,textarea')) return;
      const p = e.touches[0]; clearTimeout(lp?.timer);
      lp = {card, x:p.clientX, y:p.clientY, fired:false, timer:setTimeout(() => {
        if(!lp || document.querySelector('.sortable-fallback')) return; lp.fired = true;
        const t = S.tasks.find(x=>x.id===card.dataset.id); if(!t) return;
        document.dispatchEvent(new Event('touchend', {bubbles:true}));   // stand down the pending drag
        card.classList.add('held'); try{ navigator.vibrate?.(10); }catch(err){}
        setTimeout(() => { const r = card.getBoundingClientRect();
          openMenu({getBoundingClientRect:()=>({left:r.left+12, right:r.left+12, top:r.top+20, bottom:r.top+20, width:0, height:0}), setAttribute(){}, focus(){}}, cardMenuItems(t), v => cardAction(v, t, card, {clientX:r.left+r.width/2, clientY:r.top+r.height/2}), 'Card');
          card.classList.remove('held'); }, 40);
      }, 480)};
    }, {passive:true});
    content.addEventListener('touchmove', e => { if(!lp || lp.fired) return; const p=e.touches[0]; if(Math.hypot(p.clientX-lp.x, p.clientY-lp.y) > 8){ clearTimeout(lp.timer); lp=null; } }, {passive:true});
    const end = () => { if(!lp) return; clearTimeout(lp.timer); if(lp.fired){ const c=lp.card; const swallow = ev => { if(c.contains(ev.target) || ev.target===document.documentElement || ev.target===document.body){ ev.preventDefault(); ev.stopPropagation(); } document.removeEventListener('click', swallow, true); };
        document.addEventListener('click', swallow, true); setTimeout(()=>document.removeEventListener('click', swallow, true), 700); } lp=null; };
    content.addEventListener('touchend', e => { if(e.isTrusted) end(); }, {passive:true});
    content.addEventListener('touchcancel', end, {passive:true});
    content.addEventListener('contextmenu', e => { if(TOUCH && e.target.closest('.card')) e.preventDefault(); });
  }
  function startPlacing(t, card, e){
    stopPlacing();
    const g = card.cloneNode(true); g.className = card.className + ' dup-ghost'; g.removeAttribute('tabindex'); g.setAttribute('aria-hidden','true');
    g.style.width = card.offsetWidth + 'px'; document.body.appendChild(g);
    const tip = document.createElement('div'); tip.className = 'dup-tip'; tip.setAttribute('role','status'); tip.innerHTML = TOUCH ? 'Tap a column to place the copy · <b>Cancel</b>' : 'Click a column to place the copy · Esc to cancel'; if(TOUCH) tip.style.pointerEvents='auto'; document.body.appendChild(tip);
    document.body.classList.add('placing');
    let over = null;
    const move = ev => { g.style.transform = `translate(${ev.clientX+14}px, ${ev.clientY+10}px)`;
      const l = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.lcol,.col'); const list = l?.querySelector('.cards');
      if(over && over!==list) over.closest('.lcol,.col')?.classList.remove('drop-on'); over = list || null; over?.closest('.lcol,.col')?.classList.add('drop-on'); };
    const down = ev => { if(ev.button!==0) return; ev.preventDefault(); ev.stopPropagation();
      if(ev.target.closest('.dup-tip')) return stopPlacing();
      const list = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.lcol,.col')?.querySelector('.cards');
      stopPlacing(); if(list) duplicate(t, list.dataset.board, list.dataset.col); };
    const esc = ev => { if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); stopPlacing(); } };
    document.addEventListener('pointermove', move, true); document.addEventListener('click', down, true); document.addEventListener('keydown', esc, true);
    placing = {g, tip, off(){ document.removeEventListener('pointermove', move, true); document.removeEventListener('click', down, true); document.removeEventListener('keydown', esc, true); over?.closest('.lcol,.col')?.classList.remove('drop-on'); }};
    move(e);
  }
  function stopPlacing(){ if(!placing) return; placing.off(); placing.g.remove(); placing.tip.remove(); placing = null; document.body.classList.remove('placing'); }
  function duplicate(t, bid, col){
    if(!bid || !col) return;
    const id = uid(), now = nowIso();
    const copy = {...clone(t), id, boardId:bid, col, checklist:(t.checklist||[]).map(c=>({...c, id:uid()})), log:[], created:now, updated:now, doneAt: col==='done' ? now : '', prevCol:''};
    copy.pos = groupEnd(bid, col, grp(copy));
    docSet('tasks', copy); touchItem(bid); render(true);
    toast(`Copied to ${itemById(bid)?.name||'stack'} · ${colName(col)}`, ()=>docDel('tasks', id));
    requestAnimationFrame(()=>{ const c=document.querySelector(`.card[data-id="${CSS.escape(id)}"]`); c?.classList.add('flash'); c?.scrollIntoView({block:'nearest', inline:'nearest'}); });
  }
  $('#content').addEventListener('contextmenu', e => { if(e.target.closest('.kb .card')) cardMenu(e); });
  function addRowHTML(bid, c){
    const isAdding = adding?.board===bid && adding?.col===c.id;
    return isAdding ? `<div class="add-row"><div class="add-wrap"><textarea class="add-input" id="kbAdd" rows="2" placeholder="Task name" aria-label="New task in ${c.name}" enterkeyhint="send">${esc(draft)}</textarea><button class="send-btn" data-send="task" aria-label="Add task" title="Add">${ICON.send}</button></div><div class="add-tip">${TOUCH?'Tap outside to finish':'Enter to add another · Esc to finish'}</div></div>`
      : `<div class="add-row"><button class="add-btn" data-add="${c.id}">${ICON.plus} Add task</button></div>`;
  }
  function bindSortables(root){
    sortables.forEach(s=>s.destroy()); sortables = [];
    $$('.cards', root).forEach(list => sortables.push(Sortable.create(list, {
      group:'cards', animation:RM?0:180, easing:'cubic-bezier(.2,.8,.2,1)', draggable:'.card', filter:'.pin,.cbox,.mv,.prio-btn,[contenteditable]', preventOnFilter:false,
      delay:200, delayOnTouchOnly:true, touchStartThreshold:6, forceFallback:true, fallbackOnBody:true, fallbackClass:'dragging', fallbackTolerance:3,
      emptyInsertThreshold:60, swapThreshold:1, invertSwap:false,   /* cards make room as soon as you reach them */ direction:'vertical', ghostClass:'ghost-card',
      scroll:true, bubbleScroll:true, scrollSensitivity:44, scrollSpeed:9,
      /* touch: only scroll up/down near the top or bottom edge; never slide the board sideways under a picked-up card */
      scrollFn: TOUCH ? (dx, dy) => { if(dy) window.scrollBy(0, dy); } : undefined,
      /* pinned cards stay among pinned cards, unpinned among unpinned: the drop slot never offers a place that wouldn't stick */
      onMove(evt){
        if(evt.from!==evt.to || evt.to.dataset.col==='done') return true;     // another column: it sorts itself on release
        const me = S.tasks.find(x=>x.id===evt.dragged.dataset.id); if(!me) return true;
        const rel = evt.related?.classList?.contains('card') ? S.tasks.find(x=>x.id===evt.related.dataset.id) : null;
        if(!rel){ const cards = $$('.card', evt.to).filter(c=>c!==evt.dragged); const last = cards.length && S.tasks.find(x=>x.id===cards[cards.length-1].dataset.id); return !last || grp(last)===grp(me); }
        return grp(rel)===grp(me);   // same column: only among cards of the same pinned/priority group
      },
      onStart(){ S.dragging=true; document.body.classList.add('is-dragging'); },
      onEnd(evt){ S.dragging=false; document.body.classList.remove('is-dragging'); onDrop(evt); render(true);
        /* Sortable may swallow the next click after a drag; release it so the first click on a card opens it */
        setTimeout(() => document.dispatchEvent(new MouseEvent('click', {bubbles:true})), 0); }
    })));
    if(adding){ const a=$('#kbAdd'); if(a){ a.focus({preventScroll:true}); a.setSelectionRange(a.value.length, a.value.length); a.scrollIntoView({block:'nearest', inline:'nearest'}); } }
  }

  function view(it, root){ renderKanban(it, root); }

  /* Stacked view: one band per Kanban, all sharing one sideways scroller so the columns line up. */
  const LANE_DONE = 3;
  function lanes(boards, root, {bb=false, test=null, done=true}={}){
    const cols = COLS.filter(c => (bb || c.id!=='backburner') && (done && !test || c.id!=='done'));
    if(adding && !boards.some(b=>b.id===adding.board)) adding = null;
    const keep = t => !test || test(t);
    root.innerHTML = `<div class="lanes" data-hs="lanes" style="--n:${cols.length}"><div class="lanes-in">` + boards.map(b => {
      const open = S.tasks.filter(t=>t.boardId===b.id && !['done','backburner'].includes(t.col) && keep(t)).length;
      return `<section class="lane" style="--board:${itemColor(b)}" aria-label="${esc(b.name)}" data-key="lane-${esc(b.id)}">
        <div class="lane-h"><div class="lane-hi"><h2><input class="lane-name" data-sname="${esc(b.id)}" value="${esc(b.name)}" size="${Math.max(3,(b.name||'').length+1)}" maxlength="60" aria-label="Stack name" title="Rename stack"></h2><span class="count">${plural(open,'open task')} · ${S.tasks.filter(t=>t.boardId===b.id && (t.col==='todo'||t.col==='upcoming') && keep(t)).length} to do · ${S.tasks.filter(t=>t.boardId===b.id && t.col==='doing' && keep(t)).length} in progress</span>
          <button class="icon-btn mini lane-more" data-act="stack-menu" data-sid="${esc(b.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(b.name)} stack options" title="Stack options">${ICON.more}</button></div></div>
        <div class="lane-cols">${cols.map(c => {
          let ts = tasksIn(b.id, c.id).filter(keep); const total = ts.length; let more = '';
          const lim = LANE_DONE; if(c.id==='done' && ts.length>lim){ const all=showAllDone['lane-'+b.id]; more=`<button class="more" data-act="more" data-board="lane-${esc(b.id)}">${all?'Show fewer':'Show '+(ts.length-lim)+' more'}</button>`; if(!all) ts=ts.slice(0,lim); }
          return `<div class="lcol col ${c.id}" aria-label="${esc(b.name)}, ${c.name}, ${plural(total,'task')}">
            <div class="lcol-h"><span>${c.name}</span><span class="count">${total||''}</span>${c.id==='done'?'':`<button class="lcol-add" data-add="${c.id}" aria-label="Add task to ${esc(b.name)}, ${c.name}" title="Add task">${ICON.plus}</button>`}</div>
            <div class="cards" data-col="${c.id}" data-board="${esc(b.id)}">${ts.map(t=>cardHTML(t,true)).join('')}<div class="drop-hint">None</div></div>
            ${adding?.board===b.id && adding?.col===c.id ? addRowHTML(b.id, c) : ''}
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
      const p = {boardId:bid, col, pos:endPos(bid, col, t.id, t)}; if(col==='done' && t.col!=='done'){ p.doneAt=nowIso(); p.prevCol=t.col; }
      docPatch('tasks', t.id, p); touchItem(bid);
      toast('Moved to '+(itemById(bid)?.name||'board')+' · '+colName(col), () => docPatch('tasks', t.id, clone(from)));
      return;
    }
    if(col==='done'){ if(t.col!=='done') moveTo(t,'done'); return; }
    if(col!==t.col){   // another column: it settles at the bottom of its group there
      const p = {col, pos:endPos(bid, col, t.id, t)}; if(t.col==='done') p.prevCol = '';
      toast('Moved to '+colName(col), ()=>docPatch('tasks', t.id, {col:t.col, pos:t.pos??1024})); docPatch('tasks', t.id, p); return;
    }
    const ids = $$('.card', evt.to).map(c=>c.dataset.id); const i = ids.indexOf(t.id);
    const get = k => S.tasks.find(x=>x.id===k);
    /* only neighbours in the same group (pinned + priority) decide the new position */
    const same = x => x && grp(x) === grp(t);
    let prev = null, next = null;
    for(let j=i-1; j>=0; j--){ const x=get(ids[j]); if(same(x)){ prev=x; break; } }
    for(let j=i+1; j<ids.length; j++){ const x=get(ids[j]); if(same(x)){ next=x; break; } }
    let pos = prev&&next ? (prev.pos+next.pos)/2 : prev ? prev.pos+1024 : next ? next.pos-1024 : 1024;
    if(col===t.col && pos===t.pos) return;
    if(prev && next && Math.abs(next.pos-prev.pos)<1e-6){ ids.forEach((k,j)=>{ if(k!==t.id) docPatch('tasks', k, {pos:(j+1)*1024}); }); pos=(i+1)*1024; }
    const p = {col, pos}; if(t.col==='done') p.prevCol = '';
    if(col!==t.col) toast('Moved to '+colName(col), ()=>docPatch('tasks', t.id, {col:t.col, pos:t.pos??1024}));
    docPatch('tasks', t.id, p);
  }
  function addTask(bid, col, title){
    if(!title.trim()) return;
    const pos = groupEnd(bid, col, grp({col}));   // bottom of the no-priority group, i.e. under the cards, by the add box
    const id = uid();
    docSet('tasks', {id, boardId:bid, col, pos, title:title.trim(), notes:'', due:'', priority:'', flag:'', flagWho:'', checklist:[], log:[], created:nowIso(), updated:nowIso()});
    touchItem(bid);
  }
  function keyMove(t, key){
    const ci = COLS.findIndex(c=>c.id===t.col);
    if(key==='ArrowLeft'||key==='ArrowRight'){ const n=COLS[ci+(key==='ArrowRight'?1:-1)]; if(!n) return; moveTo(t, n.id); }
    else if(t.col!=='done'){ const l=tasksIn(t.boardId,t.col); const i=l.findIndex(x=>x.id===t.id); const j=i+(key==='ArrowDown'?1:-1); if(j<0||j>=l.length || grp(l[j])!==grp(t)) return; const o=l[j], a=t.pos, b=o.pos; docPatch('tasks', t.id, {pos:b===a?b+(key==='ArrowDown'?1:-1):b}); docPatch('tasks', o.id, {pos:a}); }
    render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"]`);
  }

  function click(e){
    const cardOf = el => S.tasks.find(x=>x.id===el.closest('.card').dataset.id);
    if(e.target.closest('[data-act="done"]')){ toggleShowDone(); return true; }
    const pinB = e.target.closest('[data-pin]');
    if(pinB){ e.stopPropagation(); const t=cardOf(pinB); if(t){ const now=!t.pinned; docPatch('tasks', t.id, {pinned:now, pos:groupEnd(t.boardId, t.col, grp({...t, pinned:now}), t.id)}); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"] [data-pin]`); toast(now?'Pinned to the top of '+colName(t.col):'Unpinned', ()=>docPatch('tasks', t.id, {pinned:!now})); } return true; }
    const tick = e.target.closest('[data-tick]');
    if(tick){ e.stopPropagation(); const t=cardOf(tick); if(t){ toggleDone(t); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"] [data-tick]`); } return true; }
    const mv = e.target.closest('[data-mv]');
    if(mv){ e.stopPropagation(); const t=cardOf(mv); if(t) openMenu(mv, COLS.map(c=>({label:c.name, value:c.id, checked:c.id===t.col})), v => { if(v!==t.col){ moveTo(t, v); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"]`); } }, 'Move to column'); return true; }
    const cb = e.target.closest('[data-cbox]');
    if(cb){ e.stopPropagation(); const t=cardOf(cb); if(t){ const id=cb.dataset.cbox; docPatch('tasks', t.id, {checklist:(t.checklist||[]).map(c=>c.id===id?{...c,done:!c.done}:c)}); render(true); restoreFocus(`.card[data-id="${CSS.escape(t.id)}"] [data-cbox="${CSS.escape(id)}"]`); } return true; }
    const add = e.target.closest('[data-add]');
    if(add){ const bid = add.closest('[data-board]')?.dataset.board || add.closest('.col')?.querySelector('.cards')?.dataset.board; if(bid){ adding={board:bid, col:add.dataset.add}; draft=''; render(true); } return true; }
    const more = e.target.closest('[data-act="more"]'); if(more){ const k=more.dataset.board; showAllDone[k]=!showAllDone[k]; render(true); return true; }
    const sb = e.target.closest('[data-send="task"]');
    if(sb){ const el=$('#kbAdd'); const v=el?.value||''; if(adding && v.trim()){ draft=''; addSubmitting=true; addTask(adding.board, adding.col, v); render(true); addSubmitting=false; } else $('#kbAdd')?.focus(); return true; }
    const pb = e.target.closest('[data-prio]'); if(pb){ e.stopPropagation(); const t=cardOf(pb); if(t) prioMenu(pb, t); return true; }
    if(e.target.closest('.lane-name')) return true;
    const ed = !TOUCH && e.isTrusted && e.target.closest('.card:not(.is-done) .tt, .card .ctt');
    if(ed){ if(!ed.isContentEditable) startEdit(ed, e); return true; }
    if(e.target.closest('[contenteditable]')) return true;
    const card = e.target.closest('.card'); if(card){ openSheet(card.dataset.id, card); return true; }
    return false;
  }
  function input(e){ if(e.target.id==='kbAdd') draft = e.target.value; if(e.target.matches('.lane-name')) e.target.size = Math.max(3, e.target.value.length+1); }
  function change(e){
    const n = e.target.closest('[data-sname]'); if(!n) return;
    const s = itemById(n.dataset.sname); const v = n.value.trim();
    if(!s) return; if(!v){ n.value = s.name; return; }
    if(v!==s.name){ const before=s.name; docPatch('items', s.id, {name:v}); render(true); toast('Stack renamed', ()=>docPatch('items', s.id, {name:before})); }
  }
  function keydown(e){
    if(e.target.matches?.('.lane-name')){
      if(e.key==='Enter'){ e.preventDefault(); e.target.blur(); }
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); const s=itemById(e.target.dataset.sname); if(s) e.target.value=s.name; e.target.blur(); }
      return;
    }
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
    setTimeout(()=>{ if(addSubmitting || Date.now()-(window.__sendPress||0) < 600 || !el.isConnected || !adding || document.activeElement===el) return;
      const v=el.value; draft=''; el.value=''; if(itemById(adding.board) && v.trim()) addTask(adding.board, adding.col, v); adding=null; render(true); }, 120);
  });
  function newShortcut(it){ const s = stacksOf(it.id)[0]; if(!s) return; adding={board:s.id, col:'todo'}; draft=''; render(true); }

  /* ---------- task window ----------
     Layout: top bar (board · saved · close), title, a property list (Status, Priority, Due, Flag),
     notes, subtasks (each can carry its own flag), updates, footer. One column at every width. */
  const sheet = $('#sheet'); sheet.tabIndex = -1;
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
    requestAnimationFrame(()=>{ grow($('#fTitle')); grow($('#fNotes')); (TOUCH ? sheet : $('#fTitle'))?.focus({preventScroll:true}); });
  }
  function closeSheet(silent){
    if(!openId) return; flushAll(); closeMenu(false);
    const id = openId; openId = null; window.__sheetOpen = false;
    sheet.classList.remove('show'); setBackgroundInert(); document.body.classList.remove('sheet-open'); render(true);
    if(silent) return;
    if(!restoreFocus(`.card[data-id="${CSS.escape(id)}"]`) && !restoreFocus(`[data-open="task:${CSS.escape(id)}"]`) && opener?.isConnected) opener.focus({preventScroll:true});
  }
  /* Never rebuild the window while you're typing in it: that recreates the box you're in, drops the iPhone keyboard and
     shifts the screen (taps then land in the wrong place). Changes are shown once you've left the box. */
  const typingInSheet = () => sheet.contains(document.activeElement) && document.activeElement.matches('input,textarea');
  let refreshPending = false;
  function refreshSheet(){ if(!openId) return; if(typingInSheet() || Object.keys(timers).length){ refreshPending = true; return; } renderSheet(); }
  sheet.addEventListener('focusout', () => setTimeout(() => { if(refreshPending && openId && !typingInSheet() && !Object.keys(timers).length){ refreshPending = false; renderSheet(); } }, 450));
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
        <textarea class="t-input" id="fTitle" rows="1" aria-label="Task title" placeholder="Task name">${esc(t.title)}</textarea>
        <span class="saved" id="savedNote" role="status" aria-live="polite"></span>
        ${t.col!=='done'?`<button class="icon-btn pin-btn" id="fPin" aria-pressed="${!!t.pinned}" aria-label="${t.pinned?'Unpin':'Pin to top of column'}" title="${t.pinned?'Unpin':'Pin to top of column'}">${ICON.pin}</button>`:''}
        <button class="icon-btn" id="closeSheet" aria-label="Close" title="Close (Esc)">${ICON.x}</button>
      </div>
      <div class="sh-body">
        ${archived(t)?`<span class="arch-note">Archived ${doneYear(t)}</span>`:''}
        <div class="props" role="group" aria-label="Task details">
          ${propRow('hBoard','Stack', `<span class="lbl-t">${esc(b?.name||'')}</span>`)}
          ${propRow('pCol','Status', `<span class="sdot st-${t.col}" aria-hidden="true"></span><span class="lbl-t">${colName(t.col)}</span>`)}
          ${propRow('pPri','Priority', t.priority ? `${prioIcon(t.priority)}<span class="lbl-t">${PRIO[t.priority].label}</span>` : `<span class="lbl-t muted">None</span>`)}
          ${propRow('pDue','Due', d ? `${ICON.cal}<span class="lbl-t ${d.cls}">${esc(d.t)}</span>` : `<span class="lbl-t muted">No date</span>`)}
          ${propRow('pFlag','Flag', f ? `<span class="fdot" style="--fc:${colorOf(f.color)}"></span><span class="lbl-t">${esc(f.label)}</span>` : `<span class="lbl-t muted">None</span>`)}
          ${flagAsk(f)?`<div class="prop"><label class="prop-l" for="fWho">${flagAskLabel(f)}</label><input class="prop-in" id="fWho" type="text" placeholder="${flagAsk(f)}" value="${esc(t.flagWho||'')}"></div>`:''}
          ${(() => { const e=effFlag(t); const ef=e&&e.from&&flagOf(e.flag); return ef ? `<p class="prop-note"><span class="fdot" style="--fc:${colorOf(ef.color)}"></span>Card shows ${esc(ef.label)}${e.who&&flagAsk(ef)?' · '+esc(e.who):''}, from subtask “${esc(e.from.text)}”</p>` : ''; })()}
          <input type="date" id="fDue" class="sr-only" tabindex="-1" aria-hidden="true" value="${esc(t.due||'')}">
        </div>
        <section class="sh-sec">
          <textarea class="notes" id="fNotes" rows="2" placeholder="Add notes, links, reference numbers…" aria-label="Notes">${esc(t.notes||'')}</textarea>
        </section>
        <section class="sh-sec" aria-labelledby="clLbl">
          <div class="sh-h"><h3 id="clLbl">Subtasks</h3>${cl.length?`<span class="sh-n">${doneN}/${cl.length}</span><div class="progress" aria-hidden="true"><i style="width:${doneN/cl.length*100}%;background:var(--board)"></i></div>`:''}</div>
          <div class="subs">${cl.map(c=>{ const cf=flagOf(c.flag); return `<div class="ci ${c.done?'done':''}" data-key="ci-${esc(c.id)}">
              <button class="cbox" data-ci="${esc(c.id)}" role="checkbox" aria-checked="${!!c.done}" aria-label="Done: ${esc(c.text)}">${ICON.check}</button>
              <div class="ci-m"><div class="ci-row"><input type="text" data-ct="${esc(c.id)}" value="${esc(c.text)}" aria-label="Subtask">
                ${c.done ? '' : cf ? `<button class="chip sm" data-cf="${esc(c.id)}" aria-haspopup="menu" aria-expanded="false" style="--fc:${colorOf(cf.color)}" title="Change flag">${esc(flagShort(cf))}</button>` : `<button class="icon-btn mini flag-add" data-cf="${esc(c.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Flag ${esc(c.text)}" title="Add a flag">${ICON.flag}</button>`}
                <button class="icon-btn mini" data-cdel="${esc(c.id)}" aria-label="Delete subtask ${esc(c.text)}" title="Delete subtask">${ICON.x}</button></div>
                ${cf && !c.done && flagAsk(cf)?`<div class="ci-f"><input type="text" class="ci-who" data-cw="${esc(c.id)}" value="${esc(c.flagWho||'')}" placeholder="${flagAsk(cf)}" aria-label="${flagAsk(cf)==='Who?'?'Who is this subtask waiting on?':'Why does this subtask '+esc(cf.label.toLowerCase())+'?'}"></div>`:''}</div>
            </div>`; }).join('')}
            <div class="ci add"><span class="cbox ghost" aria-hidden="true">${ICON.plus}</span><input type="text" id="fCheckNew" placeholder="Add subtask" aria-label="New subtask" enterkeyhint="done"><button class="send-btn" data-send="check" aria-label="Add subtask" title="Add">${ICON.send}</button></div>
          </div>
        </section>
        <section class="sh-sec" aria-labelledby="lgLbl">
          <div class="sh-h"><h3 id="lgLbl">Updates</h3></div>
          ${(t.log||[]).length?`<div class="log">${(t.log||[]).slice().sort((a,b)=>(a.t||'').localeCompare(b.t||'')).map(l=>`<div class="log-i"><time>${esc(stamp(l.t))}</time><p>${esc(l.text)}</p><button class="x" data-del-l="${esc(l.id)}" aria-label="Remove update from ${esc(stamp(l.t))}">${ICON.x}</button></div>`).join('')}</div>`:''}
          <div class="ci add"><span class="cbox ghost" aria-hidden="true">${ICON.plus}</span><input type="text" id="fLogNew" placeholder="Log an update, e.g. Called the insurer" aria-label="New update" enterkeyhint="send"><button class="send-btn" data-send="log" aria-label="Add update" title="Add">${ICON.send}</button></div>
        </section>
        <div class="sh-foot"><span>Created ${esc(stamp(t.created))}${t.doneAt&&t.col==='done'?' · Done '+esc(stamp(t.doneAt)):''}</span><button class="btn danger" id="fDelete">Delete task</button></div>
      </div>`;
    grow($('#fTitle')); grow($('#fNotes'));
    const body = $('.sh-body', sheet); if(body) body.scrollTop = sc;
    if(fk) restoreFocus(fk, sheet);
  }
  /* phone: drag the grabber or top bar down to close */
  { let y0=null, dy=0;
    sheet.addEventListener('touchstart', e => { const h=e.target.closest('.sh-grab,.sh-top'); y0 = h && !e.target.closest('button,textarea,input') ? e.touches[0].clientY : null; dy=0; }, {passive:true});
    sheet.addEventListener('touchmove', e => { if(y0===null) return; dy=Math.max(0, e.touches[0].clientY-y0); sheet.style.transition='none'; sheet.style.transform=`translateY(${dy}px)`; }, {passive:true});
    const endSwipe = close => { if(y0===null) return; sheet.style.transition=''; sheet.style.transform=''; if(close && dy>80) closeSheet(); y0=null; };
    sheet.addEventListener('touchend', () => endSwipe(true), {passive:true});
    sheet.addEventListener('touchcancel', () => endSwipe(false), {passive:true}); }
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
  function addCheck(){ const el=$('#fCheckNew'); const v=el.value.trim(); if(!v) return; const t=cur(); docPatch('tasks', t.id, {checklist:[...(t.checklist||[]), {id:uid(), text:v, done:false}]}); renderSheet(); markSaved(); render(); const n=$('#fCheckNew'); n.focus({preventScroll:true}); reveal(n); }
  function addLog(){ const v=$('#fLogNew').value.trim(); if(!v) return; const t=cur(); docPatch('tasks', t.id, {log:[...(t.log||[]), {id:uid(), t:nowIso(), text:v}]}); renderSheet(); markSaved(); const n=$('#fLogNew'); n.focus({preventScroll:true}); reveal(n); }
  /* keep what you just added, or the box you are typing in, in view (also once the keyboard has opened) */
  function reveal(el){ if(!el) return; const go = () => el.isConnected && el.scrollIntoView({block:'center', behavior:RM?'auto':'smooth'}); requestAnimationFrame(go); setTimeout(go, 350); }
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
    const sb = e.target.closest('[data-send]'); if(sb){ if(sb.dataset.send==='check') addCheck(); else addLog(); return; }
    if(e.target.closest('#closeSheet')) return closeSheet();
    const hb = e.target.closest('#hBoard');
    if(hb) return openMenu(hb, kanbans().map(x=>({label:(itemsOf(i=>i.type==='kanban').length>1 ? topOf(x).name+' › ' : '')+x.name, value:x.id, checked:x.id===t.boardId})), v => {
      if(v===t.boardId) return; const from=t.boardId, fromPos=t.pos;
      docPatch('tasks', t.id, {boardId:v, pos:endPos(v,t.col,t.id,t)}); renderSheet(); render(); markSaved();
      toast('Moved to '+itemById(v)?.name, () => docPatch('tasks', t.id, {boardId:from, pos:fromPos}));
    }, 'Move to stack');
    const pc = e.target.closest('#pCol');
    if(pc) return openMenu(pc, COLS.map(c=>({label:c.name, value:c.id, checked:c.id===t.col})), v => { if(v!==t.col){ moveTo(t, v); renderSheet(); render(); markSaved(); } }, 'Status');
    const pp = e.target.closest('#pPri');
    if(pp) return openMenu(pp, ['high','med','low',''].map(p=>({label:p?PRIO[p].label:'None', value:p, checked:(t.priority||'')===p})), v => { if(v===(t.priority||'')) return; docPatch('tasks', t.id, {priority:v, pos:groupEnd(t.boardId, t.col, grp({...t, priority:v}), t.id)}); renderSheet(); markSaved(); render(); }, 'Priority');
    const pd = e.target.closest('#pDue');
    if(pd) return openMenu(pd, [...quickDates().map(([l,v])=>({label:`${l} · ${dateLabel(v)}`, value:v, checked:t.due===v})), {sep:true}, {label:'Pick a date…', value:'pick'}, ...(t.due?[{label:'No due date', value:'clear'}]:[])], v => {
      if(v==='pick') return pickDate();
      docPatch('tasks', t.id, {due:v==='clear'?'':v}); renderSheet(); markSaved(); render(); }, 'Due date');
    const pf = e.target.closest('#pFlag');
    if(pf) return openMenu(pf, flagItems(t.flag), v => { docPatch('tasks', t.id, {flag:v, ...(v!==t.flag?{flagWho:''}:{})}); renderSheet(); markSaved(); render(); const w=$('#fWho'); if(flagAsk(flagOf(v)) && w){ w.focus({preventScroll:true}); reveal(w); } }, 'Flag');
    if(e.target.closest('#fPin')){ const now = !t.pinned; docPatch('tasks', t.id, {pinned:now, pos:groupEnd(t.boardId, t.col, grp({...t, pinned:now}), t.id)}); renderSheet(); markSaved(); render(); toast(now ? 'Pinned to the top of '+colName(t.col) : 'Unpinned'); return; }
    const cd = e.target.closest('[data-cdel]');
    if(cd){ const id=cd.dataset.cdel; const c=(t.checklist||[]).find(x=>x.id===id); const before=clone(t.checklist||[]); docPatch('tasks', t.id, {checklist:before.filter(x=>x.id!==id)}); renderSheet(); markSaved(); render(); toast('Removed “'+(c?.text||'subtask')+'”', ()=>docPatch('tasks', t.id, {checklist:before})); return; }
    const cfb = e.target.closest('[data-cf]');
    if(cfb){ const id=cfb.dataset.cf; const c=(t.checklist||[]).find(x=>x.id===id); return openMenu(cfb, flagItems(c?.flag), v => { patchCl(t, id, x=>({...x, flag:v, ...(v!==x.flag?{flagWho:''}:{})})); renderSheet(); markSaved(); render(); const w=$(`[data-cw="${CSS.escape(id)}"]`); if(flagAsk(flagOf(v)) && w){ w.focus({preventScroll:true}); reveal(w); } }, 'Subtask flag'); }
    const cm = e.target.closest('[data-cm]');
    if(cm){ const id=cm.dataset.cm; const c=(t.checklist||[]).find(x=>x.id===id); if(!c) return;
      return openMenu(cm, [{head:'Flag'}, ...flagItems(c.flag), {sep:true}, {label:'Delete subtask', value:'del', danger:true}], v => {
        if(v==='del'){ const before=clone(t.checklist||[]); docPatch('tasks', t.id, {checklist:before.filter(x=>x.id!==id)}); renderSheet(); markSaved(); render(); toast('Removed “'+(c.text||'subtask')+'”', ()=>docPatch('tasks', t.id, {checklist:before})); return; }
        patchCl(t, id, x=>({...x, flag:v, ...(v!==x.flag?{flagWho:''}:{})})); renderSheet(); markSaved(); render(); if(flagAsk(flagOf(v))) $(`[data-cw="${CSS.escape(id)}"]`)?.focus();
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
        <p class="note">A flag sits on a card alongside its column, so a task can be In Progress and also Waiting. Tick “Ask who” to add a name field. Flags are shared by every Kanban.</p>
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

  return {wide:true, render:view, lanes, click, input, change, keydown, newShortcut, openSheet, closeSheet, refreshSheet, openFlagsModal, focusStart(){}};
})();
