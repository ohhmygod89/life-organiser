/* ============================================================
   Tracker — dated numbers with a chart.
   item.points = [{id, date:'YYYY-MM-DD', value:Number, note}], item.unit, item.decimals, item.step
   step=true draws a step line: each value holds until the next entry (interest rates).
   ============================================================ */
TYPE_VIEWS.tracker = (() => {
  const range = {};   // item id -> '1y' | '3y' | 'all'
  let ro = null;
  const pts = it => (it.points||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const fmt = (it, v) => fmtNum(v, it.decimals ?? 2);
  const unitHTML = it => it.unit ? `<small>${esc(it.unit)}</small>` : '';
  const withUnit = (it, v) => it.unit==='$' ? '$'+fmt(it,v) : fmt(it,v)+(it.unit?(it.unit==='%'?'%':' '+it.unit):'');
  function niceTicks(lo, hi, n=4){
    if(lo===hi){ const pad = Math.abs(lo)*0.1 || 1; lo-=pad; hi+=pad; }
    const span = hi-lo, raw = span/n, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw/mag;
    const step = (norm<1.5?1:norm<3?2:norm<7?5:10)*mag;
    const a = Math.floor(lo/step)*step, b = Math.ceil(hi/step)*step; const out=[];
    for(let v=a; v<=b+step/2; v+=step) out.push(+v.toFixed(10));
    return out;
  }
  function inRange(it){
    const all = pts(it); const r = range[it.id] || 'all'; if(r==='all' || all.length<2) return all;
    const cut = new Date(); cut.setFullYear(cut.getFullYear() - (r==='1y'?1:3)); const c = ymd(cut);
    const inside = all.filter(p=>p.date>=c); const before = all.filter(p=>p.date<c).pop();
    return before && it.step ? [{...before, date:c, carried:true}, ...inside] : inside;
  }
  function drawChart(it){
    const box = $('#trChart'); if(!box) return;
    const P = inRange(it); const W = Math.max(280, box.clientWidth), H = 260;
    if(P.length<2){ box.innerHTML = `<div class="empty-state">${P.length?'Add one more entry to draw the chart.':'No entries in this range.'}</div>`; return; }
    const m = {l:52, r:18, t:14, b:30};
    const t0 = new Date(P[0].date).getTime(), t1 = Math.max(new Date(P[P.length-1].date).getTime(), it.step ? Date.now() : 0) || new Date(P[P.length-1].date).getTime();
    const vals = P.map(p=>+p.value); const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
    const y0 = ticks[0], y1 = ticks[ticks.length-1];
    const X = t => m.l + (t1===t0 ? 0.5 : (t-t0)/(t1-t0))*(W-m.l-m.r);
    const Y = v => m.t + (1-(v-y0)/(y1-y0||1))*(H-m.t-m.b);
    const xy = P.map(p=>[X(new Date(p.date).getTime()), Y(+p.value)]);
    /* dot-matrix (Pulse): a square grid of equal dots (column pitch = row pitch); each column is filled up to the value at that date
       (a step holds its value; otherwise the line between entries). Colour runs light at the bottom to saturated at the top. No lines, no area. */
    const pw = W-m.l-m.r, ph = H-m.t-m.b, pitch = W < 420 ? 9 : 10, LV = 6;
    const nc = Math.max(8, Math.floor(pw/pitch)), cw = pw/nc, nr = Math.max(8, Math.floor(ph/pitch)), rh = ph/nr;
    const valueAt = t => { let i = -1; for(let k=0;k<P.length;k++){ if(new Date(P[k].date).getTime() <= t) i = k; else break; } if(i<0) return null;
      if(it.step || i===P.length-1) return +P[i].value;
      const a = new Date(P[i].date).getTime(), b = new Date(P[i+1].date).getTime(); return +P[i].value + (+P[i+1].value - +P[i].value) * (t-a) / ((b-a)||1); };
    const lv = Array(LV).fill('');
    for(let c=0;c<nc;c++){
      const x = m.l + (c+.5)*cw, v = valueAt(t0 + (c+.5)/nc*(t1-t0)); if(v===null) continue;
      const h = Math.max(1, Math.min(nr, Math.round((v-y0)/((y1-y0)||1)*nr)));
      for(let r=0;r<h;r++) lv[Math.min(LV-1, Math.floor(r/nr*LV))] += `M${x.toFixed(1)},${(m.t + ph - (r+.5)*rh).toFixed(1)}h.01`;
    }
    // x ticks: up to 6 evenly spaced dates
    const nx = Math.min(6, Math.max(2, Math.floor((W-m.l-m.r)/110)));
    const xt = Array.from({length:nx}, (_,i)=> t0 + (t1-t0)*i/(nx-1));
    const span = t1-t0; const lab = t => { const dd=new Date(t); return span > 400*864e5 ? MON[dd.getMonth()]+' '+String(dd.getFullYear()).slice(2) : dd.getDate()+' '+MON[dd.getMonth()]; };
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(it.name)}: ${P.length} entries from ${esc(dateLabel(P[0].date))} to ${esc(dateLabel(P[P.length-1].date))}, latest ${esc(withUnit(it, vals[vals.length-1]))}">
      ${lv.map((d,i)=>d?`<path class="dots l${i}" d="${d}"/>`:'').join('')}
      <g class="axis">${ticks.map(v=>`<text x="${m.l-8}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${esc(fmtNum(v, Math.min(it.decimals??2, 2)))}</text>`).join('')}
        ${xt.map((t,i)=>`<text x="${X(t).toFixed(1)}" y="${H-8}" text-anchor="${i===0?'start':i===xt.length-1?'end':'middle'}">${lab(t)}</text>`).join('')}</g>
      <g id="trHover" style="display:none"><line class="xh" y1="${m.t}" y2="${H-m.b}"/><circle class="hpt" r="5"/></g>
      <rect id="trHit" x="${m.l}" y="0" width="${W-m.l-m.r}" height="${H}" fill="transparent"/>
    </svg><div class="tip" id="trTip" hidden></div>`;
    const hit = $('#trHit'), hov = $('#trHover'), tip = $('#trTip');
    const real = P.map((p,i)=>({p, x:xy[i][0], y:xy[i][1]})).filter(o=>!o.p.carried);
    const show = clientX => {
      const r = box.getBoundingClientRect(); const x = (clientX - r.left) * (W / r.width);
      let best = real[0]; for(const o of real) if(Math.abs(o.x-x) < Math.abs(best.x-x)) best = o;
      hov.style.display=''; $('line', hov).setAttribute('x1', best.x); $('line', hov).setAttribute('x2', best.x); $('circle', hov).setAttribute('cx', best.x); $('circle', hov).setAttribute('cy', best.y);
      tip.hidden=false; tip.innerHTML = `<b>${esc(withUnit(it, best.p.value))}</b><br>${esc(dateLabel(best.p.date))}${best.p.note?'<br>'+esc(best.p.note):''}`;
      tip.style.left = (best.x * r.width / W)+'px'; tip.style.top = (best.y * r.height / H)+'px';
    };
    hit.addEventListener('pointermove', e => show(e.clientX));
    hit.addEventListener('pointerdown', e => show(e.clientX));
    hit.addEventListener('pointerleave', () => { hov.style.display='none'; tip.hidden=true; });
  }
  function view(it, root){
    const all = pts(it); const last = all[all.length-1], prev = all[all.length-2];
    const delta = last && prev ? (+last.value) - (+prev.value) : null;
    const r = range[it.id] || 'all';
    root.innerHTML = `
      <section class="panel">
        <div class="hero"><div><p class="eyebrow">${last?'Latest · since '+esc(dateLabel(last.date)):'No entries yet'}</p><div class="val">${last?esc(it.unit==='$'?'$'+fmt(it,last.value):fmt(it,last.value)):'—'}${it.unit&&it.unit!=='$'?unitHTML(it):''}</div></div>
          ${delta!==null?`<div class="delta"><b>${delta>0?'▲':delta<0?'▼':'■'} ${esc(fmtNum(Math.abs(delta), it.decimals??2))}${it.unit==='%'?' pts':it.unit&&it.unit!=='$'?' '+esc(it.unit):''}</b> since ${esc(dateLabel(prev.date))}</div>`:''}
          <span class="spacer"></span>
          ${all.length>1?`<div class="seg" role="group" aria-label="Range">${[['1y','1Y'],['3y','3Y'],['all','All']].map(([k,l])=>`<button data-seg="${k}" aria-pressed="${r===k}">${l}</button>`).join('')}</div>`:''}</div>
        <div class="chart-box" id="trChart" style="margin-top:14px"></div>
      </section>
      <section class="panel"><div class="panel-h"><h2>Add an entry</h2><span class="caption">${it.step?'Each value holds until the next entry':'Points are joined in date order'}</span></div>
        <div class="entry-form"><input type="date" class="field-in" id="trDate" value="${today()}" aria-label="Date"><input type="number" step="any" inputmode="decimal" class="field-in" id="trVal" placeholder="Value${it.unit?' ('+esc(it.unit)+')':''}" aria-label="Value${it.unit?' in '+esc(it.unit):''}"><input class="field-in note-in" id="trNote" placeholder="Note, e.g. RBA cut, lender letter" aria-label="Note"><button class="pill" data-act="add">${ICON.plus}Add</button></div></section>
      <section class="panel"><div class="panel-h"><h2>Entries</h2><span class="caption">${plural(all.length,'entry').replace('entrys','entries')} · newest first</span></div>
        ${all.length?`<div class="tbl-wrap" style="background:none;border-radius:0"><table class="tbl"><thead><tr><th scope="col"><button tabindex="-1">Date</button></th><th scope="col"><button tabindex="-1">Value</button></th><th scope="col" style="width:100%"><button tabindex="-1">Note</button></th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
          ${all.slice().reverse().map(p=>`<tr data-key="pt-${esc(p.id)}"><td><input type="date" data-pt="${esc(p.id)}" data-k="date" value="${esc(p.date)}" aria-label="Date"></td><td><input type="number" step="any" data-pt="${esc(p.id)}" data-k="value" value="${esc(p.value)}" aria-label="Value"></td><td><input type="text" data-pt="${esc(p.id)}" data-k="note" value="${esc(p.note||'')}" aria-label="Note"></td><td><button class="x row-x" data-del-pt="${esc(p.id)}" aria-label="Delete entry from ${esc(dateLabel(p.date))}">${ICON.x}</button></td></tr>`).join('')}
        </tbody></table></div>`:`<div class="empty-state">Your entries will be listed here. ${it.unit==='%'?'Start with your current rate and the date it applied from.':''}</div>`}
      </section>`;
    drawChart(it);
    ro?.disconnect(); ro = new ResizeObserver(()=>{ const c=currentItem(); if(c && c.id===it.id) drawChart(c); }); ro.observe($('#trChart'));
  }
  function add(it){
    const d = $('#trDate').value, v = $('#trVal').value, n = $('#trNote').value.trim();
    if(!d){ $('#trDate').focus(); return toast('Pick a date for this entry.', null, true); }
    if(v===''||isNaN(+v)){ $('#trVal').focus(); return toast('Enter a number for the value.', null, true); }
    const p = {id:uid(), date:d, value:+v, note:n};
    docPatch('items', it.id, {points:[...(it.points||[]), p]}); view(it, $('#tv')); renderSide();
    toast('Entry added', ()=>{ const c=itemById(it.id); docPatch('items', it.id, {points:(c.points||[]).filter(x=>x.id!==p.id)}); });
    $('#trVal').focus();
  }
  function click(e, it){
    const sg = e.target.closest('[data-seg]'); if(sg){ range[it.id]=sg.dataset.seg; view(it, $('#tv')); restoreFocus(`[data-seg="${sg.dataset.seg}"]`); return; }
    if(e.target.closest('[data-act="add"]')) return add(it);
    const dp = e.target.closest('[data-del-pt]');
    if(dp){ const before = clone(it.points||[]); docPatch('items', it.id, {points:before.filter(p=>p.id!==dp.dataset.delPt)}); view(it, $('#tv')); toast('Entry deleted', ()=>docPatch('items', it.id, {points:before})); }
  }
  function change(e, it){
    const el = e.target; const id = el.dataset.pt; if(!id) return;
    const k = el.dataset.k; let v = el.value; if(k==='value'){ if(v===''||isNaN(+v)) return view(it,$('#tv')); v=+v; } if(k==='date' && !v) return view(it,$('#tv'));
    docPatch('items', it.id, {points:(it.points||[]).map(p=>p.id===id?{...p,[k]:v}:p)}); if(k!=='note') view(it, $('#tv'));
  }
  function keydown(e, it){ if(e.key==='Enter' && ['trVal','trNote','trDate'].includes(e.target.id)){ e.preventDefault(); add(it); } if(e.key==='Enter' && e.target.dataset.pt) e.target.blur(); }
  function settingsModal(it, op){
    let step = !!it.step;
    const m = openModal(`<h2 id="mTitle">Tracker settings</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="field"><span class="lbl">Unit</span><input class="txt-in" id="tsUnit" value="${esc(it.unit||'')}" placeholder="%, $, kg" maxlength="8"></label>
      <label class="field"><span class="lbl">Decimal places</span><input class="txt-in" id="tsDec" type="number" min="0" max="4" value="${esc(it.decimals??2)}"></label></div>
      <button class="switch" role="switch" aria-checked="${step}" id="tsStep"><span class="sw-track" aria-hidden="true"></span>Hold each value until the next entry (best for interest rates)</button>
      <div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">Save</button></div>`, {opener:op});
    m.onclick = e => { if(e.target.closest('#tsStep')){ step=!step; $('#tsStep').setAttribute('aria-checked', step); return; } const b=e.target.closest('[data-x]'); if(!b) return;
      if(b.dataset.x==='yes'){ docPatch('items', it.id, {unit:$('#tsUnit').value.trim(), decimals:Math.max(0,Math.min(4, parseInt($('#tsDec').value)||0)), step}); render(true); } closeModal(); };
  }
  return {render:view, click, change, keydown, settingsModal, newShortcut(){ $('#trVal')?.focus(); }, focusStart(){ $('#trVal')?.focus(); }};
})();
