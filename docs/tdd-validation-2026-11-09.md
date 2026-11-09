# TDD 테스트 검증 — 2026-11-09

기준 커밋: `c6f3e0236568b0509d427544758a40cbe20f0bf5`.
환경: Node24.22.1, Linux. 사용자 요청은 테스트이며, 인수인계의 미승인 개선은 구현하지 않았다. 실행 소스·게임 규칙·운영 서비스 변경과 배포는 없다.

## 결과

- 기존259개 회귀 검사 통과.
- 이동 시간 신규2개: 대조군1개 통과, 긴급 입력 재현1개 실패. 전체 `npm test`는261개/72파일,260개 통과·1개 실패로 종료한다. 새 실패 테스트를 의도적으로 건너뛰거나 TODO로 바꾸지 않았다.
- 기존 PC·모바일 DOM 흐름 단언은 모두 통과. 각 환경에 추가한 사격 이벤트 검사3개는 대조군1개 통과, 이벤트 전달·명중 HUD2개 실패.
- 운영 공개 환경변수를 제공한 TypeScript/Vite 빌드 통과. 기존 큰 청크 경고는 남는다.
- `git diff --check` 통과.

## Red1: 긴급 입력의 이동 시간

`tests/online-motion-timing.test.ts`는 실제 `createOnlinePump`·`createOnlineMotion`·서버 시뮬레이션을 연결한다. 서버가 처리한 seq0의 스냅샷을 지연 전달하고, 그 사이16ms 간격 입력3개와48ms의 로컬 이동을 만든다. 요구 동작은 정확한 서버 위치에 불필요한 이동 보정이 생기지 않는 것이다.

일반50ms 입력1개는 보정 없이 통과한다.16ms 입력3개는 재생을 각50ms로 계산하여 약0.714m의 보정이 발생한다. `<0.01m` 단언이 실제로 실패했다. 서버의 정식 위치는 변하지 않았다.

## Red2: 렌더 사이 사격 이벤트 유실

`docs/qa/ui-flow.mjs --online-event-loss`는 기존 DOM 하네스에서 실제 `main.ts`의 상태 콜백과 렌더 루프를 실행한다. DOM·3D 렌더러·통신은 대역이며 스냅샷과 사격 결과는 실제 서버 시뮬레이션으로 생성한다.

사격 스냅샷을 즉시 그리면 렌더러 이벤트 전달과 명중 HUD가 정상이다. 같은 사격 스냅샷 다음에 이벤트가 빈 스냅샷을 전달한 후 그리면, 최신 tick·탄약11·상대HP75는 유지되지만 사격 이벤트가 렌더러에 전달되지 않고 명중 HUD도 숨겨져 있다. 두 단언이 PC·모바일 DOM에서 각각 실패했다. 이전 표시가 남아 거짓 통과하지 않도록 매번 표시 만료를 먼저 확인한다.

## 재실행

기본 의존성은 루트와 `server`에서 각각 `npm ci`로 준비한다. 기존 모바일 테스트는 manifest에 없는 `linkedom`을 사용한다. 이번 검증은 `linkedom@0.18.12`를 `/tmp/game-qa`에 설치하고 루트 `node_modules/linkedom`에 링크했다. manifest와 lock 파일은 변경하지 않았다.

```sh
npm test
node --test --test-isolation=none tests/online-motion-timing.test.ts
HARBOR_DOM_MODULE=/tmp/game-qa/node_modules/linkedom/esm/index.js node docs/qa/ui-flow.mjs --online-event-loss
HARBOR_DOM_MODULE=/tmp/game-qa/node_modules/linkedom/esm/index.js node docs/qa/ui-flow.mjs --mobile --online-event-loss
```

실행 로그: `/workspace/qa/tdd-2026-11-09/`의 `regression-final.log`, `motion-red.log`, `events-pc-red.log`, `events-mobile-red.log`, `build.log`. 초기 검사에서 발생한 프록시/자식 프로세스 권한·의존성 오류는 환경을 준비해 재실행했으며 기능 Red로 세지 않았다.

이번 작업은 TDD의 Red 단계와 회귀 검증이다. 최소 수정(Green)·구조 정리(Refactor)는 수행하지 않았다. 실제 Android/iPhone의 조작·GPU·FPS·발열·인터넷 품질은 이번 DOM/로컬 검사로 검증되지 않는다.
