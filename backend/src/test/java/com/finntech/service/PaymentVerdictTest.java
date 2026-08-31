package com.finntech.service;

import com.finntech.domain.PaymentVerdict;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 결제별 사람의 답 — 덮어쓰기와 시각 기록. */
class PaymentVerdictTest {

    private static final LocalDateTime T0 = LocalDateTime.of(2026, 8, 1, 12, 0);
    private static final LocalDateTime T1 = LocalDateTime.of(2026, 8, 2, 9, 30);

    @Test
    @DisplayName("처음 답하면 만든 시각과 고친 시각이 같다")
    void 처음_답() {
        var v = new PaymentVerdict(1L, "p1", PaymentVerdict.Verdict.WASTE, T0);
        assertTrue(v.isWaste());
        assertEquals(T0, v.getCreatedAt());
        assertEquals(T0, v.getUpdatedAt());
    }

    @Test
    @DisplayName("마음이 바뀌면 덮어쓰고 고친 시각만 움직인다 — 이력을 쌓지 않는다")
    void 답을_바꾼다() {
        var v = new PaymentVerdict(1L, "p1", PaymentVerdict.Verdict.WASTE, T0);
        v.change(PaymentVerdict.Verdict.FINE, T1);
        assertFalse(v.isWaste());
        assertEquals(PaymentVerdict.Verdict.FINE, v.getVerdict());
        assertEquals(T0, v.getCreatedAt(), "만든 시각은 그대로다");
        assertEquals(T1, v.getUpdatedAt());
    }

    @Test
    @DisplayName("답은 둘뿐이다 — 안 고른 것은 행이 없는 것이지 셋째 값이 아니다")
    void 값은_둘() {
        assertEquals(2, PaymentVerdict.Verdict.values().length);
    }
}
