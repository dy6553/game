# 로그인 · 공개 공식 전적

## 운영 활성화·실제 검증 완료 — 2026-11-07

사용자가 도메인을 허용한 뒤 정상적으로 가입·로그인 요청이 처리됐다. DB 스키마·삭제 트리거·Worker 기능이 준비돼 있고 공개 Vercel Auth URL을 복구해 로비 계정 버튼을 활성화했다. 현재 동작은 이 절이 이전 준비/차단 기록보다 우선한다.

실제 Chromium(844×390 터치 화면)에서 관리형 Auth 가입→세션→인증된 Worker의 본인 프로필→로그아웃→비밀번호 로그인과 두 WebSocket의 비공개 온라인 10킬 경기→운영 DB의 1경기/1승/10킬 기록→완료 반복 중복 없음→인증 없는 공개 조회를 확인했다. 같은 계정의 양쪽 입장409와 클라이언트 임의 결과 저장404도 검사했다.

삭제는 직접 SDK delete-user 호출이 운영에서404였으므로 게임 서버의 DELETE /account로 처리한다. 서명/발급자/수신자/만료/역할을 검증한 JWT의 본인 ID만 사용한다. 서버가 해당 ID의 이메일을 조회하고 **입력한 비밀번호를 Neon sign-in/email로 다시 검증**, 응답 사용자 ID까지 일치해야 그 본인 사용자 행을 삭제한다. body의 임의 이메일/사용자 ID는 사용하지 않는다. 비밀번호는 TLS로 Worker를 거쳐 인증 확인용으로만 전달하고 DB나 앱 로그에 저장하지 않는다. 기존 DB 삭제 트리거/외래키로 계정·공식 전적이 함께 지워진다.

실제 잘못된 삭제 비밀번호는403이며 계정/전적200 유지, 올바른 비밀번호로 삭제 후 공개 프로필404, 브라우저 예외0을 확인했다. 로그아웃한 브라우저의 공개 링크 화면에서는 성적만 보이고 관리·삭제 입력과 이메일은 숨겨진다.

- TDD: account-delete-red의3개 assertion 및 DELETE 경로404→401 red 후 구현. 비밀번호 누락/오류·서비스 실패·ID 불일치 때 DB 삭제 없음, 인증 전 DB 접근 차단, 실패 시 로그인 유지, 삭제 후 오래된 SDK 캐시가 게스트 플레이를 막지 않음을 검증했다.
- 전체141개/39파일0실패, PostgreSQL 실제 SQL·다른 계정 보존·최근20개·오래된 중복/삭제 트리거 검사, Worker 및 깨끗한 웹 빌드·모바일 DOM 통과.
- 운영 소스3d2bc765d888a17f5144429491810dd128c623ab, Vercel dpl_CBzq3vuMYB9kVPWTPCZHCGrxmuP3 READY. 공개 assets는 깨끗한 활성화 빌드와 일치했다.
- 실기기 Android/타사 쿠키 제한 환경·장시간 테스트는 별도다. 실제 브라우저 검사를 물리 Android 확인으로 표시하지 않는다.
- 초기 검증용 예약 example.invalid 계정1개는 임시 비밀번호를 폐기한 뒤 정리되지 않았다. 비밀번호 없는 삭제 점검은 자동 승인 검토에서 계정·전적 영구 삭제 위험으로 차단됐으며 우회하지 않았다. 이 임시계정만 대상으로 제한한 정리 SQL은 로컬에 준비했고 별도 승인 전 실행하지 않는다. 이후 검증용 계정은 비밀번호 확인으로 정상 삭제했다. 실제 사용자 개인정보를 테스트에 사용하지 않았고 원본 진단·토큰·비밀번호는 Git에 넣지 않는다.


## 운영 준비 상태 — 2026-11-07 갱신

운영 DB 카탈로그에서 필수 전적 테이블·삭제 트리거 존재를 확인해 `database=ready`가 됐다. SQL을 다시 실행하지 않는다. Worker `ACCOUNTS_ENABLED=true` 배포 및 `/health/accounts`의 전체 `ready=true`까지 확인했다. 서버/계정20개 집중 검사와 Worker dry-run을 통과했다.

Vercel 공개 Auth URL을 설정해 실제 Chromium 모바일 화면에서 가입을 검사했으나 Neon이 POST 요청을 `403 INVALID_ORIGIN`으로 차단했다. 비로그인 GET 세션의 CORS200 응답은 이 허용 설정을 증명하지 않는다. 로그인·가입·실계정 전적 E2E는 미완료다. 테스트 가입도 Origin 검사에서 거절돼 테스트 계정은 생성되지 않았다.

