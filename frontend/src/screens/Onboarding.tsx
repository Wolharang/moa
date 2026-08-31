/**
 * 이번 챌린지 정하기 — <b>화면 하나에서 네 걸음</b> (프로토타입_0828 `s-ob`).
 *
 * <p><b>0818 개편의 가장 큰 변화</b>는 화면 넷(ob1~ob4)을 하나로 합친 것이었다. 사람은 화면이
 * 바뀔 때마다 "여기가 어디였지"를 다시 세우고, 뒤로 가면 앞 화면의 선택이 살아 있는지 확신하지
 * 못한다. 지금은 <b>한 화면에서 말풍선이 쌓이고 무대만 바뀐다</b>.
 *
 * <p><b>0828 은 걸음을 다섯에서 넷으로 줄였다.</b> 성역 고르기(타일)와 줄일 곳 고르기(카드)가
 * 각각 한 걸음이었는데, 둘 다 "이 소비를 어떻게 할까"를 묻는 같은 질문이었다. 카드를 좌우로
 * 넘기는 <b>덱 하나</b>로 합쳤다 — 왼쪽이 포기할 수 없는 것, 오른쪽이 줄여볼 것이다.
 *
 * <pre>
 *   1  지난 소비를 분석했어요        막대가 그려진다        (자동으로 2로)
 *   2  아껴볼 수 있겠네요            찾은 항목 목록
 *   3  포기할 수 없는 소비와…        덱 = 좌우로 넘겨 가른다
 *   4  챌린지 목표를 세워봐요        슬라이더 + 항목별 스테퍼
 * </pre>
 *
 * <p><b>고르는 단위가 소분류로 내려갔다</b>(0828). 중분류(`식비`)로는 "밥을 포기할 수 없다"
 * 밖에 못 말한다. 소분류(`배달`·`한식`)면 "배달은 줄이고 한식은 둔다"를 말할 수 있다.
 * 소분류는 정확히 한 중분류에만 속하므로, 챌린지로 넘길 때 중분류가 정확히 되돌아온다 —
 * 지킴이 도메인은 중분류 단위 그대로 두고 고르는 화면만 한 칸 내려간다.
 *
 * <p><b>왜 1단계만 자동으로 넘어가나.</b> 1은 <b>사람이 고를 것이 없는 브리핑</b>이라 버튼을
 * 두면 "읽었다"는 확인만 받는 셈이다. 2부터는 고를 것이 생기므로 버튼이 필요하다.
 * 뒤로 와서 앞 걸음을 다시 볼 때는 <b>재생하지 않고 결과 상태로 세운다</b> —
 * 이미 본 연출이 다시 도는 것은 기다림이지 안내가 아니다.
 *
 * <p><b>숫자는 실제 데이터다.</b> 프로토타입은 하드코딩된 값으로 그림을 보였지만, 여기서는
 * `/api/onboarding/window` 가 준 <b>최근 창의 실측</b>을 같은 모양으로 그린다. 색은
 * 리포트 도넛과 같은 팔레트를 쓴다 — 온보딩에서 배운 색이 리포트에서 이어져야
 * 카테고리를 색으로 읽을 수 있다.
 *
 * <p><b>결제별 '이건 낭비가 아니에요'는 이 화면에 없다</b>(0818 디자인). 그 기능은 사라진
 * 것이 아니라 <b>챌린지 관리</b>(`m-challenge`)로 옮겼다 — 온보딩은 처음 한 번이고, 판정을
 * 다듬는 일은 지내면서 하는 일이라 그쪽이 제자리다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cta, Screen, ErrorBox } from '../components/ui';
import { SaveDeck, type Pick } from '../components/SaveDeck';
import { SaveList } from '../components/SaveList';
import { useSession } from '../state/session';
import { useGuardian } from '../state/guardian';
import { useAsync } from '../state/useAsync';
import { ApiError, api, catLabel, isUnknownCategory } from '../lib/api';
import { CHALLENGE_DAYS } from '../lib/config';
import { won, iconOf } from '../lib/format';

/* ── 프로토타입이 정한 값들 ────────────────────────────────────────────── */

/** 제목이 한 글자씩 떠오르는 간격과 줄 간격(ms). 0828 에서 40/400 → 30/260 으로 빨라졌다. */
const CHAR_STEP = 30;
const LINE_STEP = 260;

/** 걸음별 진행바(0-based 자리채움 + 1~4단계). 숫자를 쓰지 않고 막대로만 안내한다. */
const PROGRESS = ['20%', '20%', '40%', '60%', '80%'];

