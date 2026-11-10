/* ============================================================
   Note — a page of markdown-style writing with [[links]] and backlinks.
   item.body holds the text.
   ============================================================ */
TYPE_VIEWS.note = (() => {
  const R = it => document.querySelector(`[data-root="${CSS.escape(it.id)}"]`) || $('#tv');   // this item's own root (it may be one block of a Page)
  const Q = (it, sel) => R(it)?.querySelector(sel);
  const mode = {};             // item id -> 'write' | 'read'
  let timer = null;
  const findByName = n => { const k = n.trim().toLowerCase(), m = i => (i.name||'').trim().toLowerCase()===k;
    return S.items.find(i => isTop(i) && m(i)) || topOf(S.items.find(i => i.type==='stack' && m(i))); };   // a stack opens its Kanban

  let EDIT = false;   // building HTML for the rich editor: links and checkboxes become non-editable chips
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
      else if(m[2]){ const name = tok.slice(2,-2); const it = findByName(name);
        parts.push(EDIT ? `<span class="wl ${it?'':'missing'}" contenteditable="false" data-wl="${esc(name)}" title="${it?'Open '+esc(it.name):'Create a page called '+esc(name)}">${esc(name)}</span>`
          : `<button class="wl ${it?'':'missing'}" data-wl="${esc(name)}" title="${it?'Open '+esc(it.name):'Create a page called '+esc(name)}">${esc(name)}</button>`); }
      else if(m[3]){ const mm = tok.match(/^\[([^\]]+)\]\((.+)\)$/); parts.push(`<a href="${esc(mm[2])}" target="_blank" rel="noopener">${emph(esc(mm[1]))}</a>`); }
      else if(m[4]) parts.push(`<a href="${esc(tok)}" target="_blank" rel="noopener">${esc(tok)}</a>`);
      rest = rest.slice(m.index + tok.length);
    }
    return parts.join('');
  }
  const emph = s => s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/~~([^~]+)~~/g,'<s>$1</s>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>');

  function toHTML(body, edit=false){
    EDIT = edit;
    const lines = (body||'').split('\n'); const out = []; let list = null, para = [];
    const flushPara = () => { if(para.length){ out.push(`<p>${para.map(inline).join('<br>')}</p>`); para=[]; } };
    const closeList = () => { if(list){ out.push(`</${list.tag}>`); list=null; } };
    const openList = (tag, cls) => { if(!list || list.tag!==tag || list.cls!==cls){ closeList(); out.push(`<${tag}${cls?` class="${cls}"`:''}>`); list={tag, cls}; } };
    lines.forEach((ln, i) => {
      let m;
      if(!ln.trim()){ flushPara(); closeList(); return; }
      if((m = ln.match(/^(#{1,3})\s+(.*)$/))){ flushPara(); closeList(); const n=m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); return; }
      if(/^\s*(---|\*\*\*)\s*$/.test(ln)){ flushPara(); closeList(); out.push('<hr>'); return; }
      if((m = ln.match(/^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/))){ flushPara(); openList('ul','tasks'); const on=m[1]!==' ';
        out.push(edit ? `<li class="${on?'on':''}">${cbHTML(on)}${inline(m[2])||'<br>'}</li>`
          : `<li class="${on?'on':''}"><button class="cbox" data-line="${i}" role="checkbox" aria-checked="${on}" aria-label="${esc(m[2]||'Checkbox')}">${ICON.check}</button><span>${inline(m[2])}</span></li>`); return; }
      if((m = ln.match(/^\s*[-*]\s+(.*)$/))){ flushPara(); openList('ul',''); out.push(`<li>${inline(m[1])||'<br>'}</li>`); return; }
      if((m = ln.match(/^\s*\d+[.)]\s+(.*)$/))){ flushPara(); openList('ol',''); out.push(`<li>${inline(m[1])||'<br>'}</li>`); return; }
      if((m = ln.match(/^>\s?(.*)$/))){ flushPara(); closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); return; }
      closeList(); para.push(ln);
    });
    flushPara(); closeList(); EDIT = false;
    return out.join('');
  }
  const cbHTML = on => `<span class="rt-cb" contenteditable="false" role="checkbox" aria-checked="${!!on}" aria-label="Done">${ICON.check}</span>`;

  /* Rich editor → markdown (the stored format, so Raw and the rest of the app keep working) */
  function toMD(root){
    const blocks = [];
    const wrap = (mk, s) => { const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/); return m[2] ? m[1]+mk+m[2]+mk+m[3] : s; };
    const inl = n => {
      if(n.nodeType===3) return n.nodeValue.replace(/ /g,' ').replace(/​/g,'');
      if(n.nodeType!==1) return '';
      const tag = n.tagName, kids = () => [...n.childNodes].map(inl).join('');
      if(n.classList.contains('rt-cb')) return '';
      if(n.dataset.wl) return '[['+n.dataset.wl+']]';
      if(tag==='BR') return '\n';
      if(tag==='B' || tag==='STRONG') return wrap('**', kids());
      if(tag==='I' || tag==='EM') return wrap('*', kids());
      if(tag==='S' || tag==='STRIKE' || tag==='DEL') return wrap('~~', kids());
      if(tag==='CODE') return '`'+n.textContent+'`';
      if(tag==='A'){ const h=n.getAttribute('href')||'', t=kids(); return !h ? t : (t.trim()===h ? h : '['+t.trim()+']('+h+')'); }
      const st = n.getAttribute('style')||'';   // pasted or browser-made spans
      if(/font-weight:\s*(bold|[6-9]00)/.test(st)) return wrap('**', kids());
      if(/font-style:\s*italic/.test(st)) return wrap('*', kids());
      if(['DIV','P','UL','OL','LI','H1','H2','H3','H4','BLOCKQUOTE'].includes(tag)) return '\n'+kids()+'\n';
      return kids();
    };
    const lines = s => s.split('\n').map(x=>x.replace(/\s+$/,'')).filter((x,i,a)=>x.trim() || (i>0 && i<a.length-1));
    const list = (el, kind) => [...el.children].filter(li=>li.tagName==='LI').flatMap((li,i) => {
      const nested = [...li.querySelectorAll(':scope > ul, :scope > ol')]; nested.forEach(x=>x.remove());
      const cb = li.querySelector(':scope > .rt-cb'); const task = kind==='task' || cb;
      const txt = inl(li).replace(/\n+/g,' ').trim();
      const head = task ? `- [${(cb?.getAttribute('aria-checked')==='true' || li.classList.contains('on'))?'x':' '}] ` : kind==='ol' ? `${i+1}. ` : '- ';
      return [head+txt, ...nested.flatMap(x=>list(x, x.tagName==='OL'?'ol':x.classList.contains('tasks')?'task':'ul'))];
    });
    const BLOCK = /^(P|DIV|UL|OL|H[1-6]|BLOCKQUOTE|HR)$/;
    const walkKids = parent => { let run = [];   // loose text and inline tags between blocks make one paragraph
      const flush = () => { if(!run.length) return; const p = document.createElement('p'); run.forEach(x=>p.appendChild(x.cloneNode(true))); run = []; walk(p); };
      [...parent.childNodes].forEach(x => { if(x.nodeType===1 && BLOCK.test(x.tagName)){ flush(); walk(x); } else run.push(x); }); flush(); };
    const walk = n => {
      if(n.nodeType===3){ const t=n.nodeValue.trim(); if(t) blocks.push(t); return; }
      if(n.nodeType!==1) return;
      const tag = n.tagName;
      if(/^H[1-6]$/.test(tag)){ const t=inl(n).replace(/\n+/g,' ').trim(); if(t) blocks.push('#'.repeat(Math.min(3,+tag[1]))+' '+t); return; }
      if(tag==='HR'){ blocks.push('---'); return; }
      if(tag==='UL' || tag==='OL'){ const l = list(n.cloneNode(true), tag==='OL'?'ol':n.classList.contains('tasks')?'task':'ul'); if(l.length) blocks.push(l.join('\n')); return; }
      if(tag==='BLOCKQUOTE'){ const l=lines(inl(n)); if(l.length) blocks.push(l.map(x=>'> '+x.trim()).join('\n')); return; }
      if((tag==='DIV' || tag==='P') && [...n.children].some(c=>BLOCK.test(c.tagName))){ walkKids(n); return; }
      const l = lines(inl(n)); if(l.length) blocks.push(l.join('\n'));
    };
    walkKids(root);
    return blocks.join('\n\n');
  }

  function backlinks(it){
    const key = '[['+(topOf(it).name||'').trim().toLowerCase()+']]';   // links name the page, not the block
    const notes = S.items.filter(x => x.id!==it.id && x.type==='note' && (x.body||'').toLowerCase().includes(key)).map(topOf).filter((x,i,a)=>x && x.id!==topOf(it)?.id && a.indexOf(x)===i);
    const tasks = S.tasks.filter(t => (t.notes||'').toLowerCase().includes(key));
    if(blocksOf(topOf(it).id).filter(b=>b.type==='note')[0]?.id !== it.id) return {notes:[], tasks:[]};   // shown once per page, under its first text block
    return {notes, tasks};
  }

  /* Two modes: Editor (rich text with a formatting bar, like an email draft) and Raw (the markdown underneath). */
  const TOOLS = [
    {c:'style', l:'Text style', menu:true},
    {sep:true},
    {c:'itemlink', l:'Link to another item in the app', i:`${ICON.page}<span class="rt-txt">Item link</span>`, wide:true}, {c:'link', l:'Web link (⌘K)', i:ICON.rtLink},
    {sep:true},
    {c:'bold', l:'Bold (⌘B)', i:'<b>B</b>'}, {c:'italic', l:'Italic (⌘I)', i:'<i>I</i>'}, {c:'strikeThrough', l:'Strikethrough', i:'<s>S</s>'}, {c:'code', l:'Code', i:'<span class="mono">&lt;/&gt;</span>'},
    {sep:true},
    {c:'insertUnorderedList', l:'Bulleted list', i:ICON.rtUl}, {c:'insertOrderedList', l:'Numbered list', i:ICON.rtOl}, {c:'tasks', l:'Checklist', i:ICON.rtCk}, {c:'quote', l:'Quote', i:ICON.rtQ},
    {sep:true},
    {c:'clear', l:'Clear formatting', i:ICON.rtClear},
  ];
  const STYLES = [{v:'P', l:'Normal text'}, {v:'H1', l:'Heading 1'}, {v:'H2', l:'Heading 2'}, {v:'H3', l:'Heading 3'}];
  function view(it, root){
    root.dataset.root = it.id;
    const m = mode[it.id] || 'rich';
    const words = (it.body||'').trim() ? (it.body.trim().split(/\s+/).length) : 0;
    const bl = backlinks(it);
    root.innerHTML = `
      <div class="note-tools"><div class="seg" role="group" aria-label="Mode"><button data-seg="rich" aria-pressed="${m==='rich'}">Editor</button><button data-seg="raw" aria-pressed="${m==='raw'}">Raw</button></div>
        <span class="caption" id="noteSaved" role="status" aria-live="polite">${plural(words,'word')}</span>
        <span class="spacer"></span>${m==='raw'?'<span class="caption raw-tip"># Heading · - list · - [ ] checkbox · **bold** · [[Item name]] link</span>':''}</div>
      ${m==='raw'
        ? `<textarea class="note-edit" id="noteBody" aria-label="Note text (markdown)" placeholder="Start writing…\n\n# Heading\n- [ ] A checkbox\nLink another item with [[Home Loan Rate]]">${esc(it.body||'')}</textarea>`
        : `<div class="rt">
            <div class="rt-bar" role="toolbar" aria-label="Formatting">${TOOLS.map(t=> t.sep ? '<span class="rt-sep" aria-hidden="true"></span>'
              : t.menu ? `<button class="rt-btn rt-style" data-rt="style" aria-haspopup="menu" aria-expanded="false" title="${t.l}"><span class="lbl-t">Normal text</span>${ICON.chevD}</button>`
              : `<button class="rt-btn ${t.wide?'rt-wide':''}" data-rt="${t.c}" aria-label="${esc(t.l)}" title="${esc(t.l)}" aria-pressed="false">${t.i}</button>`).join('')}</div>
            <div class="rt-edit md" id="noteRich" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note text" data-ph="Start writing…" spellcheck="true">${(it.body||'').trim() ? toHTML(it.body, true) : '<p><br></p>'}</div>
          </div>`}
      ${(bl.notes.length||bl.tasks.length)?`<section class="panel"><div class="panel-h"><h2>Linked from</h2><span class="caption">${plural(bl.notes.length+bl.tasks.length,'place')}</span></div><div class="backlinks">${bl.notes.map(n=>`<a class="chip-btn" href="#i-${esc(n.id)}" style="--c:${itemColor(n)};text-decoration:none"><span class="dot"></span>${esc(n.name)}</a>`).join('')}${bl.tasks.map(t=>`<button class="chip-btn" data-open="task:${esc(t.id)}" style="--c:${itemColor(itemById(t.boardId))}"><span class="dot"></span>${esc(t.title)}</button>`).join('')}</div></section>`:''}`;
    if(m==='raw'){ const ta=root.querySelector('#noteBody'); autoSize(ta); }
    else { const ed = root.querySelector('#noteRich'); ed.classList.toggle('empty', !(it.body||'').trim()); }
  }
  const autoSize = ta => { if(!ta) return; ta.style.height='auto'; ta.style.height=Math.max(160, ta.scrollHeight+4)+'px'; };
  function save(it, v){
    window.__typingItem = it.id; clearTimeout(timer);
    timer = setTimeout(()=>{ timer=null; docPatch('items', it.id, {body:v}); window.__typingItem=null; const s=Q(it,'#noteSaved'); if(s) s.textContent = 'Saved · '+plural(v.trim()?v.trim().split(/\s+/).length:0,'word'); renderSide(); }, 500);
  }
  const current = it => { const ta=Q(it,'#noteBody'); if(ta) return ta.value; const ed=Q(it,'#noteRich'); return ed ? toMD(ed) : null; };
  function flush(it){ if(!timer) return; clearTimeout(timer); timer=null; const v=current(it); if(v!==null) docPatch('items', it.id, {body:v}); window.__typingItem=null; }
  function setMode(it, m){ flush(it); mode[it.id]=m; it = itemById(it.id); view(it, R(it));
    if(m==='raw'){ const ta=Q(it,'#noteBody'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    else { const ed=Q(it,'#noteRich'); ed?.focus(); caretEnd(ed); } }
  const caretEnd = el => { if(!el) return; try{ const r=document.createRange(); r.selectNodeContents(el); r.collapse(false); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }catch(e){} };

  /* ----- rich editor ----- */
  let savedRange = null;
  const editorOf = el => el?.closest?.('[data-root]')?.querySelector('#noteRich');
  const blockAt = ed => { const s=getSelection(); if(!s.rangeCount) return null; let n=s.getRangeAt(0).startContainer; if(!ed.contains(n)) return null;
    while(n && n.parentNode!==ed) n=n.parentNode; return n; };
  function syncBar(ed){
    const root = ed.closest('[data-root]'); if(!root) return;
    const q = c => { try{ return document.queryCommandState(c); }catch(e){ return false; } };
    for(const c of ['bold','italic','strikeThrough','insertUnorderedList','insertOrderedList']){ const b=root.querySelector(`[data-rt="${c}"]`); if(b) b.setAttribute('aria-pressed', q(c) && !(c==='insertUnorderedList' && inTasks(ed))); }
    const tk = root.querySelector('[data-rt="tasks"]'); if(tk) tk.setAttribute('aria-pressed', inTasks(ed));
    const b = blockAt(ed); const tag = b?.nodeType===1 ? b.tagName : 'P';
    const qt = root.querySelector('[data-rt="quote"]'); if(qt) qt.setAttribute('aria-pressed', tag==='BLOCKQUOTE');
    const st = root.querySelector('.rt-style .lbl-t'); if(st) st.textContent = (STYLES.find(s=>s.v===tag)||STYLES[0]).l;
  }
  const inTasks = ed => { const s=getSelection(); if(!s.rangeCount) return false; const n=s.getRangeAt(0).startContainer; const ul=(n.nodeType===1?n:n.parentElement)?.closest('ul'); return !!ul && ed.contains(ul) && ul.classList.contains('tasks'); };
  function normalize(ed){
    ed.querySelectorAll('ul.tasks > li').forEach(li => { if(!li.querySelector(':scope > .rt-cb')) li.insertAdjacentHTML('afterbegin', cbHTML(false)); });
    ed.querySelectorAll('ul:not(.tasks) > li > .rt-cb, ol > li > .rt-cb').forEach(cb => cb.remove());
    ed.classList.toggle('empty', !ed.textContent.trim() && !ed.querySelector('li,hr,.wl'));
  }
  function edited(ed){ normalize(ed); const it = itemById(ed.closest('[data-root]').dataset.root); if(it) save(it, toMD(ed)); syncBar(ed); }
  const exec = (c, v=null) => { try{ document.execCommand(c, false, v); }catch(e){} };
  function restoreSel(ed){ ed.focus({preventScroll:true}); if(savedRange){ const s=getSelection(); s.removeAllRanges(); s.addRange(savedRange); } }
  async function tool(btn, ed){
    const c = btn.dataset.rt; restoreSel(ed);
    if(c==='style') return openMenu(btn, STYLES.map(s=>({label:s.l, value:s.v})), v => { restoreSel(ed); exec('formatBlock', '<'+v+'>'); edited(ed); }, 'Text style');
    if(c==='bold'||c==='italic'||c==='strikeThrough') exec(c);
    else if(c==='insertUnorderedList'||c==='insertOrderedList'){
      if(inTasks(ed)){ const ul = getSelection().getRangeAt(0).startContainer; const l=(ul.nodeType===1?ul:ul.parentElement).closest('ul'); l.classList.remove('tasks'); l.querySelectorAll('.rt-cb').forEach(x=>x.remove()); if(c==='insertOrderedList') exec(c); }
      else exec(c); }
    else if(c==='tasks'){
      if(inTasks(ed)){ const n=getSelection().getRangeAt(0).startContainer; const l=(n.nodeType===1?n:n.parentElement).closest('ul'); l.classList.remove('tasks'); l.querySelectorAll('.rt-cb').forEach(x=>x.remove()); exec('insertUnorderedList'); }
      else { if(!document.queryCommandState('insertUnorderedList')) exec('insertUnorderedList');
        const n=getSelection().getRangeAt(0).startContainer; const l=(n.nodeType===1?n:n.parentElement)?.closest('ul'); if(l) l.classList.add('tasks'); } }
    else if(c==='quote'){ const b=blockAt(ed); exec('formatBlock', b?.tagName==='BLOCKQUOTE' ? '<P>' : '<BLOCKQUOTE>'); }
    else if(c==='code'){ const s=getSelection(); const t=s.toString(); if(t) exec('insertHTML', `<code>${esc(t)}</code>&#8203;`); }
    else if(c==='clear'){ exec('removeFormat'); exec('unlink'); const b=blockAt(ed); if(b && /^(H1|H2|H3|BLOCKQUOTE)$/.test(b.tagName)) exec('formatBlock', '<P>'); }
    else if(c==='link'){ const sel = savedRange?.cloneRange(); const txt = sel?.toString()||'';
      const url = await promptModal({title:'Web link', label:'Address', value:/^https?:\/\//.test(txt)?txt:'https://', opener:btn}); if(!url || url==='https://') return ed.focus();
      const href = /^https?:\/\//i.test(url) ? url : 'https://'+url; ed.focus(); if(sel){ const s=getSelection(); s.removeAllRanges(); s.addRange(sel); }
      if(sel && !sel.collapsed) exec('createLink', href); else exec('insertHTML', `<a href="${esc(href)}">${esc(href)}</a>&nbsp;`); }
    else if(c==='itemlink'){ const sel = savedRange?.cloneRange();
      const list = S.items.filter(i=>isTop(i) && TYPE_GROUP[i.type]).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
      return openMenu(btn, list.map(i=>({label:i.name||'Untitled', value:i.id})), id => { const i=itemById(id); if(!i) return; ed.focus(); if(sel){ const s=getSelection(); s.removeAllRanges(); s.addRange(sel); }
        exec('insertHTML', `<span class="wl" contenteditable="false" data-wl="${esc(i.name)}">${esc(i.name)}</span>&nbsp;`); edited(ed); }, 'Link to an item'); }
    edited(ed);
  }
  document.addEventListener('selectionchange', () => { const s=getSelection(); if(!s.rangeCount) return; const n=s.getRangeAt(0).startContainer; const ed=(n.nodeType===1?n:n.parentElement)?.closest?.('#noteRich'); if(!ed) return; savedRange = s.getRangeAt(0).cloneRange(); syncBar(ed); });
  /* toolbar buttons keep the text selection */
  $('#content').addEventListener('mousedown', e => { if(e.target.closest('.rt-bar button')) e.preventDefault(); });
  $('#content').addEventListener('paste', e => { const ed = e.target.closest?.('#noteRich'); if(!ed) return; e.preventDefault(); const t=(e.clipboardData||window.clipboardData).getData('text/plain'); exec('insertText', t); edited(ed); });

  function click(e, it){
    const sg = e.target.closest('[data-seg]'); if(sg) return setMode(it, sg.dataset.seg);
    const tb = e.target.closest('[data-rt]'); if(tb){ const ed=editorOf(tb); if(ed) tool(tb, ed); return; }
    const rc = e.target.closest('.rt-cb'); if(rc){ const on = rc.getAttribute('aria-checked')!=='true'; rc.setAttribute('aria-checked', on); rc.closest('li')?.classList.toggle('on', on); edited(editorOf(rc)); return; }
    const cb = e.target.closest('[data-line]');
    if(cb){ const lines=(it.body||'').split('\n'); const i=+cb.dataset.line; lines[i] = lines[i].replace(/\[( |x|X)\]/, m => m==='[ ]'?'[x]':'[ ]'); docPatch('items', it.id, {body:lines.join('\n')}); view(it, R(it)); restoreFocus(`[data-line="${i}"]`, R(it)); return; }
    if(e.target.closest('#noteRich a[href]') && (e.metaKey||e.ctrlKey)){ window.open(e.target.closest('a').href, '_blank', 'noopener'); return; }
    const wl = e.target.closest('[data-wl]');
    if(wl){ flush(it); const name = wl.dataset.wl; const t = findByName(name); if(t) return go('i-'+t.id);
      const pg = topOf(it); const n = buildItem('page', name.trim(), pg?.folderId||''); const tb2 = buildItem('note', 'Text', '', n.id); docSet('items', n); docSet('items', tb2); go('i-'+n.id); toast('Created page “'+n.name+'”', ()=>{ docDel('items', tb2.id); docDel('items', n.id); go('i-'+pg.id); }); }
  }
  function input(e, it){
    if(e.target.id==='noteBody'){ autoSize(e.target); save(it, e.target.value); return; }
    const ed = e.target.closest?.('#noteRich'); if(ed) edited(ed);
  }
  function keydown(e, it){
    if(e.target.id==='noteBody' && (e.metaKey||e.ctrlKey) && e.key==='Enter'){ e.preventDefault(); setMode(it, 'rich'); return; }
    const ed = e.target.closest?.('#noteRich'); if(!ed) return;
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); e.stopPropagation(); const b=ed.closest('[data-root]').querySelector('[data-rt="link"]'); if(b) tool(b, ed); return; }
    if((e.metaKey||e.ctrlKey) && ['b','i'].includes(e.key.toLowerCase())) setTimeout(()=>edited(ed), 0);
  }
  /* leaving the editor: save now and redraw, so typed [[links]] turn into links */
  $('#content').addEventListener('focusout', e => {
    if(e.target.id==='noteBody' && timer){ const r=e.target.closest('[data-root]'); const it=r && itemById(r.dataset.root); if(it){ clearTimeout(timer); timer=null; docPatch('items', it.id, {body:e.target.value}); window.__typingItem=null; } return; }
    if(e.target.id!=='noteRich') return; const ed = e.target;
    setTimeout(() => { if(!ed.isConnected || ed.contains(document.activeElement) || document.activeElement?.closest?.('.rt-bar') || menuEl || modalOpen()) return;
      const it = itemById(ed.closest('[data-root]')?.dataset.root); if(!it) return; flush(it);
      const v = toMD(ed); if(v!==(itemById(it.id).body||'')) docPatch('items', it.id, {body:v});
      if(/\[\[[^\]]+\]\]/.test(ed.textContent)) view(itemById(it.id), R(it)); }, 150);
  });

  return {narrow:true, render:view, click, input, keydown, toHTML, toMD,
    focusStart(it){ mode[it.id]='rich'; view(it, R(it)); const ed=Q(it,'#noteRich'); ed?.focus(); caretEnd(ed); },
    newShortcut(it){ setMode(it, 'rich'); }};
})();
