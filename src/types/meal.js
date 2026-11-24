/* ============================================================
   Meal planner: a trip's restaurants on a grid of days × breakfast / lunch / dinner.
   item = {type:'meal', template?:true, tz:'Asia/Tokyo', start:'YYYY-MM-DD', end:'YYYY-MM-DD',
           shops:[{id, name, area, cuisine, kind:'walkin'|'reserve', link, maps, notes,
                   rule:{type:'none'|'rolling'|'monthly'|'fixed', days, day, ahead, time, at, text}}],
           plan:{'YYYY-MM-DD':{b:[slot], l:[slot], d:[slot]}}}
   slot = {id, sid (shop id), booked:bool, time:'HH:MM', ref, note}
   - Restaurants live in a list beside the grid; drag one into a meal (it stays in the list, greyed once scheduled),
     drag a meal between slots, or back onto the list to take it out. On a phone, tap + in a meal to pick one.
   - Reservation rules follow how TableCheck pages word them:
       rolling  "Reservations open 60 days in advance (at 00:00)"
       monthly  "Reservations for the following month open on the 1st at 10:00" (ahead 1 = following month, 2 = month after next…)
       fixed    a known opening date and time
     From the rule and the planned day, the app works out when booking opens, in the destination's local time.
   - A template is a meal planner with template:true: only a restaurant list, which new trips can copy.
   ============================================================ */
