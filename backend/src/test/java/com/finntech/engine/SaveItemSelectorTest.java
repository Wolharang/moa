package com.finntech.engine;

import com.finntech.config.AnalysisProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 아껴볼 소비 항목 선정(소분류 단위) — 보호 제외·낭비 게이트·절감액·정렬·근거. */
class SaveItemSelectorTest {

    private final AnalysisProperties.CutCandidate cut = new AnalysisProperties.CutCandidate();

    /** 재량성 스텁 — 등급은 이름이 아니라 재량성이 정한다({@link CutCandidateSelectorTest} 와 같은 뜻). */
    private static double disc(String mid) {
        return switch (mid) {
            case "의료", "주거/통신" -> 0.10;   // 보호(0.30 미만)
            case "식비" -> 0.45;                // 최적화(중앙값 초과분만)
            default -> 0.70;                    // 제거가능(0.55 이상)
        };
    }

    private static final int ONE_MONTH = 30;
    private static long monthly(long windowTotal) {
        return Math.round(windowTotal * 30.436875 / ONE_MONTH);
    }

    private static SaveItemSelector.Payment p(String sub, String mid, long amt, Boolean waste, String why) {
        return new SaveItemSelector.Payment(sub, mid, amt, waste, why);
    }

    /** 같은 소분류로 n건 — 표본 미달로 걸러지지 않게 채울 때 쓴다. */
    private static List<SaveItemSelector.Payment> many(String sub, String mid, long amt, int n, boolean waste) {
        List<SaveItemSelector.Payment> out = new ArrayList<>();
        for (int i = 0; i < n; i++) out.add(p(sub, mid, amt, waste, waste ? "평소보다 많이 썼어요" : null));
        return out;
    }

    private List<SaveItemSelector.SaveItem> select(List<SaveItemSelector.Payment> window, int minSamples) {
        return SaveItemSelector.selectFrom(window, cut, ONE_MONTH, minSamples, SaveItemSelectorTest::disc);
    }

    @Test
    @DisplayName("소분류를 못 풀면 중분류로 묶는다 — 거친 단위라도 고를 수 있어야 한다")
    void 소분류가_없으면_중분류로() {
        var w = new ArrayList<>(many(null, "취미/여가", 20000, 5, true));
        var items = select(w, 3);
        assertEquals(1, items.size(), "버리지 않는다");
        assertEquals("취미/여가", items.get(0).sub());
        assertEquals("취미/여가", items.get(0).category2());
    }

    @Test
    @DisplayName("아는 것은 소분류로, 모르는 것은 중분류로 — 한 카테고리 안에서 갈린다")
    void 아는만큼_잘게() {
        // 제거가능(재량 0.70)이라 절감액이 낭비 비율만큼 나온다 — 중앙값 초과분이 0 이어도 남는다.
        var w = new ArrayList<SaveItemSelector.Payment>();
        w.addAll(many("게임", "취미/여가", 20000, 5, true));   // 소분류를 안다
        w.addAll(many(null, "취미/여가", 20000, 5, true));     // 모른다
        var names = select(w, 3).stream().map(SaveItemSelector.SaveItem::sub).sorted().toList();
        assertEquals(List.of("게임", "취미/여가"), names);
    }

    @Test
    @DisplayName("재량성이 낮은 중분류는 후보가 아니다 — 약값·통신비는 줄이라고 권하지 않는다")
    void 보호_카테고리는_뺀다() {
        var w = new ArrayList<>(many("병원", "의료", 50000, 6, true));
        assertTrue(select(w, 3).isEmpty());
    }

    @Test
    @DisplayName("표본이 모자란 소분류는 올리지 않는다")
    void 표본_미달은_뺀다() {
        var w = new ArrayList<>(many("택시", "교통/자동차", 12000, 2, true));
        assertTrue(select(w, 3).isEmpty());
    }

    @Test
    @DisplayName("그 사람에게 낭비가 아니면 뺀다 — 재량성만으로는 알 수 없는 사실이다")
    void 낭비_비율이_낮으면_뺀다() {
        var w = new ArrayList<>(many("게임", "취미/여가", 10000, 8, false));
        assertTrue(select(w, 3).isEmpty());
    }

