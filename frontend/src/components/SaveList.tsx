/**
 * 아껴볼 소비 목록 — 온보딩 2단계(프로토타입_0828 `#saves`).
 *
 * <h2>왜 처음에 셋만 보여 주나</h2>
 *
 * 원본 주석이 이유를 적어 뒀다 — <i>"목록의 역할은 「N개를 찾았다」는 사실 전달과 근거
 * 맛보기지 완독이 아니다. 3개면 CTA가 첫 화면 안에 들어와 스크롤 없이 다음으로 갈 수
 * 있다"</i>. 더 보고 싶은 사람만 펼친다.
 *
 * <p>펼칠 때 새로 들어온 줄에만 등장 연출을 붙인다(`fresh`). 전부 다시 움직이면 이미 읽던
 * 줄까지 흔들려서 어디를 보고 있었는지 잃는다.
 */
import { useState } from 'react';
import type { OnboardingSaveItem } from '../lib/api';
import { catLabel } from '../lib/api';
import { won } from '../lib/format';

/** 처음 보여 줄 줄 수. */
const INIT = 3;
/** 더 보기 한 번에 펼치는 줄 수. */
const MORE = 5;

export function SaveList({ items }: { items: OnboardingSaveItem[] }) {
  const [shown, setShown] = useState(INIT);
  /** 이번에 새로 들어온 줄의 시작 — 그 줄들만 연출한다. `null` 이면 접은 것이다. */
  const [fresh, setFresh] = useState<number | null>(null);

  const n = Math.min(shown, items.length);
  const rest = items.length - n;

  function more() {
    setFresh(n);
    setShown(Math.min(items.length, shown + MORE));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  function fold() {
    setFresh(null);
    setShown(INIT);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  return (
    <div className="saves">
      <div className="sv-cap">아껴볼 소비 <em>{items.length}개</em></div>
      <div className="sv-list">
        {items.slice(0, n).map((c, i) => (
          <div className={`sv-row${fresh != null && i >= fresh ? ' fresh' : ''}`} key={c.sub}>
            <div className="r1">
              <span className="nm">{c.sub}</span>
              {/* 소분류를 못 푼 항목은 이름이 곧 중분류다 — 같은 말을 두 번 적지 않는다. */}
              {c.sub !== c.categoryCode && (
                <span className="cat">{catLabel(c.categoryCode, c.categoryCode)}</span>
              )}
            </div>
            <div className="r2"><span>월평균</span><b>{won(c.monthlyAmount)}</b></div>
            {/* 근거는 모델이 한 말이다. 없으면 그 줄을 비운다. */}
            {c.why && <div className="why">{c.why}</div>}
          </div>
        ))}
        {rest > 0 && (
          <button type="button" className="sv-more" onClick={more}>
            <span>{rest}개 더 보기</span>
            <svg viewBox="0 0 16 16"><path d="M4 6.5 8 10.5 12 6.5" /></svg>
          </button>
        )}
        {rest === 0 && items.length > INIT && (
          <button type="button" className="sv-more" onClick={fold}>
            <span>접기</span>
            <svg viewBox="0 0 16 16" className="up"><path d="M4 6.5 8 10.5 12 6.5" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
