# 이동 중 총 줍기·무기 교체 — 2026-11-07

이동 중 총 줍기·무기 교체가 안 되는 문제의 수정을 요청받았다.

## 원인과 수정

획득·슬롯·교체 취소 버튼은 click에만 연결되어 있었다. 이동·시점 터치를 유지한 비주 터치에서는 호환 click이 발생하지 않을 수 있어 요청이 누락됐다. 버튼의 기본 포인터 pointerdown에서 바로 처리하고 preventDefault로 호환 동작을 막는다. detail 0의 키보드/보조기기 click은 유지하며, 물리 클릭의 중복 요청은 무시한다. 비활성 버튼·일시정지·거리·소지·사망·온라인 검증 조건을 유지한다. 게임 규칙·서버 코드 변경 없음.

## TDD와 검증

- docs/qa/ui-flow.mjs에 이동·시점 유지 중 획득 touch-down 재현을 먼저 추가. 기존 구현에서 요청 0회/기대 1회의 assertion 실패를 실행으로 확인한 뒤 수정했다.
- PC·모바일 DOM 흐름: 이동 유지·획득·슬롯 교체·호환 click 중복 방지·키보드 활성화·일시정지 차단·가득 찬 소지품의 버릴 총 선택/취소·온라인 pickup/slot 큐 전송 및 재전송 없음 통과.
- 기존 전체147개/40파일 통과, 타입/운영 공개 설정의 웹 빌드 통과.
- 실제 Chromium 740×360 터치에서 이동·시점 손가락을 유지한 채 기관총 획득→권총 슬롯 교체 및 이동 입력 유지/런타임 예외0을 확인했다. 소프트웨어 렌더링 중 상자 범위를 벗어나지 않도록 브라우저 응답에만 테스트 브리지를 넣고 위치/속도를 고정했다(배포 소스에는 없음). 브라우저 검사는 물리 Android 수용을 대신하지 않는다.
- 로컬 증거: /workspace/qa/inventory-red.log, inventory-green-mobile.log, inventory-green-desktop.log, inventory-all-tests.log, inventory-build.log, inventory-browser.json.

수정 후 물리 Android에서 이동·시점 유지 중 획득·교체 재확인은 남는다.