    @Test
    @DisplayName("제거가능은 낭비인 만큼만 절감액으로 잡는다 — 전액이 아니다")
    void 제거가능_절감액은_낭비비율만큼() {
        var w = new ArrayList<SaveItemSelector.Payment>();
        w.addAll(many("게임", "취미/여가", 10000, 6, true));    // 60,000원 낭비
        w.addAll(many("게임", "취미/여가", 10000, 4, false));   // 40,000원 아님
        var items = select(w, 3);
        assertEquals(1, items.size());
        var it = items.get(0);
        assertEquals(monthly(100000), it.monthlyAmount());
        assertEquals(monthly(60000), it.wasteAmount());
        // 낭비 비율 0.6 → 월 지출의 60%
        assertEquals(Math.round(monthly(100000) * 0.6), it.suggestedCut());
    }

    @Test
    @DisplayName("최적화가능은 중앙값을 넘는 부분만 절감액이다 — 밥은 끊을 수 없다")
    void 최적화가능_절감액은_중앙값_초과분() {
        var w = new ArrayList<SaveItemSelector.Payment>();
        w.addAll(many("배달", "식비", 10000, 4, true));
        w.add(p("배달", "식비", 30000, true, "평소보다 많이 썼어요"));
        var items = select(w, 3);
        assertEquals(1, items.size());
        // 중앙값 10,000 → 초과분은 30,000 한 건의 20,000원뿐
        assertEquals(monthly(20000), items.get(0).suggestedCut());
    }

    @Test
    @DisplayName("취소는 금액에서 상쇄되지만 건수로 세지 않는다")
    void 취소는_상쇄만_한다() {
        var w = new ArrayList<SaveItemSelector.Payment>();
        w.addAll(many("게임", "취미/여가", 10000, 5, true));
        w.add(p("게임", "취미/여가", -10000, null, null));
        var items = select(w, 3);
        assertEquals(1, items.size());
        assertEquals(5, items.get(0).count());
        assertEquals(monthly(40000), items.get(0).monthlyAmount());
    }

    @Test
    @DisplayName("낭비 금액이 큰 순으로 정렬하고, 동점은 이름 오름차순으로 깬다")
    void 정렬은_결정적이다() {
        var w = new ArrayList<SaveItemSelector.Payment>();
        w.addAll(many("택시", "교통/자동차", 10000, 5, true));   // 50,000
        w.addAll(many("게임", "취미/여가", 20000, 5, true));     // 100,000
        w.addAll(many("가방", "쇼핑", 10000, 5, true));          // 50,000 — 택시와 동점
        var items = select(w, 3);
        assertEquals(List.of("게임", "가방", "택시"), items.stream().map(SaveItemSelector.SaveItem::sub).toList());
    }

    @Test
    @DisplayName("근거는 가장 큰 낭비 결제의 판정 문장을 그대로 쓴다 — 요약하지 않는다")
    void 근거는_모델이_한_말이다() {
        var w = new ArrayList<SaveItemSelector.Payment>();
        w.addAll(many("게임", "취미/여가", 10000, 4, true));
        w.add(p("게임", "취미/여가", 90000, true, "취미/여가에 보통 10,000원 쓰는데 이번엔 90,000원이에요."));
        var items = select(w, 3);
        assertEquals("취미/여가에 보통 10,000원 쓰는데 이번엔 90,000원이에요.", items.get(0).why());
    }

    @Test
    @DisplayName("모델이 근거를 안 남겼으면 지어내지 않고 비운다")
    void 근거가_없으면_null() {
        var w = new ArrayList<SaveItemSelector.Payment>();
        for (int i = 0; i < 5; i++) w.add(p("게임", "취미/여가", 10000, true, null));
        assertNull(select(w, 3).get(0).why());
    }

    @Test
    @DisplayName("모르는 중분류는 항목이 되지 않는다 — 무엇을 줄일지 말해 줄 수 없다")
    void 모르는_칸은_뺀다() {
        var w = new ArrayList<>(many("무언가", IndustryCategoryMapper.UNCLASSIFIED, 10000, 6, true));
        assertTrue(select(w, 3).isEmpty());
    }
}
