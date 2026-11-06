# 홈 및 온라인 대전 — 2026-11-06

사용자는 홈 화면, 사람 간 대전과 봇 모드 및 추천 구성 적용을 승인했다. 기존 Vercel 웹 + Cloudflare Workers/SQLite Durable Objects 서버로 구성한다.

## 구현

홈에서 온라인 1대1 / 쉬운 봇 대전 / 표적 연습을 선택한다. 봇과 연습은 즉시 실행된다. 온라인은 방 생성·코드 입장·초대 링크·자동 매칭, 캐릭터와 시작 무기 선택을 구현했다. 서버 주소가 설정되지 않으면 준비 중으로 안내하고 연결 버튼을 비활성화한다.

온라인 서버는 방별 2명, 먼저 10킬, 3초 부활, 20Hz 고정 갱신으로 이동·벽 충돌·발사 간격·탄약·피해·점수를 판정한다. 클라이언트가 보낸 체력·피해 값은 사용하지 않는다. 연결이 끊기면 경기를 멈추고 30초 재접속 유예를 준다. 메뉴를 열면 내 입력만 멈추며 상대 경기는 계속된다. 재접속은 같은 페이지 세션에서 지원하고 페이지 새로고침은 세션을 복구하지 않는다.

## 검증과 제한

자동 검사 49개와 프로덕션 빌드 통과. PC/모바일 DOM 대역 검사, Babylon NullEngine 온라인 상태 표시·객체 정리 검사, 로컬 Worker에 실제 WebSocket 2개를 연결한 방 생성·입장·정원·서버 판정 처치·재접속·자동 매칭 검사를 사용했다. 실제 브라우저 GPU 화면 및 서로 다른 실제 기기/인터넷 검증은 남아 있다.

현재 Cloudflare 인증이 없어 서버를 공개 배포하지 못했다. `wrangler whoami`가 인증되지 않음을 확인했다. Vercel에서 `VITE_ONLINE_URL`을 설정하기 전에는 공개 사람 간 대전이 동작하지 않는다. 계정·영구 전적·랭크·지연 보상은 없다. 서버 피격 판정은 단순 캐릭터 박스와 공통 맵 장애물을 사용하며 모든 장식 메시를 반영하지 않는다. 서버 체크포인트는 2초 간격이므로 서버 재시작 시 최근 상태가 되돌아갈 수 있다.

## 무료 운영 조건

Cloudflare 공식 문서 저장소의 Durable Objects 가격 문서에서 Workers Free의 SQLite Durable Objects 지원을 확인했다. DO 요청 100,000/일, 실행 시간 13,000 GB-s/일, SQL 읽기 500만/일·쓰기 10만/일·저장 5GB. 무료 한도 초과 시 요청이 실패하며 일일 한도는 UTC 자정 초기화된다. WebSocket 수신 메시지는 20:1로 요청 환산한다. Workers 자체 무료 한도도 함께 적용된다. 무제한 무료 운영을 보장하지 않는다.

공식 근거: https://developers.cloudflare.com/durable-objects/platform/pricing/ (직접 접근 제한으로 공식 cloudflare/cloudflare-docs 저장소 원문 확인).

유료 플랜 전환·결제 수단 등록은 승인 범위가 아니다. 실제 계정의 Free 플랜 및 카드 없이 배포 가능한지 로그인 후 확인해야 한다. 현재 유료 리소스나 요금제는 생성하지 않았다.

## 최초 서버 연결

Node.js 22 이상을 설치한 컴퓨터에서 실행한다.

```sh
git clone https://github.com/dy6553/game.git
cd game/server
npm ci
npx wrangler login
npm run deploy
```

로그인할 계정은 Workers Free 플랜을 사용한다. 결제/유료 전환이 요구되면 진행하지 않는다. 배포가 출력한 `https://harbor-arena-online.<계정>.workers.dev` 주소만 공유하면 된다. 로그인 토큰이나 비밀키를 대화에 붙이지 않는다.

Vercel 프로젝트 `project-3uu6s`에 공개 환경 변수 `VITE_ONLINE_URL`을 위 주소로 설정하고 다시 빌드한다. 허용 Origin은 기존 웹 주소와 로컬 5173이며 도메인 변경 시 server/wrangler.jsonc도 갱신한다. 공개 서버에 두 기기로 접속해 방 생성 → 코드 입장 → 이동/발사/처치 → 재접속을 검증한 뒤 공개 대전 완료로 기록한다.

로컬 검증: server에서 `npm run dev`, 다른 터미널에서 `node check-online.mjs`. 웹은 루트에서 `npm run dev`; 개발 모드 기본 서버는 127.0.0.1:8787이다.