/**
 * 막대 색 — 리포트 도넛과 <b>같은 팔레트</b>. 진한 색은 카테고리 본색이고
 * 연한 색은 절감분을 보일 때 뒤로 물러나는 톤이다.
 */
const CHART_BASE: Record<string, string> = {
  food: '#F08812', cafe: '#8B5CF6', taxi: '#3671E9',
  cvs: '#34C38F', shop: '#E85D9F', ott: '#8C97A3',
};
const CHART_SOFT: Record<string, string> = {
  food: '#EDD9C2', cafe: '#D8CBF7', taxi: '#C2D0ED',
  cvs: '#C6E7D9', shop: '#F2CFE0', ott: '#D8DCE1',
};
/** 팔레트에 없는 카테고리가 나와도 색이 비지 않게. */
const CHART_FALLBACK = ['#4EC3A8', '#4795EB', '#6C7CE0', '#A78BE0', '#E570B5'];

/**
 * 본색을 흰색과 섞어 <b>물러난 톤</b>을 만든다.
 *
 * 2단계에서 카테고리는 연해지고 절감분만 본색으로 차오르는데, 팔레트에 없는 카테고리는
 * 연한 색도 없어 본색 그대로였다 — 그러면 <b>차오르는 것이 안 보인다</b>(2026-08-20 화면 실측).
 * 디자인이 정한 연한 값들과 같은 정도(흰색 65%)로 섞는다.
 */
function soften(hex: string): string {
  const v = hex.replace('#', '');
  const mix = (i: number) => Math.round(parseInt(v.slice(i, i + 2), 16) * 0.35 + 255 * 0.65);
  return `rgb(${mix(0)}, ${mix(2)}, ${mix(4)})`;
}

/** 카테고리 이름 → 팔레트 열쇠. 이름을 코드에 박지 않으려고 포함 관계로 본다(원칙 4). */
function paletteKey(name: string): string | null {
  if (name.includes('식비') || name.includes('배달')) return 'food';
  if (name.includes('카페') || name.includes('간식')) return 'cafe';
  if (name.includes('교통') || name.includes('자동차')) return 'taxi';
  if (name.includes('편의점') || name.includes('잡화')) return 'cvs';
  if (name.includes('쇼핑')) return 'shop';
  if (name.includes('기타')) return 'ott';
  return null;
}

/** 막대에 세울 칸 수. 그보다 잘게 쪼개면 색을 못 알아본다 — 나머지는 '기타'로 묶는다. */
const BAR_SLOTS = 5;
/** 목표 슬라이더 범위(추천액 대비 %). */
const GOAL_MIN = 50;
const GOAL_MAX = 150;
/** 스테퍼 한 칸. */
const GOAL_STEP = 5000;

const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtMan = (v: number) => {
  const m = v / 10000;
  return `${m % 1 ? m.toFixed(1) : m}만`;
};

/** 한 걸음의 말풍선. `pre`=아직 안 옴 · `live`=지금 · `out`=지나간 것(접힘). */
type MsgState = 'pre' | 'live' | 'out';

/** 제목을 글자마다 쪼개 순서대로 떠오르게 한다(프로토타입 `prepTitle`). */
function Title({ lines, on }: { lines: string[]; on: boolean }) {
  return (
    <div className={`h-title${on ? ' txt-in' : ''}`}>
      {lines.map((line, li) => {
        let ci = 0;
        return (
          <span key={li}>
            {li > 0 && <br />}
            {[...line].map((ch, k) => (ch === ' ' ? ' ' : (
              <span className="ch" key={k}
                style={{ transitionDelay: `${li * LINE_STEP + (ci++) * CHAR_STEP}ms` }}>{ch}</span>
            )))}
          </span>
        );
      })}
    </div>
  );
}

/** 그 제목이 다 떠오르는 데 걸리는 시간(ms) — 다음 연출이 언제 시작할지의 근거다. */
const titleDur = (lines: string[]) =>
  (lines.length - 1) * LINE_STEP
  + [...lines[lines.length - 1]].filter((c) => c !== ' ').length * CHAR_STEP + 300;

const MSGS: { title: string[]; sub?: string }[] = [
  { title: ['지난 소비를 분석했어요', '평균 소비 상위 카테고리예요'] },
  { title: ['이런 것들을', '아껴볼 수 있겠네요!'] },
  { title: ['포기할 수 없는 소비와', '줄여볼 소비를 나눠주세요'] },
  { title: ['지킴이와 함께', '챌린지 목표를 세워봐요'], sub: '무리한 목표보다 지킬 수 있는 목표가 좋아요' },
];

