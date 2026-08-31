/** 온보딩 4단계를 응답을 심어 확인한다 — 목록·덱·CTA 잠금·되돌리기·목표. */
import { chromium, devices } from 'playwright';

const ITEMS = [
  { sub:'배달', categoryCode:'식비', monthlyAmount:142960, count:12, wasteAmount:80000, suggestedCut:50000,
    why:'식비에 보통 12,000원 쓰는데 이번엔 34,000원이에요.' },
  { sub:'택시', categoryCode:'교통/자동차', monthlyAmount:125400, count:9, wasteAmount:70000, suggestedCut:35000,
    why:'평소보다 많이 썼어요.' },
  { sub:'커피전문점', categoryCode:'카페/간식', monthlyAmount:96400, count:21, wasteAmount:45000, suggestedCut:30000, why:null },
  { sub:'게임', categoryCode:'취미/여가', monthlyAmount:87900, count:5, wasteAmount:60000, suggestedCut:50000,
    why:'5건이 모두 늦은 밤에 몰렸어요.' },
];
const CATS = [
  { categoryCode:'식비', displayName:'식비', amount:420000, count:40, wasteAmount:80000, protectedCategory:false, payments:[] },
  { categoryCode:'교통/자동차', displayName:'교통/자동차', amount:180000, count:20, wasteAmount:70000, protectedCategory:false, payments:[] },
  { categoryCode:'카페/간식', displayName:'카페/간식', amount:96400, count:21, wasteAmount:45000, protectedCategory:false, payments:[] },
  { categoryCode:'취미/여가', displayName:'취미/여가', amount:87900, count:5, wasteAmount:60000, protectedCategory:false, payments:[] },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: devices['Galaxy S9+'].userAgent,
  viewport:{width:Number(process.env.W||360),height:Number(process.env.H||780)}, deviceScaleFactor:3, hasTouch:true, isMobile:true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });

await page.route('**/api/onboarding/window**', r => r.fulfill({ status:200, contentType:'application/json',
  body: JSON.stringify({ userId:1, windowDays:30, from:'2026-08-01T00:00:00', to:'2026-08-31T00:00:00',
    categories: CATS, saveItems: ITEMS }) }));
await page.route('**/api/**', r => r.request().url().includes('/onboarding/window') ? r.fallback()
  : r.fulfill({ status:200, contentType:'application/json', body:'{}' }));

await page.addInitScript(() => {
  try { localStorage.setItem('mydata_onboarded','true'); localStorage.setItem('userId','1'); } catch {}
});
let pass=0, fail=0;
const say=(l,ok,n='')=>{ ok?pass++:fail++; console.log(`  ${ok?'✔':'✗'} ${l}${n?'  — '+n:''}`); };
const prog = () => page.evaluate(() => document.querySelector('.progress i')?.style.width ?? '?');
const title = () => page.evaluate(() => document.querySelector('.msg:not(.pre):not(.out) .h-title')?.textContent ?? '');
const ctaText = () => page.evaluate(() => document.querySelector('.cta-fixed button, .cta button')?.textContent ?? '');
const ctaOff = () => page.evaluate(() => !!document.querySelector('.cta-fixed button, .cta button')?.disabled);

await page.goto('http://localhost:5173/#/ob');
await page.waitForTimeout(1500);
console.log('\n1단계');
say('진행바 20%', (await prog())==='20%', await prog());
say('제목이 1단계', (await title()).includes('지난 소비를 분석했어요'), await title());

// 1단계는 스스로 2로 넘어간다
await page.waitForTimeout(6000);
console.log('\n2단계 — 아껴볼 소비 목록');
say('스스로 2단계로 넘어간다', (await prog())==='40%', await prog());
say('제목이 2단계', (await title()).includes('아껴볼 수 있겠네요'), await title());
say('아껴볼 소비 4개', (await page.locator('.sv-cap em').textContent().catch(()=>'')) === '4개');
say('처음엔 3줄만', (await page.locator('.sv-row').count())===3);
say('더 보기 버튼', (await page.locator('.sv-more').textContent().catch(()=>'')).includes('1개 더 보기'));
await page.locator('.sv-more').click(); await page.waitForTimeout(400);
say('펼치면 4줄', (await page.locator('.sv-row').count())===4);
say('근거가 붙는다', (await page.locator('.sv-row .why').count())===3, '4개 중 why 없는 1개 제외');
await page.screenshot({ path:'/tmp/ob-2.png' });

