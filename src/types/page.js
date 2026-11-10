/* ============================================================
   Page — a modular page built from blocks, like a WordPress page editor.
   Blocks are items with parent = page.id and type note (Text), checklist or collection (Table);
   each block keeps its own data and is drawn by that type's view.
   ============================================================ */
TYPE_VIEWS.page = (() => {
  const KINDS = [{type:'note', label:'Text'}, {type:'checklist', label:'Checklist'}, {type:'collection', label:'Table'}];
  let sortable = null;
  const blockOf = e => { const r = e.target.closest('[data-root]'); return r && itemById(r.dataset.root); };

  function view(it, root){
    const bl = blocksOf(it.id);
    sortable?.destroy(); sortable = null;
    root.innerHTML = `
      <div class="blocks" id="blocks">${bl.map(b=>`
        <section class="block" data-block="${esc(b.id)}" data-key="blk-${esc(b.id)}" aria-label="${esc(TYPES[b.type].label)} block">
          <div class="blk-bar">
            ${bl.length>1?`<span class="grip blk-grip" title="Drag to move this block" aria-hidden="true">${ICON.grip}</span>`:''}
            <span class="blk-ic" aria-hidden="true">${ICON[b.type]}</span>
            <input class="blk-name" data-bname="${esc(b.id)}" value="${esc(b.name||'')}" placeholder="${esc(TYPES[b.type].label)}" aria-label="Block title" maxlength="80">
            <span class="blk-kind">${esc(TYPES[b.type].label)}</span>
            ${bl.length>1?`<button class="icon-btn mini" data-bmove="up" data-bid="${esc(b.id)}" aria-label="Move ${esc(b.name||'block')} up" title="Move up" ${bl[0]===b?'disabled':''}>${ICON.up}</button><button class="icon-btn mini" data-bmove="down" data-bid="${esc(b.id)}" aria-label="Move ${esc(b.name||'block')} down" title="Move down" ${bl[bl.length-1]===b?'disabled':''}>${ICON.chevD}</button>`:''}
            <button class="icon-btn mini blk-del" data-bdel="${esc(b.id)}" aria-label="Remove ${esc(b.name||'block')}" title="Remove block">${ICON.x}</button>
          </div>
          <div class="blk-body"></div>
        </section>`).join('')}</div>
      ${bl.length ? '' : `<div class="panel empty-state"><b>This page is empty</b>Add a block below. Mix text, checklists and tables, and drag blocks to rearrange them.</div>`}
      <div class="blk-add" role="group" aria-label="Add a block"><span class="caption">Add block</span>
        ${KINDS.map(k=>`<button class="btn" data-badd="${k.type}">${ICON[k.type]}${k.label}</button>`).join('')}</div>`;
    bl.forEach(b => TYPE_VIEWS[b.type].render(b, root.querySelector(`[data-block="${CSS.escape(b.id)}"] .blk-body`)));
    if(bl.length>1) sortable = Sortable.create(root.querySelector('#blocks'), {handle:'.blk-grip', draggable:'.block', animation:RM?0:150, forceFallback:true, fallbackOnBody:true,
      onChoose(){ document.activeElement?.blur?.(); }, onStart(){ S.dragging=true; }, onEnd(){ S.dragging=false; saveOrder($$('#blocks > .block').map(x=>x.dataset.block)); render(true); }});
  }
  function saveOrder(ids){ ids.forEach((id,i)=>{ const b=itemById(id); if(b && b.order!==i) docPatch('items', id, {order:i}); }); }

  function addBlock(it, type){
    const k = KINDS.find(x=>x.type===type); const b = buildItem(type, k.label, '', it.id); docSet('items', b);
    render(true);
    requestAnimationFrame(()=>{ const sec = document.querySelector(`[data-block="${CSS.escape(b.id)}"]`); sec?.scrollIntoView({block:'nearest', behavior:RM?'auto':'smooth'});
      if(type==='note') TYPE_VIEWS.note.focusStart(itemById(b.id)); else if(type==='checklist') TYPE_VIEWS.checklist.focusStart(itemById(b.id)); else sec?.querySelector('.blk-name')?.focus(); });
  }
  function removeBlock(b){
    const snap = docDel('items', b.id); const rows = S.rows.filter(r=>r.itemId===b.id).map(r=>docDel('rows', r.id));
    render(true); toast(`${TYPES[b.type].label} block removed`, () => { docSet('items', snap); rows.forEach(r=>docSet('rows', r)); });
  }

  function click(e, it){
    const add = e.target.closest('[data-badd]'); if(add) return addBlock(it, add.dataset.badd);
    const del = e.target.closest('[data-bdel]'); if(del){ const b=itemById(del.dataset.bdel); if(b) removeBlock(b); return; }
    const mv = e.target.closest('[data-bmove]');
    if(mv){ const ids = blocksOf(it.id).map(b=>b.id); const i = ids.indexOf(mv.dataset.bid); const j = i + (mv.dataset.bmove==='up'?-1:1);
      if(i<0 || j<0 || j>=ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; saveOrder(ids); render(true);
      restoreFocus(`[data-bmove="${mv.dataset.bmove}"][data-bid="${CSS.escape(mv.dataset.bid)}"]:not([disabled])`); return; }
    const b = blockOf(e); if(b) TYPE_VIEWS[b.type].click?.(e, b);
  }
  const pass = name => (e, it) => { const b = blockOf(e); if(b) TYPE_VIEWS[b.type][name]?.(e, b); };
  function change(e, it){
    const n = e.target.closest('[data-bname]');
    if(n){ const b=itemById(n.dataset.bname); const v=n.value.trim(); if(b && v!==(b.name||'')) docPatch('items', b.id, {name:v || TYPES[b.type].label}); return; }
    pass('change')(e, it);
  }
  function keydown(e, it){
    if(e.target.closest('[data-bname]') && e.key==='Enter'){ e.preventDefault(); e.target.blur(); return; }
    pass('keydown')(e, it);
  }
  return {render:view, click, input:pass('input'), change, keydown,
    newShortcut(it){ addBlock(it, 'note'); },
    focusStart(){}};
})();
