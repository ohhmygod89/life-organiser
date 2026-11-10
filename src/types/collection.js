/* ============================================================
   Collection — a table with fields you define.
   item.fields = [{id, name, type, options?, home?}], item.sort = {field, dir} | null
   Rows live in the `rows` collection: {itemId, pos, values:{fieldId:value}}
   ============================================================ */
TYPE_VIEWS.collection = (() => {
  const R = it => document.querySelector(`[data-root="${CSS.escape(it.id)}"]`) || $('#tv');   // this item's own root (it may be one block of a Page)
  const Q = (it, sel) => R(it)?.querySelector(sel);
  const FT = {text:'Text', number:'Number', currency:'Money ($)', percent:'Percent (%)', date:'Date', select:'Choice', checkbox:'Tick box', url:'Link'};
  const f = (name, type, extra={}) => ({id:uid(), name, type, ...extra});
  function template(t){
    const fields = {
      blank:   [f('Name','text'), f('Notes','text')],
      accounts:[f('Bank','text'), f('Account','select',{options:['Everyday','Savings','Offset','Term deposit','Credit card','Super','Brokerage']}), f('Nickname','text'), f('Last 4','text'), f('Holder','select',{options:['Me','Partner','Joint']}), f('Rate','percent'), f('Notes','text')],
      coupons: [f('Store','text'), f('Value','currency'), f('Code','text'), f('Expires','date',{home:true}), f('Used','checkbox'), f('Notes','text')],
      subs:    [f('Service','text'), f('Cost','currency'), f('Billing','select',{options:['Monthly','Quarterly','Yearly']}), f('Renews','date',{home:true}), f('Auto-renew','checkbox'), f('Cancel link','url')],
      warranty:[f('Item','text'), f('Bought','date'), f('Store','text'), f('Warranty ends','date',{home:true}), f('Receipt kept in','text')],
    }[t] || [f('Name','text')];
    return {fields, sort:null};
  }
  const rowsOf = it => S.rows.filter(r=>r.itemId===it.id);
  let filter = {}, saveT = {};

  function sorted(it){
    let rs = rowsOf(it);
    const q = (filter[it.id]||'').trim().toLowerCase();
    if(q) rs = rs.filter(r => Object.values(r.values||{}).join(' ').toLowerCase().includes(q));
    const s = it.sort; const fld = s && (it.fields||[]).find(x=>x.id===s.field);
    if(!fld) return rs.sort((a,b)=>(a.pos??0)-(b.pos??0));
    const val = r => r.values?.[fld.id];
    const num = ['number','currency','percent'].includes(fld.type);
    return rs.sort((a,b)=>{ const x=val(a), y=val(b); const ex=x===undefined||x===''||x===null, ey=y===undefined||y===''||y===null; if(ex&&ey) return 0; if(ex) return 1; if(ey) return -1;
      const c = num ? Number(x)-Number(y) : fld.type==='checkbox' ? (x?1:0)-(y?1:0) : String(x).localeCompare(String(y), undefined, {numeric:true}); return s.dir==='desc' ? -c : c; });
  }
  function cellHTML(it, r, fld){
    const v = r.values?.[fld.id]; const key = `data-row="${esc(r.id)}" data-field="${esc(fld.id)}"`; const lab = `aria-label="${esc(fld.name)}"`;
    switch(fld.type){
      case 'checkbox': return `<td class="cb"><button class="cbox" ${key} role="checkbox" aria-checked="${!!v}" ${lab}>${ICON.check}</button></td>`;
      case 'select': return `<td><button class="sel-btn" ${key} aria-haspopup="menu" aria-expanded="false" ${lab}>${v?`<span class="tag">${esc(v)}</span>`:'<span class="ph">Choose</span>'}</button></td>`;
      case 'date': { const d=v?dayDiff(v):null; const badge = fld.home && v && d<=HOME_DAYS ? `<span class="due-badge ${d<0?'overdue':''}">${esc(dueLabel(v).t)}</span>` : ''; return `<td><div class="cell-fx"><input type="date" ${key} value="${esc(v||'')}" ${lab}>${badge}</div></td>`; }
      case 'number': return `<td class="num"><input type="number" step="any" inputmode="decimal" ${key} value="${esc(v??'')}" ${lab}></td>`;
      case 'currency': return `<td class="num"><div class="cell-fx"><span aria-hidden="true">$</span><input type="number" step="0.01" inputmode="decimal" ${key} value="${esc(v??'')}" ${lab}></div></td>`;
      case 'percent': return `<td class="num"><div class="cell-fx"><input type="number" step="0.01" inputmode="decimal" ${key} value="${esc(v??'')}" ${lab}><span aria-hidden="true">%</span></div></td>`;
      case 'url': return `<td><div class="cell-fx"><input type="url" ${key} value="${esc(v||'')}" placeholder="https://" ${lab}>${v&&/^https?:\/\//.test(v)?`<a class="x" href="${esc(v)}" target="_blank" rel="noopener" aria-label="Open link" title="Open link">${ICON.link}</a>`:''}</div></td>`;
      default: return `<td><input type="text" ${key} value="${esc(v||'')}" ${lab}></td>`;
    }
  }
  const sortables = {};
  function view(it, root){
    root.dataset.root = it.id;
    const fields = it.fields||[]; const rs = sorted(it); const total = rowsOf(it).length; const s = it.sort;
    sortables[it.id]?.destroy(); delete sortables[it.id];
    root.innerHTML = `
      <div class="toolbar"><span class="caption">${plural(total,'row')}${(filter[it.id]||'').trim()?` · ${rs.length} shown`:''}</span>
        <input class="field-in" id="colFilter" style="max-width:240px;min-height:34px;padding:6px 12px;border-radius:980px" placeholder="Filter rows" aria-label="Filter rows" value="${esc(filter[it.id]||'')}">
        ${s?`<button class="link" data-act="unsort">Clear sort</button>`:''}
        <span class="spacer"></span><button class="link" data-act="fields">Edit fields</button><button class="pill" data-act="add-row">${ICON.plus}Add row</button></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="grip-h"><span class="sr-only">Reorder</span></th>${fields.map(fl=>`<th scope="col" aria-sort="${s?.field===fl.id?(s.dir==='desc'?'descending':'ascending'):'none'}"><button data-sort="${esc(fl.id)}" title="Sort by ${esc(fl.name)}">${esc(fl.name)}${s?.field===fl.id?(s.dir==='desc'?ICON.chevD:ICON.up):''}</button></th>`).join('')}<th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody id="colBody">${rs.map(r=>`<tr data-id="${esc(r.id)}" data-key="row-${esc(r.id)}"><td class="grip" title="${s?'Clear sort to drag rows':'Drag to reorder'}" aria-hidden="true">${s?'':ICON.grip}</td>${fields.map(fl=>cellHTML(it,r,fl)).join('')}<td><button class="x row-x" data-del-row="${esc(r.id)}" aria-label="Delete row">${ICON.x}</button></td></tr>`).join('')}</tbody></table>
        ${rs.length?'':`<div class="empty-state">${total?'No rows match the filter.':'<b>No rows yet</b>Add your first row. Change the columns with Edit fields.'}</div>`}
        <div class="tbl-foot"><button class="add-btn" data-act="add-row" style="width:auto">${ICON.plus} Add row</button></div></div>`;
    if(!s && rs.length>1) sortables[it.id] = Sortable.create(root.querySelector('#colBody'), {handle:'.grip', animation:RM?0:150, onStart(){S.dragging=true}, onEnd(){ S.dragging=false; $$('#colBody tr', R(it)).forEach((tr,i)=>{ const r=S.rows.find(x=>x.id===tr.dataset.id); if(r && r.pos!==i) docPatch('rows', r.id, {pos:i}); }); render(true); }});
  }
  function setVal(it, rowId, fid, v){
    const r = S.rows.find(x=>x.id===rowId); if(!r) return;
    if((r.values?.[fid] ?? '') === v) return;
    docPatch('rows', rowId, {values:{...(r.values||{}), [fid]:v}}); touchItem(it.id);
  }
  function parse(fld, raw){ if(['number','currency','percent'].includes(fld.type)) return raw==='' ? '' : Number(raw); return raw; }
  function addRow(it){
    const rs = rowsOf(it); const r = {id:uid(), itemId:it.id, pos:rs.length ? Math.max(...rs.map(x=>x.pos||0))+1 : 0, values:{}, created:nowIso(), updated:nowIso()};
    docSet('rows', r); touchItem(it.id);
    if(it.sort) docPatch('items', it.id, {sort:null});
    render(true); requestAnimationFrame(()=>{ const first=$(`tr[data-id="${CSS.escape(r.id)}"] input, tr[data-id="${CSS.escape(r.id)}"] button.sel-btn`); first?.focus(); first?.scrollIntoView({block:'nearest'}); });
  }
  function click(e, it){
    const a = e.target.closest('[data-act]');
    if(a){ const act=a.dataset.act;
      if(act==='add-row') return addRow(it);
      if(act==='fields') return fieldsModal(it, a);
      if(act==='unsort'){ docPatch('items', it.id, {sort:null}); return render(true); } }
    const so = e.target.closest('[data-sort]');
    if(so){ const s=it.sort, id=so.dataset.sort; const next = !s||s.field!==id ? {field:id, dir:'asc'} : s.dir==='asc' ? {field:id, dir:'desc'} : null; docPatch('items', it.id, {sort:next}); render(true); restoreFocus(`[data-sort="${CSS.escape(id)}"]`); return; }
    const cb = e.target.closest('.cbox[data-row]');
    if(cb){ const r=S.rows.find(x=>x.id===cb.dataset.row); setVal(it, cb.dataset.row, cb.dataset.field, !r?.values?.[cb.dataset.field]); render(true); restoreFocus(`.cbox[data-row="${CSS.escape(cb.dataset.row)}"][data-field="${CSS.escape(cb.dataset.field)}"]`); return; }
    const sb = e.target.closest('.sel-btn');
    if(sb){ const fld=(it.fields||[]).find(x=>x.id===sb.dataset.field); const r=S.rows.find(x=>x.id===sb.dataset.row); const v=r?.values?.[fld.id]||'';
      openMenu(sb, [{label:'None', value:'', checked:!v}, ...(fld.options||[]).map(o=>({label:o, value:o, checked:v===o})), {sep:true}, {label:'Edit choices…', value:'__edit'}], val => { if(val==='__edit') return fieldsModal(it, sb); setVal(it, r.id, fld.id, val); render(true); restoreFocus(`.sel-btn[data-row="${CSS.escape(r.id)}"][data-field="${CSS.escape(fld.id)}"]`); }, fld.name); return; }
    const dr = e.target.closest('[data-del-row]');
    if(dr){ const snap = docDel('rows', dr.dataset.delRow); touchItem(it.id); render(true); toast('Row deleted', ()=>docSet('rows', snap)); }
  }
  function input(e, it){
    if(e.target.id==='colFilter'){ filter[it.id] = e.target.value; const pos=e.target.selectionStart; render(true); const f=Q(it,'#colFilter'); f.focus(); f.setSelectionRange(pos,pos); return; }
    const el = e.target; if(!el.dataset.row) return;
    const fld = (it.fields||[]).find(x=>x.id===el.dataset.field); if(!fld) return;
    const k = el.dataset.row+':'+fld.id; clearTimeout(saveT[k]);
    saveT[k] = setTimeout(()=>{ setVal(it, el.dataset.row, fld.id, parse(fld, el.value)); }, 700);
  }
  function change(e, it){
    const el = e.target; if(!el.dataset.row) return;
    const fld = (it.fields||[]).find(x=>x.id===el.dataset.field); if(!fld) return;
    clearTimeout(saveT[el.dataset.row+':'+fld.id]); setVal(it, el.dataset.row, fld.id, parse(fld, el.value));
    if(fld.type==='date' || fld.type==='url') render(true);
  }
  function keydown(e, it){
    if(e.target.dataset.row && e.key==='Enter'){ e.preventDefault(); e.target.blur();
      const tr = e.target.closest('tr'); const col = [...tr.children].indexOf(e.target.closest('td')); const nx = tr.nextElementSibling;
      if(nx){ nx.children[col]?.querySelector('input,button')?.focus(); } else if(e.shiftKey===false && e.target.value){ /* stay */ } }
  }

  /* fields editor */
  function fieldsModal(it, op){
    let fl = clone(it.fields||[]);
    const draw = () => {
      const m = openModal(`<h2 id="mTitle">Fields</h2><p class="note">These are the columns of “${esc(it.name)}”. Removing a field hides its values; adding it back by the same name won’t restore them.</p>
        <div>${fl.map((x,i)=>`<div class="fld-row" data-i="${i}">
          <input class="txt-in" value="${esc(x.name)}" data-k="name" aria-label="Field name">
          <button class="pop" data-type-i="${i}" aria-haspopup="menu" aria-expanded="false"><span class="lbl-t">${FT[x.type]}</span>${ICON.chev}</button>
          <span style="display:flex"><button class="x" data-mv="${i}:-1" aria-label="Move ${esc(x.name)} up" ${i?'':'disabled'}>${ICON.up}</button><button class="x" data-mv="${i}:1" aria-label="Move ${esc(x.name)} down" ${i<fl.length-1?'':'disabled'}>${ICON.chevD}</button></span>
          <button class="x" data-rm="${i}" aria-label="Remove ${esc(x.name)}">${ICON.x}</button>
          ${x.type==='select'?`<input class="txt-in opts-in" value="${esc((x.options||[]).join(', '))}" data-k="options" placeholder="Choices, separated by commas" aria-label="Choices for ${esc(x.name)}">`:''}
          ${x.type==='date'?`<label class="home-t"><input type="checkbox" data-k="home" ${x.home?'checked':''}>Show on Home when this date is within ${HOME_DAYS} days</label>`:''}
        </div>`).join('')}</div>
        <button class="btn" data-x="add" style="align-self:flex-start">Add field</button>
        <div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">Save fields</button></div>`, {opener:op, wide:true});
      m.oninput = m.onchange = e => { const row=e.target.closest('.fld-row'); const k=e.target.dataset.k; if(!row||!k) return; const x=fl[+row.dataset.i];
        if(k==='options') x.options = e.target.value.split(',').map(s=>s.trim()).filter(Boolean); else if(k==='home') x.home = e.target.checked; else x[k] = e.target.value; };
      m.onclick = e => {
        const ty = e.target.closest('[data-type-i]');
        if(ty){ const i=+ty.dataset.typeI; openMenu(ty, Object.entries(FT).map(([k,l])=>({label:l, value:k, checked:fl[i].type===k})), v => { fl[i].type=v; if(v==='select' && !fl[i].options) fl[i].options=[]; draw(); requestAnimationFrame(()=>restoreFocus(`[data-type-i="${i}"]`, modal())); }, 'Field type'); return; }
        const mv = e.target.closest('[data-mv]'); if(mv){ const [i,d]=mv.dataset.mv.split(':').map(Number); const j=i+d; [fl[i],fl[j]]=[fl[j],fl[i]]; draw(); requestAnimationFrame(()=>restoreFocus(`[data-mv="${j}:${d}"]`, modal())); return; }
        const rm = e.target.closest('[data-rm]'); if(rm){ fl.splice(+rm.dataset.rm,1); draw(); return; }
        const b = e.target.closest('[data-x]'); if(!b) return;
        if(b.dataset.x==='add'){ fl.push({id:uid(), name:'New field', type:'text'}); draw(); requestAnimationFrame(()=>{ const ins=$$('.fld-row > .txt-in', modal()); ins[ins.length-1]?.select(); }); return; }
        if(b.dataset.x==='yes'){ const before=clone(it.fields); const out=fl.filter(x=>x.name.trim()).map(x=>({...x, name:x.name.trim()})); const s=it.sort && out.find(x=>x.id===it.sort.field) ? it.sort : null; docPatch('items', it.id, {fields:out, sort:s}); closeModal(); render(true); toast('Fields saved', ()=>docPatch('items', it.id, {fields:before})); return; }
        closeModal();
      };
    };
    draw();
  }

  return {wide:false, render:view, click, input, change, keydown, template, fieldsModal, newShortcut:addRow, focusStart(){}};
})();