await page.locator('.cta-fixed button, .cta button').click(); await page.waitForTimeout(1400);
console.log('\n3단계 — 덱');
say('진행바 60%', (await prog())==='60%', await prog());
say('제목이 3단계', (await title()).includes('포기할 수 없는 소비'), await title());
say('CTA 가 잠겨 있다', await ctaOff(), await ctaText());
say('첫 카드가 배달', (await page.locator('.dk-nm').textContent().catch(()=>''))==='배달');
say('되돌리기가 비활성', await page.locator('.dk-undo').isDisabled());
say('유령 카드 2장', (await page.locator('.dk-ghost').count())===2);
say('힌트가 뜬다', (await page.locator('.dk-hint').count())===1);
await page.screenshot({ path:'/tmp/ob-3.png' });

// 버튼으로 넘기고 되돌리고 끝까지
await page.locator('.dk-cut').click(); await page.waitForTimeout(450);
say('한 장 넘기면 다음 카드', (await page.locator('.dk-nm').textContent().catch(()=>''))==='택시');
say('CTA 라벨이 남은 수', (await ctaText()).includes('3개 선택 후 계속'), await ctaText());
say('되돌리기가 살아난다', !(await page.locator('.dk-undo').isDisabled()));
await page.locator('.dk-undo').click(); await page.waitForTimeout(350);
say('되돌리면 앞 카드로', (await page.locator('.dk-nm').textContent().catch(()=>''))==='배달');

for (const k of ['cut','keep','cut','cut']) {
  await page.locator(k==='cut'?'.dk-cut':'.dk-keep').click(); await page.waitForTimeout(450);
}
say('다 넘기면 요약', (await page.locator('.dk-done').count())===1);
const dd = (await page.locator('.dk-done').innerText()).replace(/\n/g,' / ');
say('요약이 갈라 센다', dd.includes('1개') && dd.includes('3개'), dd);
say('CTA 가 열린다', !(await ctaOff()) && (await ctaText())==='다음', await ctaText());
await page.screenshot({ path:'/tmp/ob-4.png' });

await page.locator('.cta-fixed button, .cta button').click(); await page.waitForTimeout(1500);
console.log('\n4단계 — 목표');
say('진행바 80%', (await prog())==='80%', await prog());
say('제목이 4단계', (await title()).includes('챌린지 목표를 세워봐요'), await title());
say('줄일 항목 3개', (await page.locator('.grow').count())===3);
const total = await page.locator('.gcard .amt').textContent();
say('합계가 권장액 13만', total.replace(/[^0-9]/g,'')==='130000', total);
await page.locator('.grow .stepper button').last().click(); await page.waitForTimeout(350);
say('스테퍼가 먹는다', (await page.locator('.gcard .amt').textContent()).replace(/[^0-9]/g,'')==='135000',
    await page.locator('.gcard .amt').textContent());
await page.screenshot({ path:'/tmp/ob-5.png' });

console.log('\n뒤로가기');
await page.locator('.appbar .back').click(); await page.waitForTimeout(700);
say('4→3 은 분류를 유지한 채 완료 상태', (await prog())==='60%' && (await page.locator('.dk-done').count())===1);
await page.locator('.appbar .back').click(); await page.waitForTimeout(700);
say('3→2 로 돌아간다', (await prog())==='40%', await prog());

console.log(`\nJS 오류 ${errs.length}건${errs.length?': '+errs.slice(0,3).join(' | '):''}`);
console.log(`${fail===0?'모두 통과':`실패 ${fail}건`} · ${pass}/${pass+fail}\n`);
await browser.close();
process.exit(fail?1:0);
