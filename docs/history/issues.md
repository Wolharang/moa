# Issues

원본 저장소의 이슈 6건이다.


---

## 이슈 216 — fix : develop 기동 실패 — card-catalog 의 groupName 중복이 uk_card_benefit_group 에 걸린다 (37장)

Wolharang · 2026-08-19 올림 · 2026-08-19 닫힘

> ## 증상
> 
> `develop` 의 `운영 중지 검사` 가 **실패**하고 있습니다. 백엔드 컨테이너가 기동하지 못합니다.
> 
> ```
> dependency failed to start: container ...-backend-mydata-1 is unhealthy
> dependency failed to start: container ...-backend-1 is unhealthy
> Process completed with exit code 1
> ```
> 
> 기동 로그의 원인은 이것입니다.
> 
> ```
> org.springframework.dao.DataIntegrityViolationException:
>   could not execute statement
>   [Duplicate entry '18-생활 서비스' for key 'card_benefit.uk_card_benefit_group']
>   insert into card_benefit (...)
> ```
> 
> 실패한 실행: https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-1team/actions/runs/32117925756
> 대상 커밋: `708a38a` (develop 현재 머리)
> 
> ## 원인
> 
> 두 곳이 서로 다른 전제를 갖고 있습니다.
> 
> | | 전제 |
> |---|---|
> | `backend/src/main/resources/db/migration/V36__card_product.sql:323` | `UNIQUE KEY uk_card_benefit_group (card_id, group_name)` — **한 카드에 같은 그룹 이름은 하나** |
> | `backend/src/main/resources/card-catalog.json` | 한 카드가 **같은 `groupName` 을 여러 번** 가질 수 있음 |
> 
> `CardCatalogLoader`(`service/CardCatalogLoader.java:51`, `ApplicationRunner`)가 기동할 때 카탈로그를 표로 옮기면서 두 번째 행에서 유일 제약에 걸립니다.
> 
> `ApplicationRunner` 라서 **적재 실패가 곧 기동 실패**입니다. 헬스체크가 안 서고 컨테이너가 unhealthy 가 됩니다.
> 
> ## 카드 한 장의 문제가 아닙니다
> 
> 18번(`쿠팡 패밀리 하나카드`)만 고쳐도 **다음 카드에서 같은 자리에서 죽습니다.** 561장 중 **37장**이 같은 상태입니다.
> 
> | 순번 | 카드 | 발급사 | 겹치는 groupName |
> |---:|---|---|---|
> | 18 | 쿠팡 패밀리 하나카드 | 하나카드 | 생활 서비스 ×3 |
> | 40 | 현대카드M HYBRID | 현대카드 | 기본 M포인트 적립 ×2 |
> | 51 | 배민 한그릇카드 | 현대카드 | 추가 혜택 ×3 |
> | 52 | 배민 곱빼기카드 | 현대카드 | 추가 혜택 ×2 |
> | 53 | 배민 한그릇카드 HYBRID | 현대카드 | 추가 혜택 ×3 |
> | 138 | 하나투어 KB국민카드 | KB국민카드 | 하나투어 마일리지 적립 ×5 |
> | 177 | KB국민 훈 체크카드 | KB국민카드 | 교육 ×2 · 건강 ×2 |
> | 179 | KB국민 히어로즈체크카드 | KB국민카드 | 자기계발 ×2 · 생활 ×5 |
> | 184 | KB국민 티머니 노리체크카드 | KB국민카드 | 여가 ×2 · 외식 ×2 · 편의점·서점 ×2 |
> | 193 | LG U플러스 KB국민 체크카드 | KB국민카드 | 생활 ×2 |
> | 194 | KB국민 가온 올포인트 체크카드 | KB국민카드 | 추가 적립 ×2 |
> | 219 | 해피오토JDC KB국민카드 | KB국민카드 | AUTO LIFE ×2 · HAPPY LIFE ×4 |
> | 221 | KB국민 약사님카드 | KB국민카드 | 제약/의료기기 혜택 ×2 |
> | 227 | KB국민 스타트럭 플러스 HD현대오일뱅크카드 | KB국민카드 | 생활 편의 서비스 ×3 |
> | 233 | T보너스 KB국민카드 | KB국민카드 | 세븐스프링스 ×2 · LF ×2 · 롯데시네마 ×2 · 아웃백 ×2 |
> | 260 | 위메프페이 신용카드 | KB국민카드 | 11번가/위메프오 ×2 |
> | 288 | SK인텔릭스 KB국민카드 | KB국민카드 | 놀이공원 ×2 |
> | 289 | H.Point KB국민카드 | KB국민카드 | H.Point 적립 ×2 |
> | 291 | 교원 웰스 KB국민카드 | KB국민카드 | 놀이공원 할인 ×3 |
> | 292 | KB국민 SK인텔릭스 올림카드 | KB국민카드 | 놀이공원 할인 ×2 |
> | 311 | KB국민 골든라이프 티타늄카드 | KB국민카드 | Golden Choice ×3 |
> | 342 | KB국민 기후동행카드 | KB국민카드 | 여가 ×2 |
> | 343 | KB국민 기후동행체크카드 | KB국민카드 | 여가 ×2 |
> | 379 | American Express Blue KB Kookmin Card | KB국민카드 | 이동통신/OTT ×2 |
> | 416 | KB국민 탄탄대로 호남예향카드 | KB국민카드 | 관광 ×2 |
> | 419 | KB국민 청춘대로 매니아 티타늄카드 | KB국민카드 | 매니아 티타늄 Basic ×2 |
> | 423 | KB국민 탄탄대로 웰컴카드(09214) | KB국민카드 | Daily Life ×2 · Fun Life ×2 |
> | 435 | KB국민 The Easy카드 | KB국민카드 | 기본 서비스 ×2 · 추가 서비스 ×2 |
> | 463 | BeV Ⅲ 카드 | KB국민카드 | 포인트 적립 ×4 |
> | 470 | T 라이트 KB국민카드 | KB국민카드 | 통합 청구할인 서비스 ×2 · 정기결제 추가 청구할인 서비스 ×2 |
> | 483 | KB국민 스타플러스 체크카드 | KB국민카드 | 국내 혜택 ×10 |
> | 485 | KB국민 WE:SH Travel 카드 | KB국민카드 | 여행 할인 ×2 |
> | 500 | KB 틴업 체크카드 | KB국민카드 | 공통할인 ×5 · 놀이할인 ×2 |
> | 501 | KB On the Go 체크카드 | KB국민카드 | 이동통신 ×2 |
> | 510 | KB ALL 카드 | KB국민카드 | 기본 할인 ×2 |
> | 511 | KB국민 My WE:SH 카드 | KB국민카드 | 나한테 진심 ×2 |
> | 522 | 삼성페이 카드 | 삼성카드 | 국내 가맹점 ×4 |
> 
> 총 37장 / 561장
> 
> ## 판단이 필요한 지점 — 제가 정하지 않았습니다
> 
> 어느 쪽이 옳은지는 카탈로그의 뜻을 아는 분이 정할 일이라 손대지 않았습니다. 보이는 선택지는 셋입니다.
> 
> 1. **제약이 과합니다** — 한 그룹에 혜택 여러 개가 정상이라면 `uk_card_benefit_group` 을 없애거나
>    `(card_id, group_name, sort_no)` 처럼 넓힙니다. `V36` 은 **아직 운영에 적용 전**이라
>    파일을 고쳐도 됩니다(규칙 3은 *적용된* 파일만 보호합니다).
> 2. **로더가 합쳐야 합니다** — 같은 `groupName` 의 혜택을 한 행으로 묶고 세부는 자식 표
>    (`card_benefit_target` 등)로 내립니다.
> 3. **카탈로그가 틀렸습니다** — 37장의 `groupName` 이 실수라면 수집 단계
>    (`scripts/collect-cards/build_catalog.py`)에서 바로잡습니다.
> 
> ## 곁가지 — 데이터 한 줄이 서비스를 못 세우게 하는 구조
> 
> 지금은 카탈로그에 겹치는 줄이 하나만 생겨도 **앱이 아예 안 뜹니다.** 카드 데이터는 앞으로도
> 갱신될 텐데, 그때마다 같은 위험을 집니다. 적재 실패를 기동 실패와 분리하는 것을 함께
> 고려해 주시면 좋겠습니다 — 예를 들어 겹치는 줄은 건너뛰고 `WARN` 으로 남기거나,
> 적재를 기동 경로에서 떼어 내는 방법이 있습니다.
> 
> (이 저장소는 `ApplicationRunner` 로 한 번 크게 데인 적이 있습니다 — `UserIdentityBackfill` 이
> 자기 호출로 `@Transactional` 을 잃어 **한 행도 안 써진 채 "10만 행 채웠다"** 를 찍었습니다. 커밋 `faead8e`.)
> 
> ---
> 
> ## `운영 중지 검사` 가 무엇이고 왜 멈췄나
> 
> 이름 그대로 **"이 커밋이 main 에 올라가면 서버가 멈추는가"** 를 묻는 검사입니다
> (`.github/workflows/ci.yml:85`). 단위 시험과 목적이 다릅니다.
> 
> 세 단계로 **실제 배포를 예행**합니다.
> 
> | 단계 | 하는 일 | 실패하면 |
> |---|---|---|
> | 1단계 | **기준 커밋(=`main`)** 으로 컨테이너를 띄웁니다. 지금 운영에 떠 있는 상태를 재현하고 DB 볼륨을 출시된 스키마까지 올립니다 | `continue-on-error: true` — **이 잡을 죽이지 않습니다.** 경고만 남기고 2단계가 빈 DB에서 돕니다 |
> | 2단계 | **볼륨을 지우지 않고** 이 커밋으로 갈아끼웁니다. Flyway 가 증분으로 돌고, 컨테이너 넷이 healthy 가 되어야 합니다 | ❌ **여기서 막혔습니다** |
> | 3단계 | 실제 스모크(`scripts/smoke.sh`) — 배포 후 서버에서 돌리는 것과 같은 스크립트 | |
> 
> 즉 이번 실패는 *"시험이 까다로워서"* 가 아니라 **운영에 올리면 백엔드가 안 뜬다는 사실을 그대로
> 재현한 것**입니다. 이 검사가 없었다면 배포가 나가서 스모크에서 걸렸을 것입니다(운영이 죽지는
> 않습니다 — 옛 컨테이너가 그대로 돌기 때문입니다. 대신 **배포가 막힙니다**).
> 
> ## 배포 전에 무엇을 하면 이 검사에 안 걸리나
> 
> ### ⚠️ `./mvnw test` 통과는 이 검사 통과를 보장하지 않습니다
> 
> 시험은 **H2 + `ddl-auto: create-drop` + Flyway 꺼짐**입니다. 그래서 다음을 **구조적으로 못 잡습니다.**
> 
> - 마이그레이션 SQL 자체의 오류 (파일을 읽지도 않습니다)
> - `ddl-auto: validate` 불일치 (엔티티와 실제 스키마가 어긋나는 것)
> - MySQL 유일 제약 위반 — **이번 건이 정확히 이것입니다**
> - `ApplicationRunner` 처럼 기동 경로에서만 도는 코드
> 
> ### ✅ 밀기 전에 이것을 돌리면 됩니다 — CI 와 **똑같은** 명령입니다
> 
> ```bash
> # 1) CI 가 쓰는 환경파일을 만든다 (ci.yml 85~118 줄의 블록과 같은 내용)
> cat > deploy/ci.env <<'EOF'
> MYSQL_ROOT_PASSWORD=ci-root
> DB_NAME=finntech
> DB_USER=finntech
> DB_PASSWORD=ci-pass
> DB_HOST=mysql
> DB_PORT=3306
> MYDATA_DB_NAME=finntech_mydata
> MYDATA_SHARED_SECRET=ci-shared-secret
> CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173
> TSA_ENABLED=false
> FINNTECH_DEV_SEED_ENABLED=false
> GEMINI_API_KEY=
> FSS_API_KEY=
> FINNTECH_CRYPTO_REQUIRED=false
> MYDATA_CRYPTO_REQUIRED=false
> EOF
> 
> # 2) CI 와 같은 compose 조합
> export CO="-f docker-compose.prod.yml -f docker-compose.prod.local-db.yml -f docker-compose.prod.large.yml --profile local-db --env-file deploy/ci.env"
> 
> # 3) 2단계와 같다 — 띄우고 넷이 healthy 가 되는지 본다
> docker compose $CO up -d --build
> ./.github/wait-healthy.sh 4          # ← 이번 건은 여기서 걸립니다
> 
> # 4) 3단계와 같다
> BASE=http://127.0.0.1:5173 HOST=127.0.0.1 bash scripts/smoke.sh
> 
> # 5) 정리 (볼륨까지 지웁니다)
> docker compose $CO down -v
> ```
> 
> 막히면 원인은 로그에 있습니다.
> 
> ```bash
> docker compose $CO logs --tail 150 backend
> ```
> 
> ### 더 빨리 확인하는 법
> 
> `up -d --build` 는 몇 분 걸립니다. **기동 실패만** 빨리 보고 싶으면 백엔드만 띄워도 같은 예외를 만납니다.
> 
> ```bash
> docker compose $CO up -d --build mysql backend
> docker compose $CO logs -f backend
> ```
> 
> ### 요약
> 
> `./mvnw test` 는 **로직**을 봅니다. `운영 중지 검사` 는 **기동과 스키마**를 봅니다.
> 스키마·마이그레이션·기동 경로(`ApplicationRunner`·`@PostConstruct`)·compose 를 건드렸다면
> 위 명령을 한 번 돌리고 미시는 편이 CI 를 기다리는 것보다 빠릅니다.
> 
> ### 확인 필수 사항
> main의 Hotfix 수정도 같이 반영하시기 바랍니다.


