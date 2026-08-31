/**
 * 소비 분류 덱 — <b>포기할 수 없는 소비와 줄여볼 소비를 가른다.</b>
 *
 * 프로토타입_0828 온보딩 3단계(`#deck`)를 옮긴 것이다. 생김새(도장·유령 카드·기울기·
 * 날아가기)와 규칙(임계 78px, 최대 8도)이 원본과 같다.
 *
 * <h2>왜 버튼만으로 안 되나</h2>
 *
 * 원본 주석이 이유를 적어 뒀다 — <i>"버튼과 결과가 같다. 드래그는 방향 자체가 의미를 갖는
 * 입력이라 「왼쪽 = 지킨다 / 오른쪽 = 줄인다」를 몸으로 익히게 하는 역할"</i>. 버튼도 함께
 * 둔다 — 몸짓만 두면 손이 불편한 사람이 못 쓴다.
 *
 * <h2>고르는 단위가 소분류다</h2>
 *
 * 0825 까지는 카테고리 타일(성역)과 카테고리 카드(줄일 곳) 두 걸음이었다. 0828 은 그 둘을
 * 한 걸음으로 합치고 단위를 한 칸 내렸다. 중분류로는 "식비를 포기할 수 없다"밖에 못 말하는데,
 * 소분류면 "배달은 줄이고 한식은 둔다"를 말할 수 있다.
 *
 * <h2>고른 것이 어디로 가나</h2>
 *
 * 이 덱은 <b>결과를 서버로 보내지 않는다.</b> 온보딩이 마지막에 챌린지를 한 번 만들면서
 * 함께 보낸다 — 중간에 보내면 도중에 그만둔 사람에게 반쪽짜리 챌린지가 남는다.
 */
import { useEffect, useRef, useState } from 'react';
import type { OnboardingSaveItem } from '../lib/api';
import { catLabel } from '../lib/api';
import { won, iconOf } from '../lib/format';

/** 이 거리를 넘겨 놓으면 확정 — 원본과 같은 값이다(카드 폭의 약 1/4). */
const THRESH = 78;
/** 최대 기울기(도). */
const MAXROT = 8;
/** 첫 카드 힌트가 뜨기까지. 카드가 자리를 잡은 뒤에 떠야 읽힌다. */
const HINT_DELAY = 420;

export type Pick = 'keep' | 'cut';

const IDX_KO = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째',
  '여섯 번째', '일곱 번째', '여덟 번째', '아홉 번째', '열 번째'];

const ARROW_L = <svg viewBox="0 0 16 16"><path d="M13 8H3" /><path d="M7 12.5 2.5 8 7 3.5" /></svg>;
const ARROW_R = <svg viewBox="0 0 16 16"><path d="M3 8h10" /><path d="M9 3.5 13.5 8 9 12.5" /></svg>;
const UNDO = <svg viewBox="0 0 14 14"><path d="M2 7a5 5 0 1 0 1.7-3.75" /><path d="M2 2.2V5.4h3.2" /></svg>;

