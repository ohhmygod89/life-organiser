/* ============================================================
   Demo database — used when the page runs outside claude.ai (GitHub Pages, local file).
   Same API as the artifact db (collection().onSnapshot, doc().set/update/delete/onSnapshot).
   Data is fictional sample data and stays in this browser (localStorage).
   ============================================================ */
function DemoDB(){
  const KEY = 'lo.demo.v7';   // v7: added the Gantt chart demo (v6: demo tasks gained start dates, beta.28)
  const ago = n => { const d=new Date(); d.setDate(d.getDate()-n); return ymd(d); };
  const ahead = n => ago(-n);
  const iso = nowIso();
  function seed(){
    const F = {p:'demofolderpers1', w:'demofolderwork1', f:'demofolderfina1'};
    const fld = (id,name,type,x={}) => ({id,name,type,...x});
    const task = (id, boardId, col, pos, title, x={}) => ({id, boardId, col, pos, title, notes:'', due:'', priority:'', flag:'', flagWho:'', checklist:[], log:[], created:iso, updated:iso, ...x});
    const bill = (id, asset, category, institution, start, end, period, amount, x={}) => ({id, active:true, asset, category, institution, start, end, period, amount, ref:'', notes:'', paid:{}, history:[], stopped:'', created:ago(60), prevId:'', ...x});
    return {
      folders:[{id:F.p,name:'Personal',order:0},{id:F.w,name:'Work',order:1},{id:F.f,name:'Finance',order:2}],
      items:[
        {id:'demopagestart01', type:'page', name:'Start Here', folderId:F.p, order:0, created:iso, updated:iso},
        {id:'demonotestart01', type:'note', name:'Welcome', parent:'demopagestart01', folderId:'', order:0, created:iso, updated:iso, body:
`This is a **demo** of Life Organiser with made-up sample data. Changes you make stay in this browser only.

## Item types
- **Kanban**: stacks of To Do, In Progress and Done columns. See [[Kanban]].
- **Page**: a page built from blocks: Text like this, Checklists and Tables. See [[Japan Trip]].
- **Tracker**: dated numbers with a chart. See [[Home Loan Rate]].
- **Bills**: recurring bills on a yearly timeline. See [[Bills & Renewals]].

## Try it
- [ ] Drag a card on [[Kanban]] to In Progress
- [ ] Tick a payment on [[Bills & Renewals]]
- [x] Open the demo

Press ? for keyboard shortcuts.`},
        {id:'demokanban0001', type:'kanban', container:true, name:'Kanban', folderId:'', order:0, created:iso, updated:iso},
        {id:'demokanbanhome1', type:'stack', parent:'demokanban0001', name:'Home', folderId:'', order:0, created:iso, updated:iso},
        {id:'demokanbanwork1', type:'stack', parent:'demokanban0001', name:'Work', folderId:'', order:1, created:iso, updated:iso},
        {id:'demokanbanside1', type:'stack', parent:'demokanban0001', name:'Side Business', folderId:'', order:2, created:iso, updated:iso},
        {id:'demogantt000001', type:'gantt', name:'Kitchen renovation', folderId:F.p, order:3, nav:1, created:iso, updated:iso},
        {id:'demogsecplan001', type:'gsection', parent:'demogantt000001', name:'Design and ordering', order:0, created:iso, updated:iso},
        {id:'demogsecbuild01', type:'gsection', parent:'demogantt000001', name:'Build', order:1, created:iso, updated:iso},
        {id:'demopagejapan01', type:'page', name:'Japan Trip', folderId:F.p, order:1, created:iso, updated:iso},
        {id:'demonotejapan01', type:'note', name:'Plan', parent:'demopagejapan01', folderId:'', order:0, created:iso, updated:iso, body:
`Ten days in **April**: Tokyo, Kyoto, then Osaka.

- Book the rail pass a month ahead
- Keep the hotel confirmations in [[Bills & Renewals]] notes`},
        {id:'demochecklist01', type:'checklist', name:'Travel Packing', parent:'demopagejapan01', folderId:'', order:1, created:iso, updated:iso, entries:['Passport','Phone charger','Travel adapter','Headphones','Toiletries'].map((t,i)=>({id:'dce'+i, text:t, done:i<2}))},
        {id:'demobillsitem01', type:'bills', name:'Bills & Renewals', folderId:'', order:1, created:iso, updated:iso, bills:[
          bill('demobill1','Car','Insurance','Acme Insurance', ago(250), ahead(115), 12, 980),
          bill('demobill2','House','Insurance','Harbour Mutual', ago(100), ahead(265), 12, 1420),
          bill('demobill3','House','Council rates','City Council', ago(400), '', 3, 480, {paid:{}}),
          bill('demobill4','House','Electricity','Bright Energy', ago(200), '', 3, 390),
          bill('demobill5','House','Internet','Fastnet', ago(300), '', 1, 79),
          bill('demobill6','Side business','Company renewal','Business registry', ago(320), ahead(45), 12, 310),
        ]},
        {id:'demopagecoupon1', type:'page', name:'Coupons & Vouchers', folderId:F.f, order:0, created:iso, updated:iso},
        {id:'democollcoupon1', type:'collection', name:'Coupons & Vouchers', parent:'demopagecoupon1', folderId:'', order:0, created:iso, updated:iso, sort:null, fields:[
          fld('dcf1','Store','text'), fld('dcf2','Value','currency'), fld('dcf3','Code','text'), fld('dcf4','Expires','date',{home:true}), fld('dcf5','Used','checkbox'), fld('dcf6','Notes','text')]},
        {id:'demotrackrate01', type:'tracker', name:'Home Loan Rate', folderId:'', order:2, created:iso, updated:iso, unit:'%', decimals:2, step:true, points:[
          {id:'dp1',date:ago(900),value:5.89,note:'Fixed term ended'},{id:'dp2',date:ago(640),value:6.14,note:'Rate rise'},{id:'dp3',date:ago(380),value:5.99,note:'Cut'},{id:'dp4',date:ago(120),value:5.74,note:'Cut'}]},
      ],
      tasks:(() => {
        const W = 'waiting', B = 'blocked', H = 'hold', D = 'decision';
        const sub = (text, done=false, x={}) => ({id:'s'+Math.random().toString(36).slice(2,9), text, done, ...x});
        const L = (n, text) => ({id:'l'+Math.random().toString(36).slice(2,9), t:ago(n)+'T09:30:00.000Z', text});
        const spec = {
          demokanbanhome1: {
            upcoming:[['Plan spring garden',{priority:'low', due:ahead(40)}], ['Book annual car rego',{due:ahead(25), priority:'med'}], ['Research solar panels',{notes:'Compare 6.6 kW systems, ask about the feed-in tariff.'}]],
            todo:[['Renew passport',{pinned:true, priority:'high', flag:W, flagWho:'Passport office', start:ago(3), due:ahead(6), checklist:[sub('Photos',true), sub('Lodge form'), sub('Collect from post office',false,{flag:W, flagWho:'Post office'})]}],
                  ['Book car service',{priority:'med', due:ahead(3)}], ['Fix leaking tap',{start:ago(6), due:ago(2), priority:'high'}], ['Clear out garage',{checklist:[sub('Sort donations'), sub('Book council pickup',false,{flag:D})]}]],
            doing:[['Clean gutters',{priority:'med', start:ago(2), due:ahead(5), checklist:[sub('Front',true), sub('Back')]}], ['Switch energy plan',{start:ago(10), flag:W, flagWho:'Bright Energy', log:[L(3,'Called, waiting on a quote')], priority:'low'}]],
            done:[['Pay parking fine',{start:ago(5), due:ago(1), doneAt:ago(1)}], ['Replace smoke alarm batteries',{doneAt:ago(4)}], ['Order new mattress',{doneAt:ago(9)}]],
            backburner:[['Repaint the fence',{flag:H}], ['Build a veggie patch',{priority:'low'}]],
          },
          demokanbanwork1: {
            upcoming:[['Plan training course',{start:ahead(24), due:ahead(30)}], ['Quarterly review prep',{priority:'med', start:ahead(10), due:ahead(21)}]],
            todo:[['Submit timesheet',{priority:'high', due:ahead(1)}], ['Update project risk register',{priority:'med', checklist:[sub('Schedule risks',true), sub('Supplier risks',false,{flag:W, flagWho:'Procurement'}), sub('Review with lead')]}], ['Reply to client email',{due:ago(1), priority:'high'}]],
            doing:[['Write test procedure',{pinned:true, priority:'high', flag:B, start:ago(7), due:ahead(9), notes:'Needs the updated drawing set.', checklist:[sub('Draft steps',true), sub('Peer review',false,{flag:W, flagWho:'Sam'}), sub('Sign-off')]}], ['Onboard new starter',{start:ago(1), due:ahead(12), checklist:[sub('Laptop',true), sub('Access cards'), sub('Induction')]}], ['Expense claim',{flag:W, flagWho:'Finance', priority:'low'}]],
            done:[['Book flights for site visit',{start:ago(6), due:ago(2), doneAt:ago(2)}], ['Safety refresher module',{doneAt:ago(6)}]],
            backburner:[['Reorganise shared drive',{priority:'low'}], ['Lunch-and-learn talk',{flag:D}]],
          },
          demokanbanside1: {
            upcoming:[['Logo refresh',{priority:'low'}], ['Apply for market stall',{due:ahead(45), flag:D}]],
            todo:[['Photograph new range',{priority:'med', start:ahead(2), due:ahead(5), checklist:[sub('Book studio',true), sub('Props'), sub('Model',false,{flag:W, flagWho:'Agency'})]}], ['Update shop prices',{priority:'high', due:ahead(2)}]],
            doing:[['Website copy',{priority:'med', start:ago(5), due:ahead(8), flag:W, flagWho:'Copywriter', log:[L(5,'Brief sent'), L(1,'First draft received')]}], ['Supplier samples',{start:ago(14), flag:B, checklist:[sub('Request',true), sub('Customs clearance',false,{flag:W, flagWho:'Courier'})]}]],
            done:[['Register business name',{doneAt:ago(12)}], ['Open business account',{doneAt:ago(20)}]],
            backburner:[['Podcast idea',{}], ['Second product line',{flag:H, priority:'low'}]],
          },
        };
        const out = []; let n = 0;
        /* Gantt demo (Kitchen renovation): same task fields as the Kanban plus deps (finish-to-start), progress and milestone.
           One link is deliberately out of order (Painting starts before Benchtop ends) so the red arrow can be seen. */
        const gt = (id, sec, pos, title, start, due, x={}) => ({id, boardId:sec, col:'todo', pos, title, notes:'', start, due, priority:'low', flag:'', flagWho:'', checklist:[], log:[], deps:[], progress:0, milestone:false, created:iso, updated:iso, ...x});
        const GP = 'demogsecplan001', GB = 'demogsecbuild01';
        out.push(
          gt('demogtask000001', GP, 1024, 'Measure up and sketch the layout', ago(16), ago(10), {col:'done', progress:100, doneAt:ago(10)+'T09:00:00.000Z'}),
          gt('demogtask000002', GP, 2048, 'Choose cabinets and benchtop', ago(8), ahead(4), {col:'doing', progress:60, deps:['demogtask000001'], notes:'Shortlist two suppliers, then order samples.'}),
          gt('demogtask000003', GP, 3072, 'Order appliances', ahead(5), ahead(9), {deps:['demogtask000002']}),
          gt('demogtask000004', GP, 4096, 'Design approved', ahead(10), ahead(10), {milestone:true, deps:['demogtask000003']}),
          gt('demogtask000005', GB, 1024, 'Strip out the old kitchen', ahead(12), ahead(16), {deps:['demogtask000004']}),
          gt('demogtask000006', GB, 2048, 'Plumbing and electrical rough-in', ahead(17), ahead(26), {deps:['demogtask000005'], checklist:[{id:'dgc1', text:'Move the sink waste', done:false}]}),
          gt('demogtask000007', GB, 3072, 'Install cabinets and benchtop', ahead(27), ahead(40), {deps:['demogtask000006']}),
          gt('demogtask000008', GB, 4096, 'Painting and finishing', ahead(36), ahead(48), {deps:['demogtask000007']}),
          gt('demogtask000009', GB, 5120, 'Order bar stools'),
        );
        for(const [bid, cols] of Object.entries(spec)){
          cols.todo = [...cols.todo, ...(cols.upcoming||[])].slice(0,5); delete cols.upcoming;   // no Upcoming column since beta.13
          for(const [col, list] of Object.entries(cols)) list.forEach(([title, x], i) => out.push(task('dt'+(++n), bid, col, (i+1)*1024, title, x)));
        }
        return out;
      })(),
      rows:[
        {id:'dr1', itemId:'democollcoupon1', pos:0, values:{dcf1:'Bookshop', dcf2:25, dcf3:'READ25', dcf4:ahead(20), dcf5:false}, created:iso, updated:iso},
        {id:'dr2', itemId:'democollcoupon1', pos:1, values:{dcf1:'Cinema', dcf2:15, dcf3:'MOVIE15', dcf4:ahead(75), dcf5:false}, created:iso, updated:iso},
      ],
      meta:[],
    };
  }
  let raw = null; try{ raw = JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){}
  const src = raw || seed();
  const data = {}; for(const k of ['folders','items','tasks','rows','meta']) data[k] = new Map((src[k]||[]).map(d=>{ const {id,...b}=d; return [id, b]; }));
  const persist = () => { try{ const o={}; for(const k in data) o[k]=[...data[k].entries()].map(([id,b])=>({id,...b})); localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} };
  const subs = {}, docSubs = {};
  const cp = o => JSON.parse(JSON.stringify(o));
  const snap = c => ({docs:[...(data[c]||new Map()).entries()].map(([id,b])=>({id, data:()=>cp(b)})), metadata:{fromCache:false}});
  const emit = (c, path) => { (subs[c]||[]).forEach(cb=>setTimeout(()=>cb(snap(c)),0)); (docSubs[path]||[]).forEach(cb=>setTimeout(()=>{ const [cc,id]=path.split('/'); cb({exists:data[cc].has(id), data:()=>cp(data[cc].get(id)||{})}); },0)); persist(); };
  window.__demoData = data;
  return {
    reset(){ try{ localStorage.removeItem(KEY); }catch(e){} location.reload(); },
    collection(c){ return {onSnapshot(cb){ (subs[c]=subs[c]||[]).push(cb); setTimeout(()=>cb(snap(c)),0); return ()=>{}; }}; },
    doc(path){ const [c,id]=path.split('/'); data[c]=data[c]||new Map(); return {
      onSnapshot(cb){ (docSubs[path]=docSubs[path]||[]).push(cb); setTimeout(()=>cb({exists:data[c].has(id), data:()=>cp(data[c].get(id)||{})}),0); return ()=>{}; },
      async set(b){ data[c].set(id, cp(b)); emit(c, path); },
      async update(p){ data[c].set(id, {...(data[c].get(id)||{}), ...cp(p)}); emit(c, path); },
      async delete(){ data[c].delete(id); emit(c, path); },
    }; },
  };
}