다음 필요한 외부 설정: Neon의 같은 production 브랜치 Better Auth → Configuration → Domains에 `https://project-3uu6s.vercel.app`을 허용한다. Origin을 위조하거나 관리 인증을 우회하지 않는다. 제어 가능한 Neon 관리 로그인/연결 도구가 현재 없어 이 설정은 계정 소유자가 콘솔에서 추가해야 한다.

가입이 실패하는 화면을 계속 노출하지 않도록 Vercel `VITE_NEON_AUTH_URL`은 일단 빈 값으로 유지해 계정 버튼을 숨긴다. Worker의 DB/인증 준비는 활성화 상태다. 도메인 허용 후 공개 Auth URL을 복구·배포하고 실제 가입→세션→공식 결과→공개 조회→삭제를 재검사한다. 비밀 DB 연결값을 다시 입력하거나 공유할 필요는 없다.

## DB 등록 후 준비 상태 확인

운영 확인: Worker 준비 상태가 `databaseConfigured:true`, `database:schema_missing`, `authConfigured:true`, `enabled:false`, `ready:false`로 응답했다. DB 연결은 성공했고, 필수 테이블/삭제 트리거 구성과 로그인 활성화는 아직 남아 있다. Neon 관리 로그인 자격이 현재 작업 환경에 없으므로 `server/migrations/001-official-records.sql`을 해당 브랜치 SQL Editor에서 실행한 후 상태를 다시 확인한다.


사용자가 Cloudflare DATABASE_URL 등록·배포를 완료했다고 알렸다. `/account`는 계정 활성화 전에503을 반환하기 때문에 비밀값 존재나 DB 연결 성공의 증거로 쓰지 않는다. 새 `GET /health/accounts`는 기존 Origin 허용 목록 안에서 비밀값 없이 설정 여부·DB 연결·필수 테이블/삭제 트리거 존재·계정 활성화 상태를 확인한다. 30초간 같은 환경의 결과를 재사용하며 카탈로그 SELECT만 실행한다. 계정·성적·비밀번호·접속 문자열·원래 DB 오류는 반환하지 않는다. 테이블 생성이나 계정 활성화를 수행하는 API가 아니다.

`database`는 `missing`(설정 없음), `unavailable`(연결 검사 실패), `schema_missing`(필수 객체 누락), `ready`(객체 존재)로 구분한다. 마지막 값도 실제 가입/로그인/전적 저장 E2E 완료를 뜻하지 않는다. 운영 SQL은 인증된 Neon SQL Editor/관리 환경에서 실행한다.

TDD: `/tmp/harbor-account-health-red.log` 설정·준비 상태가 항상 missing인 stub에서2개 assertion 실패, `/tmp/harbor-account-health-route-red.log` 경로404 assertion 실패를 먼저 실행했다. 수정 후 DB 상태 분류·비밀/오류 비노출·Origin 제한과 기존 방/재접속11개 집중 검사 및 Worker dry-run을 통과했다. PostgreSQL WASM에서도 마이그레이션 전후 카탈로그 쿼리를 검사한다. 운영 결과는 최신 인계 기록에 남긴다.

## 사용자 제공 Auth 주소 확인 — 2026-11-07

사용자가 JWKS 주소를 제공했다. 정상 응답의 Ed25519/EdDSA 공개 키를 확인했고, 아래 Auth URL의 `/get-session`은 게임 Origin에서 HTTP200/null 및 credentials 허용으로 응답했다. 실제 로그인한 세션 검증을 뜻하지 않는다.

- Auth URL: `https://ep-lingering-field-azhtw5y3.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth`
- JWKS: Auth URL 뒤에 `/.well-known/jwks.json`을 붙인 주소

두 Worker 배포 설정에 공개 `NEON_AUTH_URL`을 반영했다. `keep_vars=true`로 대시보드에서 설정한 계정 활성화 값 등이 다음 Git 배포 때 삭제되지 않도록 한다. `DATABASE_URL`은 secret이며 Git에 넣지 않는다. 계정 활성화 값은 DB 설정 완료 전 강제로 켜지 않는다.

현재 남은 운영 설정은 **같은 Neon 브랜치에서 SQL 마이그레이션 실행 → Worker DATABASE_URL secret 등록 → ACCOUNTS_ENABLED 활성화 → Vercel 공개 Auth URL 설정·재배포 → 실계정 E2E**다. CLI/연결 도구의 인증 정보가 없어 DB와 Cloudflare 비밀 설정을 대신 변경하지 못한다. 사용자는 DB 연결 문자열을 채팅에 보내지 말고 서비스의 비밀 설정란에 직접 입력한다.


