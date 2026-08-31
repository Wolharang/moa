/**
 * 온보딩 완료 (프로토타입_0828 `s-obdone`).
 *
 * <p><b>0818 개편으로 조용해졌다.</b> 예전에는 지킴이 오브·목표 금액·자동 이동 카운트다운이
 * 함께 있었다. 지금은 <b>체크 하나와 두 줄</b>이다 — 방금 걸음을 밟고 온 사람에게 읽을 것을
 * 더 주는 대신 "끝났다"만 분명히 말한다.
 *
 * <p>연출은 세 박자다: 원이 튀어 오르고(.5초, 살짝 넘겼다 돌아오는 곡선) → 체크가 그려지고
 * (.35초) → 글이 차례로 떠오른다(.35초·.5초 지연). <b>순서가 곧 문장</b>이라 한꺼번에
 * 띄우지 않는다.
 *
 * <h2>0828 이 되돌린 것 — 자동 전환</h2>
 *
 * 0818 은 버튼('홈으로 가기')만 두고 자동 이동을 없앴다. 0828 은 <b>버튼을 빼고 자동 전환을
 * 되살렸다</b> — 아래에 1.5초짜리 진행선이 차고, 다 차면 홈으로 간다. 아무 데나 누르면 곧바로
 * 넘어간다. 축하는 읽을 것이 아니라 스쳐 지나가는 것이라는 판단이다.
 *
 * <p><b>움직임을 줄여 달라고 한 사람에게는 자동 전환을 걸지 않는다.</b> 2.5초는 조절할 수
 * 없는 시간 제한이라 그대로 두면 KWCAG 2.2 '응답시간 조절'과 어긋난다. 그 설정을 켠 기기에서는
 * 진행선도 멈추고, 화면을 눌러야 넘어간다 — 남는 것은 사람이 정하는 길 하나다.
 */
import { useEffect, useState } from 'react';
import { Screen } from '../components/ui';
import { useSession } from '../state/session';

/** 체크(0.5s) + 문구(0.9s) + 진행선(1.5s). 원본과 같은 값이다. */
const AUTO_MS = 2500;

export function Done() {
  const { replace } = useSession();
  /** 마운트 직후 한 박자 뒤에 연출을 켠다 — 첫 페인트에 이미 켜져 있으면 전환이 안 보인다. */
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (calm) return;
    const t = window.setTimeout(() => replace('home'), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [replace]);

  return (
    <Screen id="obdone" title="첫 챌린지가 시작됐어요">
      {/*
        화면 전체가 버튼이다(원본 `onclick="obDoneGo()"`). 눈에 보이는 버튼이 없으므로
        키보드·스크린리더에게는 <b>역할과 이름을 말로 준다</b> — 안 그러면 초점이 닿지 않아
        마우스 없이는 넘어갈 방법이 자동 전환뿐이 된다.
      */}
      <div className="scroll od-tap" role="button" tabIndex={0}
        aria-label="홈으로 가기"
        onClick={() => replace('home')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') replace('home'); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className={`od-wrap${shown ? ' in' : ''}`}>
          <div className="od-check" aria-hidden="true">
            <svg viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="44" fill="var(--blue)" />
              {/* 획 길이만큼 점선 간격을 주고 오프셋을 0으로 옮겨 '그려지는' 것처럼 보이게 한다. */}
              <path className="tick" d="M30 49 L43 62 L67 37" stroke="#fff" strokeWidth="7"
                fill="none" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="60" strokeDashoffset="60" />
            </svg>
          </div>
          <h3>첫 챌린지가 시작됐어요</h3>
          <p>지킴이와 하루씩 지켜가요</p>
        </div>
      </div>
      {/* 남은 시간을 눈에 보이게 한다 — 갑자기 넘어가면 무슨 일이 일어났는지 모른다. */}
      <div className={`od-line${shown ? ' run' : ''}`} aria-hidden="true"><i /></div>
    </Screen>
  );
}