TYPE_VIEWS.meal = (() => {
  const MEALS = [['b','Breakfast'], ['l','Lunch'], ['d','Dinner']];
  const MEAL_NAME = Object.fromEntries(MEALS);
  const TZS = [['Asia/Tokyo','Japan'], ['Asia/Seoul','South Korea'], ['Asia/Taipei','Taiwan'], ['Asia/Hong_Kong','Hong Kong'], ['Asia/Shanghai','China'], ['Asia/Singapore','Singapore'],
    ['Asia/Bangkok','Thailand'], ['Asia/Ho_Chi_Minh','Vietnam'], ['Asia/Jakarta','Indonesia (Jakarta)'], ['Asia/Makassar','Bali'], ['Australia/Adelaide','Adelaide'], ['Australia/Sydney','Sydney / Melbourne'],
    ['Australia/Brisbane','Brisbane'], ['Australia/Perth','Perth'], ['Pacific/Auckland','New Zealand'], ['Pacific/Honolulu','Hawaii'], ['America/Los_Angeles','US Pacific'], ['America/New_York','US Eastern'],
    ['Europe/London','UK'], ['Europe/Paris','France / Central Europe'], ['Europe/Rome','Italy']];
  const AHEAD = [[1,'the following month'], [2,'the month after next'], [3,'3 months ahead']];
  const shops = it => it.shops || [];
  const plan = it => it.plan || {};
  const shopOf = (it, id) => shops(it).find(s => s.id===id);
  const tzOf = it => it.tz || 'Asia/Tokyo';
  const fresh = it => itemById(it.id) || it;
  const ui = {};
  const u = it => ui[it.id] ||= {q:'', f:'all'};
  const p2 = n => String(n).padStart(2, '0');
  const phone = () => matchMedia('(max-width:760px)').matches;

  /* ---------- dates and time zones ---------- */
  const addDays = (s, n) => { const [y,m,d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m-1, d + n)); return t.getUTCFullYear()+'-'+p2(t.getUTCMonth()+1)+'-'+p2(t.getUTCDate()); };
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function tripDays(it){
    if(!it.start || !it.end || it.end < it.start) return [];
    const out = []; for(let d = it.start; d <= it.end && out.length < 90; d = addDays(d, 1)) out.push(d); return out;
  }
  const dow = s => { const [y,m,d] = s.split('-').map(Number); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(Date.UTC(y, m-1, d)).getUTCDay()]; };
  const dayLabel = s => { const [,m,d] = s.split('-').map(Number); return dow(s)+' '+d+' '+MON[m-1]; };
  /* the offset of a time zone at a moment, and the moment for a wall-clock date and time there */
  function tzOff(ms, tz){
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:tz, hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'})
      .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
  }
  function zoned(date, time, tz){
    const [y,m,d] = date.split('-').map(Number), [h,mi] = (time || '00:00').split(':').map(Number);
    const g = Date.UTC(y, m-1, d, h || 0, mi || 0); let t = g - tzOff(g, tz); t = g - tzOff(t, tz); return t;
  }
  const ABBR = {'Asia/Tokyo':'JST', 'Asia/Seoul':'KST', 'Australia/Adelaide':'Adelaide time', 'Pacific/Honolulu':'HST'};
  const abbr = tz => ABBR[tz] || (new Intl.DateTimeFormat('en-US', {timeZone:tz, timeZoneName:'short'}).formatToParts(new Date()).find(p => p.type==='timeZoneName') || {}).value || tz;
  const at = (ms, tz, o) => new Intl.DateTimeFormat('en-AU', {timeZone:tz, ...o}).format(new Date(ms));
  const whenText = (ms, tz) => at(ms, tz, {weekday:'short'}) + ' ' + at(ms, tz, {day:'numeric', month:'short'}) + ' ' + at(ms, tz, {hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tripToday = it => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:tzOf(it), year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date()).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };

  /* ---------- reservation rules ---------- */
  function opensAt(it, s, date){
    const r = s.rule || {}, tz = tzOf(it);
    if(r.type==='rolling' && +r.days > 0) return zoned(addDays(date, -(+r.days)), r.time || '00:00', tz);
    if(r.type==='monthly' && +r.day > 0){
      const [y,m] = date.split('-').map(Number), k = y*12 + (m-1) - (+r.ahead || 1), yy = Math.floor(k/12), mm = k % 12 + 1;
      return zoned(`${yy}-${p2(mm)}-${p2(Math.min(+r.day, daysIn(yy, mm)))}`, r.time || '00:00', tz);
    }
    if(r.type==='fixed' && r.at) return zoned(r.at.slice(0, 10), r.at.slice(11, 16) || '00:00', tz);
    return null;
  }
  const ord = n => n + (['th','st','nd','rd'][(n % 100 - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');
  function ruleText(it, s){
    const r = s.rule || {}, tz = abbr(tzOf(it));
    if(r.type==='rolling' && +r.days > 0) return `Opens ${r.days} days ahead at ${r.time || '00:00'} ${tz}`;
    if(r.type==='monthly' && +r.day > 0) return `Opens on the ${ord(+r.day)} at ${r.time || '00:00'} ${tz} for ${(AHEAD.find(a => a[0]===(+r.ahead || 1)) || AHEAD[0])[1]}`;
    if(r.type==='fixed' && r.at) return `Opens ${whenText(zoned(r.at.slice(0,10), r.at.slice(11,16), tzOf(it)), tzOf(it))} ${tz}`;
    return '';
  }
  /* read a rule from the restaurant's own wording (best effort; you can always set it by hand) */
  function parseRule(text){
    const t = (text || '').toLowerCase(); if(!t.trim()) return null;
    let time = '00:00';
    const hm = t.match(/(\d{1,2})[:：](\d{2})\s*(am|pm)?/), ap = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
    if(hm){ let h = +hm[1]; if(hm[3]==='pm' && h < 12) h += 12; if(hm[3]==='am' && h===12) h = 0; time = p2(h)+':'+hm[2]; }
    else if(ap){ let h = +ap[1]; if(ap[2]==='pm' && h < 12) h += 12; if(ap[2]==='am' && h===12) h = 0; time = p2(h)+':00'; }
    else if(/\bnoon\b/.test(t)) time = '12:00';
    const dm = t.match(/(\d{1,2})\s*(st|nd|rd|th)?\s*(day\s*)?of\s*(each|every|the)\s*month/) || t.match(/on the\s*(\d{1,2})\s*(st|nd|rd|th)/) || t.match(/every month on the\s*(\d{1,2})/);
    if(dm){
      let ahead = 1;
      if(/month after next|two months|2 months/.test(t)) ahead = 2; else if(/three months|3 months/.test(t)) ahead = 3;
      return {type:'monthly', day:+dm[1], ahead, time};
    }
    const dd = t.match(/(\d{1,3})\s*days?\s*(in advance|ahead|before|prior)/) || t.match(/up to\s*(\d{1,3})\s*days/);
    if(dd) return {type:'rolling', days:+dd[1], time};
    const mo = t.match(/(\d)\s*months?\s*(in advance|ahead|before|prior)/);
    if(mo) return {type:'rolling', days:+mo[1] * 30, time};
    return null;
  }

  /* ---------- what's planned ---------- */
  function slotsOf(it){
    const out = [], P = plan(it), days = new Set(tripDays(it));
    for(const [date, m] of Object.entries(P)) if(days.has(date)) for(const [k] of MEALS) (m?.[k] || []).forEach((sl, i) => out.push({date, meal:k, sl, i}));
    return out;
  }
  const usesOf = (it, sid) => slotsOf(it).filter(x => x.sl.sid===sid);
  /* a planned meal's booking state: k = walk | booked | open (book now) | soon (opens within 7 days) | wait | none (no rule) | past */
  function state(it, s, sl, date){
    if(!s || s.kind!=='reserve') return {k:'walk', t:'Walk-in'};
    if(sl.booked) return {k:'booked', t:'Booked' + (sl.time ? ' · ' + sl.time : '')};
    if(date < tripToday(it)) return {k:'past', t:'Not booked'};
    const o = opensAt(it, s, date);
    if(o==null) return {k:'none', t:'Not booked'};
    const now = Date.now(), d = (o - now) / 864e5;
    if(o <= now) return {k:'open', t:'Book now', o};
    return {k:d <= 7 ? 'soon' : 'wait', t:'Opens ' + whenText(o, tzOf(it)), o, d};
  }
  const relText = d => d < 1 ? 'in ' + plural(Math.max(1, Math.round(d * 24)), 'hour') : 'in ' + plural(Math.ceil(d), 'day');

  /* ---------- saving (with undo) ---------- */
  function save(it, patch, msg){
    it = fresh(it); const before = {};
    for(const k of Object.keys(patch)) before[k] = clone(it[k] ?? (k==='plan' ? {} : k==='shops' ? [] : ''));
    docPatch('items', it.id, patch); render(true);
    if(msg) toast(msg, () => docPatch('items', it.id, before)); else pushUndo('Meal plan change', () => docPatch('items', it.id, before));
  }
  const editPlan = (it, fn, msg) => { const P = clone(plan(fresh(it))); if(fn(P)===false) return; for(const d of Object.keys(P)){ for(const [k] of MEALS) if(P[d][k] && !P[d][k].length) delete P[d][k]; if(!Object.keys(P[d]).length) delete P[d]; } save(it, {plan:P}, msg); };
  const cell = (P, date, meal) => ((P[date] ||= {})[meal] ||= []);
  function addSlot(it, sid, date, meal, index){
    const s = shopOf(it, sid); if(!s) return;
    editPlan(it, P => { const c = cell(P, date, meal); c.splice(index ?? c.length, 0, {id:uid(), sid, booked:false, time:'', ref:'', note:''}); }, `${s.name} · ${dayLabel(date)} ${MEAL_NAME[meal].toLowerCase()}`);
  }
  function findSlot(P, id){ for(const [date, m] of Object.entries(P)) for(const [k] of MEALS){ const c = m?.[k] || []; const i = c.findIndex(x => x.id===id); if(i >= 0) return {date, meal:k, c, i}; } return null; }
  function moveSlot(it, id, date, meal, index){
    editPlan(it, P => { const f = findSlot(P, id); if(!f) return false; const [sl] = f.c.splice(f.i, 1); const c = cell(P, date, meal); c.splice(Math.min(index ?? c.length, c.length), 0, sl); });
  }
  function removeSlot(it, id){
    const P0 = plan(fresh(it)), f = findSlot(P0, id), s = f && shopOf(it, f.c[f.i].sid);
    editPlan(it, P => { const g = findSlot(P, id); if(!g) return false; g.c.splice(g.i, 1); }, s ? `Took ${s.name} off ${dayLabel(f.date)} ${MEAL_NAME[f.meal].toLowerCase()}` : 'Removed');
  }

  /* ---------- the page ---------- */
  const IC_WALK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6.5L14 17v4M8 11l3-3.5 3.5 1.5 2.5 3M11.5 14.5 12.5 9"/></svg>';
  const IC_BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/></svg>';
  const kindIcon = s => s.kind==='reserve' ? `<i class="mp-k" title="Reservation">${IC_BOOK}</i>` : `<i class="mp-k" title="Walk-in">${IC_WALK}</i>`;
  const kindWord = s => s.kind==='reserve' ? 'Reservation' : 'Walk-in';

  function view(it, root){
    if(it.template) return templateView(it, root);
    if(!tripDays(it).length) return setupView(it, root);
    const days = tripDays(it), P = plan(it), all = slotsOf(it), tz = tzOf(it);
    const res = all.map(x => ({...x, s:shopOf(it, x.sl.sid)})).filter(x => x.s?.kind==='reserve');
    const st = res.map(x => state(it, x.s, x.sl, x.date));
    const booked = st.filter(x => x.k==='booked').length, open = st.filter(x => x.k==='open').length, soon = st.filter(x => x.k==='soon').length;
    const td = tripToday(it), n = days.length;
    const chips = (date, meal) => (P[date]?.[meal] || []).map(sl => { const s = shopOf(it, sl.sid); if(!s) return ''; const x = state(it, s, sl, date);
      return `<div class="mp-chip ms-${x.k}" data-slot="${esc(sl.id)}" tabindex="0" role="button" aria-label="${esc(s.name)}, ${esc(MEAL_NAME[meal])} ${esc(dayLabel(date))}: ${esc(x.t)}">
        <span class="mp-cn">${kindIcon(s)}<span class="mp-ct">${esc(s.name)}</span></span><span class="mp-cs">${esc(x.t)}${x.k==='soon' ? ' · ' + relText(x.d) : ''}</span></div>`; }).join('');
    root.innerHTML = `<div class="mp" data-mp="${esc(it.id)}">
      <div class="mp-bar">
        <div class="mp-trip"><b>${esc(dayLabel(days[0]))} – ${esc(dayLabel(days[n-1]))} ${days[n-1].slice(0,4)}</b><span>${plural(n, 'day')} · ${esc((TZS.find(z => z[0]===tz) || [tz, tz])[1])} · now ${esc(at(Date.now(), tz, {weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}))} ${esc(abbr(tz))}</span></div>
        <div class="mp-sum" role="status">${res.length ? `<span><b>${booked}</b> of ${res.length} reservations booked</span>` : '<span>No reservations planned yet</span>'}${open ? `<span class="is-over"><b>${open}</b> to book now</span>` : ''}${soon ? `<span class="is-soon"><b>${soon}</b> opening this week</span>` : ''}</div>
        <span class="spacer"></span>
        <button class="chip-btn" data-mp-act="trip">${ICON.cal || ''}Trip dates</button>
        <button class="chip-btn" data-mp-act="tpl" title="Keep this restaurant list as a template for future trips">Save list as template</button>
        <button class="chip-btn mp-ph" data-mp-act="list">Restaurants <b>${shops(it).length}</b></button>
      </div>
      <div class="mp-main">
        <div class="mp-grid" role="table" aria-label="Meals by day">
          <div class="mp-row mp-head" role="row"><span role="columnheader">Day</span>${MEALS.map(([, l]) => `<span role="columnheader">${l}</span>`).join('')}</div>
          ${days.map((d, i) => `<div class="mp-row${d===td ? ' is-today' : ''}${d < td ? ' is-past' : ''}" role="row" data-date="${d}">
            <div class="mp-day" role="rowheader"><b>Day ${i + 1}</b><span>${esc(dayLabel(d))}${d===td ? ' · today' : ''}</span></div>
            ${MEALS.map(([k, l]) => `<div class="mp-cell" role="cell" data-meal-label="${l}"><div class="mp-slots" data-date="${d}" data-meal="${k}">${chips(d, k)}</div><button class="mp-add" data-add="${d}|${k}" aria-label="Add ${l.toLowerCase()} on ${esc(dayLabel(d))}" title="Add ${l.toLowerCase()}">${ICON.plus}</button></div>`).join('')}
          </div>`).join('')}
        </div>
        ${listHTML(it, false)}
      </div></div>`;
    bind(it, root);
  }

  function listHTML(it, wide){
    const U = u(it), q = U.q.trim().toLowerCase(), uses = {};
    slotsOf(it).forEach(x => (uses[x.sl.sid] ||= []).push(x));
    const match = s => (!q || [s.name, s.area, s.cuisine, s.notes].join(' ').toLowerCase().includes(q)) &&
      (U.f==='all' || (U.f==='free' && !uses[s.id]) || (U.f==='reserve' && s.kind==='reserve') || (U.f==='walkin' && s.kind!=='reserve'));
    const list = shops(it).filter(match).sort((a, b) => (!!uses[a.id] - !!uses[b.id]) || (a.name || '').localeCompare(b.name || ''));
    const seg = (v, l) => `<button data-mp-f="${v}" aria-pressed="${U.f===v}">${l}</button>`;
    const row = s => { const us = uses[s.id] || [];
      return `<div class="mp-shop${us.length && !it.template ? ' is-used' : ''}" data-shop="${esc(s.id)}">
        <button class="mp-sn" data-edit-shop="${esc(s.id)}" title="Edit ${esc(s.name)}">${kindIcon(s)}<span class="mp-st"><b>${esc(s.name || 'Untitled')}</b><span>${esc([s.area, s.cuisine].filter(Boolean).join(' · ') || kindWord(s))}</span></span></button>
        ${us.length && !it.template ? `<span class="mp-used" title="${esc(us.map(x => dayLabel(x.date) + ' ' + MEAL_NAME[x.meal].toLowerCase()).join(', '))}">${esc(us.length > 1 ? plural(us.length, 'meal') : dayLabel(us[0].date).replace(/^\w+ /, '') + ' ' + MEAL_NAME[us[0].meal].toLowerCase())}</span>` : s.kind==='reserve' && ruleText(it, s) ? `<span class="mp-rule" title="${esc(ruleText(it, s))}">${esc(ruleText(it, s).replace(/^Opens /, ''))}</span>` : ''}
      </div>`; };
    return `<aside class="mp-list${wide ? ' wide' : ''}" aria-label="Restaurants">
      <div class="mp-lh"><h2>Restaurants <span>${shops(it).length}</span></h2><button class="pill sm" data-mp-act="addshop">${ICON.plus}Add</button></div>
      <input class="txt-in mp-q" type="search" placeholder="Search restaurants" value="${esc(U.q)}" data-mp-q aria-label="Search restaurants" autocomplete="off">
      <div class="seg mp-f" role="group" aria-label="Show">${seg('all','All')}${it.template ? '' : seg('free','Not planned')}${seg('reserve','Booking')}${seg('walkin','Walk-in')}</div>
      <div class="mp-shops" data-shops>${list.map(row).join('') || `<p class="mp-none">${shops(it).length ? 'No restaurants match.' : 'Add the restaurants you want to try. Then drag them into a meal.'}</p>`}</div>
      ${it.template || !shops(it).length ? '' : `<p class="mp-hint">${TOUCH ? 'Tap + in a meal to add a restaurant.' : 'Drag a restaurant into a meal. Drag it back here to take it out.'}</p>`}
    </aside>`;
  }

  function setupView(it, root){
    const others = S.items.filter(i => i.type==='meal' && i.id!==it.id && shops(i).length).sort((a, b) => (!!b.template - !!a.template) || (a.name || '').localeCompare(b.name || ''));
    root.innerHTML = `<section class="panel mp-setup">
      <h2>Set up your trip</h2><p class="note">Pick the dates and where you're going. Times for bookings use the destination's local time.</p>
      <div class="mp-form">
        <label class="field"><span class="lbl">First day</span><input class="txt-in" type="date" id="mpStart" value="${esc(it.start || '')}"></label>
        <label class="field"><span class="lbl">Last day</span><input class="txt-in" type="date" id="mpEnd" value="${esc(it.end || '')}"></label>
        <label class="field"><span class="lbl">Destination time</span><select class="txt-in" id="mpTz">${TZS.map(([z, l]) => `<option value="${z}"${z===tzOf(it) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        ${others.length && !shops(it).length ? `<label class="field"><span class="lbl">Restaurants</span><select class="txt-in" id="mpFrom"><option value="">Start with an empty list</option>${others.map(o => `<option value="${esc(o.id)}">${o.template ? 'Template: ' : 'Copy from '}${esc(o.name)} (${shops(o).length})</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="row-end"><button class="pill" data-mp-act="setup">Start planning</button></div>
    </section>${shops(it).length ? listHTML(it, true) : ''}`;
    bind(it, root);
  }

  function templateView(it, root){
    root.innerHTML = `<div class="mp mp-tpl"><div class="mp-bar"><div class="mp-trip"><b>Template</b><span>A restaurant list that new trips can start from. Edits here don't change trips you've already made.</span></div><span class="spacer"></span><button class="pill" data-mp-act="newtrip">${ICON.plus}New trip from this list</button></div>${listHTML(it, true)}</div>`;
    bind(it, root);
  }

  /* ---------- drag and drop ---------- */
  let sortables = [];
  function bind(it, root){
    sortables.forEach(s => { try{ s.destroy(); }catch(e){} }); sortables = [];
    if(!window.Sortable) return;
    const common = {animation:RM ? 0 : 150, delay:200, delayOnTouchOnly:true, touchStartThreshold:6, forceFallback:true, fallbackOnBody:true, fallbackClass:'dragging', fallbackTolerance:3,
      scroll:true, bubbleScroll:true, scrollSensitivity:TOUCH ? 56 : 44, scrollSpeed:9,
      onStart(){ S.dragging = true; document.body.classList.add('is-dragging', 'mp-dragging'); },
      onEnd(){ S.dragging = false; document.body.classList.remove('is-dragging', 'mp-dragging'); setTimeout(() => render(true), 0); setTimeout(() => document.dispatchEvent(new MouseEvent('click', {bubbles:true})), 0); }};
    const list = $('[data-shops]', root);
    if(list && !it.template) sortables.push(Sortable.create(list, {...common, group:{name:'meal', pull:'clone', put:true}, sort:false, draggable:'.mp-shop', filter:'.mp-none', ghostClass:'mp-ghost',
      onAdd(e){ const id = e.item.dataset.slot; e.item.remove(); if(id) removeSlot(it, id); }}));
    $$('.mp-slots', root).forEach(el => sortables.push(Sortable.create(el, {...common, group:{name:'meal', pull:true, put:true}, draggable:'.mp-chip', ghostClass:'mp-ghost', emptyInsertThreshold:40,
      onAdd(e){ const date = el.dataset.date, meal = el.dataset.meal, sid = e.item.dataset.shop, id = e.item.dataset.slot, i = e.newDraggableIndex ?? e.newIndex;
        e.item.remove(); if(sid) addSlot(it, sid, date, meal, i); else if(id) moveSlot(it, id, date, meal, i); },
      onUpdate(e){ const id = e.item.dataset.slot; if(id) moveSlot(it, id, el.dataset.date, el.dataset.meal, e.newDraggableIndex ?? e.newIndex); }})));
  }

  /* ---------- dialogs ---------- */
  const inp = (id, label, type, v, extra = '') => `<label class="field"><span class="lbl">${label}</span><input class="txt-in" id="${id}" type="${type}" value="${esc(v ?? '')}" ${extra}></label>`;
  const val = id => ($('#' + id)?.value || '').trim();
  function formModal({title, body, action, op, extra = '', onSave, onClick}){
    const m = openModal(`<h2 id="mTitle">${esc(title)}</h2>${body}<div class="row-end">${extra}<button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">${esc(action)}</button></div>`, {opener:op, wide:true});
    m.onclick = e => { if(onClick?.(e, m)) return; const x = e.target.closest('[data-x]'); if(!x) return; if(x.dataset.x==='yes'){ if(onSave()===false) return; } else if(x.dataset.x!=='no') return; closeModal(); };
    m.onkeydown = e => { if(e.key==='Enter' && e.target.matches('input:not([type=checkbox])')){ e.preventDefault(); m.querySelector('[data-x="yes"]').click(); } };
    return m;
  }

  function shopModal(it, s, op){
    const isNew = !s; s = s ? clone(s) : {id:uid(), name:'', area:'', cuisine:'', kind:'walkin', link:'', maps:'', notes:'', rule:{type:'none'}};
    let kind = s.kind || 'walkin', rule = {type:'none', ...(s.rule || {})};
    const ruleBody = () => `
      <div class="field"><span class="lbl" id="mrL">Booking opens</span><div class="seg full" role="group" aria-labelledby="mrL">${[['none','Unknown'],['rolling','Days ahead'],['monthly','Monthly release'],['fixed','Set date']].map(([v, l]) => `<button data-rt="${v}" aria-pressed="${rule.type===v}">${l}</button>`).join('')}</div></div>
      ${rule.type==='rolling' ? `<div class="mp-two">${inp('mrDays', 'Days in advance', 'number', rule.days || 30, 'min="1" max="400" inputmode="numeric"')}${inp('mrTime', 'At (local time)', 'time', rule.time || '00:00')}</div>` : ''}
      ${rule.type==='monthly' ? `<div class="mp-three">${inp('mrDay', 'Day of the month', 'number', rule.day || 1, 'min="1" max="31" inputmode="numeric"')}${inp('mrTime', 'At (local time)', 'time', rule.time || '10:00')}<label class="field"><span class="lbl">Opens for</span><select class="txt-in" id="mrAhead">${AHEAD.map(([n, l]) => `<option value="${n}"${(+rule.ahead || 1)===n ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>` : ''}
      ${rule.type==='fixed' ? inp('mrAt', 'Opens on (local time)', 'datetime-local', rule.at || '') : ''}
      <p class="note mp-rnote" id="mrNote">${esc(ruleExample())}</p>`;
    const ruleExample = () => rule.type==='rolling' ? 'Like “Reservations open 60 days in advance.”' : rule.type==='monthly' ? 'Like “Reservations for the following month open on the 1st at 10:00 JST.”' : rule.type==='fixed' ? 'For one-off releases, such as a holiday menu.' : 'Paste the restaurant\'s rule below and press Read rule, or choose how it works.';
    const body = () => `
      ${inp('msName', 'Name', 'text', s.name, 'placeholder="e.g. Sushi Saito" maxlength="80"')}
      <div class="mp-two">${inp('msArea', 'Area', 'text', s.area, 'placeholder="e.g. Ginza"')}${inp('msCui', 'Food', 'text', s.cuisine, 'placeholder="e.g. Sushi"')}</div>
      <div class="field"><span class="lbl" id="mkL">How to get in</span><div class="seg full" role="group" aria-labelledby="mkL"><button data-kind="walkin" aria-pressed="${kind!=='reserve'}">${IC_WALK}Walk-in</button><button data-kind="reserve" aria-pressed="${kind==='reserve'}">${IC_BOOK}Reservation</button></div></div>
      ${kind==='reserve' ? `${inp('msLink', 'Reservation link', 'url', s.link, 'placeholder="https://www.tablecheck.com/…" inputmode="url"')}
        <label class="field"><span class="lbl">Reservation rule (their wording)</span><textarea class="txt-in" id="msRuleTxt" rows="2" placeholder="e.g. Reservations for the following month open on the 1st of each month at 10:00 (JST)">${esc(rule.text || '')}</textarea></label>
        <div class="row-start"><button class="btn sm" data-x="parse">Read rule</button></div>
        <div id="mrBox">${ruleBody()}</div>` : ''}
      ${inp('msMaps', 'Map link', 'url', s.maps, 'placeholder="Google Maps link" inputmode="url"')}
      <label class="field"><span class="lbl">Notes</span><textarea class="txt-in" id="msNotes" rows="2">${esc(s.notes || '')}</textarea></label>`;
    const keep = () => { s.name = $('#msName') ? val('msName') : s.name; s.area = val('msArea'); s.cuisine = val('msCui'); s.maps = val('msMaps'); s.notes = $('#msNotes')?.value.trim() ?? s.notes;
      if($('#msLink')) s.link = val('msLink'); if($('#msRuleTxt')) rule.text = $('#msRuleTxt').value.trim(); readRule(); };
    const readRule = () => { if($('#mrDays')) rule.days = +val('mrDays') || ''; if($('#mrDay')) rule.day = +val('mrDay') || ''; if($('#mrTime')) rule.time = val('mrTime') || '00:00'; if($('#mrAhead')) rule.ahead = +val('mrAhead') || 1; if($('#mrAt')) rule.at = val('mrAt'); };
    const redraw = () => { keep(); const b = m.querySelector('.mp-sbody'); b.innerHTML = body(); };
    const m = formModal({title:isNew ? 'Add restaurant' : 'Edit restaurant', op, action:isNew ? 'Add' : 'Save',
      body:`<div class="mp-sbody">${body()}</div>`,
      extra:isNew ? '' : `<button class="btn danger grow" data-x="del">Delete</button>`,
      onClick(e){
        const k = e.target.closest('[data-kind]'); if(k){ kind = k.dataset.kind; redraw(); return true; }
        const r = e.target.closest('[data-rt]'); if(r){ keep(); rule.type = r.dataset.rt; $('#mrBox').innerHTML = ruleBody(); return true; }
        const x = e.target.closest('[data-x]');
        if(x?.dataset.x==='parse'){ keep(); const p = parseRule(rule.text); if(p){ Object.assign(rule, p); $('#mrBox').innerHTML = ruleBody(); $('#mrNote').textContent = 'Read from the text: ' + ruleText(it, {rule}) + '. Check it looks right.'; } else { $('#mrNote').textContent = 'Couldn\'t read a rule from that text. Choose how it works above.'; } return true; }
        if(x?.dataset.x==='del'){ const n = usesOf(it, s.id).length; closeModal();
          const P = clone(plan(fresh(it))); for(const d of Object.keys(P)) for(const [mk] of MEALS) if(P[d][mk]) P[d][mk] = P[d][mk].filter(y => y.sid!==s.id);
          save(it, {shops:shops(fresh(it)).filter(y => y.id!==s.id), plan:P}, `Deleted ${s.name || 'restaurant'}${n ? ' and ' + plural(n, 'planned meal') : ''}`); return true; }
        return false;
      },
      onSave(){ keep(); if(!s.name){ $('#msName').focus(); return false; }
        s.kind = kind; s.rule = kind==='reserve' ? rule : {type:'none'};
        const list = clone(shops(fresh(it))); const i = list.findIndex(y => y.id===s.id); if(i < 0) list.push(s); else list[i] = s;
        save(it, {shops:list}, isNew ? `Added ${s.name}` : `Saved ${s.name}`); }});
    requestAnimationFrame(() => { if(isNew) $('#msName')?.focus(); });
  }

  function slotModal(it, id, op){
    const f = findSlot(plan(it), id); if(!f) return; const sl = clone(f.c[f.i]); const s = shopOf(it, sl.sid); if(!s) return;
    const tz = tzOf(it), x = state(it, s, sl, f.date), o = s.kind==='reserve' ? opensAt(it, s, f.date) : null;
    const opens = o ? `<p class="mp-open ms-${x.k}"><b>${o <= Date.now() ? 'Booking is open' : 'Booking opens ' + esc(whenText(o, tz)) + ' ' + esc(abbr(tz))}</b>${o > Date.now() ? `<span>${esc(relText((o - Date.now()) / 864e5))} · ${esc(whenText(o, localTz))} your time</span>` : ''}${s.rule?.text ? `<span class="mp-rt">“${esc(s.rule.text)}”</span>` : ''}</p>`
      : s.kind==='reserve' ? `<p class="mp-open ms-none"><b>No reservation rule yet</b><span>Add one to the restaurant to see when booking opens.</span></p>` : '';
    formModal({title:s.name, op, action:'Save',
      body:`<p class="note">${esc(dayLabel(f.date))} · ${esc(MEAL_NAME[f.meal])} · ${esc([s.area, s.cuisine].filter(Boolean).join(' · ') || kindWord(s))}</p>
        ${opens}
        ${s.kind==='reserve' ? `<label class="mp-check"><input type="checkbox" id="mlBooked" ${sl.booked ? 'checked' : ''}><span>Booked</span></label>
          <div class="mp-two">${inp('mlTime', `Reservation time (${esc(abbr(tz))})`, 'time', sl.time)}${inp('mlRef', 'Confirmation number', 'text', sl.ref)}</div>` : ''}
        <label class="field"><span class="lbl">Notes</span><textarea class="txt-in" id="mlNote" rows="2" placeholder="e.g. Omakase course, card required">${esc(sl.note || '')}</textarea></label>
        <div class="mp-links">${s.link ? `<a class="btn" href="${esc(s.link)}" target="_blank" rel="noopener">Open reservation page</a>` : ''}${s.maps ? `<a class="btn" href="${esc(s.maps)}" target="_blank" rel="noopener">Map</a>` : ''}<button class="btn" data-x="shop">Edit restaurant</button></div>`,
      extra:`<button class="btn danger grow" data-x="rm">Take off this meal</button>`,
      onClick(e){ const b = e.target.closest('[data-x]'); if(!b) return false;
        if(b.dataset.x==='rm'){ closeModal(); removeSlot(it, id); return true; }
        if(b.dataset.x==='shop'){ closeModal(); shopModal(it, s, op); return true; } return false; },
      onSave(){ const booked = !!$('#mlBooked')?.checked, time = val('mlTime'), ref = val('mlRef'), note = $('#mlNote').value.trim();
        editPlan(it, P => { const g = findSlot(P, id); if(!g) return false; Object.assign(g.c[g.i], {booked, time, ref, note}); }, booked && !sl.booked ? `Booked ${s.name}` : `Saved ${s.name}`); }});
  }

  function tripModal(it, op){
    formModal({title:'Trip dates', op, action:'Save',
      body:`<div class="mp-three">${inp('mpStart', 'First day', 'date', it.start)}${inp('mpEnd', 'Last day', 'date', it.end)}<label class="field"><span class="lbl">Destination time</span><select class="txt-in" id="mpTz">${TZS.map(([z, l]) => `<option value="${z}"${z===tzOf(it) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
        <p class="note">Meals planned on days outside the new dates are kept, and come back if you move the dates back.</p>`,
      onSave(){ const a = val('mpStart'), b = val('mpEnd'); if(!a || !b || b < a){ $('#mpEnd').focus(); return false; } save(it, {start:a, end:b, tz:$('#mpTz').value}, 'Trip dates saved'); }});
  }

  /* phone: tap + in a meal to pick a restaurant */
  function pickModal(it, date, meal, op){
    const uses = {}; slotsOf(it).forEach(x => (uses[x.sl.sid] ||= []).push(x));
    const list = [...shops(it)].sort((a, b) => (!!uses[a.id] - !!uses[b.id]) || (a.name || '').localeCompare(b.name || ''));
    const m = openModal(`<h2 id="mTitle">${esc(MEAL_NAME[meal])} · ${esc(dayLabel(date))}</h2>
      <input class="txt-in mp-q" type="search" id="mpPickQ" placeholder="Search restaurants" autocomplete="off" aria-label="Search restaurants">
      <div class="mp-pick" role="list">${list.map(s => `<button class="mp-shop${uses[s.id] ? ' is-used' : ''}" role="listitem" data-pick="${esc(s.id)}" data-text="${esc([s.name, s.area, s.cuisine].join(' ').toLowerCase())}">${kindIcon(s)}<span class="mp-st"><b>${esc(s.name)}</b><span>${esc([s.area, s.cuisine].filter(Boolean).join(' · ') || kindWord(s))}${uses[s.id] ? ' · planned ' + plural(uses[s.id].length, 'time') : ''}</span></span></button>`).join('') || '<p class="mp-none">No restaurants yet.</p>'}</div>
      <div class="row-end"><button class="btn" data-x="new">${ICON.plus}New restaurant</button><button class="btn" data-x="no">Close</button></div>`, {opener:op, wide:true});
    m.oninput = e => { if(e.target.id==='mpPickQ'){ const q = e.target.value.trim().toLowerCase(); $$('[data-pick]', m).forEach(b => { b.hidden = !!q && !b.dataset.text.includes(q); }); } };
    m.onclick = e => { const p = e.target.closest('[data-pick]'); if(p){ closeModal(); addSlot(it, p.dataset.pick, date, meal); return; }
      const x = e.target.closest('[data-x]'); if(!x) return; closeModal(); if(x.dataset.x==='new') shopModal(it, null, op); };
  }

  function copyShops(list){ return list.map(s => ({...clone(s), id:uid()})); }
  function newMealItem(name, extra){ const it = {...buildItem('meal', name, ''), ...extra}; docSet('items', it); return it; }

  /* ---------- events ---------- */
  function click(e, it){
    const a = e.target.closest('[data-mp-act]');
    if(a){ const v = a.dataset.mpAct;
      if(v==='addshop') return shopModal(it, null, a);
      if(v==='trip') return tripModal(it, a);
      if(v==='list'){ const l = $('.mp-list'); l?.classList.toggle('open'); a.setAttribute('aria-expanded', String(!!l?.classList.contains('open'))); if(l?.classList.contains('open')) l.scrollIntoView({block:'start', behavior:RM ? 'auto' : 'smooth'}); return; }
      if(v==='tpl'){ promptModal({title:'Save list as template', label:'Template name', value:(it.name || 'Trip') + ' restaurants', action:'Save template', opener:a}).then(n => { if(!n) return;
        const t = newMealItem(n, {template:true, shops:copyShops(shops(fresh(it)))}); render(true); toast(`Saved template “${n}”`, () => { docDel('items', t.id); render(true); }); }); return; }
      if(v==='newtrip'){ promptModal({title:'New trip', label:'Trip name', value:'', placeholder:'e.g. Japan 2027', action:'Create trip', opener:a}).then(n => { if(!n) return;
        const t = newMealItem(n, {tz:tzOf(it), shops:copyShops(shops(fresh(it)))}); go('i-' + t.id); }); return; }
      if(v==='setup'){ const s0 = val('mpStart'), e0 = val('mpEnd'); if(!s0){ $('#mpStart').focus(); return; } if(!e0 || e0 < s0){ $('#mpEnd').focus(); return toast('The last day must be on or after the first day'); }
        if(dayDiff(e0) - dayDiff(s0) > 89) return toast('Trips can be up to 90 days');
        const from = $('#mpFrom')?.value, src = from && itemById(from);
        save(it, {start:s0, end:e0, tz:$('#mpTz').value, ...(src ? {shops:copyShops(shops(src))} : {})}, 'Trip set up'); return; }
    }
    const f = e.target.closest('[data-mp-f]'); if(f){ u(it).f = f.dataset.mpF; render(true); restoreFocus(`[data-mp-f="${f.dataset.mpF}"]`); return; }
    const ed = e.target.closest('[data-edit-shop]'); if(ed){ const s = shopOf(it, ed.dataset.editShop); if(s) shopModal(it, s, ed); return; }
    const ad = e.target.closest('[data-add]'); if(ad){ const [d, m] = ad.dataset.add.split('|'); if(!shops(it).length) return shopModal(it, null, ad); return pickModal(it, d, m, ad); }
    const ch = e.target.closest('[data-slot]'); if(ch && ch.closest('.mp-grid')){ slotModal(it, ch.dataset.slot, ch); return; }
  }
  function input(e, it){
    if(e.target.matches('[data-mp-q]')){ u(it).q = e.target.value; const box = $('[data-shops]'); if(!box) return;
      const tmp = document.createElement('div'); tmp.innerHTML = listHTML(it, !!e.target.closest('.wide')); box.innerHTML = tmp.querySelector('[data-shops]').innerHTML; }
  }
  function keydown(e, it){
    const ch = e.target.closest?.('[data-slot]');
    if(ch && (e.key==='Enter' || e.key===' ')){ e.preventDefault(); slotModal(it, ch.dataset.slot, ch); return; }
    if(ch && (e.key==='Delete' || e.key==='Backspace')){ e.preventDefault(); removeSlot(it, ch.dataset.slot); return; }
  }

  /* ---------- outside this page ---------- */
  /* bookings that need you: open now, or opening within 7 days (for Home and the sidebar count) */
  function alerts(it){
    if(it.template) return [];
    return slotsOf(it).map(x => { const s = shopOf(it, x.sl.sid); const st = s && state(it, s, x.sl, x.date); return st && (st.k==='open' || st.k==='soon') ? {...x, s, st} : null; }).filter(Boolean)
      .sort((a, b) => (a.st.o || 0) - (b.st.o || 0));
  }
  function homeRows(){
    const out = [];
    for(const it of S.items.filter(i => i.type==='meal' && !i.template)) for(const x of alerts(it)){
      const n = x.st.k==='open' ? 0 : Math.max(0, dayDiff(ymd(new Date(x.st.o))));
      out.push({kind:'row', date:x.st.k==='open' ? today() : ymd(new Date(x.st.o)), n, title:(x.st.k==='open' ? 'Book ' : 'Booking opens: ') + x.s.name,
        what:`${dayLabel(x.date)} ${MEAL_NAME[x.meal].toLowerCase()}` + (x.st.k==='soon' ? ` · ${whenText(x.st.o, tzOf(it))} ${abbr(tzOf(it))}` : ''), item:it, coll:it});
    }
    return out;
  }
  const openCount = it => alerts(it).filter(x => x.st.k==='open').length;

  return {wide:true, render:view, click, input, keydown, homeRows, openCount, parseRule, opensAt, newShortcut(it, op){ shopModal(it, null, op); }, focusStart(){}};
})();