## 확정한 범위

2026-11-07 사용자 승인: 기존 Neon 프로젝트 `quiet-wind-21449169`의 이메일·비밀번호 인증. 비로그인도 봇·연습·온라인을 모두 플레이한다. 로그인한 사용자의 온라인 1대1만 서버 공식 기록으로 저장한다. 봇 기록과 기존 브라우저 개인 전적은 유지한다.

공식 전적은 다른 사람도 볼 수 있게 한다는 사용자 수정 사항을 반영했다. 공유 링크의 무작위 전적 ID, 최근 20경기, 누적 경기·승패를 공개한다. 이메일·인증 계정 ID·상대 계정·방 코드·세션 토큰은 공개하지 않는다. 가입 이름은 공통 ‘항구 대원’이며 별도 닉네임 수집은 추가하지 않았다. 계정 삭제 시 공식 전적·누적 승패·중복 방지 영수증도 삭제한다. 비밀번호는 Neon Auth에만 전달하며 게임 DB에 저장하지 않는다.

## 구현과 운영 상태를 구분

- 클라이언트: 공식 Neon SDK 지연 로드, 가입/로그인/로그아웃/세션 확인, 공개 전적 링크, 삭제 확인 UI. 서비스 설정 전에는 로비 진입 버튼을 숨기고 기존 게스트 게임을 유지한다.
- 서버: JWT EdDSA 서명·발급자·수신자·만료·역할 검사. 예약 시 검증된 내부 계정을 연결하며 입력 본문의 계정 ID를 신뢰하지 않는다. 같은 계정의 양쪽 입장을 막는다.
- 경기 서버가 10킬 승패를 확정한 경우만 기록한다. 클라이언트 결과 저장 API는 만들지 않았다. 중도 종료·게스트·봇은 공식 기록 대상이 아니다.
- 경기별 UUID와 계정별 영수증으로 중복을 막는다. 전적은 20개로 정리하되 작은 중복 방지 ID는 계정 삭제까지 유지한다. 결과는 경기 체크포인트와 별도인 Durable Object 발송 대기열에 먼저 저장하고 DB 장애 시 재시도한다. 방 종료로 대기열을 지우지 않는다.
- 공개 API는 명시적으로 허용한 필드만 반환한다. DB 접근 정보는 Worker secret에만 둔다. Auth 사용자 삭제 트리거로 게임 전적을 함께 지우고, 삭제된 사용자에게 도착한 오래된 결과는 무시한다. 유효 기간이 남은 JWT도 삭제한 프로필을 다시 만들 수 없다.
- **실제 Neon 연결·실계정 가입/로그인/삭제·운영 DB 검증은 아직 미완료다.** 2026-11-07 CLI는 미로그인이고 Vercel 환경변수에는 온라인 서버 URL만 있었다. 설정 없이 완료로 표시하지 않는다.

## 실제 연결 순서

1. 기존 Neon 프로젝트의 production 브랜치와 Free 플랜을 확인한다. Auth를 활성화하고 이메일·비밀번호 가입과 `https://project-3uu6s.vercel.app` 신뢰 도메인을 설정한다. Auth URL을 확인한다. 카드 등록/유료 플랜/새 프로젝트 생성은 하지 않는다.
2. 그 브랜치의 SQL Editor에서 `server/migrations/001-official-records.sql`을 실행한다. Managed Auth의 `neon_auth."user"`가 먼저 있어야 한다. 기존 사용자/전적을 삭제하는 마이그레이션은 아니다.
3. Cloudflare game Worker 설정에서 `DATABASE_URL`은 **비밀**로 등록한다. `NEON_AUTH_URL`에는 Auth URL을 등록한다. 실제 스키마/연결 확인 후 `ACCOUNTS_ENABLED=true`로 활성화한다. 연결 문자열을 채팅·Git·웹 환경변수에 넣지 않는다.
4. Vercel에 공개 설정 `VITE_NEON_AUTH_URL`을 추가하고 재배포한다. 서버 설정을 먼저 완료한다. `VITE_ONLINE_URL`은 현재 Worker 주소를 유지한다.
5. 실제 Neon 테스트 계정으로 가입→세션 복원→온라인 경기 종료→본인 전적/로그아웃 후 공유 링크→계정 삭제→공개 링크 404를 확인한다. 이메일을 확인해야 하는 프로젝트는 이메일 인증도 검사한다. 다른 계정의 공식 기록 변경 요청이 불가능한지 검사한다.
6. Android 일반 Chrome에서 재접속·앱 전환·로그인 쿠키를 확인한다. 타사 쿠키가 차단되는 환경은 동일 사이트 인증 프록시/도메인 구성을 검토하며, 가짜 로그인이나 브라우저 보안 해제를 안내하지 않는다. 이 확인 전에는 Android 인증 수용을 완료 처리하지 않는다.

