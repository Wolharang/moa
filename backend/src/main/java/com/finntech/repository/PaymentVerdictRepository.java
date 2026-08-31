package com.finntech.repository;

import com.finntech.domain.PaymentVerdict;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** 결제별 사람의 답. 파기 흐름(`PrivacyService`)이 사용자 단위로 지운다. */
public interface PaymentVerdictRepository extends JpaRepository<PaymentVerdict, Long> {

    Optional<PaymentVerdict> findByUserIdAndPaymentId(Long userId, String paymentId);

    /** 그 사람의 답 전부 — 화면이 결제 목록에 얹을 때 한 번에 읽는다(N+1 방지). */
    List<PaymentVerdict> findByUserId(Long userId);

    /** 파기. 사용자가 지워지면 답도 남지 않는다. */
    void deleteByUserId(Long userId);

    long countByUserId(Long userId);
}
