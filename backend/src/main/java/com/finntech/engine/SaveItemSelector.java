package com.finntech.engine;

import com.finntech.config.AnalysisProperties;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.ToDoubleFunction;

/**
 * 아껴볼 소비 항목 선정 — <b>소분류 단위</b>.
 *
 * <h2>왜 중분류가 아니라 소분류인가</h2>
 *
 * 온보딩이 "무엇을 줄일까"를 묻는데, 중분류(`식비`)는 사람이 행동으로 옮길 수 있는 단위가
 * 아니다. 밥을 끊을 수는 없다. 소분류(`배달`·`택시`·`커피전문점`)는 <b>끊거나 줄일 수 있는
 * 대상</b>이고, 그 사람이 실제로 무엇을 샀는지도 말해 준다.
 *
 * <p><b>소분류는 정확히 한 중분류에만 속한다</b>({@code midBySub}). 그래서 항목을 골라 두면
 * 챌린지로 넘길 때 {@link IndustryCategoryMapper#midOfSub}가 중분류를 정확히 되돌려 준다 —
 * 지킴이 도메인은 중분류 단위 그대로 두고, 고르는 화면만 한 칸 내려간다.
 *
 * <h2>시간대를 쓰지 않는 이유</h2>
 *
 * 설계안은 `평일 19~22시 외식`처럼 시간대를 항목의 정체성으로 삼았다. 그러나 <b>운영
 * 데이터에 시각이 없다</b> — 실 명세서 적재({@code scripts/import-realperson.py})가 읽는
 * 날짜 칸 후보에 시각 칸이 하나도 없어 결제가 전부 같은 시각으로 들어온다. 없는 사실을
 * 꼬리표로 달지 않는다(2026-08-31 결정).
 *
 * <h2>등급은 {@link CutCandidateSelector}와 같은 임계를 쓴다</h2>
 *
 * 두 곳이 다른 임계를 쓰면 같은 소비가 화면마다 다른 취급을 받는다. 재량성이 낮으면
 * 애초에 후보가 아니고(약값·통신비·교통비), 재량성이 높으면 낭비 비율만큼을, 중간이면
 * 중앙값 초과분을 절감액으로 본다.
 *
 * <p>재현성(§3): 순수 함수, 그룹핑 {@link TreeMap}, 동점은 이름 오름차순으로 깬다.
 */
public final class SaveItemSelector {

    private SaveItemSelector() {}

    /** 한 달의 평균 일수(365.2425 ÷ 12) — {@link CutCandidateSelector}와 같은 값이어야 한다. */
    private static final double DAYS_PER_MONTH = 30.436875;

    /**
     * 창 안의 결제 한 건. 컨트롤러가 이미 갖고 있는 값만 받는다 — 이 클래스는 조회하지 않는다.
     *
     * @param sub       소분류. 못 풀었으면 {@code null}
     * @param category2 중분류
     * @param amount    금액. 취소는 음수로 들어온다
     * @param waste     EBM 판정. 모델이 못 본 결제는 {@code null}
     * @param reason    낭비로 본 근거 문장. 모델이 만든 것이고 여기서 지어내지 않는다
     */
    public record Payment(String sub, String category2, long amount, Boolean waste, String reason) {}

    /**
     * 고를 수 있는 소비 하나.
     *
     * @param sub           소분류 이름. 화면의 제목이다
     * @param category2     중분류. 화면의 칩이다
     * @param monthlyAmount 월 환산 지출
     * @param count         결제 건수(취소 제외)
     * @param wasteAmount   그중 EBM이 낭비로 본 금액(월 환산)
     * @param suggestedCut  권하는 절감액(월 환산)
     * @param why           근거 문장. 없으면 {@code null}
     */
    public record SaveItem(String sub, String category2, long monthlyAmount, int count,
                           long wasteAmount, long suggestedCut, String why) {}