---

## 이슈 181 — 배포 차단 — d64e444

github-actions[bot] · 2026-08-12 올림 · 2026-08-18 닫힘

> ## 🚨 배포를 막았습니다
> 
> 커밋 `d64e444` 이 main에 들어왔지만 정상 경로로 보이지 않아 **운영 배포를 중단**했습니다.
> 
> ### 이유
> - 이 커밋에 연결된 **main행 PR이 없습니다.** main에 직접 push된 것으로 보입니다.
> 
> ### 확인할 것
> - 의도한 변경이 맞습니까? 아니라면 main을 즉시 되돌리세요.
> - 맞다면 내용을 확인한 뒤 Actions에서 `deploy`를 수동 실행하세요.
> 
> 실행: https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-1team/actions/runs/31578841422


---

## 이슈 49 — 배포 차단 — 0610e5f

github-actions[bot] · 2026-07-28 올림 · 2026-08-18 닫힘

> ## 🚨 배포를 막았습니다
> 
> 커밋 `0610e5f` 이 main에 들어왔지만 정상 경로로 보이지 않아 **운영 배포를 중단**했습니다.
> 
> ### 이유
> - PR #47의 main 진입 검사가 `failure` 입니다.
> 
> ### 확인할 것
> - 의도한 변경이 맞습니까? 아니라면 main을 즉시 되돌리세요.
> - 맞다면 내용을 확인한 뒤 Actions에서 `deploy`를 수동 실행하세요.
> 
> 실행: https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-1team/actions/runs/30359201307


