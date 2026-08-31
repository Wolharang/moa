package com.finntech.domain;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 결제 한 건에 <b>사람이 붙인 답</b> (프로토타입_0828 `.ctx3`).
 *
 * <p>홈의 최근 소비에서 `필요했어요` / `새는 돈이었어요` 를 누르면 여기 남는다. 주간 리포트가
 * 그것을 모아 보여 준다 — 0828 이 또래 비교 자리를 이 요약에 내줬다.
 *
 * <h2>모델의 판정과 섞지 않는다</h2>
 *
 * 낭비 판정은 EBM 이 한다(원칙 1). 이 표에 있는 것은 <b>사람이 말한 것</b>이고, 판정을
 * 덮어쓰지 않는다. 둘이 어긋나는 것 자체가 정보다 — 모델이 낭비로 봤는데 사람이 필요했다고
 * 하면 그 신호는 가맹점 성향({@link UserMerchantStance})으로 따로 흘러간다.
 *
 * <p>카테고리 단위로 판정을 뒤집는 {@link UserSpendingOverride} 와도 다르다. 그쪽은 "이
 * 카테고리는 나에게 낭비가 아니다"라는 <b>규칙</b>이고, 이쪽은 "이 결제는 아까웠다"는
 * <b>사실 기록</b>이다.
 */
@Entity
@Table(name = "payment_verdict",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "payment_id"}))
public class PaymentVerdict {

    /** 사람이 고를 수 있는 답. 셋째 값은 없다 — 안 고른 것은 행이 없는 것이다. */
    public enum Verdict {
        /** 새는 돈이었어요. */
        WASTE,
        /** 필요했어요. */
        FINE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "payment_verdict_id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 마이데이터 결제 id. 결제 행이 재연동으로 다시 만들어져도 이 값은 같다. */
    @Column(name = "payment_id", nullable = false, length = 120)
    private String paymentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "verdict", nullable = false, length = 8)
    private Verdict verdict;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected PaymentVerdict() {}

    public PaymentVerdict(Long userId, String paymentId, Verdict verdict, LocalDateTime now) {
        this.userId = userId;
        this.paymentId = paymentId;
        this.verdict = verdict;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** 마음이 바뀌면 덮어쓴다 — 이력을 쌓지 않는다(지금 답이 무엇인가만 필요하다). */
    public void change(Verdict next, LocalDateTime now) {
        this.verdict = next;
        this.updatedAt = now;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getPaymentId() { return paymentId; }
    public Verdict getVerdict() { return verdict; }
    public boolean isWaste() { return verdict == Verdict.WASTE; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
