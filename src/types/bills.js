/* ============================================================
   Bills — recurring bills and renewals on a yearly timeline.
   item.bills = [{id, active, asset, category, institution, start, end, period (months),
                  amount, ref, notes, paid:{dueDate:{date, amount}}, history:[{start,end,institution,amount,ref}],
                  stopped ('' | date the bill was cancelled or switched away), created (date tracking began), prevId}]
   Due dates: annual bills with an end date are due on the end date (renewal);
   everything else is due every period from the start date.
   ============================================================ */
TYPE_VIEWS.bills = (() => {
  const PERIODS = [[1,'Monthly'],[2,'Every 2 months'],[3,'Quarterly'],[6,'Half-yearly'],[12,'Annually']];
  const pName = p => (PERIODS.find(x=>x[0]===+p)||[0,'Every '+p+' months'])[1];
  const CAT_COLORS = ['blue','indigo','teal','orange','green','violet','rose','amber','red','slate'];
  const ui = {};
  const st = it => ui[it.id] || (ui[it.id] = {mode:null, year:CUR_YEAR});
  const bills = it => it.bills || [];
  const money = v => (v===''||v===null||v===undefined||isNaN(v)) ? '' : '$'+fmtNum(v, Number(v)%1 ? 2 : 0);

  function catColor(it, cat){
    const cats = [...new Set(bills(it).map(b=>(b.category||'').trim().toLowerCase()))];
    const i = cats.indexOf((cat||'').trim().toLowerCase());
    return colorOf(CAT_COLORS[(i<0?0:i) % CAT_COLORS.length]);
  }
  function addMonths(s, n){ const [y,m,d]=s.split('-').map(Number); const t=new Date(y, m-1+n, 1); const last=new Date(t.getFullYear(), t.getMonth()+1, 0).getDate(); t.setDate(Math.min(d,last)); return ymd(t); }
  function monthsBetween(a, b){ const [y1,m1,d1]=a.split('-').map(Number), [y2,m2,d2]=b.split('-').map(Number); return Math.max(1, Math.round((y2-y1)*12 + (m2-m1) + (d2-d1)/30)); }
  const terms = b => [...(b.history||[]).map(h=>({...h, old:true})), {start:b.start, end:b.end, institution:b.institution, amount:b.amount, ref:b.ref, old:false}];

  function dues(b, from, to){
    const out = []; const p = +b.period || 12; const t0 = today();
    for(const t of terms(b)){
      if(!t.start) continue;
      const lim = t.old ? '' : (b.stopped || (!b.active ? t0 : ''));
      const push = d => { if(d>=from && d<=to) out.push({date:d, amount:t.amount, inst:t.institution, old:t.old}); };
      if(p===12 && t.end){ if(!lim || t.end < lim) push(t.end); continue; }
      for(let k=1; k<1200; k++){
        const d = addMonths(t.start, k*p);
        if(t.end && d > t.end) break; if(lim && d > lim) break; if(d > to) break;
        push(d);
      }
    }
    return out.sort((a,b)=>a.date.localeCompare(b.date));
  }
  function status(b, d){
    if(b.paid?.[d.date]) return 'paid';
    if(d.date < (b.created||'')) return 'pre';
    const n = dayDiff(d.date);
    return n<0 ? 'over' : n<=30 ? 'soon' : 'up';
  }
  const STATUS_TXT = {paid:'Paid', pre:'Before tracking', over:'Overdue', soon:'Due soon', up:'Upcoming'};
  const plusDays = n => { const d=new Date(); d.setDate(d.getDate()+n); return ymd(d); };
  /* unpaid, tracked dues up to `days` ahead (overdue included) */
  function pending(it, days=30){
    const to = plusDays(days), out = [];
    for(const b of bills(it)) for(const d of dues(b, '1900-01-01', to)){ const s=status(b,d); if(s==='over'||s==='soon'||s==='up') out.push({b, d, s}); }
    return out.sort((a,b)=>a.d.date.localeCompare(b.d.date));
  }
  function nextDue(b){ for(const d of dues(b, b.created||'1900-01-01', plusDays(800))){ if(!b.paid?.[d.date]) return d; } return null; }
  const dueAmount = (b, date) => dues(b, date, date)[0]?.amount ?? b.amount;
  const billName = b => [b.category, b.asset].filter(Boolean).join(' · ') || 'New bill';

  /* ---------- writes ---------- */
  function setBills(it, list){ docPatch('items', it.id, {bills:list}); renderSide(); }
  function mutate(it, id, fn, msg){
    const before = clone(bills(it)); const list = clone(before); const b = list.find(x=>x.id===id); if(!b) return;
    fn(b, list); setBills(it, list); render(true);
    if(msg) toast(msg, () => docPatch('items', it.id, {bills:before}));
  }
  function setPaid(it, b, date, rec){
    mutate(it, b.id, x => { x.paid = {...(x.paid||{})}; if(rec) x.paid[date] = rec; else delete x.paid[date]; },
      rec ? `Paid: ${billName(b)}, due ${dateLabel(date)}` : 'Marked unpaid');
  }

  /* ---------- views ---------- */
  function statTile(n, label, c, ic){ return `<div class="stat" style="--sc:${c}"><span class="s-top"><i class="s-ic" aria-hidden="true">${ICON[ic]}</i><b>${n}</b></span><span>${label}</span></div>`; }
  function view(it, root){
    const s = st(it); if(!s.mode) s.mode = bills(it).some(b=>b.start) ? 'timeline' : 'list';
    const pend = pending(it, 30); const over = pend.filter(x=>x.s==='over'), soon = pend.filter(x=>x.s!=='over');
    const sum = a => a.reduce((t,x)=>t+(+x.d.amount||0),0);
    const yr = CUR_YEAR, yTot = bills(it).reduce((t,b)=>t+dues(b, yr+'-01-01', yr+'-12-31').reduce((u,d)=>u+(+(b.paid?.[d.date]?.amount ?? d.amount)||0),0),0);
    root.innerHTML = `
      <div class="stats">
        ${statTile(bills(it).filter(b=>b.active).length, 'Active bills', '#0071e3', 'list')}
        ${statTile(soon.length, 'Due in 30 days'+(sum(soon)?' · '+money(sum(soon)):''), '#ff9500', 'cal')}
        ${statTile(over.length, 'Overdue'+(sum(over)?' · '+money(sum(over)):''), over.length?'#ff3b30':'#8e8e93', 'bang')}
        ${statTile(money(yTot)||'$0', yr+' total', '#34c759', 'tracker')}
      </div>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="View"><button data-seg="timeline" aria-pressed="${s.mode==='timeline'}">Timeline</button><button data-seg="list" aria-pressed="${s.mode==='list'}">List</button></div>
        ${s.mode==='timeline'?`<div class="yr" role="group" aria-label="Year"><button class="icon-btn" data-yr="-1" aria-label="Previous year">${ICON.chevD}</button><b>${s.year}</b><button class="icon-btn" data-yr="1" aria-label="Next year">${ICON.chevD}</button>${s.year!==CUR_YEAR?`<button class="link" data-yr="0">This year</button>`:''}</div>`:''}
        <span class="spacer"></span><button class="pill" data-act="add">${ICON.plus}Add bill</button></div>
      ${s.mode==='timeline' ? timelineHTML(it) + paymentsHTML(it) : listHTML(it)}`;
  }

  function timelineHTML(it){
    const Y = st(it).year, y0 = Y+'-01-01', y1 = Y+'-12-31';
    const days = (Date.UTC(Y+1,0,1) - Date.UTC(Y,0,1)) / 864e5;
    const pct = d => { const [a,b,c]=d.split('-').map(Number); return Math.max(0, Math.min(100, (Date.UTC(a,b-1,c) - Date.UTC(Y,0,1)) / 864e5 / days * 100)); };
    const withStart = bills(it).filter(b=>b.start);
    if(!withStart.length) return `<section class="panel empty-state"><b>No dates yet</b>Fill in start dates in the List view, and each bill will appear here across the year.<button class="pill" data-seg="list">Go to List</button></section>`;
    const assets = [...new Set(bills(it).map(b=>b.asset||'Other'))];
    const monthTot = Array(12).fill(0);
    let rows = '';
    for(const a of assets){
      const bs = bills(it).filter(b=>(b.asset||'Other')===a);
      rows += `<div class="tl-row tl-group"><div class="tl-lab"><b>${esc(a)}</b></div><div></div></div>`;
      for(const b of bs){
        const c = catColor(it, b.category); const ds = dues(b, y0, y1);
        ds.forEach(d => { monthTot[+d.date.slice(5,7)-1] += +(b.paid?.[d.date]?.amount ?? d.amount) || 0; });
        let bars = '';
        for(const t of terms(b)){
          if(!t.start) continue;
          const end = t.old ? t.end : (b.stopped || t.end || (b.active ? y1 : today()));
          if(!end || end < y0 || t.start > y1) continue;
          const l = pct(t.start < y0 ? y0 : t.start), r = pct(end > y1 ? y1 : end);
          bars += `<span class="tl-bar ${t.old?'old':''} ${!t.old && !b.active?'off':''}" style="left:${l}%;width:${Math.max(.6, r-l)}%" title="${esc((t.institution||'')+': '+dateLabel(t.start)+(t.end?' – '+dateLabel(t.end):' onwards'))}"></span>`;
        }
        const dots = ds.map(d => { const s=status(b,d); const label=`${billName(b)}, ${d.inst||''}, due ${dateLabel(d.date)}${d.amount?', '+money(d.amount):''}: ${STATUS_TXT[s]}${s==='paid'?' '+dateLabel(b.paid[d.date].date):''}`;
          return `<button class="tl-dot ${s}" style="left:${pct(d.date)}%" data-due="${esc(b.id)}|${d.date}" aria-label="${esc(label)}" title="${esc(label)}">${s==='paid'?ICON.check:s==='over'?'!':''}</button>`; }).join('');
        rows += `<div class="tl-row ${b.active?'':'inactive'}" style="--c:${c}" data-key="tl-${esc(b.id)}"><button class="tl-lab" data-edit="${esc(b.id)}" title="Edit"><b>${esc(b.category||'Bill')}</b><span>${esc(b.institution||'')}${b.active?'':' · inactive'}</span></button><div class="tl-track">${bars}${dots}</div></div>`;
      }
    }
    const months = MON.map((m,i)=>{ const s=pct(`${Y}-${String(i+1).padStart(2,'0')}-01`), e = i<11 ? pct(`${Y}-${String(i+2).padStart(2,'0')}-01`) : 100; return {m, s, mid:(s+e)/2}; });
    const maxTot = Math.max(1, ...monthTot);   // dot columns in the Total row: 8 dots = the busiest month
    const curM = Y===CUR_YEAR ? new Date().getMonth() : -1;
    return `<section class="tl" aria-label="Bills timeline ${Y}"><div class="tl-in">
      <div class="tl-row tl-head"><div class="tl-lab"><span>${Y}</span></div><div class="tl-track">${months.map((x,i)=>`<span class="tl-m ${i===curM?'cur':''}" style="left:${x.mid}%">${x.m}</span>`).join('')}</div></div>
      <div class="tl-body">${rows}
        <div class="tl-lines" aria-hidden="true">${months.slice(1).map(x=>`<i style="left:${x.s}%"></i>`).join('')}${Y===CUR_YEAR?`<b class="tl-now" style="left:${pct(today())}%"></b>`:''}</div></div>
      <div class="tl-row tl-tot"><div class="tl-lab"><span>Total</span></div><div class="tl-track">${months.map((x,i)=>monthTot[i]?`<span class="tl-col" style="left:${x.mid}%;--n:${Math.max(1, Math.round(monthTot[i]/maxTot*8))}" aria-hidden="true"></span><span class="tl-m" style="left:${x.mid}%">${money(Math.round(monthTot[i]))}</span>`:'').join('')}</div></div>
    </div>
    <div class="tl-legend" aria-hidden="true"><span><i class="tl-dot paid">${ICON.check}</i>Paid</span><span><i class="tl-dot up" style="--c:var(--accent)"></i>Upcoming</span><span><i class="tl-dot soon"></i>Due in 30 days</span><span><i class="tl-dot over">!</i>Overdue</span><span><i class="tl-dot pre"></i>Before tracking</span><span><i class="tl-now-k"></i>Today</span></div></section>`;
  }

  function payRow(b, d, s){
    const paid = s==='paid'; const dl = dueLabel(d.date);
    return `<div class="pay-row" data-key="pay-${esc(b.id)}-${d.date}"><button class="cbox" data-pay="${esc(b.id)}|${d.date}" role="checkbox" aria-checked="${paid}" aria-label="${paid?'Paid':'Mark paid'}: ${esc(billName(b))}, due ${dateLabel(d.date)}">${ICON.check}</button>
      <button class="pay-t" data-due="${esc(b.id)}|${d.date}"><b>${esc(billName(b))}</b><span>${esc(d.inst||b.institution||'')}${paid?' · paid '+esc(dateLabel(b.paid[d.date].date)):''}</span></button>
      <span class="pay-r"><b>${esc(money(paid ? b.paid[d.date].amount : d.amount))}</b><span class="${paid?'':dl.cls}">${paid?esc(dateLabel(d.date)):esc(dl.t)}</span></span></div>`;
  }
  function paymentsHTML(it){
    const items = []; const from = plusDays(-30), to = plusDays(60);
    for(const b of bills(it)) for(const d of dues(b, '1900-01-01', to)){ const s=status(b,d); if(s==='over' || ((s==='soon'||s==='up') && d.date<=to) || (s==='paid' && d.date>=from)) items.push({b,d,s}); }
    items.sort((a,b)=>a.d.date.localeCompare(b.d.date));
    return `<section class="panel"><div class="panel-h"><h2>Payments</h2><span class="caption">Overdue, the next 60 days, and paid in the last 30</span></div>
      ${items.length ? `<div class="pay-list">${items.map(x=>payRow(x.b,x.d,x.s)).join('')}</div>` : `<div class="empty-state">Nothing due in the next 60 days.</div>`}</section>`;
  }

  function listHTML(it){
    const bs = bills(it);
    const th = t => `<th scope="col"><span class="th-t">${t}</span></th>`;
    return `<div class="tbl-wrap"><table class="tbl bills-tbl"><thead><tr>${['Active','Asset','Category','Institution','Start date','End date','Period','Amount','Next due',''].map(th).join('')}</tr></thead><tbody>
      ${bs.map(b=>{ const nd = nextDue(b); const k = `data-b="${esc(b.id)}"`; const dl = nd && dueLabel(nd.date);
        return `<tr data-key="b-${esc(b.id)}" class="${b.active?'':'inactive'}">
          <td class="cb"><button class="cbox" data-active="${esc(b.id)}" role="checkbox" aria-checked="${!!b.active}" aria-label="Active: ${esc(billName(b))}">${ICON.check}</button></td>
          <td><input type="text" ${k} data-k="asset" value="${esc(b.asset||'')}" placeholder="e.g. House" aria-label="Asset"></td>
          <td><input type="text" ${k} data-k="category" value="${esc(b.category||'')}" placeholder="e.g. Insurance" aria-label="Category" list="billCats"></td>
          <td><input type="text" ${k} data-k="institution" value="${esc(b.institution||'')}" aria-label="Institution"></td>
          <td><input type="date" ${k} data-k="start" value="${esc(b.start||'')}" aria-label="Start date"></td>
          <td><input type="date" ${k} data-k="end" value="${esc(b.end||'')}" aria-label="End date"></td>
          <td><button class="sel-btn" data-period="${esc(b.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Period"><span class="tag">${pName(b.period)}</span></button></td>
          <td class="num"><div class="cell-fx"><span aria-hidden="true">$</span><input type="number" step="0.01" inputmode="decimal" ${k} data-k="amount" value="${esc(b.amount??'')}" aria-label="Amount"></div></td>
          <td>${nd ? `<div class="cell-fx nd"><button class="cbox" data-pay="${esc(b.id)}|${nd.date}" role="checkbox" aria-checked="false" aria-label="Mark paid: due ${dateLabel(nd.date)}">${ICON.check}</button><button class="nd-t ${dl.cls}" data-due="${esc(b.id)}|${nd.date}">${esc(dateLabel(nd.date))}<small>${esc(dl.t)}</small></button></div>` : `<span class="caption">${b.start?'—':'Add a start date'}</span>`}</td>
          <td><button class="pop" data-upd="${esc(b.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Update ${esc(billName(b))}">Update${ICON.chev}</button></td></tr>`; }).join('')}
      </tbody></table>
      ${bs.length?'':`<div class="empty-state"><b>No bills yet</b>Add each bill once. The app works out every due date from the start date and period.</div>`}
      <datalist id="billCats">${[...new Set(['Insurance','Council rates','ESL','Electricity','Gas','Water','Internet','Phone','Registration','Company renewal','Subscription', ...bs.map(b=>b.category).filter(Boolean)])].map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
      <div class="tbl-foot"><button class="add-btn" data-act="add" style="width:auto">${ICON.plus} Add bill</button><span class="caption">Annual bills with an end date are due on the end date. Others are due every period from the start date.</span></div></div>`;
  }

  /* ---------- dialogs ---------- */
  function payModal(it, b, date, op){
    const p = b.paid?.[date]; const amt = p ? p.amount : dueAmount(b, date); const s = status(b, {date});
    const m = openModal(`<h2 id="mTitle">${esc(billName(b))}</h2><p class="note">${esc(b.institution||'')} · due ${esc(dateLabel(date))} · ${STATUS_TXT[s]}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="field"><span class="lbl">Paid on</span><input class="txt-in" type="date" id="pDate" value="${esc(p?.date||today())}"></label>
      <label class="field"><span class="lbl">Amount ($)</span><input class="txt-in" type="number" step="0.01" id="pAmt" value="${esc(amt??'')}"></label></div>
      <div class="row-end">${p?`<button class="btn danger grow" data-x="unpay">Mark unpaid</button>`:''}<button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes" autofocus>${p?'Save':'Mark paid'}</button></div>`, {opener:op});
    m.onclick = e => { const x=e.target.closest('[data-x]'); if(!x) return; const v=x.dataset.x; closeModal();
      if(v==='yes'){ const a=$('#pAmt')?.value; setPaid(it, b, date, {date:$('#pDate').value||today(), amount:a===''?'':+a}); }
      if(v==='unpay') setPaid(it, b, date, null); };
    m.onkeydown = e => { if(e.key==='Enter' && e.target.matches('input')){ e.preventDefault(); m.querySelector('[data-x="yes"]').click(); } };
  }
  function formModal({title, body, action, op, onSave}){
    const m = openModal(`<h2 id="mTitle">${esc(title)}</h2>${body}<div class="row-end"><button class="btn" data-x="no">Cancel</button><button class="pill" data-x="yes">${esc(action)}</button></div>`, {opener:op, wide:true});
    m.onclick = e => { const x=e.target.closest('[data-x]'); if(!x) return; if(x.dataset.x==='yes'){ if(onSave()===false) return; } closeModal(); };
    m.onkeydown = e => { if(e.key==='Enter' && e.target.matches('input')){ e.preventDefault(); m.querySelector('[data-x="yes"]').click(); } };
    return m;
  }
  const inp = (id, label, type, val, extra='') => `<label class="field"><span class="lbl">${label}</span><input class="txt-in" id="${id}" type="${type}" value="${esc(val??'')}" ${extra}></label>`;
  const grid = s => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">${s}</div>`;
  const val = id => $('#'+id).value.trim();
  const num = id => { const v=$('#'+id).value; return v===''?'':+v; };

  function renewModal(it, b, op){
    const len = b.start && b.end ? monthsBetween(b.start, b.end) : (+b.period||12);
    formModal({title:'Renew '+billName(b), op, action:'Renew',
      body:`<p class="note">Same provider, new term. The current term (${esc(dateLabel(b.start))} – ${esc(dateLabel(b.end))}) is kept in the history.</p>`+
        grid(inp('rStart','New start','date',b.end)+inp('rEnd','New end','date',addMonths(b.end,len))+inp('rAmt','Amount ($)','number',b.amount,'step="0.01"')+inp('rRef','Policy or reference','text',b.ref)),
      onSave(){ const s=val('rStart'), e=val('rEnd'); if(!s){ $('#rStart').focus(); return false; }
        mutate(it, b.id, x => { x.history=[...(x.history||[]), {start:x.start, end:x.end, institution:x.institution, amount:x.amount, ref:x.ref}]; x.start=s; x.end=e; x.amount=num('rAmt'); x.ref=val('rRef'); x.active=true; x.stopped=''; }, 'Renewed '+billName(b)); }});
  }
  function switchModal(it, b, op){
    const at = b.end || today();
    formModal({title:'Switch provider', op, action:'Switch',
      body:`<p class="note">“${esc(b.institution||'Current provider')}” ends on the switch date and stays in the timeline as history. A new bill starts with the new provider.</p>`+
        grid(inp('sDate','Switch date','date',at)+inp('sInst','New provider','text','','autofocus placeholder="e.g. AAMI"')+inp('sEnd','New end date','date',+b.period===12?addMonths(at,12):'')+inp('sAmt','Amount ($)','number','','step="0.01"')+inp('sRef','Policy or reference','text','')),
      onSave(){ const d=val('sDate'), inst=val('sInst'); if(!d){ $('#sDate').focus(); return false; } if(!inst){ $('#sInst').focus(); return false; }
        const nb = {id:uid(), active:true, asset:b.asset, category:b.category, institution:inst, start:d, end:val('sEnd'), period:b.period, amount:num('sAmt'), ref:val('sRef'), notes:'', paid:{}, history:[], stopped:'', created:today(), prevId:b.id};
        mutate(it, b.id, (x, list) => { x.active=false; x.stopped=d; list.splice(list.indexOf(x)+1, 0, nb); }, 'Switched to '+inst); }});
  }
  function cancelModal(it, b, op){
    formModal({title:'End '+billName(b), op, action:'End bill',
      body:`<p class="note">No due dates after this date. The bill stays in the list as inactive, with its history.</p>`+grid(inp('cDate','Last day','date',today())),
      onSave(){ const d=val('cDate')||today(); mutate(it, b.id, x => { x.active=false; x.stopped=d; }, 'Ended '+billName(b)); }});
  }
  function editModal(it, b, op){
    let period = +b.period || 12;
    const hist = [...(b.history||[])].reverse(); const paid = Object.entries(b.paid||{}).sort((x,y)=>y[0].localeCompare(x[0]));
    const m = formModal({title:'Edit bill', op, action:'Save',
      body: grid(inp('eAsset','Asset','text',b.asset,'autofocus')+inp('eCat','Category','text',b.category,'list="billCats2"')+inp('eInst','Institution','text',b.institution)+inp('eStart','Start date','date',b.start)+inp('eEnd','End date','date',b.end)+inp('eAmt','Amount ($)','number',b.amount,'step="0.01"')+inp('eRef','Policy or reference','text',b.ref))+
        `<datalist id="billCats2">${[...new Set(bills(it).map(x=>x.category).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
        <div class="field"><span class="lbl" id="ePL">Period</span><div class="seg full" role="group" aria-labelledby="ePL">${PERIODS.map(([n,l])=>`<button data-pp="${n}" aria-pressed="${n===period}">${l}</button>`).join('')}</div></div>
        <label class="field"><span class="lbl">Notes</span><input class="txt-in" id="eNotes" value="${esc(b.notes||'')}" placeholder="e.g. Pays from offset account, auto-renews"></label>
        ${hist.length?`<div class="field"><span class="lbl">Previous terms</span><div class="hist">${hist.map(h=>`<div><b>${esc(h.institution||'')}</b><span>${esc(dateLabel(h.start))} – ${esc(h.end?dateLabel(h.end):'')}${h.amount!==''&&h.amount!==undefined?' · '+esc(money(h.amount)):''}</span></div>`).join('')}</div></div>`:''}
        ${paid.length?`<div class="field"><span class="lbl">Payments (${paid.length})</span><div class="hist">${paid.slice(0,12).map(([d,p])=>`<div><b>Due ${esc(dateLabel(d))}</b><span>Paid ${esc(dateLabel(p.date))}${p.amount!==''?' · '+esc(money(p.amount)):''}</span></div>`).join('')}</div></div>`:''}`,
      onSave(){ mutate(it, b.id, x => Object.assign(x, {asset:val('eAsset'), category:val('eCat'), institution:val('eInst'), start:val('eStart'), end:val('eEnd'), amount:num('eAmt'), ref:val('eRef'), notes:val('eNotes'), period})); }});
    const orig = m.onclick;
    m.onclick = e => { const pp=e.target.closest('[data-pp]'); if(pp){ period=+pp.dataset.pp; $$('[data-pp]',m).forEach(x=>x.setAttribute('aria-pressed', x===pp)); return; } orig(e); };
  }
  function updateMenu(it, b, anchor){
    openMenu(anchor, [
      ...(b.end?[{label:'Renew / extend…', value:'renew'}]:[]),
      {label:'Switch provider…', value:'switch'},
      {label:'Edit details…', value:'edit'},
      b.active ? {label:'End this bill…', value:'end'} : {label:'Make active again', value:'reactivate'},
      {sep:true}, {label:'Delete bill', value:'del', danger:true}
    ], v => {
      if(v==='renew') renewModal(it, b, anchor);
      if(v==='switch') switchModal(it, b, anchor);
      if(v==='edit') editModal(it, b, anchor);
      if(v==='end') cancelModal(it, b, anchor);
      if(v==='reactivate') mutate(it, b.id, x => { x.active=true; x.stopped=''; }, 'Active again');
      if(v==='del') mutate(it, b.id, (x, list) => list.splice(list.indexOf(x), 1), 'Deleted '+billName(b));
    }, 'Update bill');
  }

  /* ---------- events ---------- */
  function addBill(it){
    const nb = {id:uid(), active:true, asset:'', category:'', institution:'', start:'', end:'', period:12, amount:'', ref:'', notes:'', paid:{}, history:[], stopped:'', created:today(), prevId:''};
    setBills(it, [...bills(it), nb]); st(it).mode = 'list'; render(true);
    requestAnimationFrame(()=>{ const el=$(`[data-b="${CSS.escape(nb.id)}"][data-k="asset"]`); el?.focus(); el?.scrollIntoView({block:'nearest'}); });
  }
  const findB = (it, id) => bills(it).find(b=>b.id===id);
  function click(e, it){
    const sg = e.target.closest('[data-seg]'); if(sg){ st(it).mode = sg.dataset.seg; render(true); restoreFocus(`[data-seg="${sg.dataset.seg}"]`); return; }
    const yr = e.target.closest('[data-yr]'); if(yr){ const d=+yr.dataset.yr; st(it).year = d ? st(it).year+d : CUR_YEAR; render(true); restoreFocus(`[data-yr="${d||1}"]`); return; }
    if(e.target.closest('[data-act="add"]')) return addBill(it);
    const pay = e.target.closest('[data-pay]');
    if(pay){ const [id,date]=pay.dataset.pay.split('|'); const b=findB(it,id); if(!b) return;
      if(b.paid?.[date]) setPaid(it, b, date, null); else setPaid(it, b, date, {date:today(), amount:dueAmount(b,date)??''});
      restoreFocus(`[data-pay="${CSS.escape(pay.dataset.pay)}"]`); return; }
    const du = e.target.closest('[data-due]'); if(du){ const [id,date]=du.dataset.due.split('|'); const b=findB(it,id); if(b) payModal(it, b, date, du); return; }
    const ac = e.target.closest('[data-active]'); if(ac){ const b=findB(it, ac.dataset.active); mutate(it, b.id, x => { x.active=!x.active; x.stopped = x.active ? '' : today(); }); restoreFocus(`[data-active="${CSS.escape(b.id)}"]`); return; }
    const pr = e.target.closest('[data-period]');
    if(pr){ const b=findB(it, pr.dataset.period); openMenu(pr, PERIODS.map(([n,l])=>({label:l, value:n, checked:+b.period===n})), v => { mutate(it, b.id, x => { x.period=v; }); restoreFocus(`[data-period="${CSS.escape(b.id)}"]`); }, 'Period'); return; }
    const up = e.target.closest('[data-upd]'); if(up){ const b=findB(it, up.dataset.upd); if(b) updateMenu(it, b, up); return; }
    const ed = e.target.closest('[data-edit]'); if(ed){ const b=findB(it, ed.dataset.edit); if(b) editModal(it, b, ed); }
  }
  function change(e, it){
    const el = e.target; const id = el.dataset.b, k = el.dataset.k; if(!id || !k) return;
    const b = findB(it, id); if(!b) return;
    let v = el.value; if(k==='amount') v = v==='' ? '' : +v; else if(typeof v==='string') v = v.trim();
    if((b[k] ?? '') === v) return;
    mutate(it, id, x => { x[k] = v; });
  }
  function keydown(e){ if(e.key==='Enter' && e.target.dataset.b){ e.preventDefault(); e.target.blur(); } }

  return {wide:true, render:view, click, change, keydown, pending, newShortcut:addBill, focusStart(it){ if(!bills(it).length) addBill(it); }};
})();
