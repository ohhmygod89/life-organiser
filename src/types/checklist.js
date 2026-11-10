/* ============================================================
   Checklist — a reusable list you tick through.
   item.entries = [{id, text, done}], item.hideDone
   ============================================================ */
TYPE_VIEWS.checklist = (() => {
  const R = it => document.querySelector(`[data-root="${CSS.escape(it.id)}"]`) || $('#tv');   // this item's own root (it may be one block of a Page)
  const Q = (it, sel) => R(it)?.querySelector(sel);
  const sortables = {}; let timers = {};
  function view(it, root){
    const all = it.entries||[]; const done = all.filter(e=>e.done).length;
    const shown = it.hideDone ? all.filter(e=>!e.done) : all;
    root.dataset.root = it.id; sortables[it.id]?.destroy(); delete sortables[it.id];
    root.innerHTML = `
      <section class="panel">
        <div class="ck-head"><span class="ck-count">${done}/${all.length} done</span><span class="spacer"></span>
          <button class="switch" role="switch" aria-checked="${!!it.hideDone}" data-act="hide"><span class="sw-track" aria-hidden="true"></span>Hide done</button>
          <button class="icon-btn mini" data-act="ck-more" aria-haspopup="menu" aria-expanded="false" aria-label="Checklist options" title="More">${ICON.more}</button></div>
        <div class="progress" aria-hidden="true"><i style="width:${all.length?done/all.length*100:0}%"></i></div>
        <div class="ck-list" id="ckList" style="margin-top:8px">${shown.map(e=>`<div class="ck ${e.done?'on':''}" data-id="${esc(e.id)}" data-key="ck-${esc(e.id)}"><span class="grip" aria-hidden="true" title="Drag to reorder">${ICON.grip}</span><button class="cbox" data-ck="${esc(e.id)}" role="checkbox" aria-checked="${!!e.done}" aria-label="${esc(e.text)}">${ICON.check}</button><input type="text" data-ct="${esc(e.id)}" value="${esc(e.text)}" aria-label="Checklist item"><button class="x" data-del="${esc(e.id)}" aria-label="Remove ${esc(e.text)}">${ICON.x}</button></div>`).join('')}</div>
        ${!all.length?`<div class="empty-state" style="padding:18px">Add the first item below. Lists you reuse, like packing or monthly admin, work best: tick through, then Untick all next time.</div>`:''}
        ${all.length && !shown.length?`<div class="empty-state" style="padding:18px">Everything is done. Turn off Hide done to see the list.</div>`:''}
        <div class="send-row"><input class="field-in" id="ckNew" placeholder="Add an item" aria-label="New checklist item" enterkeyhint="send"><button class="send-btn" data-act="add" aria-label="Add item" title="Add">${ICON.send}</button></div>
      </section>`;
    if(shown.length>1) sortables[it.id] = Sortable.create(root.querySelector('#ckList'), {handle:'.grip', animation:RM?0:150, onStart(){S.dragging=true}, onEnd(){ S.dragging=false;
      const order = $$('#ckList .ck', R(it)).map(x=>x.dataset.id); const c = itemById(it.id); const hidden = (c.entries||[]).filter(e=>!order.includes(e.id));
      docPatch('items', it.id, {entries:[...order.map(id=>c.entries.find(e=>e.id===id)), ...hidden]}); render(true); }});
  }
  const setEntries = (it, list) => { docPatch('items', it.id, {entries:list}); renderSide(); };
  function add(it){ const el=Q(it,'#ckNew'); const v=el.value.trim(); if(!v) return; setEntries(it, [...(it.entries||[]), {id:uid(), text:v, done:false}]); view(it, R(it)); const n=Q(it,'#ckNew'); n.focus({preventScroll:true}); n.scrollIntoView({block:'center', behavior:RM?'auto':'smooth'}); }
  function click(e, it){
    const a = e.target.closest('[data-act]');
    if(a){ const act=a.dataset.act;
      if(act==='add') return add(it);
      if(act==='ck-more'){ const has = (it.entries||[]).some(x=>x.done); return openMenu(a, [{label:'Untick all', value:'untick', disabled:!has}, {label:'Clear done items', value:'clear', disabled:!has, danger:true}], v => { if(!has) return; click({target:{closest:s=>s==='[data-act]'?{dataset:{act:v}}:null}}, itemById(it.id)); }, 'Checklist options'); }
      if(act==='hide'){ docPatch('items', it.id, {hideDone:!it.hideDone}); view(it, R(it)); restoreFocus('[data-act="hide"]', R(it)); return; }
      if(act==='untick'){ const before=clone(it.entries); setEntries(it, before.map(x=>({...x, done:false}))); view(it, R(it)); toast('Unticked every item', ()=>docPatch('items', it.id, {entries:before})); return; }
      if(act==='clear'){ const before=clone(it.entries); setEntries(it, before.filter(x=>!x.done)); view(it, R(it)); toast('Cleared done items', ()=>docPatch('items', it.id, {entries:before})); return; } }
    const cb = e.target.closest('[data-ck]');
    if(cb){ const id=cb.dataset.ck; setEntries(it, (it.entries||[]).map(x=>x.id===id?{...x, done:!x.done}:x)); view(it, R(it)); restoreFocus(`[data-ck="${CSS.escape(id)}"]`, R(it)) || Q(it,'#ckNew').focus(); return; }
    const dl = e.target.closest('[data-del]');
    if(dl){ const before=clone(it.entries); const x=before.find(y=>y.id===dl.dataset.del); setEntries(it, before.filter(y=>y.id!==dl.dataset.del)); view(it, R(it)); toast('Removed “'+(x?.text||'item')+'”', ()=>docPatch('items', it.id, {entries:before})); }
  }
  function input(e, it){
    const id = e.target.dataset.ct; if(!id) return; const v = e.target.value;
    window.__typingItem = it.id; clearTimeout(timers[id]);
    timers[id] = setTimeout(()=>{ const c=itemById(it.id); docPatch('items', it.id, {entries:(c.entries||[]).map(x=>x.id===id?{...x, text:v}:x)}); delete timers[id]; if(!Object.keys(timers).length) window.__typingItem=null; }, 500);
  }
  function keydown(e, it){
    if(e.target.id==='ckNew' && e.key==='Enter'){ e.preventDefault(); add(it); }
    if(e.target.dataset.ct && e.key==='Enter'){ e.preventDefault(); Q(it,'#ckNew').focus(); }
  }
  return {narrow:true, render:view, click, input, keydown, newShortcut(it){ Q(it,'#ckNew')?.focus(); }, focusStart(it){ Q(it,'#ckNew')?.focus(); }};
})();
