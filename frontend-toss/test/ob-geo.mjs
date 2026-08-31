/** 덱이 기기 크기마다 화면 안에 들어가는지 — 버튼이 CTA 밑으로 숨지 않아야 한다. */
import { chromium, devices } from 'playwright';
const ITEMS = [
  { sub:'배달', categoryCode:'식비', monthlyAmount:142960, count:12, wasteAmount:80000, suggestedCut:50000,
    why:'식비에 보통 12,000원 쓰는데 이번엔 34,000원이에요.' },
  { sub:'택시', categoryCode:'교통/자동차', monthlyAmount:125400, count:9, wasteAmount:70000, suggestedCut:35000, why:'평소보다 많이 썼어요.' },
  { sub:'커피전문점', categoryCode:'카페/간식', monthlyAmount:96400, count:21, wasteAmount:45000, suggestedCut:30000, why:null },
  { sub:'게임', categoryCode:'취미/여가', monthlyAmount:87900, count:5, wasteAmount:60000, suggestedCut:50000, why:'5건이 모두 늦은 밤에 몰렸어요.' },
];
const CATS = ITEMS.map((i) => ({ categoryCode:i.categoryCode, displayName:i.categoryCode,
  amount:i.monthlyAmount, count:i.count, wasteAmount:i.wasteAmount, protectedCategory:false, payments:[] }));

const browser = await chromium.launch();
let fail = 0;
for (const [w,h,label] of [[360,780,'신고 기기'],[393,727,'Pixel 5'],[412,915,'큰 폰'],[320,658,'작은 폰']]) {
  const ctx = await browser.newContext({ userAgent: devices['Galaxy S9+'].userAgent,
    viewport:{width:w,height:h}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route('**/api/onboarding/window**', r => r.fulfill({ status:200, contentType:'application/json',
    body: JSON.stringify({ userId:1, windowDays:30, from:'2026-08-01T00:00:00', to:'2026-08-31T00:00:00',
      categories: CATS, saveItems: ITEMS }) }));
  await page.route('**/api/**', r => r.request().url().includes('/onboarding/window') ? r.fallback()
    : r.fulfill({ status:200, contentType:'application/json', body:'{}' }));
  await page.addInitScript(() => {
    try { localStorage.setItem('mydata_onboarded','true'); localStorage.setItem('userId','1'); } catch {}
  });
  await page.goto('http://localhost:5173/#/ob');
  await page.waitForTimeout(7600);                     // 1단계 자동 진행
  await page.locator('.cta-fixed button, .cta button').click();
  await page.waitForTimeout(1500);
  const g = await page.evaluate(() => {
    const r=(s)=>{const e=document.querySelector(s); if(!e) return null;
      const b=e.getBoundingClientRect(); return [Math.round(b.top),Math.round(b.bottom),Math.round(b.height)];};
    return { sc:window.innerHeight, card:r('.dk-card'), btns:r('.dk-btns'), cta:r('.cta-fixed,.cta') };
  });
  const inView = g.btns && g.btns[1] <= g.sc;
  const aboveCta = g.btns && g.cta && g.btns[1] <= g.cta[0];
  if (!inView || !aboveCta) fail++;
  console.log(`  ${w}x${h} ${label.padEnd(7)} 카드 ${String(g.card?.[2]).padStart(3)}px · 버튼 ${g.btns?.[0]}~${g.btns?.[1]} · CTA ${g.cta?.[0]}`
    + `  ${inView?'화면안 ✔':'화면밖 ✗'} · ${aboveCta?'CTA 위 ✔':'CTA 겹침 ✗'}`);
  await ctx.close();
}
await browser.close();
console.log(fail===0 ? '\n네 크기 모두 통과\n' : `\n실패 ${fail}건\n`);
process.exit(fail?1:0);
