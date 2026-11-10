/* ============================================================
   Export and import.
   File format (format 1):
     plain:     {app:'life-organiser', format:1, version, exported, data:{folders,items,tasks,rows,settings}}
     encrypted: {app:'life-organiser', format:1, version, exported, encrypted:true,
                 kdf:{name:'PBKDF2', hash:'SHA-256', iterations, salt}, cipher:{name:'AES-GCM', iv}, data:<base64>}
   The passphrase never leaves the browser; only the encrypted file is saved.
   ============================================================ */
const BK_FORMAT = 1, BK_ITER = 600000, BK_COLS = ['folders','items','tasks','rows'];
const b64 = buf => { const u=new Uint8Array(buf); let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null, u.subarray(i,i+0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
async function bkKey(pass, salt, iter){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', hash:'SHA-256', salt, iterations:iter}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
function bkSnapshot(){
  return {folders:clone(S.folders), items:clone(S.items), tasks:clone(S.tasks), rows:clone(S.rows), settings:{flags:clone(flags())}};
}
async function bkBuild(pass){
  const head = {app:'life-organiser', format:BK_FORMAT, version:APP_VERSION, exported:nowIso()};
  const data = bkSnapshot();
  if(!pass) return JSON.stringify({...head, data}, null, 2);
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await bkKey(pass, salt, BK_ITER);
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(JSON.stringify(data)));
  return JSON.stringify({...head, encrypted:true, kdf:{name:'PBKDF2', hash:'SHA-256', iterations:BK_ITER, salt:b64(salt)}, cipher:{name:'AES-GCM', iv:b64(iv)}, data:b64(ct)}, null, 2);
}
async function bkDecrypt(file, pass){
  const key = await bkKey(pass, unb64(file.kdf.salt), file.kdf.iterations||BK_ITER);
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(file.cipher.iv)}, key, unb64(file.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
/* Accepts format 1 and the older "Copy backup" JSON ({exported, folders, items, tasks, rows, flags}). */
function bkNormalise(obj){
  const d = obj.data && !obj.encrypted ? obj.data : obj;
  if(!d || !Array.isArray(d.items) || !Array.isArray(d.tasks)) throw new Error('not-backup');
  const out = {}; for(const c of BK_COLS) out[c] = (Array.isArray(d[c]) ? d[c] : []).filter(x=>x && typeof x.id==='string' && x.id);
  out.settings = {flags: Array.isArray(d.settings?.flags) ? d.settings.flags : Array.isArray(d.flags) ? d.flags : null};
  return out;
}
const bkFileName = enc => `life-organiser-${ymd(new Date())}${enc?'-encrypted':''}.json`;
async function bkSave(text, name){
  const cap = window.claude && typeof window.claude.use==='function' ? await window.claude.use('downloads').catch(()=>null) : null;
  if(cap){
    try{ await cap.save({filename:name, data:new Blob([text], {type:'application/json'})}); return true; }
    catch(e){ if(e?.code==='declined') return false; if(!['unavailable','not_granted','capability_disabled','capability_removed'].includes(e?.code)) throw e; }
  }
  try{
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:'application/json'})); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); return true;
  }catch(e){ return null; }
}
function bkMarkSaved(){ ls.set('lo.lastBackup', nowIso()); }
function bkLastLabel(){
  const t = ls.get('lo.lastBackup',''); if(!t) return 'No backup on this device yet';
  const d = -dayDiff(t.slice(0,10)); return 'Last backup: '+(d<=0?'today':d===1?'yesterday':d+' days ago');
}
function bkCounts(d){ return `${plural(d.folders.length,'folder')}, ${plural(d.items.length,'item')}, ${plural(d.tasks.length,'task')}, ${plural(d.rows.length,'row')}`; }

