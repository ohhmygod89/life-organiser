// Smoke test: opens every view in demo mode and fails on any page error.
// Usage: python3 build.py --local && node test/smoke.js
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, cs] of [[1440, 900, 'light'], [1440, 900, 'dark'], [390, 844, 'light']]) {
    const p = await b.newPage({viewport: {width: w, height: h}, colorScheme: cs});
    p.on('pageerror', e => errs.push(`${w}/${cs}: ${e.message}`));
    await p.goto('file://' + __dirname + '/local.html'); await p.evaluate(()=>localStorage.setItem('lo.sidePinned','1')); await p.reload(); await p.waitForTimeout(500);   // sidebar kept open so it never covers what the test clicks
    const ids = await p.evaluate(() => [...window.__demoData.items.keys()]);
    for (const h2 of ['home', 'tasks', 'archive', ...ids.map(i => 'i-' + i)]) {
      await p.evaluate(x => location.hash = x, h2); await p.waitForTimeout(150);
    }
    if (w === 1440 && cs === 'light') {
      await p.evaluate(() => location.hash = 'tasks'); await p.waitForTimeout(200);
      await p.click('.card >> nth=0'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
      await p.evaluate(() => location.hash = 'i-demobillsitem01'); await p.waitForTimeout(200);
      await p.click('.pay-row .cbox >> nth=0'); await p.waitForTimeout(200);
      await p.screenshot({path: __dirname + '/smoke-bills.png'});
      await p.evaluate(() => location.hash = 'home'); await p.waitForTimeout(200);
      await p.screenshot({path: __dirname + '/smoke-home.png'});
    }
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (over) errs.push(`${w}: horizontal overflow`);
    await p.close();
  }
  await b.close();
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log('Smoke test passed');
})();