---

## 이슈 48 — 배포 차단 — 0610e5f

github-actions[bot] · 2026-07-28 올림 · 2026-08-18 닫힘

> ## 🚨 배포를 막았습니다
> 
> 커밋 `0610e5f` 이 main에 들어왔지만 정상 경로로 보이지 않아 **운영 배포를 중단**했습니다.
> 
> ### 이유
> - PR #47의 main 진입 검사가 `failure` 입니다.
> 
> ### 확인할 것
> - 의도한 변경이 맞습니까? 아니라면 main을 즉시 되돌리세요.
> - 맞다면 내용을 확인한 뒤 Actions에서 `deploy`를 수동 실행하세요.
> 
> 실행: https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-1team/actions/runs/30359201307


---

## 이슈 46 — 배포 차단 — 4c94f10

github-actions[bot] · 2026-07-28 올림 · 2026-08-18 닫힘

> ## 🚨 배포를 막았습니다
> 
> 커밋 `4c94f10` 이 main에 들어왔지만 정상 경로로 보이지 않아 **운영 배포를 중단**했습니다.
> 
> ### 이유
> - PR #45의 main 진입 검사가 `null` 입니다.
> 
> ### 확인할 것
> - 의도한 변경이 맞습니까? 아니라면 main을 즉시 되돌리세요.
> - 맞다면 내용을 확인한 뒤 Actions에서 `deploy`를 수동 실행하세요.
> 
> 실행: https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-1team/actions/runs/30358649306


---

## 이슈 43 — 배포 차단 — ca802fe

github-actions[bot] · 2026-07-28 올림 · 2026-08-18 닫힘

> ## 🚨 배포를 막았습니다
> 
> 커밋 `ca802fe` 이 main에 들어왔지만 정상 경로로 보이지 않아 **운영 배포를 중단**했습니다.
> 
> ### 이유
> - PR #42의 main 진입 검사가 `null` 입니다.
> 
> ### 확인할 것
> - 의도한 변경이 맞습니까? 아니라면 main을 즉시 되돌리세요.
> - 맞다면 내용을 확인한 뒤 Actions에서 `deploy`를 수동 실행하세요.
> 
> 실행: https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-1team/actions/runs/30357916848

