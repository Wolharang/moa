/**
 * 결제 한 건에 답을 붙이는 칩 (프로토타입_0828 `.ctx3`).
 *
 * <pre>
 *   [ 필요했어요 ] [ 새는 돈이었어요 ]      ← 아직 안 붙인 결제 아래
 *        ↓ 누름
 *   이름 옆에 작은 딱지 · 칩 줄은 접힌다     ← 딱지를 누르면 다시 열린다
 * </pre>
 *
 * <h2>왜 누르면 접히나</h2>
 *
 * 답한 줄과 안 한 줄이 같은 높이로 남아 있으면 <b>어디까지 했는지</b>가 안 보인다. 접으면
 * 남은 것만 눈에 띄어 목록이 스스로 줄어든다. 원본이 `fold` 로 하는 일이 그것이다.
 *
 * <p>딱지를 눌러 다시 열 수 있게 두는 것이 짝이다 — 되돌릴 길이 없으면 사람은 애초에
 * 안 누른다.
 *
 * <h2>판정을 바꾸지 않는다</h2>
 *
 * 여기서 고른 것은 <b>사람이 말한 것</b>이고 낭비 판정은 EBM 이 한다(원칙 1). 둘이 어긋나는
 * 것은 고칠 오류가 아니라 리포트가 보여 줄 정보다.
 */
import { useState } from 'react';

export type Verdict = 'WASTE' | 'FINE';

/** 눌러서 접히기까지. 고른 것이 잠깐 보여야 "눌렸다"가 전달된다(원본과 같은 값). */
const FOLD_MS = 250;

export function VerdictChips({ value, onPick }: {
  /** 이미 붙인 답. 없으면 칩 두 개가 펼쳐져 있다. */
  value?: Verdict;
  onPick: (v: Verdict) => void;
}) {
  /** 방금 누른 것 — 접히는 동안 그 칩만 짙게 둔다. */
  const [picked, setPicked] = useState<Verdict | null>(null);
  const [folding, setFolding] = useState(false);
  /** 딱지를 눌러 다시 연 상태. */
  const [reopened, setReopened] = useState(false);

  const done = value != null && !reopened;

  function pick(v: Verdict) {
    if (folding) return;              // 접히는 중 중복 탭 방지(원본 `fold` 검사와 같다)
    setPicked(v);
    setFolding(true);
    onPick(v);
    window.setTimeout(() => { setFolding(false); setPicked(null); setReopened(false); }, FOLD_MS + 60);
  }

  if (done) {
    return (
      <button type="button" className="sp-tag tag-ctx"
        onClick={(e) => { e.stopPropagation(); setReopened(true); }}>
        {value === 'WASTE' ? '새는 돈이었어요' : '필요했어요'}
      </button>
    );
  }

  return (
    <div className={`ctx3${folding ? ' fold' : ''}`}>
      <button type="button" className={picked === 'FINE' ? 'on' : undefined}
        onClick={(e) => { e.stopPropagation(); pick('FINE'); }}>필요했어요</button>
      <button type="button" className={picked === 'WASTE' ? 'on' : undefined}
        onClick={(e) => { e.stopPropagation(); pick('WASTE'); }}>새는 돈이었어요</button>
    </div>
  );
}
