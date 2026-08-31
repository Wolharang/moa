-- 결제 한 건에 **사람이 붙인 답**을 적는다 (프로토타입_0828 `.ctx3`).
--
-- 홈의 최근 소비에서 `필요했어요` / `새는 돈이었어요` 를 누르면 여기 남고, 주간 리포트가
-- 그것을 모아 보여 준다. 0828 이 또래 비교 자리를 이 요약에 내줬다.
--
-- ## 왜 결제 행이 아니라 별도 표인가
--
-- ① **사람의 답과 모델의 판정은 다른 것이다.** `user_payment` 에는 모델이 본 것이 붙고,
--    여기에는 사람이 말한 것이 붙는다. 한 칸에 섞으면 "이 값이 누가 정한 것인가"를 잃는다.
-- ② **재연동이 결제 행을 지우고 다시 만든다**(`linkCardCompanies`). 결제 행에 두면 사람이
--    답한 것이 통째로 날아간다 — 추정층(`category2_llm`)이 실제로 그렇게 전멸한 적이 있다
--    (2026-08-05). 결제 id 로만 이어 두면 다시 만들어져도 답이 살아 있다.
--
-- ## 무엇을 안 하는가
--
-- 이 표는 **판정을 바꾸지 않는다.** 낭비 판정은 EBM 이 하고(원칙 1), 여기 있는 것은 화면이
-- 보여 주는 사람의 답이다. 둘을 견주는 자리는 리포트다 — 어긋나면 그 자체가 정보다.
CREATE TABLE payment_verdict (
    payment_verdict_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id            BIGINT       NOT NULL,
    payment_id         VARCHAR(120) NOT NULL COMMENT '마이데이터 결제 id',
    verdict            VARCHAR(8)   NOT NULL COMMENT 'WASTE(새는 돈) | FINE(필요했어요)',
    created_at         DATETIME     NOT NULL,
    updated_at         DATETIME     NOT NULL,
    -- 한 결제에 답은 하나다. 다시 누르면 덮어쓴다 — 마음이 바뀌는 것은 자연스럽고,
    -- 이력을 쌓으면 "지금 답이 무엇인가"를 매번 정렬해서 골라야 한다.
    CONSTRAINT uq_payment_verdict UNIQUE (user_id, payment_id)
);

-- 리포트가 기간으로 좁힌 뒤 사용자의 답을 한꺼번에 읽는다.
CREATE INDEX idx_payment_verdict_user ON payment_verdict (user_id, updated_at);
