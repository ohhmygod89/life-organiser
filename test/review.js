/* Release review: every page on an iPhone 13 and a 1440px desktop. Fails on anything wider than the screen or any script error. Run: node test/review.js (after python3 build.py --local) */
const { chromium, devices } = require('playwright');
const path=require('path'), fs=require('fs');
const out=path.join(__dirname,'shots')+'/'; fs.mkdirSync(out,{recursive:true});
const URL='file://'+path.join(__dirname,'local.html');
const overflow = p => p.evaluate(()=>{ const W=innerWidth; const o=[]; document.querySelectorAll('body *').forEach(e=>{ const cs=getComputedStyle(e); if(cs.visibility==='hidden'||cs.display==='none') return; if(e.closest('.lanes,.board,.tb-filters,.fgroups,.tl-scroll,.tl-in,.tbl-wrap,.menu,[hidden]')) return; const r=e.getBoundingClientRect(); if(r.width && (r.right>W+1 || r.left<-1)) o.push((e.id||(typeof e.className==='string'?e.className:'svg')||e.tagName).slice(0,30)+'@'+Math.round(r.left)+'-'+Math.round(r.right)); }); return o.slice(0,8); });
(async () => { const b = await chromium.launch(); const errs=[];
for(const [tag, opt] of [['ph',{...devices['iPhone 13']}],['dt',{viewport:{width:1440,height:900}}]]){
  const ctx = await b.newContext(opt); const p = await ctx.newPage(); p.on('pageerror',e=>errs.push(tag+': '+e.message)); p.on('console',m=>{ if(m.type()==='error' && !/fonts|TUNNEL/.test(m.text())) errs.push(tag+' console: '+m.text()); });
  await p.goto(URL+'#home'); await p.waitForTimeout(700);
  const items = await p.evaluate(()=>[...window.__demoData.items.entries()].map(([id,b])=>[id,b.type]));
  const routes = ['home','tasks','archive', ...items.map(([id,t])=>'i-'+id)];
  for(const r of routes){ await p.goto(URL+'#'+r); await p.waitForTimeout(500); const o=await overflow(p); if(o.length){ console.log(tag, r, 'OVERFLOW', o.join(' ')); process.exitCode=1; } await p.screenshot({path:out+tag+'-'+r+'.png', fullPage: tag==='ph'}); }
  await p.goto(URL+'#tasks'); await p.waitForTimeout(500);
  if(tag==='ph'){ await p.click('#fab'); await p.waitForTimeout(400); console.log(tag,'menu-open overflow', await overflow(p)); await p.screenshot({path:out+'ph-menu.png'}); await p.click('#fab'); await p.waitForTimeout(400); console.log(tag,'menu-closed overflow', await overflow(p)); }
  await p.click('.card:has-text("Update project risk register") .title'); await p.waitForTimeout(500); console.log(tag,'sheet overflow', await overflow(p)); await p.screenshot({path:out+tag+'-sheet.png'});
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await ctx.close();
}
console.log('errors', errs); await b.close();
if(errs.length || process.exitCode){ console.log('Review FAILED'); process.exit(1); } console.log('Review passed: screenshots in test/shots'); })();
