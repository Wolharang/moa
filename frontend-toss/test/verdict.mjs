/** 결제별 라벨 — 홈·내역의 칩과 리포트 요약이 이어지는지. */
import { chromium, devices } from 'playwright';

const PAY = [
  { paymentId:'p1', date:'2026-08-31T12:00:00', merchantName:'배민', displayName:'배달의민족',
    amount:23000, category:'식비', category2:'식비', cardName:'신한', companyName:'신한카드' },
  { paymentId:'p2', date:'2026-08-30T09:00:00', merchantName:'카카오T', displayName:'카카오T',
    amount:12000, category:'교통/자동차', category2:'교통/자동차', cardName:'신한', companyName:'신한카드' },
];
let stored = {};

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: devices['Galaxy S9+'].userAgent,
  viewport:{width:360,height:780}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.stack ?? String(e)));
page.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });

await page.route('**/api/**', async (r) => {
  const u = r.request().url();
  const json = (b) => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(b) });
  if (u.includes('/api/verdict') && r.request().method()==='POST') {
    const b = JSON.parse(r.request().postData() || '{}');
    stored[b.paymentId] = b.waste ? 'WASTE' : 'FINE';
    return json({ paymentId:b.paymentId, waste:b.waste });
  }
  if (u.includes('/api/verdict')) return json(stored);
  if (u.includes('/api/mydata/payments')) return json(PAY);
  // 챌린지가 없으면 서버는 404 다 — 빈 객체를 주면 화면이 있는 줄 알고 읽는다.
  if (u.includes('/api/guardian/report/weekly') || u.includes('/api/guardian/home')) {
    return r.fulfill({ status:404, contentType:'application/json', body:'{"message":"없음"}' });
  }
  if (u.includes('/api/report/period')) {
    return json({ period:'week', start:'2026-08-25', end:'2026-08-31', total:35000, count:2,
      days:[], byCategory:[{code:'식비',name:'식비',amount:23000},{code:'교통/자동차',name:'교통/자동차',amount:12000}],
      uncategorised:0 });
  }
  if (u.includes('/api/report/labels')) {
    const leak = Object.values(stored).filter(v=>v==='WASTE').length;
    const fine = Object.values(stored).filter(v=>v==='FINE').length;
    return json({ period:'week', start:'2026-08-25', end:'2026-08-31',
      fine:{count:fine,amount:fine*12000}, leak:{count:leak,amount:leak*23000},
      unlabeled: PAY.length-leak-fine, leakTop: leak?'식비':null });
  }
  return json({});
});
await page.addInitScript(() => { try {
  localStorage.setItem('mydata_onboarded','true'); localStorage.setItem('userId','1'); } catch {} });

let pass=0, fail=0;
const say=(l,ok,n='')=>{ ok?pass++:fail++; console.log(`  ${ok?'✔':'✗'} ${l}${n?'  — '+n:''}`); };

console.log('\n소비내역 칩');
await page.goto('http://localhost:5173/#/transactions');
await page.waitForTimeout(2200);
say('칩 줄이 뜬다', (await page.locator('.ctx3').count())>0, `${await page.locator('.ctx3').count()}줄`);
const first = page.locator('.ctx3').first();
await first.locator('button', { hasText:'새는 돈이었어요' }).click();
await page.waitForTimeout(700);
say('서버로 갔다', stored.p1==='WASTE' || stored.p2==='WASTE', JSON.stringify(stored));
say('딱지로 바뀐다', (await page.locator('.sp-tag.tag-ctx').count())>0);
say('칩 줄이 하나 줄었다', (await page.locator('.ctx3').count())===1);
await page.locator('.sp-tag.tag-ctx').first().click(); await page.waitForTimeout(400);
say('딱지를 누르면 다시 열린다', (await page.locator('.ctx3').count())===2);
await page.screenshot({ path:'/tmp/vd-1.png' });

console.log('\n리포트 라벨 절');
await page.goto('http://localhost:5173/#/report');
await page.waitForTimeout(2200);
const txt = await page.evaluate(()=>document.querySelector('.screen')?.innerText ?? '');
say('또래 비교가 없다', !txt.includes('또래'), txt.includes('또래')?'남아 있음':'');
say('라벨 절이 있다', (await page.locator('.lbl-rows').count())>0 || txt.includes('붙인 라벨이'));
say('두 갈래를 적는다', txt.includes('필요했어요') && txt.includes('새는 돈이었어요'), '');
await page.screenshot({ path:'/tmp/vd-2.png' });

console.log(`\nJS 오류 ${errs.length}건${errs.length?': '+errs.slice(0,3).join(' | '):''}`);
console.log(`${fail===0?'모두 통과':`실패 ${fail}건`} · ${pass}/${pass+fail}\n`);
await browser.close();
process.exit(fail?1:0);