    /**
     * 소분류로 모아 아껴볼 항목을 낸다. 낭비 금액이 큰 순.
     *
     * @param window        창 안의 결제 전부
     * @param cfg           절약 후보 임계(보호·제거가능·낭비비율)
     * @param windowDays    창 길이. 월 환산의 분모다
     * @param minSamples    이 건수 미만인 소분류는 항목으로 올리지 않는다
     * @param discretionary 중분류 → 재량성(0~1)
     */
    public static List<SaveItem> selectFrom(List<Payment> window, AnalysisProperties.CutCandidate cfg,
                                            int windowDays, int minSamples,
                                            ToDoubleFunction<String> discretionary) {
        Map<String, List<Payment>> bySub = new TreeMap<>();
        for (Payment p : window) {
            if (IndustryCategoryMapper.isUnknown(p.category2())) continue;
            // 재량성이 낮으면 줄이라고 권하지 않는다. 중분류가 정하는 성질이다.
            if (discretionary.applyAsDouble(p.category2()) < cfg.getProtectedBelow()) continue;
            /*
             * <b>소분류를 못 풀면 중분류로 묶는다.</b>
             *
             * 처음에는 소분류가 없는 결제를 버렸다. 소분류가 더 좋은 단위인 것은 맞지만
             * — `식비` 로는 "밥을 포기할 수 없다"밖에 못 말한다 — 소분류는 <b>사전에 있는
             * 가맹점에만</b> 붙는다. 사전에는 사람이 확인한 곳만 들어가므로 대부분의 결제가
             * 거기 없고, 그래서 <b>아껴볼 항목이 하나도 안 나와 챌린지를 시작할 수 없었다</b>
             * (실측 2026-08-31, 창 안 420만원인 사용자에게 항목 0개).
             *
             * 거친 단위라도 고를 수 있는 편이, 정확한 단위로 아무것도 못 고르는 것보다 낫다.
             * 아는 만큼 잘게 쪼개고, 모르면 한 칸 올린다.
             */
            String key = (p.sub() == null || p.sub().isBlank()) ? p.category2().trim() : p.sub().trim();
            bySub.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
        }

        List<SaveItem> out = new ArrayList<>();
        for (var e : bySub.entrySet()) {
            List<Payment> rows = e.getValue();
            // 건수는 실제 소비 건만 센다 — 취소 한 줄이 "한 번 더 썼다"로 세어지면 표본이 부푼다.
            int count = (int) rows.stream().filter(p -> p.amount() > 0).count();
            if (count < minSamples) continue;

            // 금액은 취소를 포함해 상쇄시킨다. 세는 것과 더하는 것은 목적이 다르다.
            long windowSum = rows.stream().mapToLong(Payment::amount).sum();
            if (windowSum <= 0) continue;
            long monthly = toMonthly(windowSum, windowDays);

            long wasteWindow = rows.stream()
                    .filter(p -> Boolean.TRUE.equals(p.waste()) && p.amount() > 0)
                    .mapToLong(Payment::amount).sum();
            long wasteMonthly = toMonthly(wasteWindow, windowDays);
            double ratio = windowSum <= 0 ? 0.0 : (double) wasteWindow / windowSum;

            // 그 사람에게 낭비가 아닌 것은 권하지 않는다 — 재량성만으로는 알 수 없는 사실이다.
            if (ratio < cfg.getWasteRatioThreshold()) continue;

            String category2 = rows.get(0).category2();
            long cut;
            if (discretionary.applyAsDouble(category2) >= cfg.getRemovableAbove()) {
                // 안 써도 되는 종류 — 다만 <b>낭비인 만큼만</b> 절감액으로 잡는다.
                cut = Math.round(monthly * ratio);
            } else {
                // 써야 하는 종류 — 결제 한 건의 중앙값을 넘는 부분만.
                double[] amounts = rows.stream().filter(p -> p.amount() > 0)
                        .mapToDouble(Payment::amount).toArray();
                long median = Math.round(Stats.median(amounts));
                cut = toMonthly(rows.stream().filter(p -> p.amount() > 0)
                        .mapToLong(p -> Math.max(0, p.amount() - median)).sum(), windowDays);
            }
            if (cut <= 0) continue;

            out.add(new SaveItem(e.getKey(), category2, monthly, count, wasteMonthly, cut, whyOf(rows)));
        }
        // 낭비 금액이 큰 순. 동점은 이름 오름차순으로 깨서 순서를 결정적으로 만든다.
        out.sort(Comparator.comparingLong(SaveItem::wasteAmount).reversed()
                .thenComparing(SaveItem::sub));
        return out;
    }

    /**
     * 근거는 <b>가장 큰 낭비 결제의 판정 문장</b>을 그대로 쓴다.
     *
     * <p>여러 건을 요약하지 않는 이유: 요약하는 순간 그것은 모델이 한 말이 아니라 우리가 지어낸
     * 말이 된다. 한 건을 가리키면 사용자가 그 결제를 떠올려 동의하거나 반박할 수 있다.
     */
    private static String whyOf(List<Payment> rows) {
        return rows.stream()
                .filter(p -> Boolean.TRUE.equals(p.waste()) && p.reason() != null && !p.reason().isBlank())
                .max(Comparator.comparingLong(Payment::amount))
                .map(Payment::reason)
                .orElse(null);
    }

    /** 창 합계를 한 달치로. 창이 비정상이면(0 이하) 그대로 둔다. */
    private static long toMonthly(long windowTotal, int windowDays) {
        if (windowDays <= 0) return windowTotal;
        return Math.round(windowTotal * DAYS_PER_MONTH / windowDays);
    }
}
