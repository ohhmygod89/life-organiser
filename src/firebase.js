/* ============================================================
   Firebase store (GitHub Pages build only: window.LO_MODE === 'firebase').
   - Sign in with email + password (Firebase Auth). Sign-ups are switched off in the Firebase console.
   - Everything is encrypted on this device before it is saved: AES-GCM with a key derived from your passphrase
     (PBKDF2-SHA-256, 600,000 rounds). Firestore only ever holds { iv, ct }. Nobody, including Google, can read it.
   - Layout: users/{uid}            { salt, iter, check }   (check = an encrypted known string, to test the passphrase)
             users/{uid}/{col}/{id} { iv, ct }              (col = folders | items | tasks | rows | meta)
   - "Remember on this device" keeps the derived key in IndexedDB as a non-extractable CryptoKey (it can be used here
     but never read out). Sign out forgets it.
   - It offers the same tiny interface as DemoDB and Claude's db: collection(c).onSnapshot, doc(path).onSnapshot/set/update/delete.
   ============================================================ */
const FireDB = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const CHECK = 'life-organiser-v1';
  const ITER = 600000;

  async function deriveKey(pass, salt, iter){
    const base = await crypto.subtle.importKey('raw', enc.encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:iter, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }
  async function seal(key, obj){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(JSON.stringify(obj)));
    return {iv:b64(iv), ct:b64(ct)};
  }
  async function open(key, box){ return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(box.iv)}, key, unb64(box.ct)))); }

  /* remembered key: IndexedDB, one record per user */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('lo-keys', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function keyGet(uid){ try{ const d = await idb(); return await new Promise(res => { const q = d.transaction('k').objectStore('k').get(uid); q.onsuccess = () => res(q.result||null); q.onerror = () => res(null); }); }catch(e){ return null; } }
  async function keyPut(uid, key){ try{ const d = await idb(); await new Promise(res => { const t = d.transaction('k','readwrite'); t.objectStore('k').put(key, uid); t.oncomplete = res; t.onerror = res; }); }catch(e){} }
  async function keyDel(uid){ try{ const d = await idb(); await new Promise(res => { const t = d.transaction('k','readwrite'); t.objectStore('k').delete(uid); t.oncomplete = res; t.onerror = res; }); }catch(e){} }

  /* ---------- the lock screen: sign in, then passphrase ---------- */
  function screen(html){
    let el = document.getElementById('lock');
    if(!el){ el = document.createElement('div'); el.id = 'lock'; el.className = 'lock'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-labelledby','lockT'); document.body.appendChild(el); }
    el.innerHTML = `<div class="lock-card"><p class="lock-brand">Life Organiser</p>${html}</div>`;
    document.body.classList.add('locked');
    requestAnimationFrame(() => el.querySelector('input')?.focus());
    return el;
  }
  const closeScreen = () => { document.getElementById('lock')?.remove(); document.body.classList.remove('locked'); };
  const busy = (form, on) => form.querySelectorAll('button, input').forEach(x => x.disabled = on);
  const fail = (form, msg) => { const e = form.querySelector('.lock-err'); e.textContent = msg; e.hidden = !msg; };

  function signIn(auth){
    return new Promise(resolve => {
      const el = screen(`<h1 id="lockT">Sign in</h1>
        <form class="lock-f" novalidate>
          <label>Email<input type="email" name="email" autocomplete="username" required></label>
          <label>Password<input type="password" name="pw" autocomplete="current-password" required></label>
          <p class="lock-err" role="alert" hidden></p>
          <button class="pill" type="submit">Sign in</button>
        </form>`);
      const f = el.querySelector('form');
      f.addEventListener('submit', async e => {
        e.preventDefault(); fail(f, ''); busy(f, true);
        try{ const c = await auth.signInWithEmailAndPassword(f.email.value.trim(), f.pw.value); resolve(c.user); }
        catch(err){ busy(f, false); fail(f, /network/i.test(err?.code||'') ? 'No connection. Check your internet and try again.' : /too-many/i.test(err?.code||'') ? 'Too many tries. Wait a few minutes, then try again.' : 'That email and password don’t match.'); f.pw.select(); }
      });
    });
  }

  function unlock(uid, keyDoc){
    const creating = !keyDoc;
    return new Promise(resolve => {
      const el = screen(creating ? `<h1 id="lockT">Create your passphrase</h1>
        <p class="lock-p">Your organiser is encrypted with this passphrase before it leaves this device, so only you can read it. <b>If you forget it, your data can’t be recovered</b>, not even by Google. Keep it somewhere safe, such as your password manager.</p>
        <form class="lock-f" novalidate>
          <label>Passphrase<input type="password" name="p1" autocomplete="new-password" minlength="10" required></label>
          <label>Type it again<input type="password" name="p2" autocomplete="new-password" required></label>
          <label class="lock-chk"><input type="checkbox" name="rem" checked> Remember on this device</label>
          <p class="lock-err" role="alert" hidden></p>
          <button class="pill" type="submit">Create and continue</button>
        </form>` : `<h1 id="lockT">Unlock</h1>
        <p class="lock-p">Enter your passphrase to open your organiser.</p>
        <form class="lock-f" novalidate>
          <label>Passphrase<input type="password" name="p1" autocomplete="current-password" required></label>
          <label class="lock-chk"><input type="checkbox" name="rem" checked> Remember on this device</label>
          <p class="lock-err" role="alert" hidden></p>
          <button class="pill" type="submit">Unlock</button>
        </form>`);
      const f = el.querySelector('form');
      f.addEventListener('submit', async e => {
        e.preventDefault(); fail(f, '');
        const p = f.p1.value;
        if(creating){
          if(p.length < 10) return fail(f, 'Use at least 10 characters. A few random words works well.');
          if(p !== f.p2.value) return fail(f, 'The two passphrases don’t match.');
        }
        busy(f, true); f.querySelector('button').textContent = creating ? 'Setting up…' : 'Unlocking…';
        try{
          if(creating){
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await deriveKey(p, salt, ITER);
            resolve({key, rem:f.rem.checked, newDoc:{salt:b64(salt), iter:ITER, check:await seal(key, CHECK), created:new Date().toISOString()}});
          } else {
            const key = await deriveKey(p, unb64(keyDoc.salt), keyDoc.iter||ITER);
            let ok = false; try{ ok = (await open(key, keyDoc.check)) === CHECK; }catch(_){}
            if(!ok){ busy(f, false); f.querySelector('button').textContent = 'Unlock'; f.p1.select(); return fail(f, 'That passphrase isn’t right.'); }
            resolve({key, rem:f.rem.checked});
          }
        }catch(err){ busy(f, false); fail(f, 'Something went wrong. Try again.'); }
      });
    });
  }

  /* ---------- the store ---------- */
  async function connect(){
    const cfg = window.LO_FIREBASE;
    if(!window.firebase || !cfg){ return null; }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    const auth = firebase.auth(), fs = firebase.firestore();
    try{ await fs.enablePersistence({synchronizeTabs:true}); }catch(e){ /* another tab or private mode: works online only */ }
    const user = await new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); }) || await signIn(auth);
    const uid = user.uid, root = fs.collection('users').doc(uid);
    let key = await keyGet(uid);
    if(key){
      const kd = (await root.get().catch(()=>null))?.data();   // the passphrase may have been changed elsewhere: check the remembered key still opens it
      if(kd){ let ok=false; try{ ok = (await open(key, kd.check)) === CHECK; }catch(_){} if(!ok){ await keyDel(uid); key = null; } }
    }
    if(!key){
      const snap = await root.get();
      const r = await unlock(uid, snap.exists ? snap.data() : null);
      if(r.newDoc) await root.set(r.newDoc);
      key = r.key; if(r.rem) await keyPut(uid, key); else await keyDel(uid);
    }
    closeScreen();

    const cache = {};          // path -> last decrypted body, so update() can merge before re-encrypting
    const boxes = {};          // path -> ciphertext last opened, to skip re-decrypting unchanged docs
    const decode = async (col, d) => {
      const path = col+'/'+d.id, box = d.data();
      if(!box || !box.ct) return null;
      if(boxes[path] === box.ct && cache[path] !== undefined) return {id:d.id, body:cache[path]};
      try{ const body = await open(key, box); cache[path] = body; boxes[path] = box.ct; return {id:d.id, body}; }
      catch(e){ console.warn('could not decrypt', path); return null; }
    };
    return {
      user, firebase:true,
      signOut: async () => { await keyDel(uid); await auth.signOut(); location.reload(); },
      lock: async () => { await keyDel(uid); location.reload(); },
      collection(c){ return { onSnapshot(cb, onErr){
        return root.collection(c).onSnapshot({includeMetadataChanges:false}, async s => {
          const docs = (await Promise.all(s.docs.map(d => decode(c, d)))).filter(Boolean);
          cb({docs:docs.filter(x => x.body !== undefined).map(x => ({id:x.id, data:() => JSON.parse(JSON.stringify(x.body))})), metadata:{fromCache:s.metadata.fromCache}});
        }, onErr);
      }}; },
      doc(path){ const [c, id] = path.split('/'); const ref = root.collection(c).doc(id); return {
        onSnapshot(cb, onErr){ return ref.onSnapshot(async s => {
          if(!s.exists){ delete cache[path]; return cb({exists:false, data:() => ({})}); }
          const x = await decode(c, s); cb({exists:!!x, data:() => x && x.body !== undefined ? JSON.parse(JSON.stringify(x.body)) : {}});
        }, onErr); },
        async set(b){ b = b || {}; cache[path] = JSON.parse(JSON.stringify(b)); const box = await seal(key, b); boxes[path] = box.ct; await ref.set(box); },
        async update(p){ const b = {...(cache[path]||{}), ...JSON.parse(JSON.stringify(p))}; return this.set(b); },
        async delete(){ delete cache[path]; delete boxes[path]; await ref.delete(); },
      }; },
    };
  }
  return {connect};
})();
