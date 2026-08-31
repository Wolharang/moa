package com.finntech.service;

import com.finntech.domain.PaymentVerdict;
import com.finntech.repository.PaymentVerdictRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 결제별 사람의 답 — 저장과 기간 요약 (프로토타입_0828 `.ctx3` · 주간 리포트 라벨 절).
 *
 * <h2>왜 리포트에 이 절이 생겼나</h2>
 *
 * 0828 은 주간 리포트에서 <b>또래 비교를 걷어내고</b> 이 요약을 그 자리에 넣었다. 또래의
 * 중앙값은 남의 이야기고 내가 할 수 있는 일이 없는데, 내가 이번 주에 붙인 라벨은 <b>내가
 * 방금 한 판단의 결과</b>라 다음 주에 무엇을 바꿀지로 이어진다.
 *
 * <h2>모델의 판정을 건드리지 않는다</h2>
 *
 * 여기 있는 것은 사람이 말한 것이고, 낭비 판정은 EBM 이 한다(원칙 1). 둘이 어긋나는 것은
 * 고칠 오류가 아니라 정보다 — 그 신호는 가맹점 성향으로 따로 흐른다.
 *
 * <p>재현성(§3): {@link Clock} 주입, 기간 계산은 {@link PeriodSpendService} 와 같은 규칙
 * (주는 월요일 시작, 달은 1일 시작), 집계 {@link TreeMap}.
 */
@Service
public class PaymentVerdictService {

    private final PaymentVerdictRepository verdicts;
    private final MyDataLinkService payments;
    private final Clock clock;

    public PaymentVerdictService(PaymentVerdictRepository verdicts, MyDataLinkService payments, Clock clock) {
        this.verdicts = verdicts;
        this.payments = payments;
        this.clock = clock;
    }

    /**
     * 한 갈래의 집계.
     *
     * @param count  건수
     * @param amount 합계
     */
    public record Bucket(int count, long amount) {}

    /**
     * 기간 요약.
     *
     * @param period    {@code week} · {@code month}
     * @param start     구간 시작(포함)
     * @param end       구간 끝(포함)
     * @param fine      필요했어요
     * @param leak      새는 돈이었어요
     * @param unlabeled 아직 안 붙인 건수
     * @param leakTop   새는 돈이 가장 몰린 중분류. 없으면 {@code null}
     */
    public record LabelSummary(String period, LocalDate start, LocalDate end,
                               Bucket fine, Bucket leak, int unlabeled, String leakTop) {}

    /** 지금 답 — 화면이 결제 목록에 얹는다. 결제 id → WASTE/FINE. */
    @Transactional(readOnly = true)
    public Map<String, PaymentVerdict.Verdict> mine(Long userId) {
        Map<String, PaymentVerdict.Verdict> out = new HashMap<>();
        for (PaymentVerdict v : verdicts.findByUserId(userId)) out.put(v.getPaymentId(), v.getVerdict());
        return out;
    }

    /**
     * 답을 적는다. 이미 있으면 덮어쓴다 — 마음이 바뀌는 것은 자연스럽다.
     *
     * <p>결제가 그 사람의 것인지 확인하지 않는다. 남의 결제 id 를 알아내도 얻는 것이 없고
     * (읽히는 것은 자기 요약뿐이다), 확인하려면 결제 전체를 훑어야 해서 누를 때마다 무거워진다.
     */
    @Transactional
    public void put(Long userId, String paymentId, boolean waste) {
        LocalDateTime now = LocalDateTime.now(clock);
        PaymentVerdict.Verdict next = waste ? PaymentVerdict.Verdict.WASTE : PaymentVerdict.Verdict.FINE;
        verdicts.findByUserIdAndPaymentId(userId, paymentId)
                .ifPresentOrElse(v -> v.change(next, now),
                        () -> verdicts.save(new PaymentVerdict(userId, paymentId, next, now)));
    }