export function Onboarding() {
  const { go, replace, userId, analysis, draft, patchDraft } = useSession();
  const { reload } = useGuardian();

  /** 지금 몇 번째 걸음인가(1~5). */
  const [phase, setPhase] = useState(1);
  /** 위에 접혀 있는 한 줄 요약 — 지나온 걸음이 무엇이었는지 남긴다. */
  const [caption, setCaption] = useState('');
  /** 연출 진행 표시. 되돌아온 걸음은 연출 없이 결과 상태로 세운다. */
  const [barDrawn, setBarDrawn] = useState(false);
  const [barCuts, setBarCuts] = useState(false);
  const [heroIn, setHeroIn] = useState(false);
  const [legendIn, setLegendIn] = useState(false);
  const [stageIn, setStageIn] = useState(false);
  const [ctaIn, setCtaIn] = useState(false);
  const [titleOn, setTitleOn] = useState<Record<number, boolean>>({});
  const [subOn, setSubOn] = useState<Record<number, boolean>>({});
  /** 막대를 눌렀을 때 뜨는 금액 칩. */
  const [chip, setChip] = useState<{ i: number; text: string; color: string; left: number } | null>(null);
  /** 그 칸만 본색으로 되살릴 대상. */
  const [litSeg, setLitSeg] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const timers = useRef<number[]>([]);
  const chipTimer = useRef<number | undefined>(undefined);
  const clearSeq = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    window.clearTimeout(chipTimer.current);
  }, []);

  /* ── 재료 ─────────────────────────────────────────────────────────── */

  const win = useAsync(() => api.onboardingWindow(userId), [userId]);

  /** 창 안의 카테고리 — 쓴 금액 순. **모르는 칸은 고를 대상이 아니다**({@link isUnknownCategory}). */
  const rows = useMemo(() => (win.data?.categories ?? [])
    .filter((c) => !isUnknownCategory(c.categoryCode))
    .slice().sort((a, b) => b.amount - a.amount), [win.data]);

  /** 한 달 평균 총액 — 히어로의 첫 숫자다. */
  const spendTotal = useMemo(() => rows.reduce((s, c) => s + c.amount, 0), [rows]);

  /**
   * 'AI 추천' — <b>ML 낭비 금액</b>이 큰 둘. 재량성이 낮다고 서버가 표시한 곳은 뺀다.
   * 배지가 순서까지 정하면 추천이 강요가 되므로 <b>표시 순서는 쓴 금액 순</b>으로 둔다.
   */
  const recommended = useMemo(() => new Set(rows
    .filter((c) => !c.protectedCategory && c.wasteAmount > 0)
    .sort((a, b) => b.wasteAmount - a.wasteAmount)
    .slice(0, 2).map((c) => c.categoryCode)), [rows]);

  /** 그 카테고리에서 권하는 절감액 — ML 낭비 금액이 있으면 그것, 없으면 쓴 돈의 15%. */
  const cutOf = useCallback((c: { amount: number; wasteAmount: number; protectedCategory: boolean }) => {
    if (c.protectedCategory) return 0;
    const raw = c.wasteAmount > 0 ? c.wasteAmount : c.amount * 0.15;
    return Math.max(GOAL_STEP, Math.round(raw / GOAL_STEP) * GOAL_STEP);
  }, []);

  /**
   * 막대에 세울 칸 — 상위 넷 + 나머지를 묶은 '기타'.
   *
   * 다섯을 넘기면 칸이 얇아져 색을 못 알아보고, 범례도 화면을 넘긴다.
   */
  const segs = useMemo(() => {
    if (rows.length === 0) return [];
    const head = rows.slice(0, BAR_SLOTS - 1);
    const tail = rows.slice(BAR_SLOTS - 1);
    const items = head.map((c) => ({
      name: catLabel(c.categoryCode, c.displayName),
      amount: c.amount,
      cut: cutOf(c),
    }));
    if (tail.length > 0) {
      items.push({
        name: '기타',
        amount: tail.reduce((s, c) => s + c.amount, 0),
        cut: tail.reduce((s, c) => s + cutOf(c), 0),
      });
    }
    const sum = items.reduce((s, x) => s + x.amount, 0) || 1;
    return items.map((x, i) => {
      const key = paletteKey(x.name);
      return {
        ...x,
        pct: (x.amount / sum) * 100,
        base: key ? CHART_BASE[key] : CHART_FALLBACK[i % CHART_FALLBACK.length],
        soft: key ? CHART_SOFT[key] : soften(CHART_FALLBACK[i % CHART_FALLBACK.length]),
      };
    });
  }, [rows, cutOf]);

  /**
   * 2·3단계가 다루는 항목 — <b>소분류</b>다. 서버가 골라 낭비 금액 순으로 준다.
   *
   * <p>여기서 다시 거르거나 정렬하지 않는다. 고르는 규칙은 서버 한 곳에 있고
   * (`SaveItemSelector`), 화면이 같은 일을 또 하면 두 곳이 갈린다(원칙 2).
   */
  const saveItems = useMemo(() => win.data?.saveItems ?? [], [win.data]);

  /** 덱에서 고른 것. `picks[i]` 가 `saveItems[i]` 의 답이다. */
  const [picks, setPicks] = useState<Pick[]>([]);

  /** 4단계에서 손대는 항목 — 덱에서 '줄여볼래요' 로 간 것만. */
  const goalItems = useMemo(() => saveItems
    .filter((_, i) => picks[i] === 'cut')
    .map((c) => ({
      /** 목표를 다루는 키는 소분류다 — 같은 중분류 안에서도 따로 정할 수 있어야 한다. */
      key: c.sub,
      code: c.categoryCode,
      name: c.sub,
      amount: c.monthlyAmount,
      cut: c.suggestedCut,
    })), [saveItems, picks]);

  const [goalVals, setGoalVals] = useState<Record<string, number>>({});
  const [slider, setSlider] = useState(100);
  const recSum = useMemo(() => goalItems.reduce((s, c) => s + c.cut, 0), [goalItems]);
  const goalTotal = useMemo(
    () => goalItems.reduce((s, c) => s + (goalVals[c.key] ?? c.cut), 0), [goalItems, goalVals]);

  /* ── 재료가 오면 담아 둔다(다른 화면이 쓴다) ───────────────────────── */
  const stored = useRef(false);
  useEffect(() => {
    if (stored.current || rows.length === 0) return;
    stored.current = true;
    const baseline: typeof draft.baseline = {};
    for (const c of rows) {
      baseline[c.categoryCode] = {
        displayName: catLabel(c.categoryCode, c.displayName),
        monthlyAmount: c.amount,
        wasteAmount: c.wasteAmount,
        payments: c.payments,
        type: recommended.has(c.categoryCode) ? 'RECOMMENDED' : 'OTHER',
      };
    }
    patchDraft({ baseline });
    // 창이 오면 한 번이면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /*
   * <b>미리 골라 두지 않는다</b>(0828). 0825 까지는 'AI 추천' 항목을 켠 채로 보여 줬는데,
   * 그건 사용자의 답이 아니라 우리의 답이었다. 덱은 한 장씩 사람이 답하는 자리라
   * 처음부터 비어 있어야 한다.
   */

  /* ── 걸음 사이 연출 ───────────────────────────────────────────────── */

  const showTitle = useCallback((n: number, delay: number) => {
    const m = MSGS[n - 1];
    at(delay, () => setTitleOn((p) => ({ ...p, [n]: true })));
    const d = titleDur(m.title);
    if (m.sub) at(delay + d - 200, () => setSubOn((p) => ({ ...p, [n]: true })));
    return delay + d;
  }, [at]);

  /** 1단계 — 사람이 고를 것이 없는 브리핑이라 끝나면 스스로 2로 넘어간다. */
  const playP1 = useCallback(() => {
    clearSeq();
    setPhase(1); setCaption('');
    setTitleOn({}); setSubOn({});
    setBarDrawn(false); setBarCuts(false); setHeroIn(false);
    setLegendIn(false); setStageIn(false); setCtaIn(false); setChip(null);
    const end = showTitle(1, 200);
    at(end - 100, () => setHeroIn(true));
    at(end + 100, () => setBarDrawn(true));
    at(end + 400, () => setLegendIn(true));
    at(end + 100 + 900 + 3000, () => toP2());
    // toP2 는 아래에서 정의된다 — 서로를 부르므로 의존 목록에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSeq, showTitle, at]);

  /**
   * 2단계 — 아껴볼 소비 목록.
   *
   * <p><b>막대에 절감분이 차오르는 연출은 0828 에서 없어졌다.</b> 원본에도 `showCuts()` 가
   * 정의만 남고 부르는 곳이 없다 — 이 걸음이 막대 채우기에서 목록으로 바뀌었기 때문이다.
   * 막대는 그대로 물러나고(`exit`), 자리를 목록에 넘긴다.
   */
  const toP2 = useCallback(() => {
    clearSeq(); setPhase(2);
    setCaption('지난 소비를 분석했어요');
    setCtaIn(false); setChip(null); setStageIn(false);
    showTitle(2, 350);
    at(500, () => setStageIn(true));
    at(900, () => setCtaIn(true));
  }, [clearSeq, showTitle, at]);

  /** 되돌아온 2단계 — 이미 본 연출이라 <b>재생하지 않고</b> 결과 상태로 세운다. */
  const stillP2 = useCallback(() => {
    clearSeq(); setPhase(2);
    setCaption('지난 소비를 분석했어요');
    setTitleOn({ 1: true, 2: true }); setSubOn({});
    setBarDrawn(true); setHeroIn(true);
    setLegendIn(true); setStageIn(true); setCtaIn(true); setChip(null);
  }, [clearSeq]);

  /**
   * 3단계 — 덱. <b>캡션을 접는다</b>(프로토타입: 이 걸음에는 캡션 줄이 없다).
   * 카드가 화면을 거의 채우므로 위에 한 줄이라도 더 있으면 버튼이 밀려 내려간다.
   */
  const toP3 = useCallback((instant?: boolean) => {
    clearSeq(); setPhase(3);
    setCaption('');
    setStageIn(false); setChip(null);
    showTitle(3, instant ? 200 : 350);
    at(instant ? 300 : 500, () => setStageIn(true));
    at(instant ? 400 : 700, () => setCtaIn(true));
  }, [clearSeq, showTitle, at]);

  const toP4 = useCallback((instant?: boolean) => {
    clearSeq(); setPhase(4);
    const n = picks.filter((p) => p === 'cut').length;
    setCaption(`줄일 항목 ${n}개를 골랐어요`);
    setStageIn(false); setChip(null);
    // 슬라이더는 추천액 100% 에서 시작한다.
    setGoalVals(Object.fromEntries(goalItems.map((c) => [c.key, c.cut])));
    setSlider(100);
    showTitle(4, instant ? 200 : 350);
    at(instant ? 300 : 500, () => setStageIn(true));
    at(instant ? 400 : 700, () => setCtaIn(true));
  }, [clearSeq, showTitle, at, picks, goalItems]);

  /** 재료가 오면 1단계를 시작한다. 데이터 없이 그리면 빈 막대가 먼저 보인다. */
  const started = useRef(false);
  useEffect(() => {
    if (started.current || segs.length === 0) return;
    started.current = true;
    playP1();
  }, [segs.length, playP1]);

  /**
   * 뒤로 — 앞 걸음은 <b>연출 없이</b> 결과 상태로 세운다.
   *
   * <p>1·2단계로는 돌아가되 1로는 안 간다. 1은 고를 것이 없는 브리핑이라 되돌아갈 결정이
   * 없고, 되돌아가면 자동으로 다시 2로 넘어와 제자리걸음이 된다.
   *
   * <p><b>덱에서 고른 것은 지우지 않는다.</b> 4단계에서 3으로 돌아오면 이미 분류를 마친
   * 상태로 보이고, 되돌리기 버튼으로 한 장씩 물릴 수 있다.
   */
  function goBack() {
    if (phase === 4) toP3(true);
    else if (phase === 3) stillP2();
  }

  /* ── 고르기 ───────────────────────────────────────────────────────── */

  /** 덱에서 한 장 고름. 카드 순서와 답의 순서가 같아야 하므로 <b>끝에 붙인다</b>. */
  const pick = useCallback((kind: Pick) => setPicks((p) => [...p, kind]), []);
  /** 되돌리기 — 마지막 한 장을 물린다. */
  const undo = useCallback(() => setPicks((p) => p.slice(0, -1)), []);

  /** 막대 한 칸을 누르면 그 칸만 본색으로 살아나고 금액 칩이 뜬다. */
  function tapSeg(i: number) {
    if (!barDrawn) return;
    window.clearTimeout(chipTimer.current);
    const s = segs[i];
    const left = segs.slice(0, i).reduce((a, x) => a + x.pct, 0) + s.pct / 2;
    setLitSeg(barCuts ? i : null);
    setChip({ i, left, color: s.base, text: barCuts ? `-${fmt(s.cut)}원` : `${fmt(s.amount)}원` });
    chipTimer.current = window.setTimeout(() => { setChip(null); setLitSeg(null); }, 2200);
  }

  /** 슬라이더 — 추천액에 비례해 다시 나눈다(5천원 단위). */
  function onSlider(v: number) {
    setSlider(v);
    setGoalVals(Object.fromEntries(goalItems.map((c) =>
      [c.key, Math.max(GOAL_STEP, Math.round(c.cut * v / 100 / GOAL_STEP) * GOAL_STEP)])));
  }
  /** 스테퍼 — 한 칸 올리고 내린다. 슬라이더 위치도 따라 움직인다. */
  function stepVal(key: string, delta: number) {
    const item = goalItems.find((c) => c.key === key);
    if (!item) return;
    const next = { ...goalVals };
    next[key] = Math.min(item.amount, Math.max(GOAL_STEP, (goalVals[key] ?? item.cut) + delta));
    setGoalVals(next);
    const sum = goalItems.reduce((s, c) => s + (next[c.key] ?? c.cut), 0);
    if (recSum > 0) setSlider(Math.max(GOAL_MIN, Math.min(GOAL_MAX, Math.round(sum / recSum * 100))));
  }

  /* ── 마무리 ───────────────────────────────────────────────────────── */

  /**
   * 소분류로 고른 것을 <b>중분류로 접어</b> 챌린지를 만든다.
   *
   * <p>지킴이는 중분류 단위다 — 예산도 정산도 카테고리로 센다. 소분류는 정확히 한 중분류에만
   * 속하므로 접기가 손실 없이 된다. 프로토타입도 같은 일을 표(`OB_KEY`)로 했는데, 우리는
   * 서버가 항목마다 중분류를 함께 내려 주므로 표가 필요 없다.
   *
   * <p><b>성역은 "그 중분류에서 줄일 것이 하나도 없다"일 때만 붙는다.</b> `식비/배달` 은 줄이고
   * `식비/한식` 은 뒀다면 식비는 성역이 아니다 — 줄일 것이 있는 칸을 통째로 빼면 사용자가
   * 고른 것이 사라진다.
   */
  async function finish() {
    if (goalTotal <= 0) {
      setError(new Error('지킬 돈이 0원이에요. 목표를 올리거나 다른 항목을 골라주세요.'));
      return;
    }
    setBusy(true); setError(null); setConflict(null);

    // 중분류로 접는다 — 같은 칸에 든 소분류의 금액을 더한다.
    const targets: Record<string, number> = {};
    const baselines: Record<string, number> = {};
    for (const c of goalItems) {
      targets[c.code] = (targets[c.code] ?? 0) + (goalVals[c.key] ?? c.cut);
      baselines[c.code] = (baselines[c.code] ?? 0) + c.amount;
    }
    const categories = Object.keys(targets);
    const cutCats = new Set(categories);
    const sanctuary = [...new Set(saveItems
      .filter((_, i) => picks[i] === 'keep')
      .map((c) => c.categoryCode)
      .filter((code) => !cutCats.has(code)))];

    // 서버는 지킬 돈이 기준 지출보다 **작을 것**을 요구한다(예산 0원인 챌린지는 안 만든다).
    const baselineTotal = Object.values(baselines).reduce((s, v) => s + v, 0);
    const target = baselineTotal > 0 ? Math.min(goalTotal, baselineTotal - 1) : 0;
    try {
      await api.guardian.createChallenge(userId, {
        categories,
        sanctuaryCategories: sanctuary,
        targetSaving: target,
        durationDays: CHALLENGE_DAYS,
        keptPaymentIds: draft.keptPaymentIds,
        // 항목마다 정한 금액을 그대로 보낸다. 하나로 보내면 서버가 균등분할해
        // 사용자가 정한 것과 화면이 보여준 것이 달라진다.
        categoryTargets: targets,
      });
      // ① 절약 후보 추적에도 남긴다 — 후보가 아니면 서버가 거부하므로 조용히 넘어간다.
      const candidates = analysis?.cutCandidates ?? [];
      for (const code of categories) {
        const hit = candidates.find((x) => x.category2 === code);
        if (hit) await api.chooseCut(userId, hit.category2).catch(() => undefined);
      }
      // 다른 화면이 읽는 칸을 채워 둔다 — 강도는 금액에서 되돌린다.
      patchDraft({
        sanctuary,
        cutCats: categories,
        intensities: Object.fromEntries(categories.map((code) =>
          [code, baselines[code] > 0 ? Math.round(targets[code] / baselines[code] * 10) / 10 : 0.3])),
      });
      await reload();
      replace('done');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(e.message);
      else setError(e);
      setBusy(false);
    }
  }

  /* ── 그리기 ───────────────────────────────────────────────────────── */

  const msgClass = (n: number): string => {
    const state: MsgState = n === phase ? 'live' : n < phase ? 'out' : 'pre';
    return `msg${state === 'live' ? '' : ` ${state}`}`;
  };

  const heroLabel = '한 달 평균';
  const heroValue = `${fmt(spendTotal)}원`;
  /** 막대는 2단계에서 물러난다 — 그 자리를 목록이 받는다(0828). */
  const chartExit = phase >= 2;

  const cta = (() => {
    if (phase === 1) return null;
    if (phase === 2) return { label: '다음', on: () => toP3(), off: false };
    if (phase === 3) {
      // 전부 분류하기 전에는 남은 장수를 라벨로 알린다(프로토타입 `updateCtaDeck`).
      const left = saveItems.length - picks.length;
      return left > 0
        ? { label: `${left}개 선택 후 계속`, on: () => undefined, off: true }
        : { label: '다음', on: () => toP4(), off: false };
    }
    return { label: busy ? '챌린지를 시작하는 중…' : '시작하기', on: () => void finish(), off: busy };
  })();

  return (
    <Screen id="ob" title="이번 챌린지 정하기">
      {/* 뒤로는 3단계부터 뜬다(1·2는 브리핑이라 되돌아갈 앞 걸음이 없다).
          프로토타입은 버튼을 늘 두고 `.show` 로만 나타낸다 — 자리가 생겼다 없어지면
          앱바의 높이가 흔들린다. 우리도 같게 둔다. */}
      <div className="appbar">
        <button type="button" className={`back${phase >= 3 ? ' show' : ''}`}
          onClick={goBack} aria-label="이전 걸음으로"
          aria-hidden={phase < 3} tabIndex={phase < 3 ? -1 : 0}>‹</button>
      </div>
      <div className="progress"><i style={{ width: PROGRESS[phase] }} /></div>

      <div className="scroll">
        <div className="pad">
          {/* 캡션이 없는 걸음(덱)에서는 <b>접는다</b>. 빈 채로 자리를 지키면 그만큼 카드가
              눌려 아래 버튼이 CTA 밑으로 밀린다(원본 `hideCaption` 과 같다). */}
          <div className={`caption${caption ? ' in' : ' off'}`}>{caption}</div>
          <div className="msg-stack">
            {MSGS.map((m, i) => {
              const n = i + 1;
              return (
                <div className={msgClass(n)} key={n}>
                  <Title lines={m.title} on={!!titleOn[n]} />
                  {m.sub && <div className={`h-sub${subOn[n] ? ' el-in' : ''}`}>{m.sub}</div>}
                </div>
              );
            })}
          </div>
          <ErrorBox error={win.error} onRetry={win.reload} />
        </div>

        <div className="stage">
          {/* 1·2단계 — 한 달 소비를 한 줄 막대로. 2단계에서 절감분이 오른쪽부터 차오른다. */}
          <div className={`stage-item chart-box${chartExit ? ' exit' : ''}`}>
            <div className="cwrap">
              <div className={`hero${heroIn ? ' in' : ''}${phase >= 2 ? ' save' : ''}`}>
                <div className="hlab">{heroLabel}</div>
                <div className="hval">
                  {[...heroValue].map((ch, i) => (
                    <span className="ch" key={i} style={{ transitionDelay: `${i * 45}ms` }}>{ch}</span>
                  ))}
                </div>
              </div>
              <div className="sbwrap">
                <div className={`sbar${barDrawn ? ' drawn' : ''}${barCuts ? ' cuts' : ''}`}>
                  {segs.map((s, i) => (
                    <div className="sg" key={s.name} data-i={i}
                      style={{
                        flex: s.pct,
                        background: barCuts && litSeg !== i ? s.soft : s.base,
                        // 그 칸에서 잘라낼 폭 — 오른쪽에서 이만큼 본색이 차오른다.
                        ['--cw' as string]: `${s.pct > 0 ? (s.cut / s.amount * 100).toFixed(1) : 0}%`,
                      }}
                      onClick={() => tapSeg(i)} role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') tapSeg(i); }}
                      aria-label={`${s.name} ${won(s.amount)}`}>
                      <i style={{ background: s.base }} />
                    </div>
                  ))}
                </div>
                {chip && (
                  <div className="chip show" style={{ left: `${chip.left}%`, color: chip.color }}>
                    {chip.text}
                  </div>
                )}
              </div>
              <div className={`slg${legendIn ? ' in' : ''}${barCuts ? ' cuts' : ''}`}>
                <div className="lhd">
                  <span className="dt" /><span className="nm" />
                  <span className="am">한 달 평균</span><span className="cv">월 절약 추천</span>
                </div>
                {segs.map((s, i) => (
                  <div className="lgr" key={s.name} data-i={i} style={{ transitionDelay: `${i * 45}ms` }}>
                    <span className="dt" style={{ background: s.base }} />
                    <span className="nm">{s.name}</span>
                    <span className="am">{fmt(s.amount)}원</span>
                    {/* 재량성이 낮아 <b>줄이라고 권하지 않는</b> 곳은 '-0'이 아니라 줄표다.
                        0원을 아끼라는 말처럼 보이면 안 된다. */}
                    <span className="cv">{s.cut > 0 ? `-${fmt(s.cut)}` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2단계 — 아껴볼 소비 목록. 셋만 보이고 더 보고 싶은 사람만 펼친다. */}
          <div className="stage-item list-box">
            <div className={`saves-wrap${phase === 2 && stageIn ? ' in' : ''}`}>
              {saveItems.length > 0
                ? <SaveList items={saveItems} />
                : phase === 2 && (
                  <p className="empty">
                    아껴볼 만한 곳을 못 찾았어요. 소비가 더 쌓이면 다시 찾아볼게요.
                  </p>
                )}
            </div>
          </div>

          {/* 3단계 — 덱. 왼쪽이 포기할 수 없는 것, 오른쪽이 줄여볼 것이다. */}
          <div className="stage-item deck-box">
            <div className={`deck-wrap${phase === 3 && stageIn ? ' in' : ''}`}>
              {saveItems.length > 0 && (
                <SaveDeck items={saveItems} picks={picks} onPick={pick} onUndo={undo} />
              )}
            </div>
          </div>

          {/* 4단계 — 목표 금액. 슬라이더로 한 번에, 스테퍼로 항목마다. */}
          <div className="stage-item goal-box">
            <div className={`goal${phase === 4 && stageIn ? ' in' : ''}`}>
              <div className="gcard">
                <div className="lbl">한 달 목표 저금액</div>
                <div className="amt">{fmt(goalTotal)}원</div>
                <input type="range" min={GOAL_MIN} max={GOAL_MAX} value={slider}
                  aria-label="목표 세기"
                  style={{ ['--p' as string]: `${(slider - GOAL_MIN) / (GOAL_MAX - GOAL_MIN) * 100}%` }}
                  onChange={(e) => onSlider(Number(e.target.value))} />
                <div className="marks">
                  {['조금', '적당히', '확실히'].map((label, i) => {
                    const f = recSum ? goalTotal / recSum * 100 : 100;
                    const active = i === (f < 80 ? 0 : f <= 120 ? 1 : 2);
                    return <span key={label} className={active ? 'on' : undefined}>{label}</span>;
                  })}
                </div>
              </div>
              <div className="gitems">
                {goalItems.map((c) => {
                  const { icon, bg } = iconOf(c.code);
                  const v = goalVals[c.key] ?? c.cut;
                  return (
                    <div className="grow" key={c.key}>
                      <span className="ic" style={{ background: bg }}>
                        <svg><use href={`#${icon}`} /></svg>
                      </span>
                      <span className="mid"><b>{c.name}</b><span>평균 {fmtMan(c.amount)}원</span></span>
                      <span className="stepper">
                        <button type="button" aria-label={`${c.name} 목표 낮추기`}
                          disabled={v <= GOAL_STEP}
                          onClick={() => stepVal(c.key, -GOAL_STEP)}>−</button>
                        <span className="val">{fmtMan(v)}</span>
                        <button type="button" aria-label={`${c.name} 목표 올리기`}
                          disabled={v >= c.amount}
                          onClick={() => stepVal(c.key, GOAL_STEP)}>＋</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="pad">
          {conflict != null && (
            <>
              <p className="notice-warn" role="alert">{conflict}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('home')}>
                지금 지키는 중인 챌린지 보기
              </button>
            </>
          )}
          {error != null && (
            <>
              <ErrorBox error={error} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('home')}>
                나중에 정할게요 · 홈으로
              </button>
            </>
          )}
        </div>
      </div>

      {cta && (
        <Cta className={ctaIn ? 'in' : undefined}>
          <button type="button" className="btn btn-primary" disabled={cta.off} onClick={cta.on}>
            {cta.label}
          </button>
        </Cta>
      )}
    </Screen>
  );
}