## 무료 조건 확인 — 2026-11-07

[공식 가격](https://neon.com/pricing), [플랜·한도 초과 안내](https://neon.com/docs/introduction/plans)를 확인했다. Free는 카드 없이 $0, 프로젝트당 월100 CU-hours·저장1GB·전송5GB, Managed Better Auth 월활성6만명이다. 5분 유휴 후 절전하며 재개 지연이 있을 수 있다. 컴퓨트/전송 소진 시 다음 기간까지 정지하고 저장 한도에서는 공간 증가 작업이 실패한다. 자동 유료 전환을 구현하지 않는다. 실제 계정의 플랜/사용량은 로그인 후 확인해야 한다.

DB 장애가 렌더링/이동 루프를 기다리게 하지는 않는다. 결과 대기열은 저장 후 재시도하지만 장기간 장애·무료 한도 초과 상황에서 기록 반영 시간을 보장하지 않는다. 삭제 요청도 DB/Auth 서비스 장애 시 완료됐다고 안내하지 않는다.

최종 자동 회귀는 36파일 133개 통과. 타입/웹 프로덕션 빌드, Worker dry-run, PC/모바일 DOM 흐름, 실제 로컬 Worker 두 소켓 검사를 통과했다. 기존 3D 번들 크기 경고는 남아 있다.

## 테스트 기록

- `tests/account-auth.test.ts`, `official-records.test.ts`: 정상 stub의 요구 동작 부재를 먼저 실행해 5개 assertion 실패 후 구현·통과. 동시 완료 손실도 별도 Red→직렬 저장 수정→Green.
- `account-client.test.ts`: 실제 세션 확인과 오류 처리가 없는 상태에서 2개 실패 후 구현·통과. 토큰/비밀번호를 localStorage에 저장하지 않는다.
- `account-worker.test.ts`: 잘못된 인증이 예약되는 문제와 방 정리 시 대기열 삭제를 Red로 재현 후 수정·통과. 게스트가 보낸 계정 ID 제거도 검사한다.
- `account-online.test.ts`: 인증 헤더 누락 assertion 실패 후 연결. 초기 테스트 소켓 fixture 오류는 Red 증거에서 제외하고 fixture 수정 후 인증 누락을 다시 확인했다.
- `docs/qa/ui-flow.mjs`: 로비 계정 진입 연결 부재 assertion 실패 후 main 연결. 설정 없는 게스트 부팅·PC/모바일 기존 동작을 회귀 검사한다. `account-ui.mjs`는 계정 화면 상태·비밀번호 비움·삭제 확인·포커스/inert 복구를 검사한다. DOM 검사는 실제 인증/실기기 검사가 아니다.
- `docs/qa/official-database.mjs`: 별도 임시 PGlite(PostgreSQL WASM)에서 실제 마이그레이션/SQL을 실행해 25경기·오래된 결과 재전송·최근20개·삭제 트리거·삭제 후 재생성 차단을 확인했다. 운영 Neon DB 검사를 대신하지 않는다. 선택 실행: `HARBOR_POSTGRES_MODULE=<임시 설치 pglite의 dist/index.js 절대경로> node docs/qa/official-database.mjs`.
- 실제 로컬 Wrangler Worker와 두 WebSocket으로 게스트 대시/탄약/재접속/종료 회귀를 확인했다. 공개 배포 결과와 최종 전체 검사 수는 최신 인계 기록에 남긴다.

배포 환경 회귀: Cloudflare는 루트에서 패키지를 설치하므로 서버 전용 package.json에만 추가한 DB 라이브러리를 찾지 못했다. 별도 깨끗한 설치에서 `Could not resolve @neondatabase/serverless`를 재현한 뒤 루트에도 서버 런타임 의존성을 명시했다. 서버 node_modules가 없는 동일 환경에서 Worker dry-run을 다시 통과시켰다. 실제 배포 환경변수를 넣은 깨끗한 웹 빌드도 공개 assets와 일치했다.
