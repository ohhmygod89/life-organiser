/* ============================================================
   Note — a page of markdown-style writing with [[links]] and backlinks.
   item.body holds the text.
   ============================================================ */
TYPE_VIEWS.note = (() => {
  const R = it => document.querySelector(`[data-root="${CSS.escape(it.id)}"]`) || $('#tv');   // this item's own root (it may be one block of a Page)
  const Q = (it, sel) => R(it)?.querySelector(sel);
  const mode = {};             // item id -> 'write' | 'read'
  let timer = null;
  const findByName = n => S.items.find(i => isTop(i) && (i.name||'').trim().toLowerCase() === n.trim().toLowerCase());

  function inline(raw){
    // raw is unescaped text for one line
    const parts = [];
    let rest = raw;
    const tokens = /(`[^`]+`)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<]+)/;
    while(rest.length){
      const m = rest.match(tokens);
      if(!m){ parts.push(emph(esc(rest))); break; }
      if(m.index) parts.push(emph(esc(rest.slice(0, m.index))));
      const tok = m[0];
      if(m[1]) parts.push(`<code>${esc(tok.slice(1,-1))}</code>`);
      else if(m[2]){ const name = tok.slice(2,-2); const it = findByName(name); parts.push(`<button class="wl ${it?'':'missing'}" data-wl="${esc(name)}" title="${it?'Open '+esc(it.name):'Create a note called '+esc(name)}">${esc(name)}</button>`); }
      else if(m[3]){ const mm = tok.match(/^\[([^\]]+)\]\((.+)\)$/); parts.push(`<a href="${esc(mm[2])}" target="_blank" rel="noopener">${emph(esc(mm[1]))}</a>`); }
      else if(m[4]) parts.push(`<a href="${esc(tok)}" target="_blank" rel="noopener">${esc(tok)}</a>`);
      rest = rest.slice(m.index + tok.length);
    }
    return parts.join('');
  }
  const emph = s => s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>');

  function toHTML(body){
    const lines = (body||'').split('\n'); const out = []; let list = null, para = [];
    const flushPara = () => { if(para.length){ out.push(`<p>${para.map(inline).join('<br>')}</p>`); para=[]; } };
    const closeList = () => { if(list){ out.push(`</${list.tag}>`); list=null; } };
    const openList = (tag, cls) => { if(!list || list.tag!==tag || list.cls!==cls){ closeList(); out.push(`<${tag}${cls?` class="${cls}"`:''}>`); list={tag, cls}; } };
    lines.forEach((ln, i) => {
      let m;
      if(!ln.trim()){ flushPara(); closeList(); return; }
      if((m = ln.match(/^(#{1,3})\s+(.*)$/))){ flushPara(); closeList(); const n=m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); return; }
      if(/^\s*(---|\*\*\*)\s*$/.test(ln)){ flushPara(); closeList(); out.push('<hr>'); return; }
      if((m = ln.match(/^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/))){ flushPara(); openList('ul','tasks'); const on=m[1]!==' '; out.push(`<li class="${on?'on':''}"><button class="cbox" data-line="${i}" role="checkbox" aria-checked="${on}" aria-label="${esc(m[2]||'Checkbox')}">${ICON.check}</button><span>${inline(m[2])}</span></li>`); return; }
      if((m = ln.match(/^\s*[-*]\s+(.*)$/))){ flushPara(); openList('ul',''); out.push(`<li>${inline(m[1])}</li>`); return; }
      if((m = ln.match(/^\s*\d+[.)]\s+(.*)$/))){ flushPara(); openList('ol',''); out.push(`<li>${inline(m[1])}</li>`); return; }
      if((m = ln.match(/^>\s?(.*)$/))){ flushPara(); closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); return; }
      closeList(); para.push(ln);
    });
    flushPara(); closeList();
    return out.join('');
  }
  function backlinks(it){
    const key = '[['+(it.name||'').trim().toLowerCase()+']]';
    const notes = S.items.filter(x => x.id!==it.id && x.type==='note' && (x.body||'').toLowerCase().includes(key)).map(topOf).filter((x,i,a)=>x && x.id!==topOf(it)?.id && a.indexOf(x)===i);
    const tasks = S.tasks.filter(t => (t.notes||'').toLowerCase().includes(key));
    return {notes, tasks};
  }

  function view(it, root){
    root.dataset.root = it.id;
    const m = mode[it.id] || ((it.body||'').trim() ? 'read' : 'write');
    const words = (it.body||'').trim() ? (it.body.trim().split(/\s+/).length) : 0;
    const bl = backlinks(it);
    root.innerHTML = `
      <div class="note-tools"><div class="seg" role="group" aria-label="Mode"><button data-seg="read" aria-pressed="${m==='read'}">Read</button><button data-seg="write" aria-pressed="${m==='write'}">Write</button></div>
        <span class="caption" id="noteSaved" role="status" aria-live="polite">${plural(words,'word')}</span>
        <span class="spacer"></span><span class="caption">${m==='write'?'# Heading · - list · - [ ] checkbox · **bold** · [[Item name]] link':(TOUCH?'Double-tap':'Double-click')+' the text to edit'}</span></div>
      ${m==='write'
        ? `<textarea class="note-edit" id="noteBody" aria-label="Note text" placeholder="Start writing…\n\n# Heading\n- [ ] A checkbox\nLink another item with [[Home loan rate]]">${esc(it.body||'')}</textarea>`
        : `<article class="note-body md" id="noteRead">${(it.body||'').trim() ? toHTML(it.body) : '<p style="color:var(--muted)">This note is empty. Switch to Write to start.</p>'}</article>`}
      ${(bl.notes.length||bl.tasks.length)?`<section class="panel"><div class="panel-h"><h2>Linked from</h2><span class="caption">${plural(bl.notes.length+bl.tasks.length,'place')}</span></div><div class="backlinks">${bl.notes.map(n=>`<a class="chip-btn" href="#i-${esc(n.id)}" style="--c:${itemColor(n)};text-decoration:none"><span class="dot"></span>${esc(n.name)}</a>`).join('')}${bl.tasks.map(t=>`<button class="chip-btn" data-open="task:${esc(t.id)}" style="--c:${itemColor(itemById(t.boardId))}"><span class="dot"></span>${esc(t.title)}</button>`).join('')}</div></section>`:''}`;
    if(m==='write'){ const ta=root.querySelector('#noteBody'); autoSize(ta); }
  }
  const autoSize = ta => { if(!ta) return; ta.style.height='auto'; ta.style.height=Math.max(160, ta.scrollHeight+4)+'px'; };
  function save(it, v){
    window.__typingItem = it.id; clearTimeout(timer);
    timer = setTimeout(()=>{ docPatch('items', it.id, {body:v}); window.__typingItem=null; const s=Q(it,'#noteSaved'); if(s) s.textContent = 'Saved · '+plural(v.trim()?v.trim().split(/\s+/).length:0,'word'); renderSide(); }, 500);
  }
  function setMode(it, m){ if(timer){ clearTimeout(timer); const ta=Q(it,'#noteBody'); if(ta) docPatch('items', it.id, {body:ta.value}); window.__typingItem=null; timer=null; } mode[it.id]=m; view(it, R(it)); if(m==='write'){ const ta=Q(it,'#noteBody'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } else restoreFocus('[data-seg="read"]'); }

  function click(e, it){
    const sg = e.target.closest('[data-seg]'); if(sg) return setMode(it, sg.dataset.seg);
    const cb = e.target.closest('[data-line]');
    if(cb){ const lines=(it.body||'').split('\n'); const i=+cb.dataset.line; lines[i] = lines[i].replace(/\[( |x|X)\]/, m => m==='[ ]'?'[x]':'[ ]'); docPatch('items', it.id, {body:lines.join('\n')}); view(it, R(it)); restoreFocus(`[data-line="${i}"]`, R(it)); return; }
    const wl = e.target.closest('[data-wl]');
    if(wl){ const name = wl.dataset.wl; const t = findByName(name); if(t) return go('i-'+t.id);
      const pg = topOf(it); const n = buildItem('page', name.trim(), pg?.folderId||''); const tb = buildItem('note', 'Text', '', n.id); docSet('items', n); docSet('items', tb); go('i-'+n.id); toast('Created page “'+n.name+'”', ()=>{ docDel('items', tb.id); docDel('items', n.id); go('i-'+pg.id); }); }
  }
  function input(e, it){ if(e.target.id==='noteBody'){ autoSize(e.target); save(it, e.target.value); } }
  function keydown(e, it){
    if(e.target.id==='noteBody' && (e.metaKey||e.ctrlKey) && e.key==='Enter'){ e.preventDefault(); setMode(it, 'read'); }
  }
  $('#content').addEventListener('dblclick', e => { const r=e.target.closest('[data-root]'); const it=r && itemById(r.dataset.root); if(it?.type==='note' && e.target.closest('#noteRead') && !e.target.closest('button,a')) setMode(it, 'write'); });
  $('#content').addEventListener('focusout', e => { if(e.target.id==='noteBody' && timer){ const r=e.target.closest('[data-root]'); const it=r && itemById(r.dataset.root); if(it){ clearTimeout(timer); timer=null; docPatch('items', it.id, {body:e.target.value}); window.__typingItem=null; } } });

  return {narrow:true, render:view, click, input, keydown, toHTML,
    focusStart(it){ mode[it.id]='write'; view(it, R(it)); Q(it,'#noteBody')?.focus(); },
    newShortcut(it){ setMode(it, 'write'); }};
})();