    /** 답을 지운다 — 되돌릴 길이 없으면 사람은 애초에 안 누른다. */
    @Transactional
    public void clear(Long userId, String paymentId) {
        verdicts.findByUserIdAndPaymentId(userId, paymentId).ifPresent(verdicts::delete);
    }

    /**
     * 그 구간에 붙인 라벨을 모은다.
     *
     * @param period {@code "week"} 또는 {@code "month"}
     * @param offset 0 이면 이번 주/달, 1 이면 지난 주/달. 음수는 0 으로 본다
     */
    @Transactional(readOnly = true)
    public LabelSummary summary(Long userId, String period, int offset) {
        int back = Math.max(0, offset);
        LocalDate today = LocalDate.now(clock);
        boolean monthly = "month".equalsIgnoreCase(period);
        LocalDate start = monthly
                ? today.minusMonths(back).withDayOfMonth(1)
                : today.with(DayOfWeek.MONDAY).minusWeeks(back);
        LocalDate endExclusive = monthly ? start.plusMonths(1) : start.plusWeeks(1);

        Map<String, PaymentVerdict.Verdict> said = mine(userId);

        int fineN = 0, leakN = 0, unlabeled = 0;
        long fineAmt = 0, leakAmt = 0;
        Map<String, Long> leakByCat = new TreeMap<>();

        // 창은 넉넉히 받고 여기서 정확히 자른다 — `allPayments` 는 개월 단위다.
        int months = monthly ? back + 2 : Math.max(2, (back + 1) / 4 + 2);
        for (MyDataLinkService.PaymentHistoryRow p : payments.allPayments(userId, months)) {
            LocalDate day = p.date().toLocalDate();
            if (day.isBefore(start) || !day.isBefore(endExclusive)) continue;
            // 취소(음수)는 답을 붙일 대상이 아니다 — 안 쓴 돈이다.
            if (p.amount() <= 0) continue;
            PaymentVerdict.Verdict v = said.get(p.paymentId());
            if (v == null) { unlabeled++; continue; }
            if (v == PaymentVerdict.Verdict.WASTE) {
                leakN++; leakAmt += p.amount();
                String cat = p.category2();
                if (cat != null && !cat.isBlank()) leakByCat.merge(cat, (long) p.amount(), Long::sum);
            } else {
                fineN++; fineAmt += p.amount();
            }
        }

        // 가장 몰린 칸. 동점은 이름 오름차순으로 깨서 순서를 결정적으로 만든다(§3).
        String leakTop = leakByCat.entrySet().stream()
                .max(Comparator.<Map.Entry<String, Long>>comparingLong(Map.Entry::getValue)
                        .thenComparing(Map.Entry::getKey, Comparator.reverseOrder()))
                .map(Map.Entry::getKey).orElse(null);

        return new LabelSummary(monthly ? "month" : "week", start, endExclusive.minusDays(1),
                new Bucket(fineN, fineAmt), new Bucket(leakN, leakAmt), unlabeled, leakTop);
    }

    /** 파기 — 사용자가 지워지면 답도 남지 않는다. */
    @Transactional
    public long forget(Long userId) {
        long n = verdicts.countByUserId(userId);
        verdicts.deleteByUserId(userId);
        return n;
    }

    /** 아직 답이 없는 최근 결제 — 홈이 물어볼 것을 고를 때 쓴다. */
    @Transactional(readOnly = true)
    public List<MyDataLinkService.PaymentHistoryRow> unanswered(Long userId, int months, int limit) {
        Map<String, PaymentVerdict.Verdict> said = mine(userId);
        List<MyDataLinkService.PaymentHistoryRow> out = new ArrayList<>();
        for (MyDataLinkService.PaymentHistoryRow p : payments.allPayments(userId, months)) {
            if (p.amount() <= 0 || said.containsKey(p.paymentId())) continue;
            out.add(p);
            if (out.size() >= limit) break;
        }
        return out;
    }
}