/* ----- Export ----- */
function openExport(opener){
  const m = openModal(`<h2 id="mTitle">Export</h2>
    <p class="note">Saves everything (folders, items, tasks, bills, rows and status flags) to one file you keep. ${esc(bkLastLabel())}.</p>
    <div class="field"><span class="lbl" id="exL">File</span><div class="seg" role="group" aria-labelledby="exL"><button data-enc="1" aria-pressed="true">Encrypted</button><button data-enc="0" aria-pressed="false">Plain</button></div></div>
    <div id="exPass" style="display:flex;flex-direction:column;gap:10px">
      <label class="field"><span class="lbl">Passphrase</span><input class="txt-in" type="password" id="exP1" autocomplete="new-password" placeholder="At least 8 characters" autofocus></label>
      <label class="field"><span class="lbl">Repeat passphrase</span><input class="txt-in" type="password" id="exP2" autocomplete="new-password"></label>
      <p class="note">Keep the passphrase in your password manager. Without it the file can’t be opened, by anyone.</p>
    </div>
    <p class="note" id="exPlain" hidden>A plain file can be read by anyone who gets it. Keep it somewhere private.</p>
    <p class="notice" id="exErr" hidden></p>
    <div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">Export</button></div>`, {opener});
  let enc = true;
  const err = t => { const e=$('#exErr'); e.textContent=t; e.hidden=!t; };
  const go = async () => {
    let pass = '';
    if(enc){ pass=$('#exP1').value; if(pass.length<8) return err('Use a passphrase of at least 8 characters.'); if(pass!==$('#exP2').value) return err('The two passphrases don’t match.'); }
    err(''); const b=m.querySelector('[data-x="yes"]'); b.disabled=true; b.textContent='Exporting…';
    try{
      const text = await bkBuild(pass); const ok = await bkSave(text, bkFileName(enc));
      if(ok===false){ b.disabled=false; b.textContent='Export'; return; }
      if(ok===null) throw new Error('save');
      bkMarkSaved(); closeModal(); toast(enc ? 'Encrypted export saved' : 'Export saved');
    }catch(e){ console.warn(e); b.disabled=false; b.textContent='Export'; err('Couldn’t save the file here. Try again, or try another browser.'); }
  };
  m.onclick = e => {
    const s = e.target.closest('[data-enc]'); if(s){ enc = s.dataset.enc==='1'; $$('[data-enc]', m).forEach(x=>x.setAttribute('aria-pressed', x===s)); $('#exPass').hidden=!enc; $('#exPlain').hidden=enc; err(''); return; }
    const b = e.target.closest('[data-x]'); if(!b) return; if(b.dataset.x==='no') return closeModal(); go();
  };
  m.onkeydown = e => { if(e.key==='Enter' && e.target.matches('input')){ e.preventDefault(); go(); } };
}