export function SaveDeck({ items, picks, onPick, onUndo }: {
  items: OnboardingSaveItem[];
  /** 지금까지 고른 것. 길이가 곧 몇 장을 봤는가다 — 이 덱은 상태를 갖지 않는다. */
  picks: Pick[];
  onPick: (kind: Pick) => void;
  onUndo: () => void;
}) {
  const idx = picks.length;
  /** 한 번 넘기면 힌트를 다시 띄우지 않는다. 되돌아와도 마찬가지다. */
  const [hintDone, setHintDone] = useState(false);
  const [hintIn, setHintIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flying, setFlying] = useState<Pick | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLSpanElement>(null);
  const cutRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ id: number | null; x0: number; dx: number; moved: boolean }>(
    { id: null, x0: 0, dx: 0, moved: false });

  const card = items[idx];
  const left = items.length - idx;
  const showHint = idx === 0 && !hintDone;

  /** 힌트는 카드가 놓인 뒤에 뜬다 — 같이 뜨면 카드에 묻힌다. */
  useEffect(() => {
    if (!showHint) { setHintIn(false); return; }
    const t = window.setTimeout(() => setHintIn(true), HINT_DELAY);
    return () => window.clearTimeout(t);
  }, [showHint]);

  function commit(kind: Pick) {
    setHintDone(true);
    setHintIn(false);
    onPick(kind);
  }

  /** 버튼으로 고르기 — 결과는 드래그와 같고, 카드가 그쪽으로 빠진다. */
  function tap(kind: Pick) {
    if (busy) return;
    setBusy(true);
    setFlying(kind);
    // 누른 버튼에 초점이 남으면 브라우저가 다음 카드에서 그 자리를 다시 비춘다.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(() => { setFlying(null); setBusy(false); commit(kind); }, 220);
  }

  function paint() {
    const el = cardRef.current;
    if (!el) return;
    const { dx } = drag.current;
    const r = Math.max(-1, Math.min(1, dx / THRESH));
    el.style.transform = `translateX(${dx}px) rotate(${r * MAXROT}deg)`;
    if (keepRef.current) keepRef.current.style.opacity = String(dx < 0 ? Math.min(1, -dx / THRESH) : 0);
    if (cutRef.current) cutRef.current.style.opacity = String(dx > 0 ? Math.min(1, dx / THRESH) : 0);
    const over = Math.abs(dx) >= THRESH;
    el.classList.toggle('will', over);
    el.classList.toggle('will-keep', over && dx < 0);
    el.classList.toggle('will-cut', over && dx > 0);
  }

  function clearPaint() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = '';
    if (keepRef.current) keepRef.current.style.opacity = '0';
    if (cutRef.current) cutRef.current.style.opacity = '0';
    el.classList.remove('will', 'will-keep', 'will-cut');
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (busy || drag.current.id !== null) return;
    drag.current = { id: e.pointerId, x0: e.clientX, dx: 0, moved: false };
    cardRef.current?.setPointerCapture(e.pointerId);
    cardRef.current?.classList.add('drag');
    setHintDone(true);
    setHintIn(false);
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== drag.current.id) return;
    drag.current.dx = e.clientX - drag.current.x0;
    if (Math.abs(drag.current.dx) > 3) drag.current.moved = true;
    paint();
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== drag.current.id) return;
    const el = cardRef.current;
    el?.classList.remove('drag');
    try { el?.releasePointerCapture(e.pointerId); } catch { /* 이미 놓였다 */ }
    const { dx, moved } = drag.current;
    drag.current.id = null;
    if (!moved) { clearPaint(); return; }
    if (Math.abs(dx) >= THRESH && el) {
      // 놓은 자리에서 이어서 날아간다 — 손을 뗀 지점부터 움직여야 이어진 동작으로 보인다.
      const kind: Pick = dx > 0 ? 'cut' : 'keep';
      setBusy(true);
      const dir = kind === 'cut' ? 1 : -1;
      el.style.transition = 'transform .26s cubic-bezier(.2,.8,.2,1), opacity .26s linear';
      el.style.transform = `translateX(${dir * (el.offsetWidth + 140)}px) rotate(${dir * 14}deg)`;
      el.style.opacity = '0';
      window.setTimeout(() => { setBusy(false); commit(kind); }, 240);
      return;
    }
    // 임계값 미달 — 튕김 없이 제자리로.
    el?.classList.add('snap');
    clearPaint();
    window.setTimeout(() => el?.classList.remove('snap'), 300);
  }

  const head = (
    <div className="dk-head">
      <span className="idx">
        {card ? <><em>{IDX_KO[idx] ?? `${idx + 1}번째`}</em> 소비</> : '분류를 마쳤어요'}
      </span>
      <button type="button" className="dk-undo" onClick={onUndo} disabled={idx === 0 || busy}>
        {UNDO}이전 선택
      </button>
    </div>
  );

  if (!card) {
    const cut = items.filter((_, i) => picks[i] === 'cut');
    const sum = cut.reduce((s, c) => s + c.suggestedCut, 0);
    return (
      <div className="deck">
        {head}
        <div className="dk-stack">
          <div className="dk-done">
            <div className="dd-row">
              <span className="k">포기할 수 없는 소비</span>
              <span className="v">{picks.length - cut.length}개</span>
            </div>
            <div className="dd-row cut">
              <span className="k">줄여볼 소비</span>
              <span className="v">{cut.length}개 · 월 {won(sum)}</span>
            </div>
            <div className="dd-note">
              포기할 수 없다고 고른 소비는<br />챌린지 계산에서 완전히 빠져요
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { icon, bg } = iconOf(card.categoryCode);

  return (
    <div className="deck">
      {head}

      <div className="dk-stack">
        {/* 뒤에 겹친 카드 — 남은 장수를 몸으로 알린다. */}
        {left > 2 && <div className="dk-ghost g2" />}
        {left > 1 && <div className="dk-ghost g1" />}

        <div
          ref={cardRef}
          key={card.sub}
          className={`dk-card${flying === 'keep' ? ' out-keep' : ''}${flying === 'cut' ? ' out-cut' : ''}`
            + `${showHint ? ' nudge' : ''}`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <span className="dk-stamp keep" ref={keepRef}>포기할 수 없어요</span>
          <span className="dk-stamp cut" ref={cutRef}>줄여볼래요</span>
          {showHint && <div className={`dk-hint${hintIn ? ' in' : ''}`}>카드를 좌우로 넘겨 선택해요</div>}

          <div className="dk-meta">
            {/* 소분류를 못 푼 항목은 이름이 곧 중분류다 — 같은 말을 두 번 적지 않는다. */}
            {card.sub !== card.categoryCode && (
              <span className="tg" style={{ background: bg }}>{catLabel(card.categoryCode, card.categoryCode)}</span>
            )}
            <span className="tg time">{card.count}번 결제</span>
            <span className="dk-ic" style={{ background: bg }}><svg><use href={`#${icon}`} /></svg></span>
          </div>
          <div className="dk-nm">{card.sub}</div>
          <div className="dk-spacer" />
          <div className="dk-avg"><span>월평균</span><b>{won(card.monthlyAmount)}</b></div>
          {/* 근거는 모델이 한 말이다. 없으면 비운다 — 지어내면 그건 판정이 아니다. */}
          {card.why && <div className="dk-why">{card.why}</div>}
        </div>
      </div>

      <div className="dk-btns">
        <button type="button" className="dk-keep" onClick={() => tap('keep')}>{ARROW_L}포기할 수 없어요</button>
        <button type="button" className="dk-cut" onClick={() => tap('cut')}>줄여볼래요{ARROW_R}</button>
      </div>
    </div>
  );
}