/* ----- Import ----- */
function openImport(opener){
  let parsed = null, data = null, mode = 'merge';
  const m = openModal(`<h2 id="mTitle">Import</h2>
    <p class="note">Choose a Life Organiser export file. You’ll see what’s in it before anything changes.</p>
    <label class="btn" style="align-self:flex-start;cursor:pointer">Choose file…<input type="file" id="imFile" class="sr-only" accept=".json,application/json"></label>
    <div id="imStep"></div>
    <p class="notice" id="imErr" hidden></p>
    <div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes" disabled>Import</button></div>`, {opener});
  const err = t => { const e=$('#imErr'); e.textContent=t; e.hidden=!t; };
  const btn = () => m.querySelector('[data-x="yes"]');
  const showPreview = () => {
    $('#imStep').innerHTML = `<div class="field"><span class="lbl">In this file</span><p style="margin:0">${esc(bkCounts(data))}${parsed.exported?` · exported ${esc(stamp(parsed.exported))}`:''}${parsed.version?` · version ${esc(parsed.version)}`:''}</p></div>
      <div class="field"><span class="lbl" id="imL">How to import</span><div class="seg" role="group" aria-labelledby="imL"><button data-mode="merge" aria-pressed="${mode==='merge'}">Merge</button><button data-mode="replace" aria-pressed="${mode==='replace'}">Replace everything</button></div>
      <p class="note" id="imHelp">${mode==='merge'?'Adds what’s new and keeps the newer version of anything edited in both places. Nothing is deleted.':'Deletes everything here first, then loads the file. You can undo straight after.'}</p></div>
      <p class="note">You now have ${esc(bkCounts(S))}.</p>`;
    btn().disabled = false; btn().textContent = mode==='replace' ? 'Replace everything' : 'Merge';
    btn().classList.toggle('danger', mode==='replace');
  };
  const askPass = () => {
    $('#imStep').innerHTML = `<label class="field"><span class="lbl">This file is encrypted. Passphrase</span><input class="txt-in" type="password" id="imPass" autocomplete="current-password" autofocus></label>`;
    btn().disabled = false; btn().textContent = 'Unlock'; requestAnimationFrame(()=>$('#imPass')?.focus());
  };
  const unlock = async () => {
    const p = $('#imPass').value; if(!p) return; btn().disabled = true; btn().textContent = 'Unlocking…';
    try{ data = bkNormalise(await bkDecrypt(parsed, p)); err(''); showPreview(); }
    catch(e){ btn().disabled = false; btn().textContent = 'Unlock'; err(e.message==='not-backup' ? 'This doesn’t look like a Life Organiser export.' : 'That passphrase didn’t work. Check it and try again.'); }
  };
  m.onchange = async e => {
    if(e.target.id!=='imFile') return; const f = e.target.files?.[0]; if(!f) return;
    err(''); data=null; $('#imStep').innerHTML=''; btn().disabled=true;
    try{
      parsed = JSON.parse(await f.text());
      if(parsed.encrypted){ if(parsed.app!=='life-organiser' || !parsed.kdf || !parsed.cipher) throw new Error('not-backup'); if((parsed.format||1)>BK_FORMAT) throw new Error('newer'); askPass(); return; }
      if((parsed.format||1)>BK_FORMAT) throw new Error('newer');
      data = bkNormalise(parsed); showPreview();
    }catch(x){ err(x.message==='newer' ? 'This file comes from a newer version of Life Organiser. Update this copy first.' : 'This doesn’t look like a Life Organiser export.'); }
  };
  m.onclick = e => {
    const md = e.target.closest('[data-mode]'); if(md){ mode = md.dataset.mode; showPreview(); return; }
    const b = e.target.closest('[data-x]'); if(!b) return;
    if(b.dataset.x==='no') return closeModal();
    if(!data){ if(parsed?.encrypted) unlock(); return; }
    const res = bkApply(data, mode); closeModal();
    toast(`${mode==='replace'?'Replaced with':'Merged'} ${plural(res.changed,'change')} from the file`, () => bkRestore(res.before));
  };
  m.onkeydown = e => { if(e.key==='Enter' && e.target.id==='imPass'){ e.preventDefault(); unlock(); } };
}
const bkStamp = x => x?.updated || x?.created || '';
const bkSame = (a,b) => { const n = v => Array.isArray(v) ? v.map(n) : v && typeof v==='object' ? Object.keys(v).sort().reduce((o,k)=>(o[k]=n(v[k]),o),{}) : v; return JSON.stringify(n(a))===JSON.stringify(n(b)); };
function bkApply(d, mode){
  const before = bkSnapshot();
  try{ localStorage.setItem('lo.preImport', JSON.stringify({saved:nowIso(), data:before})); }catch(e){}
  let changed = 0;
  for(const c of BK_COLS){
    const incoming = new Map(d[c].map(x=>[x.id, x]));
    if(mode==='replace') for(const x of S[c].slice()) if(!incoming.has(x.id)){ docDel(c, x.id); changed++; }
    for(const x of incoming.values()){
      const cur = S[c].find(y=>y.id===x.id);
      if(cur && mode==='merge' && bkStamp(cur) >= bkStamp(x)) continue;
      if(cur && bkSame(cur, x)) continue;
      docSet(c, clone(x)); changed++;
    }
  }
  if(d.settings?.flags && (mode==='replace' || !S.flags)){ const prev=S.flags; S.flags=d.settings.flags; Store.run('meta/settings', r=>r.set({flags:S.flags}), ()=>{ S.flags=prev; }); }
  render(true);
  return {before, changed};
}
function bkRestore(before){
  for(const c of BK_COLS){
    const keep = new Map(before[c].map(x=>[x.id, x]));
    for(const x of S[c].slice()) if(!keep.has(x.id)) docDel(c, x.id);
    for(const x of keep.values()){ const cur=S[c].find(y=>y.id===x.id); if(!cur || !bkSame(cur, x)) docSet(c, clone(x)); }
  }
  const prev=S.flags; S.flags=before.settings.flags; Store.run('meta/settings', r=>r.set({flags:S.flags}), ()=>{ S.flags=prev; });
  render(true);
}
function bkUndoLast(){
  let saved=null; try{ saved = JSON.parse(localStorage.getItem('lo.preImport')||'null'); }catch(e){}
  if(!saved?.data) return toast('There’s no earlier import to undo on this device.');
  confirmModal({title:'Undo last import?', body:`Puts everything back as it was on ${esc(stamp(saved.saved))}, just before the last import. Changes made since then are lost.`, action:'Restore', danger:true}).then(ok => {
    if(!ok) return; const now = bkSnapshot(); bkRestore(saved.data); try{ localStorage.removeItem('lo.preImport'); }catch(e){}
    toast('Restored to before the last import', () => bkRestore(now));
  });
}
/* Gentle weekly nudge, once per session, when there is real data and no recent backup. */
function bkNudge(){
  if(Store.demo || !S.tasks.length && S.items.length<2) return;
  const t = ls.get('lo.lastBackup',''); const days = t ? -dayDiff(t.slice(0,10)) : 99;
  let seen = false; try{ seen = !!sessionStorage.getItem('lo.nudged'); sessionStorage.setItem('lo.nudged','1'); }catch(e){}
  if(days>=7 && !seen){ toast(t ? `No backup for ${days} days. Export one from the ••• menu.` : 'Tip: export a backup from the ••• menu.'); }
}
