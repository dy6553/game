import {chooseOnlineNickname} from './member-nickname-entry.ts';
import {stanceStats} from './stance.ts';
import {createOnlineEvents} from './online-events.ts';
import type {ShotEvent} from './network-game.ts';
import type {ToolEvent} from './equipment.ts';
import {createOnlinePump} from './online-pump.ts';
import {installMobileBrowser} from './mobile-browser.ts';
import {ENVIRONMENT_MARKUP,createEnvironmentPanel} from './environment-panel.ts';
import {createEnvironmentPreferences,type EnvironmentPreferences} from './environment-preferences.ts';
import {createFrameLimit} from './frame-limit.ts';
import {NICKNAME_MARKUP,createNicknameDialog} from './nickname-dialog.ts';
import {WAITING_ROOM_MARKUP,createWaitingRoom,needsWaiting,rankedPlayers} from './waiting-room.ts';
import {normalizeNickname,playerName} from './nickname.ts';
import {createNameplates} from './nameplates.ts';
import {COMBAT_HUD_MARKUP,combatContacts,drawCombatMap,type Contact} from './combat-hud.ts';
import {EQUIPMENT,createGear,type EquipmentId} from './equipment.ts';
import {growth} from './progression.ts';
import {ACCOUNT_MARKUP,createAccountView} from './account-view.ts';
import {createDash,beginDash,advanceDash,cancelDash} from './dash.ts';
import {createLobbyPolish} from './lobby-polish.ts';
import {createGameChoices} from './game-choices.ts';
import {HOME_MARKUP,createHomeScreen} from './home-screen.ts';
import {createResultJournal,createResultTracker,type ResultSnapshot} from './results.ts';
import {RESULTS_MARKUP,createResultsView} from './results-view.ts';
import {BOT_DIFFICULTIES,isSurvivalDifficulty} from './duel.ts';
import {nearbyPickup,createInventory} from './inventory.ts';
import { createPlaytest } from './playtest.ts';
import { createRemoteMotion } from './remote-motion.ts';
import { createOnlineMotion } from './online-motion.ts';
import { createOnlineClient } from './online.ts';
import {onlinePlaying,wonOnline,type MatchState,type Command } from './network-game.ts';
import { simulationSteps } from './simulation.ts';
import { createRenderBudget } from './render-budget.ts';
import { sprintMultiplier } from './sprint.ts';
import { createGameAudio,spatialSound } from './audio.ts';
import {createOnlineAudio} from './online-audio.ts';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { createInput } from './input.ts';
import { createHarborScene } from './scene.ts';
import { moveWithCollisions, PROTOTYPE,harborWorld,type MapId,type Point } from './world.ts';
import { isCharacterType } from './characters.ts';
import { viewMovement } from './view.ts';
import { isWeaponId,WEAPONS,WEAPON_IDS } from './weapons.ts';
import './style.css';
import './ui-theme.css';
const readMode=(value:string):'practice'|'duel'|'ffa'|'survival'=>value==='survival'?'survival':value==='ffa'?'ffa':value==='duel'?'duel':'practice';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${HOME_MARKUP}
  ${ACCOUNT_MARKUP}
  ${ENVIRONMENT_MARKUP}
  ${NICKNAME_MARKUP}${WAITING_ROOM_MARKUP}<section id="online-lobby" class="online-lobby" hidden aria-labelledby="online-title"><div><button id="online-back">홈으로</button><h2 id="online-title">온라인 대전</h2><label>대전 방식<select id="online-mode"><option value="duel">1대1 · 먼저 10킬</option><option value="ffa">개인전 · 같은 맵 최대 20명</option><option value="team">팀전 · 최대 10대10</option></select></label><p>개인전은 먼저 10킬, 팀전은 팀 합계 30킬입니다. 개인전·팀전은1명부터 시작할 수 있고, 진행 중에도 최대20명까지 합류합니다. 1대1은2명이 필요합니다.</p><p id="online-map"></p><label>캐릭터<select id="online-character"><option value="robot">소형 로봇</option><option value="robot-cat">고양이형 로봇</option></select></label><label>시작 무기<select id="online-weapon"><option value="pistol">권총</option><option value="machinegun">기관총</option><option value="shotgun">산탄총</option><option value="sniper">저격총</option></select></label><div class="online-actions"><button id="online-create">방 만들기</button><button id="online-quick">자동 매칭</button></div><label>방 코드<input id="online-code" maxlength="8" autocomplete="off" placeholder="8자리 코드"></label><button id="online-join">코드로 입장</button><p id="online-message" role="status"></p><p>온라인 대전에서는 메뉴를 열어도 상대의 경기는 계속됩니다.</p></div></section>
  <div id="lobby-deploy-transition" class="lobby-deploy-transition" role="status" hidden><div><span>HARBOR / DEPLOYMENT</span><strong>출격 중</strong><i></i></div></div>
  ${RESULTS_MARKUP}
  <div id="mouse-aim-hint" class="mouse-only" hidden>게임 화면을 클릭해 마우스 고정 · Esc로 게임 메뉴</div>
  <canvas id="game" tabindex="0" aria-label="항구 도시 1인칭 탐색. WASD로 이동하고 마우스 이동 또는 터치 드래그로 조준합니다."></canvas>
  <header class="topbar">
    <div class="brand"><span class="eyebrow">HARBOR / FIRST PERSON</span><h1>항구의 밤<span>1인칭</span></h1></div>
    <button id="menu-toggle" aria-expanded="false" aria-controls="game-toolbar">메뉴</button>
    <div id="game-toolbar" class="toolbar" aria-label="화면 설정">
      <button id="home-open">홈으로</button><button id="online-copy" hidden>초대 링크 복사</button><button id="character-open">캐릭터 선택</button>
      <button id="pause-open">일시정지</button><button id="pointer-lock" class="mouse-only">마우스 고정</button>
      <button id="reset">출발점</button>
      <button id="practice-reset">다시 시작</button>
      <select id="game-mode" aria-label="게임 모드"><option value="duel">봇 1대1</option><option value="ffa">봇 3명 개인전</option><option value="survival">웨이브 생존</option><option value="practice">표적 연습</option></select>
      <label id="bot-difficulty-setting">봇 난이도<select id="bot-difficulty" aria-label="봇 난이도, 변경 시 새 경기"><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option><option value="auto" disabled hidden>자동 · 생존 9단계</option></select></label>
      <label class="pc-jump-setting"><select id="jump-key" aria-label="PC 점프 키 선택"><option value="Space" selected>스페이스: 점프</option><option value="KeyJ">J: 점프</option></select></label>
      <label class="weapon-setting">시작 무기 · 변경 시 새 경기<select id="weapon-select" aria-label="시작 무기 선택, 변경 시 경기 초기화"><option value="pistol">권총</option><option value="machinegun">기관총</option><option value="shotgun">산탄총</option><option value="sniper">저격총</option></select></label>
      <button id="environment-open">환경설정</button><button id="help-toggle" aria-expanded="false" aria-controls="help">도움말</button>
    </div>
  </header>
  <div class="location"><span class="live-dot"></span><span id="zone">중앙 광장</span><span class="location-divider"></span><span>해안 지구</span></div>
  <section class="help" id="help" hidden>
    <button id="help-close" class="panel-close" aria-label="도움말 닫기">닫기</button><h2>조작과 게임 안내</h2><p>수류탄 G · 섬광탄 B · 회복키트 H 또는 장비 버튼. 각 2개까지 소지하며 상자에서 얻습니다. 회복은 2초 후 50 회복하며 사격/피격 시 취소됩니다. 무기·장비 상자는 매판 야외와 건물 1·2층의 다른 위치에 놓입니다.</p><p>초록 입구와 ‘출입 가능’ 표지가 있는 건물은 1층·2층·옥상에 갈 수 있습니다. 입구에서 E 또는 문 버튼으로 문을 열고 닫습니다. 보급 상자가 가까우면 E는 획득을 우선합니다. 서쪽 계단으로 2층, 동쪽 계단으로 옥상에 오릅니다. 2층·옥상의 중앙 출구로 발코니에 나가 가장자리에서 뛰어내릴 수 있습니다. 고층 사격 시 상대 지도에 4초간 위치가 표시됩니다. C는 앉기, Z는 엎드리기이며 같은 키를 다시 누르면 일어납니다. 몹도 문과 계단으로 추격합니다. 몹은 건물 밖 지상에서만 생성됩니다. 부활 후 3초 동안 보호되며 사격하면 해제됩니다.</p><p>대시: PC F키 또는 대시 버튼. 이동 방향(멈췄다면 보는 방향)으로 4m를 0.2초에 이동하며 사용 시점부터 3초 뒤 다시 사용할 수 있습니다. 지상에서만 시작하고 대시 중 점프는 불가합니다. 사격·재장전은 가능하며 무적이나 벽 관통은 없습니다.</p><p>생존 자동 난이도는 9단계이며 보통에 해당하는 5단계에서 시작합니다. 총 20웨이브입니다. 체력 50 이상으로 2웨이브 연속 클리어하면 한 단계 상승하고, 사망 후 재도전할 때 한 단계 내려갑니다. 조준·경고 시간과 이동·좌우 이동 속도가 조금씩 변하며 전투 중에는 유지됩니다.</p><p>생존: 생명 3개, 쉬움 10·보통 20·어려움 30웨이브. 동시 최대 3명이며 첫 적 4명에서 2웨이브마다 1명씩 늘어 최대 12명입니다. 적 부활·증원 대기는 1.5초입니다. 준비 시간은 5초이며 체력·탄창을 회복합니다. 사망 시 3초 후 현재 웨이브의 적·상자와 소지 무기를 초기화해 시작 총으로 재도전합니다.</p><p>봇 3명 개인전에서는 봇끼리 싸우지 않고 나만 공격합니다. 나와 각 봇의 점수를 따로 기록하며 먼저 10킬이면 승리합니다. 사망하면 3초 후 다른 캐릭터들과 먼 지점에서 시작 총으로 부활합니다.</p><p>봇 대전은 쉬움·보통·어려움 중 선택합니다. 보통·어려움은 더 빨리 조준하고 좌우로 움직이며, 발사 경고 중에는 멈춥니다. 난이도를 변경하면 새 경기를 시작합니다.</p><p>보급 상자 근처에서 E키 또는 획득 버튼으로 무기를 줍습니다. 최대 3개를 소지하며 숫자 1~3 또는 아래 슬롯 버튼으로 바꿉니다. 가득 차면 버릴 총을 선택하세요. 상자는 20초 후 다시 나오며, 사망하면 시작 총만 남습니다.</p>
    <p>로봇의 눈높이에서 거리를 탐색합니다. 화면 중앙의 조준점이 바라보는 방향입니다.</p>
    <p><strong>PC</strong> WASD 이동 · Shift 달리기 · 마우스를 움직여 조준. 게임 중 마우스가 고정되어 화면 가장자리 없이 회전할 수 있습니다. Esc를 누르면 고정이 풀리고 게임 메뉴가 열립니다.</p>
    <p><strong>휴대폰</strong> 왼쪽 스틱 이동 · 화면 빈 공간을 좌우·위아래로 드래그해 시점 변경</p>
    <p><strong>달리기</strong> PC는 Shift를 누르고 앞으로 이동하세요. 휴대폰은 스틱 위의 달리기 버튼으로 켜고 끕니다. 이동 속도는 1.5배이며 발사·재장전·확대 조준 중에는 걷습니다. 스태미나 제한은 없습니다.</p>
    <p><strong>점프</strong> 휴대폰은 점프 버튼을 누릅니다. PC는 스페이스바로 점프합니다. 메뉴에서 J키로 변경할 수 있습니다.</p>
    <p>성능 개선을 위해 플레이 중 프레임과 온라인 연결 수치를 자동으로 수집합니다. 수집한 기록은 48시간 후 자동 삭제됩니다.</p>
    <p id="weapon-help"></p>
    <p>봇 1대1: 양쪽 체력 100, 먼저 10킬 승리. 자동 회복 없이 사망 3초 후 부활합니다. 붉은 표시가 상대 봇입니다. 봇은 1초 조준 후 위치를 고정하고 0.4초 경고 뒤 발사합니다. 경고 때 옆으로 이동하면 피할 수 있으며, 벽 뒤로 숨으면 조준이 초기화됩니다.</p>
    <p>맵을 남쪽 상점 거리와 양옆 골목으로 넓혔습니다. 중앙 거리 양쪽의 열린 출입구와 남쪽 거리의 상점, 총 6곳의 1층에 들어갈 수 있습니다. 문 버튼 없이 걸어서 출입합니다.</p>
    <p>시작 무기는 메뉴에서 선택하며 변경하면 경기를 새로 시작합니다. 기관총은 발사 버튼을 누르고 있거나 PC 마우스 고정 상태에서 왼쪽 버튼을 누르면 연사합니다. 산탄총은 탄알 6개가 퍼지며, 저격총은 확대 버튼 또는 PC Q키로 조준합니다.</p>
    <p>야경 개선: 젖은 노면의 빛, 수면 반짝임, 벽·지붕 표면과 금속 광택을 추가했습니다. 자동 화질은 지속적인 프레임 저하가 있을 때 렌더 해상도를 조절합니다. 높음은 수동 고화질, 균형은 낮은 부하 설정입니다.</p>
    <fieldset class="audio-settings"><legend>소리</legend><label><input id="audio-mute" type="checkbox"> 음소거</label><label>전체<input id="audio-master" type="range" min="0" max="100" aria-label="전체 음량"></label><label>효과음<input id="audio-effects" type="range" min="0" max="100" aria-label="효과음 음량"></label><label>환경음<input id="audio-environment" type="range" min="0" max="100" aria-label="환경음 음량"></label><button id="audio-test" type="button">좌우 소리 확인</button><small>이어폰으로 왼쪽 → 오른쪽 소리를 확인하세요.</small><small id="audio-status">시작 버튼을 누르면 소리를 켭니다.</small></fieldset>
    <label class="graphics-setting">사격 효과<select id="shot-effects"><option value="low">안정 · 섬광/화면 흔들림 최소</option><option value="full">기본 · 전체 효과</option></select></label><label class="graphics-setting">화면 흔들림<select id="screen-shake"><option value="off">끄기</option><option value="low" selected>약하게</option><option value="normal">보통</option></select></label><p>총기 반동·로봇 피격·처치 연출을 추가했습니다. 화면 흔들림은 조절할 수 있으며, 조준 방향과 무기 피해량은 바꾸지 않습니다.</p>
    <label class="sensitivity-setting">모바일 조준 감도 <output id="look-sensitivity-value">1.00배</output><input id="look-sensitivity" type="range" min="25" max="200" step="5" value="100" aria-label="모바일 조준 감도"></label>
    <details class="developer-settings"><summary>개발용 도구</summary><button id="reference-open" aria-pressed="false">시안 비교</button><p>배경 시안과 현재 맵을 비교합니다.</p></details>
    <label class="graphics-setting">그래픽 화질 <select id="graphics-quality"><option value="auto" selected>자동 · 기기에 맞춤</option><option value="high">높음 · 선명한 화면</option><option value="balanced">균형 · 부드러운 실행</option><option value="low">낮음 · 가벼운 해상도</option></select></label>
  </section>
  <div class="desktop-hint"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><p>이동 <i>·</i> 마우스를 움직여 조준</p></div>
  <div class="touch-controls">
    <button id="sprint" class="sprint-button" aria-pressed="false" aria-label="달리기 켜기">달리기</button>
    <div class="move-control"><div id="joystick" role="group" aria-label="이동 가상 스틱"><div class="stick-cross"></div><div id="joystick-thumb"></div></div><span>이동</span></div>
    <button id="fire" class="single-fire" aria-label="화면 중앙 정면으로 발사">발사</button>
    <button id="reload" class="reload-button" aria-label="무기 재장전">재장전</button>
    <button id="scope" class="scope-button" hidden aria-pressed="false">확대</button>
    <button id="dash" class="dash-button" aria-label="대시 · F키 · 재사용 대기 3초">대시</button>
    <button id="jump" class="jump-button" aria-label="점프">점프</button>
  </div>
  <section id="inventory-ui" aria-label="무기 소지와 획득"><div id="pickup-panel" hidden><span id="pickup-label"></span><button id="pickup-action">획득 · E</button><button id="pickup-cancel" hidden>취소</button></div><div id="door-panel" hidden><span>출입 가능 · 2층 / 옥상</span><button id="door-action">문 열기 · E</button></div><div id="posture-controls"><button id="crouch">앉기 · C</button><button id="prone">엎드리기 · Z</button></div><div id="equipment-slots"><button data-equipment="grenade" aria-label="수류탄"><span>수류탄</span><b>0</b><small>G</small></button><button data-equipment="flash" aria-label="섬광탄"><span>섬광탄</span><b>0</b><small>B</small></button><button data-equipment="medkit" aria-label="회복키트"><span>회복키트</span><b>0</b><small>H</small></button></div><p id="equipment-status" role="status"></p><progress id="heal-progress" max="2" value="0" hidden aria-label="회복키트 사용 진행"></progress><div id="weapon-slots"><button data-slot="0" aria-label="무기 슬롯 1">1</button><button data-slot="1" aria-label="무기 슬롯 2">2</button><button data-slot="2" aria-label="무기 슬롯 3">3</button></div></section>
  ${COMBAT_HUD_MARKUP}<p id="elevated-alert" role="status" hidden></p><div id="spawn-protection" role="status" hidden></div><div id="scope-overlay" hidden aria-hidden="true"><i></i></div>
  <aside id="match-roster" aria-label="온라인 실시간 현황" hidden><strong id="roster-title"></strong><div id="roster-lines"></div></aside><div id="flash-overlay" aria-hidden="true"></div><details id="online-scoreboard" hidden><summary>온라인 순위표 <span id="online-population"></span></summary><ol id="online-player-list"></ol></details><div id="damage-overlay" aria-hidden="true"><i id="damage-direction"></i></div><div id="impact-marker" aria-hidden="true">×</div>
  <div class="crosshair" aria-hidden="true"><i></i><b></b></div>
  <div id="shot-feedback" class="shot-feedback" role="status" hidden></div>
  <div class="look-hint">빈 화면을 드래그해 둘러보세요</div>
  <section class="practice-score" aria-label="표적 연습 현황"><div>명중 <span id="hits">0</span> · 파괴 <span id="destroyed">0</span>/3</div><div class="target-health">${[0,1,2].map(i=>`<div><span>표적 ${i+1}</span><progress id="health-${i}" max="100" value="100" aria-label="표적 ${i+1} 체력"></progress><b id="health-value-${i}">100</b></div>`).join('')}</div></section>
  <section id="duel-hud" class="duel-hud" aria-label="봇 대전 현황"><strong id="duel-score"></strong><div id="ffa-scores" hidden></div><div id="duel-health"></div><small id="network-status" hidden></small><progress id="player-health" max="100" value="100" aria-label="내 체력"></progress><div id="health-segments" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p id="duel-status" role="status"></p></section>
  <div class="ammo-hud" aria-label="무기 탄약"><span id="weapon-name">권총</span><div><b id="ammo">12</b><span id="magazine-size"> / 12</span><small>예비 ∞</small></div><p id="weapon-status">발사 준비</p><progress id="reload-progress" max="1.5" value="0" aria-label="재장전 진행" hidden></progress></div>
  <div id="practice-complete" class="practice-complete" role="status" hidden>표적 연습 완료 <button id="practice-again">다시 연습</button></div>
  <figure id="reference-panel" class="reference-panel" hidden><figcaption>기준 시안</figcaption><div class="reference-load"><p>비교할 배경 시안을 선택해 주세요</p><label>이미지 선택<input id="reference-file" type="file" accept="image/*" /></label><p id="reference-status">게임은 이미지를 선택하지 않아도 실행됩니다.</p></div><img id="reference-image" alt="선택한 배경 시안" hidden /></figure>
  <div class="live-reference-label" hidden>현재 3D 배경 · 제작 중</div><button id="comparison-close" class="comparison-close" hidden>일시정지 · 비교 닫고 게임으로</button>
  <div id="pause-indicator" class="pause-indicator" hidden><span role="status">일시정지</span><button id="pause-continue">계속하기</button></div>
  <div class="rotate-notice"><span>↻</span><h2>가로로 돌려주세요</h2><p>넓은 화면에서 이동과 조준을 함께 사용할 수 있습니다.</p></div>
  <section id="character-picker" class="character-picker" role="dialog" aria-modal="true" aria-labelledby="character-title" hidden>
    <div class="character-sheet"><span class="eyebrow">CHOOSE YOUR CHARACTER</span>
      <button id="setup-home">홈으로</button><h2 id="character-title">출발 준비</h2><p>캐릭터와 게임 모드, 시작 무기를 골라주세요. 설정을 바꾸면 새 경기를 시작합니다.</p>
      <div class="start-settings"><label>게임 모드<select id="start-mode"><option value="duel">봇 1대1</option><option value="ffa">봇 3명 개인전</option><option value="survival">웨이브 생존</option><option value="practice">표적 연습</option></select></label><label id="start-difficulty-setting">봇 난이도<select id="start-difficulty"><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option><option value="auto" disabled hidden>자동 · 생존 9단계</option></select></label><label>시작 무기<select id="start-weapon"><option value="pistol">권총</option><option value="machinegun">기관총</option><option value="shotgun">산탄총</option><option value="sniper">저격총</option></select></label></div>
      <p id="survival-mode-note" hidden>생명 3개로 쉬움 10·보통 20·어려움 30웨이브에 도전합니다. 자동은 20웨이브·5/9단계로 시작하며, 체력 50 이상으로 2웨이브 연속 클리어하면 한 단계 상승하고 사망 후 재도전하면 한 단계 내려갑니다. 5초 준비 후 시작하며, 사망하면 현재 웨이브를 시작 총으로 재도전합니다.</p>
      <p id="ffa-mode-note" hidden>봇 3명은 나만 공격합니다. 나와 각 봇이 먼저 10킬을 경쟁하며, 플레이어는 사망 3초 후 먼 지점에서 부활하고, 봇은 1.5초 후 다시 나타납니다.</p>
      <div class="character-options">
        <button data-character="robot"><span class="robot-icon" aria-hidden="true">▰<i>● ●</i></span><strong>소형 로봇</strong><span>둥근 머리 · 청록색 눈 · 작은 안테나</span><small>왼쪽 시안</small></button>
        <button data-character="robot-cat"><span class="robot-icon cat-icon" aria-hidden="true">▲ ▲<i>◆ ◆</i></span><strong>고양이형 로봇</strong><span>뾰족한 귀 · 금빛 눈 · 기계 꼬리</span><small>오른쪽 시안</small></button>
      </div><button id="character-start" class="character-start">게임 시작</button><p class="character-note">캐릭터를 고르면 오른쪽에서 실제 3D 모델을 볼 수 있습니다.</p>
    </div>
  </section>
  <section id="pause-panel" class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div><h2 id="pause-title">일시정지</h2><p id="pause-description">전투와 이동이 멈췄습니다.</p><button id="resume">계속하기</button><button id="pause-menu">게임 메뉴</button><button id="resume-locked" class="mouse-only" hidden>마우스 고정 다시 시도</button><p id="pause-lock-status" role="status"></p></div></section>
  <div class="loading" id="loading" role="status"><div class="loading-ring"></div><p>밤의 거리를 준비하고 있습니다</p></div>
  <footer class="phase-note">표적 연습 · 봇 1대1 · 봇 3명 개인전</footer>
`;

const mobileBrowser=installMobileBrowser();
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
for(const select of document.querySelectorAll<HTMLSelectElement>('select'))if([...select.options].some(o=>o.value==='robot'))select.insertAdjacentHTML('beforeend','<option value="welder" disabled>용접 로봇 · Lv3</option>');
for(const select of document.querySelectorAll<HTMLSelectElement>('select'))if([...select.options].some(o=>o.value==='pistol'))for(const id of WEAPON_IDS)if(![...select.options].some(o=>o.value===id))select.insertAdjacentHTML('beforeend',`<option value="${id}">${WEAPONS[id].name}</option>`);
const loading = document.querySelector<HTMLDivElement>('#loading')!;
async function start() {
  if (!Engine.IsSupported) throw new Error('이 브라우저에서 WebGL을 사용할 수 없습니다. 하드웨어 가속을 켜거나 다른 브라우저를 사용해 주세요.');
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, false);
  const mobile=matchMedia('(pointer: coarse)').matches;
  let settingsStorage:Storage|null=null;try{settingsStorage=localStorage;}catch{}const preferences=createEnvironmentPreferences(settingsStorage),frameLimit=createFrameLimit(preferences.value.fps);
  const savePreference=(value:Partial<EnvironmentPreferences>)=>{const next=preferences.patch(value);document.querySelector('#environment-save-status')!.textContent=preferences.saved?'설정은 이 브라우저에 자동 저장됩니다.':'저장할 수 없어 이번 접속에만 적용됩니다.';return next;};
  let graphicsMode=preferences.value.graphics;
  const densityCap=()=>Math.min(window.devicePixelRatio||1,graphicsMode==='high'?2:graphicsMode==='balanced'?1:graphicsMode==='low'?.7:1);
  let budget=createRenderBudget(densityCap()),qualityHigh=graphicsMode==='high';
  engine.setHardwareScalingLevel(1/budget.density);
  const playtest=createPlaytest(import.meta.env?.VITE_ONLINE_URL);
  let selectedMap:MapId='harbor';
  const harborArtSource=(high:boolean)=>'/maps/harbor-full-'+(high?'high':'low')+'.glb';
  let world = createHarborScene(engine,{mapArtSource:harborArtSource});
  const nearbyDoor=(p:Point,doors:Parameters<typeof world.geometry.nearbyDoor>[1])=>(world.geometry??harborWorld).nearbyDoor(p,doors);
  const indoorAt=(p:Point)=>(world.geometry??harborWorld).indoorAt(p);
  world.setQuality(qualityHigh);world.setShadows?.(preferences.value.shadows);document.querySelector<HTMLSelectElement>('#graphics-quality')!.value=graphicsMode;
  world.setPerformanceLow?.(graphicsMode==='low');
  world.setMode('duel');
  const shake=document.querySelector<HTMLSelectElement>('#screen-shake')!;
  const setShake=(value:string)=>{const level=value==='off'||value==='normal'?value:'low';shake.value=level;world.setShake(level);return level;};
  let savedShake=mobile?'off':'low';try{savedShake=localStorage.getItem('harbor-screen-shake')??savedShake;}catch{}setShake(savedShake);
  shake.addEventListener('change',()=>{const level=setShake(shake.value);try{localStorage.setItem('harbor-screen-shake',level);}catch{}});
  document.querySelector<HTMLSelectElement>('#graphics-quality')!.addEventListener('change',event=>{
    graphicsMode=savePreference({graphics:(event.currentTarget as HTMLSelectElement).value as EnvironmentPreferences['graphics']}).graphics;budget=createRenderBudget(densityCap());
    engine.setHardwareScalingLevel(1/budget.density);qualityHigh=graphicsMode==='high';
    world.setQuality(qualityHigh);world.setPerformanceLow?.(graphicsMode==='low');engine.resize();world.resize();
  });
  const effectsSetting=document.querySelector<HTMLSelectElement>('#shot-effects')!;let reducedShots=mobile;try{const saved=localStorage.getItem('harbor-shot-effects');if(saved)reducedShots=saved==='low';}catch{}effectsSetting.value=reducedShots?'low':'full';world.setReducedShots?.(reducedShots);effectsSetting.addEventListener('change',()=>{reducedShots=effectsSetting.value==='low';world.setReducedShots?.(reducedShots);try{localStorage.setItem('harbor-shot-effects',effectsSetting.value);}catch{}});
  const input = createInput(canvas,{mouseScale:()=>world.scoped?.3:1,requestMouseLock:()=>requestGameplayMouseLock(),smoothLook:true});
  input.setEnabled(false);input.setInvertY(preferences.value.invertY);input.setMouseSensitivity?.(preferences.value.mouse);input.setJumpKey(preferences.value.jump);document.querySelector<HTMLSelectElement>('#jump-key')!.value=preferences.value.jump;
  const sensitivity=document.querySelector<HTMLInputElement>('#look-sensitivity')!;
  const setSensitivity=(value:number)=>{
    const next=Number.isFinite(value)?Math.max(.25,Math.min(2,value)):1;
    input.setTouchSensitivity(next);sensitivity.value=String(next*100);
    document.querySelector('#look-sensitivity-value')!.textContent=`${next.toFixed(2)}배`;
    return next;
  };
  let savedSensitivity=1;
  try{const saved=localStorage.getItem('harbor-touch-sensitivity');if(saved!==null)savedSensitivity=Number(saved);}catch{/* Storage is optional. */}
  setSensitivity(savedSensitivity);
  sensitivity.addEventListener('input',()=>{const next=setSensitivity(Number(sensitivity.value)/100);try{localStorage.setItem('harbor-touch-sensitivity',String(next));}catch{}});
  const journal=createResultJournal({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)}),resultTracker=createResultTracker();
  let shownResult='';let localDash=createDash(),predictionDash=false,predictionJump=false;
  const audio=createGameAudio();const reducedLobbyMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const lobbyCue=(kind:'ui'|'deploy')=>{void audio.unlock().then(()=>{if(!document.hidden&&document.hasFocus())audio.playInterface(kind);});};
  document.addEventListener('pointerdown',()=>{void audio.unlock();});
  document.addEventListener('keydown',()=>{void audio.unlock();});
  for(const key of ['master','effects','environment'] as const){const slider=document.querySelector<HTMLInputElement>(`#audio-${key}`)!;slider.value=String(audio.settings[key]*100);slider.addEventListener('input',()=>audio.configure({[key]:Number(slider.value)/100}));}
  const mute=document.querySelector<HTMLInputElement>('#audio-mute')!;mute.checked=audio.settings.muted;mute.addEventListener('change',()=>audio.configure({muted:mute.checked}));
  document.querySelector('#audio-test')!.addEventListener('click',()=>{void audio.unlock().then(()=>{if(!document.hidden&&document.hasFocus())audio.preview();});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause(true);audio.setInterfaceActive(false);}});
  window.addEventListener('blur',()=>{audio.pause(true);audio.setInterfaceActive(false);});
  let lastReload=0,lastGrounded=true,lastPlayerHealth=100,lastRespawn=0,footDistance=0,footAlternating=false,emptyAt=0;

  document.querySelector<HTMLSelectElement>('#jump-key')!.addEventListener('change',event=>{
    const code=(event.currentTarget as HTMLSelectElement).value;
    if(code==='Space'||code==='KeyJ'){input.reset();input.setJumpKey(code);savePreference({jump:code});if(!settingsView.isOpen)canvas.focus();}
  });
  const onlineShots=createOnlineEvents<ShotEvent>(),onlineTools=createOnlineEvents<ToolEvent>();
  let elevatedAlertUntil=0,lastRevealEvent=-1;
  let onlineState:MatchState|null=null,onlineId='',onlineActive=false,onlineEventId=-1;
  let onlineStatus='',onlineCode='';let resultOnlineTick:number|null=null,resultOnlineReady=false;const onlineMotion=createOnlineMotion(m=>playtest.correction(m)),remoteMotion=createRemoteMotion();
  const onlineLobby=document.querySelector<HTMLElement>('#online-lobby')!;
  let currentGrowth=growth(0),growthLoggedIn=false;
  const accountView=createAccountView(import.meta.env?.VITE_NEON_AUTH_URL??'',import.meta.env?.VITE_ONLINE_URL??'',undefined,(g,loggedIn)=>{
   currentGrowth=g;growthLoggedIn=loggedIn;const factory=document.querySelector<HTMLOptionElement>('#home-map option[value=factory]')!;factory.disabled=!loggedIn||g.level<3;factory.textContent=factory.disabled?'폐공장 · Lv3 해금':'폐공장';if(factory.disabled)document.querySelector<HTMLSelectElement>('#home-map')!.value='harbor';homeView.setTier(loggedIn?g.tier:0);
   document.querySelector('#growth-summary')!.textContent=loggedIn?`Lv${g.level} · ${g.xp.toLocaleString('ko-KR')} XP ▾`:'성장 기록 · 로그인 ▾';
   document.querySelector<HTMLProgressElement>('#growth-progress')!.value=g.within;document.querySelector('#growth-next')!.textContent=loggedIn?`다음 레벨까지 ${200-g.within} XP · 봇 강화 ${g.tier}단계`:'로그인하면 성장 기록을 서버에 저장합니다.';
   for(const option of document.querySelectorAll<HTMLOptionElement>('option[value=welder]')){option.disabled=!loggedIn||g.level<3;option.textContent=option.disabled?'용접 로봇 · Lv3 해금':'용접 로봇';if(option.disabled&&option.selected){(option.parentElement as HTMLSelectElement).value='robot';if(world.characterType==='welder')world.selectCharacter('robot');}}
  });
  let growthTicket:ReturnType<typeof accountView.startGrowth>=Promise.resolve(null);

  const nicknameDialog=createNicknameDialog(),waitingView=createWaitingRoom(),nameplates=createNameplates();let roomWaiting=false,guestPromptPending=false;
  const onlineAudio=createOnlineAudio();
  const online=createOnlineClient(import.meta.env?.VITE_ONLINE_URL??(import.meta.env?.DEV?'http://127.0.0.1:8787':''),(state,id)=>{
    playtest.packet();document.querySelector<HTMLSelectElement>('#online-mode')!.value=state.mode??'duel';onlineShots.receive(state.events);onlineTools.receive(state.toolEvents??[]);if(settingsView.isOpen||document.hidden){onlineShots.drain();onlineTools.drain();}onlineState=state;onlineId=id;onlineMotion.receive(state,id);remoteMotion.receive(state,id,performance.now());
    if(!onlineActive)lastRevealEvent=-1;for(const event of state.events)if(event.id>lastRevealEvent){lastRevealEvent=event.id;const shooter=state.players.find(p=>p.id===event.player),self=state.players.find(p=>p.id===id);if(event.elevated&&(event.player===id||self?.team===undefined||shooter?.team!==self.team)){const alert=document.querySelector<HTMLElement>('#elevated-alert')!;alert.textContent=event.player===id?'고층 사격 · 내 위치가 4초간 노출됩니다':'고층 사격 감지 · 미니맵에 4초간 표시';elevatedAlertUntil=performance.now()+4000;combatHudAt=-Infinity;}}
    const me=state.players.find(p=>p.id===id),wasActive=onlineActive,wasWaiting=roomWaiting;
    roomWaiting=needsWaiting(state,id)||!!me?.guest&&!normalizeNickname(me.nickname);
    if(!onlineActive){onlineActive=true;homeOpen=false;home.hidden=true;onlineLobby.hidden=true;picker.hidden=true;manualPaused=false;pausePanel.hidden=true;document.body.classList.remove('at-home');gameChoices.close();}
    document.body.classList.toggle('in-waiting-room',roomWaiting);
    if(roomWaiting){waitingView.show(state,id,onlineCode,online.connected);nameplates.clear();input.reset();input.setEnabled(false);if(!wasWaiting){world.endOnline();world.setPreview(true,true);}}
    else{waitingView.hide();if(!wasActive||wasWaiting){switchMap(state.map==='factory'?'factory':'harbor',me?.character??'robot');lobbyPolish.deploy();lobbyCue('deploy');world.setPreview(false);if(me){world.selectCharacter(me.character);world.selectWeapon(me.weaponId);input.resetLook();input.setLook(me.yaw,me.pitch);}hasPlayed=true;canvas.focus();}}
    if(me?.guest&&!normalizeNickname(me.nickname)&&online.connected&&!guestPromptPending){guestPromptPending=true;void nicknameDialog.open(false).then(name=>{if(!onlineActive)return;if(!name){openHome();return;}online.control('nickname',name);});}else if(me?.nickname)guestPromptPending=false;
    for(const cue of onlineAudio.update(state,id,input.look.yaw,canUseInventory()&&online.connected))audio.play(cue.kind,cue.pan,cue.volume);
    observeOnlineResult(state,id);
  },status=>{if(status!=='대전 중'&&status!=='경기 종료')resultOnlineReady=false;onlineStatus=status;document.querySelector('#online-message')!.textContent=status;document.querySelector('#waiting-status')!.textContent=status;if(status.startsWith('연결 복구 중')||status.startsWith('방 연결 종료')){for(const p of onlineState?.players??[])if(p.guest)delete p.nickname;nameplates.clear();document.querySelector('#online-player-list')!.replaceChildren();document.querySelector('#roster-lines')!.replaceChildren();nicknameDialog.cancel();guestPromptPending=false;if(onlineState&&roomWaiting)waitingView.show(onlineState,onlineId,onlineCode,false);}},session=>{onlineShots.reset();onlineTools.reset();onlineToolEventId=-1;onlineAudio.reset();predictionDash=predictionJump=false;onlineCode=session.code;resultTracker.start();shownResult='';resultOnlineTick=null;resultOnlineReady=false;resultView.hide();},()=>accountView.token());
  let pendingDoor:string|undefined;
  let pendingEquipment:EquipmentId|undefined;let onlineToolEventId=-1;
  let onlineBoardKey='';const onlineBoard=document.querySelector<HTMLDetailsElement>('#online-scoreboard')!;onlineBoard.addEventListener('toggle',()=>{if(onlineBoard.open){onlineBoardKey='';input.reset();}});
  let pendingSlot:number|undefined,pendingTake:{pickup:string;replace?:number}|undefined,choosePickupId:string|undefined;
  const inventoryUi=document.querySelector<HTMLElement>('#inventory-ui')!,slotButtons=[...document.querySelectorAll<HTMLButtonElement>('#weapon-slots button')];
  function inventoryData(){
    if(onlineActive&&onlineState){const me=onlineState.players.find(p=>p.id===onlineId)!;return {inventory:me.inventory??createInventory(me.weaponId),pickups:onlineState.pickups??[],position:me,ready:!!me.inventory&&!!onlineState.pickups,blocked:me.health===0||!!onlineState.winner||!onlinePlaying(onlineState,onlineId)||!online.connected};}
    const battle=world.duelState();return {...world.inventoryState(),position,ready:true,blocked:battle.playerHealth===0||!!battle.winner};
  }
  function canUseInventory(){return !settingsView.isOpen&&!roomWaiting&&!nicknameDialog.isOpen&&!onlineBoard.open&&!lobbyPolish.deploying&&!gameChoices.isOpen&&!resultView.isOpen&&!homeOpen&&!manualPaused&&picker.hidden&&!menuOpen&&help.hidden&&!comparing&&!document.hidden&&document.hasFocus()&&!matchMedia('(pointer: coarse) and (orientation: portrait)').matches;}
  function requestPickup(replace?:number){
    if(!canUseInventory())return;const data=inventoryData(),crate=nearbyPickup(data.position,data.pickups);if(data.blocked||!data.ready||!crate)return;
    if(!crate.equipmentId&&data.inventory.slots.some(s=>s.id===crate.weaponId)){notice='이미 가진 무기입니다';noticeTime=1;return;}
    if(!crate.equipmentId&&data.inventory.slots.length===3&&replace===undefined){choosePickupId=crate.id;return;}
    if(onlineActive)pendingTake={pickup:crate.id,replace};else if(world.pickup(data.position,crate.id,replace)==='added')audio.play('pickup');choosePickupId=undefined;
  }
  function requestSlot(slot:number){if(!canUseInventory())return;const data=inventoryData();if(data.blocked||!data.ready)return;if(choosePickupId){requestPickup(slot);return;}if(onlineActive)pendingSlot=slot;else if(world.switchWeapon(slot))audio.play('equip');}
  // Non-primary touches do not reliably produce click while movement/look are held.
  function bindInventoryAction(button:HTMLButtonElement,action:()=>void){
    button.addEventListener('pointerdown',event=>{if(event.button!==0||button.disabled)return;event.preventDefault();action();});
    button.addEventListener('click',event=>{if(event.detail===0&&!button.disabled)action();});
  }
  function requestDoor(){
    if(!canUseInventory())return;const data=inventoryData(),doors=onlineActive?onlineState?.doors:world.doorState?.();if(data.blocked||!doors)return;
    const door=nearbyDoor(data.position,doors);if(!door)return;
    if(onlineActive)pendingDoor=door.id;else world.toggleDoor(data.position,door.id);
  }
  bindInventoryAction(document.querySelector<HTMLButtonElement>('#door-action')!,requestDoor);
  slotButtons.forEach((button,i)=>bindInventoryAction(button,()=>requestSlot(i)));
  bindInventoryAction(document.querySelector<HTMLButtonElement>('#pickup-action')!,()=>requestPickup());
  bindInventoryAction(document.querySelector<HTMLButtonElement>('#pickup-cancel')!,()=>{choosePickupId=undefined;});
  window.addEventListener('keydown',event=>{const tag=(event.target as HTMLElement|null)?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag??''))return;if(event.code==='Escape')choosePickupId=undefined;if(!canUseInventory()||event.repeat)return;if(event.code==='KeyE'){event.preventDefault();const data=inventoryData();if(nearbyPickup(data.position,data.pickups))requestPickup();else requestDoor();}if(/^Digit[123]$/.test(event.code)){event.preventDefault();requestSlot(Number(event.code.slice(-1))-1);}});
  function refreshInventory(){
    inventoryUi.hidden=homeOpen||!picker.hidden||comparing;if(inventoryUi.hidden)return;
    const data=inventoryData(),crate=nearbyPickup(data.position,data.pickups)??data.pickups.filter(c=>c.remaining>0&&Math.abs((c.y??0)-(data.position.y??0))<1.5&&Math.hypot(c.x-data.position.x,c.z-data.position.z)<=2.5).sort((a,b)=>Math.hypot(a.x-data.position.x,a.z-data.position.z)-Math.hypot(b.x-data.position.x,b.z-data.position.z))[0];if(!crate||crate.remaining>0||crate.id!==choosePickupId||data.blocked)choosePickupId=undefined;
    slotButtons.forEach((button,i)=>{const slot=data.inventory.slots[i],text=slot?`${i+1} · ${WEAPONS[slot.id].name}${choosePickupId?' 버리기':''}`:`${i+1} · 비어 있음`;if(button.textContent!==text)button.textContent=text;button.disabled=!slot||data.blocked||!canUseInventory()||!data.ready;button.setAttribute('aria-pressed',String(i===data.inventory.active));});
    const doors=onlineActive?onlineState?.doors:world.doorState?.(),door=doors?nearbyDoor(data.position,doors):undefined;
    const doorPanel=document.querySelector<HTMLElement>('#door-panel')!,doorAction=document.querySelector<HTMLButtonElement>('#door-action')!;
    doorPanel.hidden=!door||!!crate||data.blocked||!canUseInventory();doorAction.disabled=data.blocked;doorAction.textContent=door&&doors?.[door.id]?'문 닫기 · E':'문 열기 · E';
    const panel=document.querySelector<HTMLElement>('#pickup-panel')!;panel.hidden=!crate||data.blocked||!canUseInventory()||!data.ready;
    if(crate){const duplicate=crate.equipmentId?(readGear().gear[crate.equipmentId]>=2):data.inventory.slots.some(s=>s.id===crate.weaponId),waiting=crate.remaining>0,name=crate.equipmentId?EQUIPMENT[crate.equipmentId].name:WEAPONS[crate.weaponId].name;document.querySelector('#pickup-label')!.textContent=waiting?`${name} 보급 상자 · ${Math.ceil(crate.remaining)}초 후 재보급`:choosePickupId?'버릴 무기를 아래에서 고르세요':`${name} 보급 상자${duplicate?' · 이미 소지 중':''}`;const action=document.querySelector<HTMLButtonElement>('#pickup-action')!;action.disabled=waiting||duplicate||!!choosePickupId;action.textContent=waiting?'재보급 대기':'획득 · E';document.querySelector<HTMLElement>('#pickup-cancel')!.hidden=!choosePickupId;}
  }
  let onlineControlsActive=false;const updateOnlineControls=(active:boolean)=>{if(active===onlineControlsActive)return;onlineControlsActive=active;document.querySelector<HTMLElement>('#online-copy')!.hidden=!active;for(const id of ['character-open','game-mode','bot-difficulty','weapon-select','practice-reset','reset'])document.querySelector<HTMLButtonElement>('#'+id)!.disabled=active;};
  document.querySelector('#online-copy')!.addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('room',onlineCode);try{await navigator.clipboard.writeText(url.href);document.querySelector('#online-copy')!.textContent='초대 링크 복사됨';}catch{document.querySelector('#online-copy')!.textContent=`방 코드 ${onlineCode}`;}});
  const openOnlineLobby=()=>{document.querySelector('#online-map')!.textContent='선택 전장 · '+(selectedMap==='factory'?'폐공장 · Lv3':'항구 지구');gameChoices.close();home.hidden=true;onlineLobby.hidden=false;document.querySelector('#online-message')!.textContent=online.available?'방을 만들거나 친구의 코드를 입력하세요.':'온라인 서버 연결 준비 중입니다. 봇 대전과 표적 연습은 바로 이용할 수 있습니다.';for(const id of ['online-create','online-join','online-quick'])document.querySelector<HTMLButtonElement>('#'+id)!.disabled=!online.available;};
  for(const [id,action] of [['online-create','create'],['online-join','join'],['online-quick','quick']] as const)document.querySelector('#'+id)!.addEventListener('click',async()=>{
    const buttons=['online-create','online-join','online-quick'].map(id=>document.querySelector<HTMLButtonElement>('#'+id)!);buttons.forEach(button=>button.disabled=true);
    try{const identity=await accountView.onlineIdentity();const nickname=await chooseOnlineNickname(identity,(member,save,initial)=>nicknameDialog.open(member,save,initial),name=>accountView.saveNickname(name));if(!nickname)return;await online.enter(action,document.querySelector<HTMLInputElement>('#online-code')!.value.trim().toUpperCase(),document.querySelector<HTMLSelectElement>('#online-weapon')!.value,document.querySelector<HTMLSelectElement>('#online-character')!.value,selectedMap,document.querySelector<HTMLSelectElement>('#online-mode')!.value,nickname);}catch(error){document.querySelector('#online-message')!.textContent=error instanceof Error?error.message:'방에 입장하지 못했습니다.';}finally{buttons.forEach(button=>button.disabled=!online.available);}
  });
  document.querySelector('#waiting-start')!.addEventListener('click',()=>online.control('start'));document.querySelector('#waiting-deploy')!.addEventListener('click',()=>online.control('deploy'));document.querySelector('#waiting-leave')!.addEventListener('click',()=>openHome());document.querySelector('#waiting-copy')!.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(onlineCode);document.querySelector('#waiting-status')!.textContent='방 코드를 복사했습니다.';}catch{document.querySelector('#waiting-status')!.textContent='초대 코드 '+onlineCode;}});
  let homeOpen=true;
  let manualPaused=false,hasPlayed=false,wasLocked=false;
  let mouseLockPending=false,mouseLockFallback=false;
  const pausePanel=document.querySelector<HTMLElement>('#pause-panel')!;
  const aimHint=document.querySelector<HTMLElement>('#mouse-aim-hint')!;
  const lockStatus=document.querySelector<HTMLElement>('#pause-lock-status')!;
  const retryLock=document.querySelector<HTMLButtonElement>('#resume-locked')!;
  const pauseGame=()=>{
    if(settingsView.isOpen||!hasPlayed||homeOpen||roomWaiting||!picker.hidden||resultView.isOpen||gameChoices.isOpen)return;
    manualPaused=true;input.setEnabled(false);audio.pause(true);
    if(document.pointerLockElement)document.exitPointerLock();
    pausePanel.hidden=false;document.querySelector<HTMLButtonElement>('#resume')!.focus();
  };
  const resumeGame=()=>{manualPaused=false;pausePanel.hidden=true;input.reset();canvas.focus();};
  const reportMouseLock=()=>{
    if(!mouseLockPending)return;
    mouseLockPending=false;mouseLockFallback=true;retryLock.hidden=false;
    lockStatus.textContent='마우스를 고정하지 못했습니다. 계속하기를 누르면 커서로 조준할 수 있습니다.';
    aimHint.textContent='마우스 고정 실패 · 게임 메뉴에서 다시 시도';
    pauseGame();
  };
  document.addEventListener('pointerlockerror',reportMouseLock);
  function lockMouse(){
    if(document.pointerLockElement===canvas||mouseLockPending)return true;
    if(!canvas.requestPointerLock){
      aimHint.textContent='이 브라우저에서는 커서로 조준합니다.';
      return false;
    }
    mouseLockPending=true;
    try{canvas.requestPointerLock()?.catch(reportMouseLock);}
    catch{reportMouseLock();}
    return true;
  }
  function requestGameplayMouseLock(){return !mobile&&!mouseLockFallback&&lockMouse();}
  function retryMouseLock(){mouseLockFallback=false;canvas.focus();lockMouse();}
  document.querySelector('#pause-open')!.addEventListener('click',pauseGame);
  document.querySelector('#resume')!.addEventListener('click',()=>{resumeGame();requestGameplayMouseLock();});
  retryLock.addEventListener('click',()=>{resumeGame();retryMouseLock();});
  document.querySelector('#pointer-lock')!.addEventListener('click',retryMouseLock);
  document.addEventListener('pointerlockchange',()=>{
    const locked=document.pointerLockElement===canvas,unlocked=wasLocked&&!locked;
    wasLocked=locked;mouseLockPending=false;
    if(locked){
      if(homeOpen||roomWaiting||manualPaused||!picker.hidden||settingsView.isOpen||resultView.isOpen){
        document.exitPointerLock();return;
      }
      lockStatus.textContent='';retryLock.hidden=true;
      aimHint.textContent='게임 화면을 클릭해 마우스 고정 · Esc로 게임 메뉴';
    }
    if(unlocked&&!manualPaused&&!menuOpen&&!comparing&&help.hidden&&canOpenGameMenu())openGameMenu();
  });
  window.addEventListener('blur',pauseGame);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
  let menuOpen=false;
  const menuButton=document.querySelector<HTMLButtonElement>('#menu-toggle')!;
  const closeMenu=()=>{menuOpen=false;document.body.classList.remove('menu-open');menuButton.setAttribute('aria-expanded','false');menuButton.textContent='메뉴';input.reset();};
  function canOpenGameMenu(){
    return hasPlayed&&!homeOpen&&!roomWaiting&&picker.hidden&&!settingsView.isOpen&&!resultView.isOpen&&!gameChoices.isOpen;
  }
  function openGameMenu(){
    manualPaused=false;pausePanel.hidden=true;menuOpen=true;
    document.body.classList.add('menu-open');menuButton.setAttribute('aria-expanded','true');menuButton.textContent='계속하기';
    input.setEnabled(false);closeHelp();
    if(document.pointerLockElement)document.exitPointerLock();
    menuButton.focus();
  }
  document.querySelector('#pause-menu')!.addEventListener('click',openGameMenu);
  menuButton.addEventListener('click',()=>{
    if(menuOpen){closeMenu();canvas.focus();requestGameplayMouseLock();}
    else if(canOpenGameMenu())openGameMenu();
  });
  document.querySelector('#game-toolbar')!.addEventListener('click',event=>{if((event.target as HTMLElement).closest('button'))closeMenu();});
  document.querySelector('#game-toolbar')!.addEventListener('change',closeMenu);
  let comparing=false;
  const referenceButton=document.querySelector<HTMLButtonElement>('#reference-open')!;
  const referenceFile=document.querySelector<HTMLInputElement>('#reference-file')!;
  const referenceImage=document.querySelector<HTMLImageElement>('#reference-image')!;
  const referenceStatus=document.querySelector<HTMLElement>('#reference-status')!;
  referenceFile.addEventListener('change',()=>{
    const file=referenceFile.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onerror=()=>{referenceStatus.textContent='이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.';};
    reader.onload=()=>{
      referenceImage.onload=()=>{referenceImage.hidden=false;referenceStatus.textContent='시안을 불러왔습니다.';};
      referenceImage.onerror=()=>{referenceImage.hidden=true;referenceStatus.textContent='지원하지 않는 이미지입니다. PNG 또는 JPG를 선택해 주세요.';};
      referenceImage.src=String(reader.result);
    };
    reader.readAsDataURL(file);
  });
  const setComparison=(value:boolean)=>{
    comparing=value;input.reset();world.setReference(value);
    document.body.classList.toggle('comparing',value);
    document.querySelector<HTMLElement>('#reference-panel')!.hidden=!value;
    document.querySelector<HTMLElement>('.live-reference-label')!.hidden=!value;
    document.querySelector<HTMLElement>('#comparison-close')!.hidden=!value;
    referenceButton.textContent=value?'1인칭 돌아가기':'시안 비교';
    referenceButton.setAttribute('aria-pressed',String(value));
    if(document.pointerLockElement)document.exitPointerLock();
    engine.resize();world.resize();
  };
  referenceButton.addEventListener('click',()=>{setComparison(!comparing);document.querySelector<HTMLElement>('#help')!.hidden=true;document.querySelector('#help-toggle')!.setAttribute('aria-expanded','false');});
  document.querySelector('#comparison-close')!.addEventListener('click',()=>{setComparison(false);canvas.focus();});
  const picker = document.querySelector<HTMLElement>('#character-picker')!;
  const openCharacter = document.querySelector<HTMLButtonElement>('#character-open')!;
  const choices = [...document.querySelectorAll<HTMLButtonElement>('[data-character]')];
  const startButton = document.querySelector<HTMLButtonElement>('#character-start')!;
  const refreshCharacter = () => choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.character === world.characterType)));
  const openPicker = () => { picker.hidden=false;setComparison(false);input.setEnabled(false);document.querySelector<HTMLSelectElement>('#start-mode')!.value=document.querySelector<HTMLSelectElement>('#game-mode')!.value;document.querySelector<HTMLSelectElement>('#start-difficulty')!.value=document.querySelector<HTMLSelectElement>('#bot-difficulty')!.value;document.querySelector<HTMLSelectElement>('#start-weapon')!.value=document.querySelector<HTMLSelectElement>('#weapon-select')!.value;input.reset();world.setPreview(true);refreshCharacter();choices[0]!.focus(); };
  const home=document.querySelector<HTMLElement>('#home-screen')!;
  const openHome=()=>{settingsView.close();roomWaiting=false;guestPromptPending=false;nicknameDialog.cancel();waitingView.hide();nameplates.clear();document.querySelector('#online-player-list')!.replaceChildren();document.querySelector('#roster-lines')!.replaceChildren();document.body.classList.remove('in-waiting-room');onlineBoard.open=false;pendingEquipment=undefined;onlineToolEventId=-1;void accountView.refreshGrowth().catch(()=>{});predictionDash=predictionJump=false;localDash=cancelDash(localDash);lobbyPolish.cancelDeploy();lobbyPolish.cancelDrag();gameChoices.close();syncHomeSelection();resultTracker.cancel();resultView.hide();online.leave();onlineMotion.reset();remoteMotion.reset();onlineAudio.reset();pendingDoor=undefined;pendingSlot=undefined;pendingTake=undefined;choosePickupId=undefined;onlineActive=false;onlineState=null;onlineShots.reset();onlineTools.reset();onlineId='';onlineEventId=-1;world.endOnline();onlineLobby.hidden=true;updateOnlineControls(false);homeOpen=true;home.hidden=false;document.body.classList.add('at-home');manualPaused=false;pausePanel.hidden=true;closeMenu();document.querySelector<HTMLElement>('#help')!.hidden=true;picker.hidden=true;setComparison(false);input.setEnabled(false);world.setPreview(true,true);document.querySelector<HTMLButtonElement>('#home-start')!.focus();};
  document.querySelector('#online-back')!.addEventListener('click',openHome);
  document.querySelector('#home-open')!.addEventListener('click',openHome);
  document.querySelector('#setup-home')!.addEventListener('click',openHome);
  openCharacter.addEventListener('click', openPicker);
  choices.forEach(button => button.addEventListener('click', () => {
    const type = button.dataset.character;
    if (!isCharacterType(type)) return;
    world.selectCharacter(type); refreshCharacter(); input.reset();
  }));
  let homeMatchPending=true;
  const syncDifficultyOptions=()=>{
    for(const [modeId,levelId] of [['game-mode','bot-difficulty'],['start-mode','start-difficulty']]){
      const mode=document.querySelector<HTMLSelectElement>('#'+modeId)!,level=document.querySelector<HTMLSelectElement>('#'+levelId)!;
      const option=level.querySelector<HTMLOptionElement>('option[value="auto"]')!;option.disabled=option.hidden=mode.value!=='survival';
      if(option.disabled&&level.value==='auto')level.value='normal';
    }
  };
  document.querySelector('#start-mode')!.addEventListener('change',syncDifficultyOptions);
  const beginGame=()=>{
    syncDifficultyOptions();
    const mode=document.querySelector<HTMLSelectElement>('#game-mode')!;
    const weapon=document.querySelector<HTMLSelectElement>('#weapon-select')!;
    const nextMode=document.querySelector<HTMLSelectElement>('#start-mode')!.value;
    const nextWeapon=document.querySelector<HTMLSelectElement>('#start-weapon')!.value;
    const nextDifficulty=document.querySelector<HTMLSelectElement>('#start-difficulty')!.value;const difficulty=document.querySelector<HTMLSelectElement>('#bot-difficulty')!;
    const changed=mode.value!==nextMode||weapon.value!==nextWeapon||difficulty.value!==nextDifficulty;
    mode.value=nextMode;weapon.value=nextWeapon;if(isSurvivalDifficulty(nextDifficulty))difficulty.value=nextDifficulty;
    if((changed||homeMatchPending)&&isWeaponId(nextWeapon)){world.setMode(readMode(nextMode),isSurvivalDifficulty(nextDifficulty)?nextDifficulty:'easy');world.selectWeapon(nextWeapon);restart();}
    homeOpen=false;home.hidden=true;document.body.classList.remove('at-home');homeMatchPending=false;void audio.unlock();input.reset();picker.hidden=true;world.setPreview(false);closeMenu();hasPlayed=true;resumeGame();
    mouseLockFallback=false;requestGameplayMouseLock();
  };
  startButton.addEventListener('click',beginGame);
  function switchMap(map:MapId,type=world.characterType){if(map===selectedMap)return;world.scene.dispose();world=createHarborScene(engine,{map,mapArtSource:harborArtSource});selectedMap=map;world.selectCharacter(type);world.setQuality(qualityHigh);world.setShadows?.(preferences.value.shadows);world.setPerformanceLow?.(graphicsMode==='low'||graphicsMode==='auto'&&budget.density<=.85);world.setReducedShots?.(reducedShots);world.setShake(shake.value==='off'||shake.value==='normal'?shake.value:'low');world.setPreview(true,true);}
  const homeView=createHomeScreen({
    selectCharacter(type){world.selectCharacter(type);refreshCharacter();lobbyCue('ui');if(!reducedLobbyMotion.matches)document.querySelector('#home-character-name')?.animate?.([{opacity:.3},{opacity:1}],{duration:180});},
    selectWeapon(id){world.setLobbyWeapon(id);lobbyCue('ui');if(!reducedLobbyMotion.matches)document.querySelector('#home-equipped-art')?.animate?.([{opacity:.3,transform:'translateX(-6px)'},{opacity:1,transform:'translateX(0)'}],{duration:180});},
    start(selection){
      const map=document.querySelector<HTMLSelectElement>('#home-map')!.value;
      const nextMap:MapId=growthLoggedIn&&currentGrowth.level>=3&&map==='factory'?'factory':'harbor';
      switchMap(nextMap,selection.character);

      if(selection.mode==='online'){
        document.querySelector<HTMLSelectElement>('#online-character')!.value=selection.character;document.querySelector<HTMLSelectElement>('#online-weapon')!.value=selection.weapon;openOnlineLobby();return;
      }
      document.querySelector<HTMLSelectElement>('#start-mode')!.value=selection.mode;document.querySelector<HTMLSelectElement>('#start-difficulty')!.value=selection.difficulty;document.querySelector<HTMLSelectElement>('#start-weapon')!.value=selection.weapon;
      lobbyPolish.deploy();lobbyCue('deploy');homeMatchPending=true;beginGame();
    },
  });
  function syncHomeSelection(){
    const weapon=document.querySelector<HTMLSelectElement>(onlineActive?'#online-weapon':'#weapon-select')!.value,character=onlineActive?document.querySelector<HTMLSelectElement>('#online-character')!.value:world.characterType,difficulty=document.querySelector<HTMLSelectElement>('#bot-difficulty')!.value;
    world.setLobbyWeapon(isWeaponId(weapon)?weapon:'pistol');
    homeView.sync({mode:onlineActive?'online':readMode(document.querySelector<HTMLSelectElement>('#game-mode')!.value),weapon:isWeaponId(weapon)?weapon:'pistol',character:isCharacterType(character)?character:'robot',difficulty:isSurvivalDifficulty(difficulty)?difficulty:'easy'});
  }

  picker.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const buttons=[...picker.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')].filter(element=>!element.hidden&&element.getClientRects().length>0);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement|HTMLSelectElement);
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]!.focus();
    }
  });
  let position:Point = { ...PROTOTYPE.spawn };
  const zone = document.querySelector('#zone')!;
  const hits = document.querySelector('#hits')!;
  const crosshair = document.querySelector('.crosshair')!;
  const shotFeedback=document.querySelector<HTMLElement>('#shot-feedback')!;
  const ammo=document.querySelector('#ammo')!;
  const destroyed=document.querySelector('#destroyed')!;
  const weaponStatus=document.querySelector('#weapon-status')!;
  const reloadButton=document.querySelector<HTMLButtonElement>('#reload')!;
  const jumpButton=document.querySelector<HTMLButtonElement>('#jump')!;
  const reloadProgress=document.querySelector<HTMLProgressElement>('#reload-progress')!;
  const complete=document.querySelector<HTMLElement>('#practice-complete')!;
  const healthBars=[0,1,2].map(i=>document.querySelector<HTMLProgressElement>(`#health-${i}`)!);
  const healthLabels=[0,1,2].map(i=>document.querySelector(`#health-value-${i}`)!);
  let hitTime = 0, shotTime=0, feedbackTime=0, noticeTime=0, notice='';
  let previousDamage=0,damageTime=0,impactTime=0;
  let lastHudKey='';
  const refreshHud=()=>{
    const state=world.practiceState();document.querySelector<HTMLElement>('#network-status')!.hidden=!onlineActive;document.querySelector<HTMLElement>('#ffa-scores')!.hidden=true;
    if(onlineActive&&onlineState){
      const me=onlineState.players.find(p=>p.id===onlineId),foe=onlineState.players.find(p=>p.id!==onlineId);if(!me)return;
      document.querySelector<HTMLElement>('.practice-score')!.hidden=true;document.querySelector<HTMLElement>('#duel-hud')!.hidden=false;
      document.querySelector('#duel-score')!.textContent=onlineState.mode==='team'?`팀전 · 블루 ${onlineState.teamScores?.[0]??0} : ${onlineState.teamScores?.[1]??0} 레드 · 30킬`:onlineState.mode==='ffa'?`개인전 · 내 ${me.kills}킬 · 목표 10킬`:`나 ${me.kills} : ${foe?.kills??0} 상대 · 목표 10킬`;
      const net=online.network;const latency=net.rttMs===null?'통신 측정 중':`통신 ${net.rttMs}ms${net.rttMs>300?' · 지연 높음':''}`;
      document.querySelector('#duel-health')!.textContent=`내 체력 ${me.health} · 방 ${onlineCode}`;
      document.querySelector('#network-status')!.textContent=latency+((net.staleMs??0)>500?' · 수신 지연':'');
      document.querySelector<HTMLProgressElement>('#player-health')!.value=me.health;
      document.querySelector('#duel-status')!.textContent=onlineState.winner?(wonOnline(onlineState,onlineId)?'승리!':'패배')+' · 홈에서 새 경기':me.health===0?`${Math.ceil(me.dead)}초 후 부활`:onlineStatus;
      document.querySelector('#weapon-name')!.textContent=state.weaponName;ammo.textContent=String(me.weapon.ammo);document.querySelector('#magazine-size')!.textContent=` / ${state.magazineSize}`;weaponStatus.textContent=me.weapon.reloadRemaining>0?`재장전 ${me.weapon.reloadRemaining.toFixed(1)}초`:me.weapon.ammo===0?'탄약 없음 · 재장전':'발사 준비';
      document.querySelector<HTMLButtonElement>('#fire')!.disabled=me.health===0||!!onlineState.winner;
      const scopeButton=document.querySelector<HTMLButtonElement>('#scope')!;
      scopeButton.hidden=me.weaponId!=='sniper';scopeButton.disabled=me.health===0||!!onlineState.winner||!onlinePlaying(onlineState,onlineId)||!online.connected;
      scopeButton.textContent=state.scoped?'원래 시야':'확대';scopeButton.setAttribute('aria-pressed',String(state.scoped));document.querySelector<HTMLElement>('#scope-overlay')!.hidden=!state.scoped;
      jumpButton.disabled=me.health===0||!!onlineState.winner||me.jump.height>0||me.jump.velocity!==0||(me.dash?.remaining??0)>0;reloadButton.disabled=me.health===0||me.weapon.reloadRemaining>0||me.weapon.ammo===state.magazineSize;reloadButton.textContent=me.weapon.reloadRemaining>0?'재장전 중':'재장전';reloadProgress.hidden=me.weapon.reloadRemaining<=0;reloadProgress.max=state.reloadSeconds;reloadProgress.value=state.reloadSeconds-me.weapon.reloadRemaining;complete.hidden=true;
      return;
    }
    const duel=world.duelState();
    document.querySelector<HTMLElement>('.practice-score')!.hidden=duel.active;
    document.querySelector<HTMLElement>('#duel-hud')!.hidden=!duel.active;
    document.querySelector('#duel-score')!.textContent=duel.mode==='survival'?`웨이브 ${duel.wave} / ${duel.totalWaves} · ${duel.automatic?'자동 '+duel.adaptiveStage+'/9':BOT_DIFFICULTIES[duel.difficulty].name}`:duel.mode==='ffa'?`개인전 · 나 ${duel.playerKills}킬 · ${BOT_DIFFICULTIES[duel.difficulty].name}`:`나 ${duel.playerKills} : ${duel.botKills} 봇 · ${BOT_DIFFICULTIES[duel.difficulty].name} · 10킬`;
    const scores=document.querySelector<HTMLElement>('#ffa-scores')!;if(duel.mode==='ffa'&&duel.active){scores.hidden=false;scores.textContent=duel.bots.map((b,i)=>`${b.name}(${['빨강','파랑','노랑'][i]}) ${b.kills}킬 · ${b.health===0?Math.ceil(b.dead)+'초 후 부활':'HP '+b.health}`).join('\n');}
    document.querySelector('#duel-health')!.textContent=duel.mode==='survival'?`체력 ${duel.playerHealth} · 생명 ${duel.lives}`:duel.mode==='ffa'?`내 체력 ${duel.playerHealth} · 목표 10킬`:`내 체력 ${duel.playerHealth} · 봇 체력 ${duel.botHealth}`;
    document.querySelector<HTMLProgressElement>('#player-health')!.value=duel.playerHealth;
    document.querySelector('#duel-hud')!.classList.toggle('critical',duel.playerHealth<=25);
    if(duel.damageVersion>previousDamage){damageTime=0.35;}
    previousDamage=duel.damageVersion;
    document.querySelectorAll<HTMLElement>('#health-segments i').forEach((part,i)=>part.classList.toggle('lost',duel.playerHealth<=(i*25)));
    const incoming=Math.atan2(duel.position.x-position.x,duel.position.z-position.z)-input.look.yaw;
    (document.querySelector('#damage-direction') as HTMLElement).style.transform=`rotate(${incoming}rad)`;
    document.querySelector<HTMLElement>('#damage-overlay')!.style.opacity=String(duel.active?Math.min(0.7,damageTime*2):0);
    const status=document.querySelector('#duel-status')!;
    status.classList.toggle('incoming',!!duel.locked);
    document.querySelector('#duel-status')!.textContent=duel.winner?(duel.winner==='player'?'승리!':duel.mode==='ffa'?`${duel.winnerName} 승리 · 패배`:'패배')+' · 다시 시작으로 재경기':duel.playerDead>0?`쓰러졌습니다 · ${Math.ceil(duel.playerDead)}초 후 부활`:duel.botDead>0?`봇 처치 · ${Math.ceil(duel.botDead)}초 후 상대 부활`:duel.locked?'발사 임박! 옆으로 이동하세요':duel.aim>0?'상대가 조준 중 · 엄폐하세요':'벽과 건물로 몸을 숨기세요';
    if(duel.mode==='survival'){
      const alive=duel.bots.filter(b=>b.health>0).length,reinforcing=alive===0&&duel.spawned<duel.total;
      const spawnWait=Math.ceil(Math.min(3,...duel.bots.filter(b=>b.health===0).map(b=>b.dead)));
      status.textContent=duel.phase==='won'?'생존 성공! 모든 웨이브 클리어 · 다시 시작':duel.phase==='lost'?'생명을 모두 잃었습니다 · 다시 시작':duel.phase==='preparing'?`준비 ${Math.ceil(duel.prepareRemaining)}초 · 이번 웨이브 적 ${duel.total}명`:duel.phase==='respawning'?`${Math.ceil(duel.playerDead)}초 후 현재 웨이브 재도전 · 생명 ${duel.lives}`:reinforcing?`증원 ${spawnWait}초 · 남은 적 ${duel.remaining}명`:`${duel.locked?'발사 임박! · ':''}남은 적 ${duel.remaining}명 · 현재 ${alive}명 출현`;
    }
    document.body.classList.toggle('player-hurt',duel.active&&duel.playerHealth>0&&duel.playerHealth<=50);
    document.querySelector<HTMLButtonElement>('#reset')!.disabled=duel.active;
    const blocked=duel.active&&(duel.playerHealth===0||!!duel.winner);
    document.querySelector<HTMLButtonElement>('#fire')!.disabled=blocked;
    document.querySelector('#weapon-name')!.textContent=state.weaponName;
    reloadButton.setAttribute('aria-label',`${state.weaponName} 재장전`);document.querySelector('.ammo-hud')!.setAttribute('aria-label',`${state.weaponName} 탄약`);
    document.querySelector('#weapon-help')!.textContent=`${state.weaponName}: 탄창 ${state.magazineSize}발 · 재장전 ${state.reloadSeconds}초. PC R키 또는 재장전 버튼을 사용하세요. 표적 체력은 100, 예비 탄약은 무제한입니다.`;
    document.querySelector('#magazine-size')!.textContent=` / ${state.magazineSize}`;
    const scopeButton=document.querySelector<HTMLButtonElement>('#scope')!;
    scopeButton.hidden=state.weaponId!=='sniper';scopeButton.disabled=blocked;
    scopeButton.textContent=state.scoped?'원래 시야':'확대';scopeButton.setAttribute('aria-pressed',String(state.scoped));
    document.querySelector<HTMLElement>('#scope-overlay')!.hidden=!state.scoped||!picker.hidden||comparing;
    jumpButton.disabled=blocked||!state.grounded||localDash.remaining>0;
    const key=[state.weaponId,blocked,state.ammo,Math.ceil(state.reloadRemaining*10),...state.targetHealth,state.hits,state.destroyed,state.grounded,noticeTime>0?notice:''].join('|');
    if(key===lastHudKey)return;lastHudKey=key;
    ammo.textContent=String(state.ammo);hits.textContent=String(state.hits);destroyed.textContent=String(state.destroyed);
    for(let i=0;i<state.targetHealth.length;i++){
      healthBars[i]!.value=state.targetHealth[i]!;healthLabels[i]!.textContent=String(state.targetHealth[i]);
    }
    const reloading=state.reloadRemaining>0;
    reloadProgress.hidden=!reloading;reloadProgress.max=state.reloadSeconds;
    reloadProgress.value=state.reloadSeconds-state.reloadRemaining;
    reloadButton.disabled=blocked||reloading||state.ammo===state.magazineSize;
    reloadButton.textContent=reloading?'재장전 중':'재장전';
    weaponStatus.textContent=reloading?`재장전 ${state.reloadRemaining.toFixed(1)}초`:noticeTime>0?notice:state.ammo===0?'탄창이 비었습니다 · 재장전하세요':'발사 준비';
    complete.hidden=duel.active||!state.complete;
  };
  function readGear(){if(onlineActive&&onlineState){const me=onlineState.players.find(p=>p.id===onlineId);if(me)return {gear:me.gear??createGear(),health:me.health,flash:me.flash??0,healing:me.healing??0,cooldown:me.gearCooldown??0};}return world.gearState?.()??{gear:createGear(),health:100,flash:0,healing:0,cooldown:0};}
  function requestEquipment(kind:EquipmentId){if(!canUseInventory()||inventoryData().blocked)return;if(onlineActive)pendingEquipment=kind;else world.useEquipment?.(kind,position,input.look);}
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-equipment]'))bindInventoryAction(b,()=>requestEquipment(b.dataset.equipment as EquipmentId));
  window.addEventListener('keydown',event=>{if(event.repeat||!canUseInventory())return;const kind=event.code==='KeyG'?'grenade':event.code==='KeyB'?'flash':event.code==='KeyH'?'medkit':null;if(kind){event.preventDefault();requestEquipment(kind);}});
  function refreshEquipment(){const g=readGear(),blocked=!canUseInventory()||inventoryData().blocked;for(const b of document.querySelectorAll<HTMLButtonElement>('[data-equipment]')){const kind=b.dataset.equipment as EquipmentId,count=g.gear[kind];b.querySelector('b')!.textContent=String(count);b.disabled=blocked||count<=0||g.cooldown>0||(kind==='medkit'&&(g.health>=100||g.healing>0));b.setAttribute('aria-label',`${EQUIPMENT[kind].name} · ${count}개`);}const healing=document.querySelector<HTMLProgressElement>('#heal-progress')!;healing.hidden=g.healing<=0;healing.value=2-g.healing;document.querySelector('#equipment-status')!.textContent=g.healing>0?`회복 중 ${g.healing.toFixed(1)}초 · 사격/피격 시 취소`:g.flash>.05?'섬광 · 시야 회복 중':g.health>0&&g.health<100?`HP ${Math.ceil(g.health)}`:'';document.querySelector<HTMLElement>('#flash-overlay')!.style.opacity=String(Math.min(.94,g.flash/1.5));
   onlineBoard.hidden=!onlineActive;if(onlineActive&&onlineState){document.querySelector('#online-population')!.textContent=`${onlineState.players.filter(p=>p.connected&&!p.abandoned).length}/${onlineState.capacity??2}`;const boardKey=JSON.stringify(onlineState.players.map(p=>[p.id,p.nickname,p.kills,p.deaths,p.team,p.connected,p.abandoned]));if(onlineBoard.open&&boardKey!==onlineBoardKey){onlineBoardKey=boardKey;const list=document.querySelector('#online-player-list')!,rows=[...onlineState.players].sort((a,b)=>b.kills-a.kills);list.replaceChildren();for(const p of rows){const li=document.createElement('li'),index=onlineState.players.indexOf(p)+1;li.textContent=`${p.id===onlineId?'나 · ':''}${playerName(p,`대원 ${index}`)} ${p.team===undefined?'':p.team===0?'· 블루':'· 레드'} · ${p.kills}킬 / ${p.deaths??0}데스${p.abandoned?' · 이탈':!p.connected?' · 재접속 중':''}`;li.classList.toggle('is-me',p.id===onlineId);list.append(li);}}for(const e of onlineState.toolEvents??[])if(e.id>onlineToolEventId){onlineToolEventId=e.id;const me=onlineState.players.find(p=>p.id===onlineId)!;const sound=spatialSound(e.x-me.x,e.z-me.z,input.look.yaw);if(!blocked)audio.play(e.kind,sound.pan,sound.gain);}}
  }
  function refreshRoster(){const panel=document.querySelector<HTMLElement>('#match-roster')!;panel.hidden=!onlineActive||!onlineState||roomWaiting||homeOpen;if(panel.hidden||!onlineState)return;const me=onlineState.players.find(p=>p.id===onlineId)!,title=document.querySelector('#roster-title')!,lines=document.querySelector('#roster-lines')!;lines.replaceChildren();const add=(text:string)=>{const row=document.createElement('div');row.textContent=text;lines.append(row);};if(onlineState.mode==='team'){title.textContent='팀 생존 / 접속';for(const team of [me.team,1-(me.team??0)]){const players=onlineState.players.filter(p=>p.team===team&&p.playing!==false&&!p.abandoned),connected=players.filter(p=>p.connected&&(!p.guest||!!normalizeNickname(p.nickname)));add(`${team===me.team?'아군':'상대'} · 생존 ${connected.filter(p=>p.health>0).length} / 접속 ${connected.length}`);}}else{const ranks=rankedPlayers(onlineState.players);title.textContent=onlineState.mode==='ffa'?`개인전 · 내 ${ranks.findIndex(p=>p.id===onlineId)+1}위`:'1대1 현황';ranks.slice(0,3).forEach((p,i)=>add(`${i+1}. ${playerName(p,'이탈 대원')} · ${p.kills}킬`));if(ranks.findIndex(p=>p.id===onlineId)>=3)add(`나 · ${me.kills}킬 / ${me.deaths}데스`);}}
  let combatHudAt=-Infinity,showMinimap=preferences.value.minimap;
  function refreshCombatHud(){
    const now=performance.now(),active=!settingsView.isOpen&&!roomWaiting&&!nicknameDialog.isOpen&&!homeOpen&&picker.hidden&&!comparing&&!document.body.classList.contains('results-open');
    document.querySelector<HTMLElement>('#combat-vitals')!.hidden=!active;
    document.querySelector<HTMLElement>('#combat-map')!.hidden=!active||!showMinimap;
    const card=document.querySelector<HTMLElement>('#target-vitals')!;if(!active){card.hidden=true;nameplates.clear();document.querySelector<HTMLElement>('#match-roster')!.hidden=true;return;}if(now-combatHudAt<100)return;combatHudAt=now;
    const battle=world.duelState(),me=onlineActive?onlineState?.players.find(p=>p.id===onlineId):undefined,health=me?.health??(battle.active?battle.playerHealth:readGear().health),p=me?{...me,y:(me.y??0)+me.jump.height}:{...position,y:(position.y??0)+(world.practiceState().jumpHeight??0)},geometry=world.geometry??harborWorld,doors=(onlineActive?onlineState?.doors:world.doorState?.())??{};
    document.querySelector('#combat-hp')!.textContent=String(Math.ceil(health));document.querySelector<HTMLProgressElement>('#combat-hp-bar')!.value=health;document.querySelector('#combat-vitals')!.classList.toggle('critical',health<=25);
    document.querySelector('#combat-life')!.textContent=health===0?'쓰러짐 · 부활 대기':(me?.protection??battle.protection??0)>0?'부활 보호 중':battle.active&&battle.mode==='survival'?`남은 생명 ${battle.lives}`:'피격 시 엄폐 · H 회복';
    let actors:Contact[]=[];
    if(onlineActive&&onlineState)actors=onlineState.players.filter(a=>a.id!==onlineId).map((a,i)=>({...a,revealed:(a.revealedUntil??0)>onlineState!.tick,name:playerName(a,a.team!==undefined&&a.team===me?.team?'아군':`적 대원 ${i+1}`),ally:me?.team!==undefined&&a.team===me.team,active:a.connected&&!a.abandoned}));
    else if(battle.active)actors=battle.mode==='duel'?[{...battle.position,id:'bot-1',revealed:world.isBotRevealed?.('bot-1'),name:'적 봇',health:battle.botHealth}]:battle.bots.map(b=>({...b.position,id:b.id,revealed:world.isBotRevealed?.(b.id),name:b.name,health:b.health,active:!!b.position}));
    else actors=world.targetContacts?.()??[];
    const view=combatContacts(geometry,doors,p,input.look.yaw,input.look.pitch,actors),target=health>0?view.target:undefined;card.hidden=!target;if(target){document.querySelector('#target-name')!.textContent=target.name;document.querySelector('#target-hp')!.textContent=String(Math.ceil(target.health));document.querySelector<HTMLProgressElement>('#target-hp-bar')!.value=target.health;}
    if(showMinimap)drawCombatMap(document.querySelector<HTMLCanvasElement>('#minimap')!,geometry,p,input.look.yaw,view.radar);
    nameplates.update(onlineActive&&onlineState&&online.connected?(world.onlineNameplates?.(onlineState,onlineId)??[]):[]);refreshRoster();
  }
  const reset = () => { position = { ...PROTOTYPE.spawn }; input.resetLook();world.resetJump(); };
  document.querySelector('#reset')!.addEventListener('click', reset);
  const restart=()=>{world.setUpgradeTier?.(growthLoggedIn?currentGrowth.tier:0);const b=world.duelState();growthTicket=accountView.startGrowth(b.active?b.mode:'practice',b.mode==='survival'&&b.automatic?'auto':b.difficulty);localDash=createDash();predictionDash=predictionJump=false;resultView.hide();resultTracker.start();shownResult='';reset();world.resetPractice();lastReload=0;lastGrounded=true;lastPlayerHealth=100;lastRespawn=0;footDistance=0;footAlternating=false;emptyAt=0;lastHudKey='';noticeTime=0;hitTime=0;shotTime=0;feedbackTime=0;damageTime=0;impactTime=0;previousDamage=0;refreshHud();};
  document.querySelector('#practice-reset')!.addEventListener('click',restart);
  document.querySelector('#practice-again')!.addEventListener('click',restart);
  document.querySelector<HTMLSelectElement>('#bot-difficulty')!.addEventListener('change',event=>{const level=(event.currentTarget as HTMLSelectElement).value;if(onlineActive||!isSurvivalDifficulty(level))return;world.setMode(readMode(document.querySelector<HTMLSelectElement>('#game-mode')!.value),level);restart();canvas.focus();});
  document.querySelector<HTMLSelectElement>('#game-mode')!.addEventListener('change',event=>{
    syncDifficultyOptions();const level=document.querySelector<HTMLSelectElement>('#bot-difficulty')!.value;world.setMode(readMode((event.currentTarget as HTMLSelectElement).value),isSurvivalDifficulty(level)?level:'easy');restart();canvas.focus();
  });
  document.querySelector<HTMLSelectElement>('#weapon-select')!.addEventListener('change',event=>{
    const id=(event.currentTarget as HTMLSelectElement).value;if(isWeaponId(id)){world.selectWeapon(id);restart();canvas.focus();}
  });
  function showFinishedResult(){
    const result=resultTracker.finish();if(!result||shownResult===result.id)return;shownResult=result.id;journal.add(result);resultView.show(result);if(result.mode==='online'){document.querySelector('#result-growth')!.textContent='온라인 경험치는 서버 확정 후 반영됩니다.';void accountView.refreshGrowth().catch(()=>{});}else{const ticket=growthTicket;void ticket.then(t=>accountView.saveGrowth(t,result)).catch(()=>{});}if(!document.hidden&&document.hasFocus()){audio.pause(false);audio.play(result.outcome==='win'?'win':'lose');}
  }
  function observeOfflineResult(seconds:number){
    const battle=world.duelState();const survival=battle.mode==='survival';
    const snapshot:ResultSnapshot={mode:battle.active?battle.mode:'practice',active:battle.active,difficulty:survival&&battle.automatic?'auto':battle.difficulty,winner:battle.winner?(battle.winner==='player'?'win':'loss'):'',kills:battle.playerKills,deaths:survival?3-battle.lives:(battle.playerDeaths??(battle.mode==='ffa'?battle.bots.reduce((n,b)=>n+b.kills,0):battle.botKills)),wave:survival?battle.wave:null,totalWaves:survival?battle.totalWaves:null,stage:survival&&battle.automatic?battle.adaptiveStage:null};
    resultTracker.observe(snapshot,seconds);showFinishedResult();
  }
  function observeOnlineResult(state:MatchState,id:string){
    const me=state.players.find(p=>p.id===id),foe=state.players.find(p=>p.id!==id);if(!me||!foe)return;
    const ready=onlinePlaying({...state,winner:''},id),seconds=resultOnlineReady&&ready&&resultOnlineTick!==null?Math.max(0,state.tick-resultOnlineTick)*.05:0;
    resultOnlineTick=state.tick;resultOnlineReady=ready;
    resultTracker.observe({mode:'online',active:true,difficulty:null,winner:state.winner?(wonOnline(state,id)?'win':'loss'):'',kills:me.kills,deaths:Math.max(me.deaths??0,state.mode==='duel'||!state.mode?foe.kills:0),wave:null,totalWaves:null,stage:null},seconds);showFinishedResult();
  }
  const resultView=createResultsView(journal,{
    opened(){settingsView.close();lobbyPolish.cancelDeploy();gameChoices.close();input.setEnabled(false);input.reset();pausePanel.hidden=true;manualPaused=false;closeMenu();help.hidden=true;if(document.pointerLockElement)document.exitPointerLock();audio.pause(true);},
    home:openHome,
    retry(isOnline){if(isOnline){openHome();openOnlineLobby();}else{restart();resumeGame();requestGameplayMouseLock();}},
  });
  document.querySelector('#home-records')!.addEventListener('click',()=>resultView.history());
  function toggleScope(){
    if(!canUseInventory())return;
    if(onlineActive&&onlineState){const me=onlineState.players.find(p=>p.id===onlineId);if(!me||me.health===0||onlineState.winner||!onlinePlaying(onlineState,onlineId)||!online.connected)return;}
    const before=world.practiceState().scoped;world.toggleScope();
    if(world.practiceState().scoped!==before)audio.play('scope');
    canvas.focus();refreshHud();
  }
  window.addEventListener('keydown',event=>{
    const tag=(event.target as HTMLElement|null)?.tagName;
    if(event.code==='KeyQ'&&!event.repeat&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!['INPUT','SELECT','TEXTAREA'].includes(tag??'')){event.preventDefault();toggleScope();}
  });
  document.querySelector<HTMLButtonElement>('#scope')!.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();toggleScope();});
  document.querySelector<HTMLButtonElement>('#scope')!.addEventListener('click',event=>{if(event.detail===0)toggleScope();});
  const help = document.querySelector<HTMLElement>('#help')!;
  const closeHelp=()=>{help.hidden=true;document.querySelector('#help-toggle')!.setAttribute('aria-expanded','false');input.reset();};
  document.querySelector('#pause-continue')!.addEventListener('click',()=>{closeHelp();closeMenu();resumeGame();requestGameplayMouseLock();});
  document.querySelector('#help-close')!.addEventListener('click',()=>{closeHelp();canvas.focus();});
  document.querySelector('#help-toggle')!.addEventListener('click', event => {
    help.hidden = !help.hidden;input.setEnabled(false);input.reset();
    (event.currentTarget as HTMLElement).setAttribute('aria-expanded', String(!help.hidden));
  });
  window.addEventListener('keydown',event=>{
    if(event.code!=='Escape'||event.repeat||!canOpenGameMenu())return;
    if(!help.hidden){event.preventDefault();closeHelp();canvas.focus();}
    else if(comparing){event.preventDefault();setComparison(false);}
    else if(menuOpen){event.preventDefault();}
    else{event.preventDefault();openGameMenu();}
  });
  pausePanel.addEventListener('keydown',event=>{if(event.key!=='Tab')return;event.preventDefault();const buttons=[...pausePanel.querySelectorAll<HTMLButtonElement>('button')].filter(button=>button.getClientRects().length>0);const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(index+(event.shiftKey?buttons.length-1:1))%buttons.length]!.focus();});
  let resizeFrame=0,lastWidth=window.innerWidth;
  const resizeViewport=()=>{
    if(window.innerWidth!==lastWidth){lastWidth=window.innerWidth;closeMenu();}
    if(resizeFrame)return;
    resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;engine.resize();world.resize();});
  };
  window.addEventListener('resize',resizeViewport);
  window.visualViewport?.addEventListener('resize',resizeViewport);
  mobileBrowser.refresh();
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  const lobbyPolish=createLobbyPolish({rotate:delta=>world.rotateLobby(delta),reset:()=>world.resetLobbyRotation(),enabled:()=>homeOpen&&!settingsView.isOpen&&!gameChoices.isOpen&&!resultView.isOpen,reduced:()=>reducedLobbyMotion.matches});
  const settingsView=createEnvironmentPanel({opened(){lobbyPolish.cancelDrag();input.reset();input.setEnabled(false);closeMenu();closeHelp();if(document.pointerLockElement)document.exitPointerLock();},beforeClose(){gameChoices.close();},closed(){input.reset();frameLimit.reset();if(!homeOpen&&!roomWaiting)canvas.focus();},reset(){resetEnvironment();}});
  const frameSelect=document.querySelector<HTMLSelectElement>('#frame-target')!;
  frameSelect.value=String(preferences.value.fps);
  frameSelect.addEventListener('change',()=>{
    const fps=frameSelect.value==='auto'?'auto':Number(frameSelect.value) as EnvironmentPreferences['fps'];
    frameLimit.setTarget(savePreference({fps}).fps);
  });
  const shadowCheck=document.querySelector<HTMLInputElement>('#shadows-enabled')!;shadowCheck.checked=preferences.value.shadows;shadowCheck.addEventListener('change',()=>world.setShadows?.(savePreference({shadows:shadowCheck.checked}).shadows));
  const invertCheck=document.querySelector<HTMLInputElement>('#invert-y')!,minimapCheck=document.querySelector<HTMLInputElement>('#minimap-enabled')!;
  invertCheck.checked=preferences.value.invertY;minimapCheck.checked=preferences.value.minimap;
  invertCheck.addEventListener('change',()=>input.setInvertY(savePreference({invertY:invertCheck.checked}).invertY));
  minimapCheck.addEventListener('change',()=>{showMinimap=savePreference({minimap:minimapCheck.checked}).minimap;combatHudAt=-Infinity;});
  const mouseSlider=document.querySelector<HTMLInputElement>('#mouse-sensitivity')!;mouseSlider.value=String(preferences.value.mouse*100);const mouseLabel=()=>{document.querySelector('#mouse-sensitivity-value')!.textContent=`${(Number(mouseSlider.value)/100).toFixed(2)}배`;};mouseLabel();mouseSlider.addEventListener('input',()=>{input.setMouseSensitivity?.(savePreference({mouse:Number(mouseSlider.value)/100}).mouse);mouseLabel();});
  const hudSelect=document.querySelector<HTMLSelectElement>('#hud-size')!,opacitySlider=document.querySelector<HTMLInputElement>('#controls-opacity')!,colorSelect=document.querySelector<HTMLSelectElement>('#crosshair-color')!,crossSize=document.querySelector<HTMLSelectElement>('#crosshair-size')!;
  function applyInterface(){const p=preferences.value,style=document.documentElement.style;style.setProperty('--combat-text-scale',p.hud==='large'?'1.2':'1');style.setProperty('--touch-opacity',String(p.opacity));style.setProperty('--reticle-color',p.crosshairColor==='green'?'#83ffb3':p.crosshairColor==='gold'?'#ffe38b':'#e7fcff');style.setProperty('--reticle-size',p.crosshairSize==='large'?'1.5':'1');document.querySelector('#controls-opacity-value')!.textContent=Math.round(p.opacity*100)+'%';}
  hudSelect.value=preferences.value.hud;opacitySlider.value=String(preferences.value.opacity*100);colorSelect.value=preferences.value.crosshairColor;crossSize.value=preferences.value.crosshairSize;applyInterface();
  for(const [node,key,event] of [[hudSelect,'hud','change'],[colorSelect,'crosshairColor','change'],[crossSize,'crosshairSize','change'],[opacitySlider,'opacity','input']] as const)node.addEventListener(event,()=>{savePreference({[key]:key==='opacity'?Number(node.value)/100:node.value} as Partial<EnvironmentPreferences>);applyInterface();});
  for(const id of ['audio-master','audio-effects','audio-environment'] as const){const node=document.querySelector<HTMLInputElement>('#'+id)!,output=document.createElement('output');output.id=id+'-value';node.parentElement!.append(output);const label=()=>{output.textContent=Math.round(Number(node.value))+'%';};label();node.addEventListener('input',label);}
  const changeSelect=(id:string,value:string)=>{const node=document.querySelector<HTMLSelectElement>('#'+id)!;node.value=value;node.dispatchEvent(new window.Event('change',{bubbles:true}));};
  function resetEnvironment(){const p=preferences.reset();for(const [id,value] of [['graphics-quality',p.graphics],['frame-target',String(p.fps)],['hud-size',p.hud],['crosshair-color',p.crosshairColor],['crosshair-size',p.crosshairSize],['jump-key',p.jump],['shot-effects',mobile?'low':'full'],['screen-shake',mobile?'off':'low']])changeSelect(id!,value!);invertCheck.checked=p.invertY;invertCheck.dispatchEvent(new window.Event('change',{bubbles:true}));minimapCheck.checked=p.minimap;minimapCheck.dispatchEvent(new window.Event('change',{bubbles:true}));shadowCheck.checked=p.shadows;shadowCheck.dispatchEvent(new window.Event('change',{bubbles:true}));for(const [node,value] of [[mouseSlider,100],[opacitySlider,100],[sensitivity,100]] as const){node.value=String(value);node.dispatchEvent(new window.Event('input',{bubbles:true}));}audio.configure({master:.7,effects:.85,environment:.16,muted:false});for(const key of ['master','effects','environment'] as const){const node=document.querySelector<HTMLInputElement>('#audio-'+key)!;node.value=String(audio.settings[key]*100);node.dispatchEvent(new window.Event('input',{bubbles:true}));}mute.checked=false;gameChoices.refresh();document.querySelector('#environment-save-status')!.textContent=preferences.saved?'기본 설정으로 복원했습니다. 게임 기록은 유지됩니다.':'저장할 수 없어 이번 접속에만 기본값을 적용합니다.';}
  document.querySelector('#environment-low-preset')!.addEventListener('click',()=>{
    for(const [id,value] of [['graphics-quality','low'],['frame-target','30'],['shot-effects','low'],['screen-shake','off']])changeSelect(id!,value!);
    shadowCheck.checked=false;shadowCheck.dispatchEvent(new window.Event('change',{bubbles:true}));gameChoices.refresh();
    document.querySelector('#environment-save-status')!.textContent=preferences.saved?'저사양 추천 적용 · 낮음 / 30 FPS · 감도·소리·게임 기록은 유지했습니다.':'저사양 추천을 적용했습니다. 저장할 수 없어 이번 접속에만 적용됩니다.';
  });
  for(const id of ['home-settings','environment-open','waiting-settings-open'])document.querySelector('#'+id)!.addEventListener('click',()=>settingsView.open());
  const gameChoices=createGameChoices({opened(){lobbyPolish.cancelDrag();input.setEnabled(false);input.reset();if(document.pointerLockElement)document.exitPointerLock();}});
  world.update(position, 1);
  await world.scene.whenReadyAsync();
  loading.hidden = true;
  openHome();
  const invited=new URLSearchParams(window.location?.search??'').get('room');if(invited&&/^[0-9A-F]{8}$/.test(invited.toUpperCase())){document.querySelector<HTMLInputElement>('#online-code')!.value=invited.toUpperCase();openOnlineLobby();}
  function onlineCanPlay(){return !settingsView.isOpen&&!roomWaiting&&!nicknameDialog.isOpen&&!onlineBoard.open&&!lobbyPolish.deploying&&!gameChoices.isOpen&&!resultView.isOpen&&!homeOpen&&!manualPaused&&!document.hidden&&!matchMedia('(pointer: coarse) and (orientation: portrait)').matches&&picker.hidden&&!comparing&&!menuOpen&&help.hidden&&document.hasFocus();}
  let retained:Partial<Command>={};
  const inputPump=createOnlinePump(()=>{
    if(!onlineActive||!onlineState||roomWaiting){retained={};return;}
    if(!online.connected){retained={};input.reset();return;}
    const can=onlineCanPlay();
    if(!can)retained={};
    const command:Omit<Command,'seq'>={stance:input.stance,x:can?input.move.x:0,y:can?input.move.y:0,yaw:input.look.yaw,pitch:input.look.pitch,fire:can&&input.firing,shot:can&&(input.consumeShots()>0||!!retained.shot),reload:can&&(input.consumeReloads()>0||!!retained.reload),jump:can&&(input.consumeJumps()>0||!!retained.jump),sprint:can&&input.sprintingRequested,scope:world.practiceState().scoped,dash:can&&(input.consumeDashes()>0||!!retained.dash)};
    if(can){command.door=pendingDoor??retained.door;command.slot=pendingSlot??retained.slot;command.pickup=pendingTake?.pickup??retained.pickup;command.replace=pendingTake?.replace??retained.replace;command.equipment=pendingEquipment??retained.equipment;}
    const seq=online.send(command);
    if(seq!==null){onlineMotion.sent(seq,command);predictionDash ||=!!command.dash;predictionJump ||=command.jump;retained={};pendingDoor=undefined;pendingSlot=undefined;pendingTake=undefined;pendingEquipment=undefined;}else retained={...command};
  });
  let networkTimer:ReturnType<typeof setInterval>|null=null;
  const startNetworkTimer=()=>{if(networkTimer===null)networkTimer=setInterval(()=>inputPump.pump(),25);};startNetworkTimer();
  window.addEventListener('pageshow',startNetworkTimer);
  for(const type of ['pointerdown','pointerup','pointercancel','keydown','keyup','click'])window.addEventListener(type,()=>{if(onlineActive)queueMicrotask(()=>inputPump.pump(true));},{capture:true});
  window.addEventListener('pagehide',()=>{if(networkTimer!==null)clearInterval(networkTimer);networkTimer=null;retained={};});
  let uiRefreshAt=-Infinity,onlineVisualTime=0,playFrameTime=0;
  let resetClock=true;
  document.addEventListener('visibilitychange',()=>{resetClock=true;frameLimit.reset();});
  window.addEventListener('focus',()=>{resetClock=true;frameLimit.reset();});
  engine.runRenderLoop(() => {
    const elapsed=resetClock?0:Math.max(0,engine.getDeltaTime()/1000);resetClock=false;
    const dt = Math.min(elapsed, 0.05);
    world.setStance?.(input.stance);for(const posture of ['crouch','prone'])document.querySelector('#'+posture)?.setAttribute('aria-pressed',String(input.stance===posture));
    const drawFrame=!roomWaiting&&!settingsView.isOpen&&frameLimit.shouldRender(performance.now());
    if(!onlineActive||!onlineState||roomWaiting)onlineVisualTime=0;
    const uiTick=performance.now()-uiRefreshAt>=50;if(uiTick)uiRefreshAt=performance.now();
    const portraitTouch = matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
    lobbyPolish.update();world.setLobbyMotion(!reducedLobbyMotion.matches&&!settingsView.isOpen&&!document.hidden&&document.hasFocus()&&!gameChoices.isOpen&&!resultView.isOpen);audio.setInterfaceActive(!document.hidden&&document.hasFocus());
    const canPlay=!settingsView.isOpen&&!roomWaiting&&!nicknameDialog.isOpen&&!onlineBoard.open&&!lobbyPolish.deploying&&!gameChoices.isOpen&&!resultView.isOpen&&!homeOpen&&!manualPaused&&!document.hidden&&!portraitTouch&&picker.hidden&&!comparing&&!menuOpen&&help.hidden&&document.hasFocus();
    input.setEnabled(canPlay);
    input.advanceLook(elapsed);
    aimHint.hidden=!canPlay||document.pointerLockElement===canvas;
    document.querySelector('#pause-description')!.textContent=onlineActive?'내 조작만 멈춥니다. 상대의 경기는 계속됩니다.':'전투와 이동이 멈췄습니다.';
    document.querySelector<HTMLElement>('#pause-indicator')!.hidden=manualPaused||!picker.hidden||comparing||portraitTouch||(!menuOpen&&help.hidden);
    if(uiTick)refreshEquipment();
    // Count drawn frames, not the extra callbacks skipped by the FPS cap.
    playFrameTime=canPlay?playFrameTime+elapsed:0;
    if(drawFrame||!canPlay){
      playtest.frame(playFrameTime,onlineActive?'online':world.duelState().active?'bot':'practice',canPlay,onlineActive?online.network.rttMs:null);
      if(graphicsMode==='auto'){
        const density=budget.sample(playFrameTime,canPlay,frameLimit.target);
        if(density!==null){engine.setHardwareScalingLevel(1/density);engine.resize();world.resize();}
      }
      frameLimit.sample(playFrameTime,canPlay);
      playFrameTime=0;
    }
    if(graphicsMode==='auto'){
      world.setPerformanceLow?.(budget.density<=.85);
      const detailed=!mobile&&budget.density>=1.1;
      if(detailed!==qualityHigh){qualityHigh=detailed;world.setQuality(detailed);}
    }
    const resultAudio=!document.querySelector<HTMLElement>('#match-results')!.hidden&&!document.hidden&&document.hasFocus();
    audio.pause(!canPlay&&!resultAudio);
    document.querySelector('#audio-status')!.textContent=audio.settings.muted?'음소거 중':audio.available?'사운드 활성화 · 좌우 방향음':'화면을 눌러 소리 켜기';
    if(onlineActive&&onlineState&&!roomWaiting){
      updateOnlineControls(true);
      const command:Omit<Command,'seq'>={stance:input.stance,x:canPlay?input.move.x:0,y:canPlay?input.move.y:0,yaw:input.look.yaw,pitch:input.look.pitch,fire:canPlay&&input.firing,shot:false,reload:false,jump:false,sprint:canPlay&&input.sprintingRequested,scope:world.practiceState().scoped};
      inputPump.pump(!!(input.actionsPending||pendingDoor||pendingSlot!==undefined||pendingTake||pendingEquipment));command.jump=canPlay&&predictionJump;command.dash=canPlay&&predictionDash;predictionJump=predictionDash=false;
      const predictedPosition=onlineMotion.advance(elapsed,command,online.connected);
      onlineVisualTime=Math.min(.25,onlineVisualTime+elapsed);
      if(drawFrame){
        const frameState={...onlineState,events:onlineShots.drain(),toolEvents:onlineTools.drain()};
        world.renderOnline(frameState,onlineId,input.look,Math.min(onlineVisualTime,.1),predictedPosition,remoteMotion.sampleAll(performance.now(),online.network.rttMs),onlineMotion.jump);
        for(const event of frameState.events)if(event.id>onlineEventId){onlineEventId=event.id;if(event.hit&&event.player===onlineId){impactTime=.2;feedbackTime=.35;shotFeedback.textContent=event.headshot?(event.killed?'헤드샷 · 처치':'헤드샷'):(event.killed?'상대 처치':'명중');document.querySelector('#impact-marker')!.classList.toggle('kill',event.killed);}}
        onlineVisualTime=0;
      }
    } else if (canPlay) {
      for(const step of simulationSteps(elapsed)){
        const queued=input.consumeShots(),reloadRequested=input.consumeReloads();
        const before=world.practiceState();
        const movement = viewMovement(input.look.yaw, input.move.x, input.move.y);
        const duel=world.duelState(),canAct=duel.playerHealth>0&&!duel.winner;
        const runScale=stanceStats(input.stance).speed*sprintMultiplier({requested:input.sprintingRequested,forward:input.move.y,canAct,firing:queued>0||input.firing||before.cooldown>0||shotTime>0,reloading:before.reloadRemaining>0||reloadRequested>0,scoped:before.scoped},1.5);
        const oldPosition={...position};
        const dashRequested=input.consumeDashes()>0;
        if(!canAct)localDash=cancelDash(localDash);
        if(dashRequested){const wasReady=localDash.cooldown<=1e-8;localDash=beginDash(localDash,{x:input.move.x,y:input.move.y,yaw:input.look.yaw,grounded:before.grounded,canAct});if(wasReady&&localDash.remaining>0)audio.play('dash');}
        const wasDashing=localDash.remaining>0,dashStep=advanceDash(localDash,step);localDash=dashStep.state;
        if(canAct){position=world.move?.(position,dashStep.delta)??moveWithCollisions(position,dashStep.delta);const walkTime=step-dashStep.activeSeconds;position=world.move?.(position,{x:movement.x*PROTOTYPE.speed*runScale*walkTime,z:movement.z*PROTOTYPE.speed*runScale*walkTime})??moveWithCollisions(position,{x:movement.x*PROTOTYPE.speed*runScale*walkTime,z:movement.z*PROTOTYPE.speed*runScale*walkTime});}
        if(input.consumeJumps()>0&&canAct&&!wasDashing&&world.jump())audio.play('jump');
        world.update(position, step, input.look);
        if(reloadRequested>0&&world.reload())audio.play('reload');
        const current=world.practiceState();
        if(lastReload>0&&current.reloadRemaining===0)audio.play('ready');
        lastReload=current.reloadRemaining;
        if(!lastGrounded&&current.grounded)audio.play('land');lastGrounded=current.grounded;
        const walked=Math.hypot(position.x-oldPosition.x,position.z-oldPosition.z);
        if(canAct&&current.grounded&&!wasDashing&&walked<2){footDistance+=walked;if(footDistance>2.2){footDistance=0;footAlternating=!footAlternating;audio.play(footAlternating?'step':'step2');}}
        const battle=world.duelState();
        if(battle.active&&battle.playerHealth<lastPlayerHealth)audio.play(battle.playerHealth===0?'death':'hurt');
        if(battle.respawnVersion>lastRespawn){localDash=createDash();audio.play('respawn');}if(battle.playerHealth===0)localDash=cancelDash(localDash);
        lastPlayerHealth=battle.playerHealth;lastRespawn=battle.respawnVersion;
        for(const event of world.consumeSounds()){const spatial=spatialSound(event.x-position.x,event.z-position.z,input.look.yaw);audio.play(event.kind,spatial.pan,spatial.gain);}
        const shots=queued>0?queued:(input.firing&&world.practiceState().automatic?1:0);
        const attempts=world.consumeAutoShots?.()??[];for(let i=0;i<shots;i++)attempts.push(world.shoot());
        for (const shot of attempts) {
          if(shot.fired){shotTime=0.08;audio.play(world.practiceState().weaponId);if(shot.hit)audio.play(shot.eliminated?'kill':'hit',0,.6);else if('impact' in shot&&shot.impact)audio.play('wall',0,.35);}
          if(!shot.fired&&'reason' in shot&&shot.reason==='empty'&&performance.now()>emptyAt){audio.play('empty');emptyAt=performance.now()+500;}
          if (shot.hit) {impactTime=0.2;document.querySelector('#impact-marker')!.classList.toggle('kill','eliminated' in shot&&!!shot.eliminated);hitTime=0.16;feedbackTime=0.35;shotFeedback.textContent='eliminated' in shot&&shot.eliminated?(world.duelState().active?'봇 처치':'표적 파괴'):`명중 −${'damage' in shot?shot.damage:0}`;}
          else if(!shot.fired && 'reason' in shot && shot.reason!=='cooldown'){notice=shot.reason==='empty'?'탄창이 비었습니다 · 재장전하세요':'재장전 중에는 발사할 수 없습니다';noticeTime=0.8;}
        }
        observeOfflineResult(step);if(resultView.isOpen)break;
      }
      const building=indoorAt(position);zone.textContent = building?`${(position.y??0)>=building.height-.1?'옥상':(position.y??0)>=3.3?'2층':'1층'} · 출입 가능 건물`:selectedMap==='factory'?'폐공장 · 산업 지구':position.z < -28?'남쪽 상점 거리':position.z > 28 ? '항구 산책로' : Math.abs(position.x) > 20 ? '건물 사이 골목'
        : Math.abs(position.z) < 11 && Math.abs(position.x) < 11 ? '중앙 광장' : '해안 거리';
    } else { localDash=cancelDash(localDash);input.consumeDashes();input.consumeShots();input.consumeReloads();input.consumeJumps();world.update(position, dt, input.look,true);world.consumeSounds(); }
    const dashButton=document.querySelector<HTMLButtonElement>('#dash')!,onlineMe=onlineState?.players.find(p=>p.id===onlineId),dashState=onlineActive?onlineMe?.dash:localDash;
    const dashGrounded=onlineActive?!!onlineMe&&onlineMe.jump.height===0&&onlineMe.jump.velocity===0:world.practiceState().grounded;
    const dashBattle=world.duelState(),dashAlive=onlineActive?!!onlineMe&&onlineMe.health>0&&!onlineState?.winner:!dashBattle.active||(dashBattle.playerHealth>0&&!dashBattle.winner);
    dashButton.disabled=!canPlay||!dashAlive||!dashGrounded||!dashState||dashState.cooldown>1e-8||dashState.remaining>0;
    const dashText=!dashState?'서버 준비 중':dashState.remaining>0?'대시 중':dashState.cooldown>0?`대시 ${(Math.ceil((dashState.cooldown-1e-8)*10)/10).toFixed(1)}초`:'대시';
    if(dashButton.textContent!==dashText)dashButton.textContent=dashText;dashButton.setAttribute('aria-label',dashText+' · F키');
    const protection=onlineActive?(onlineMe?.protection??0):world.duelState().protection??0;const shield=document.querySelector<HTMLElement>('#spawn-protection')!;shield.hidden=protection<=0||!canPlay;shield.textContent=`부활 보호 ${protection.toFixed(1)}초 · 사격 시 해제`;
    const runButton=document.querySelector<HTMLButtonElement>('#sprint')!;
    const runningRequested=input.sprintingRequested;
    runButton.setAttribute('aria-pressed',String(runningRequested));runButton.setAttribute('aria-label',runningRequested?'달리기 끄기':'달리기 켜기');
    runButton.textContent=runningRequested?'달리기 켜짐':'달리기';
    const runBattle=world.duelState();runButton.disabled=runBattle.active&&(runBattle.playerHealth===0||!!runBattle.winner);
    damageTime=Math.max(0,damageTime-elapsed);impactTime=Math.max(0,impactTime-elapsed);document.querySelector<HTMLElement>('#impact-marker')!.hidden=impactTime<=0||!picker.hidden||comparing;
    if(uiTick){syncDifficultyOptions();
    document.querySelector<HTMLElement>('#bot-difficulty-setting')!.hidden=onlineActive||document.querySelector<HTMLSelectElement>('#game-mode')!.value==='practice';document.querySelector<HTMLElement>('#start-difficulty-setting')!.hidden=document.querySelector<HTMLSelectElement>('#start-mode')!.value==='practice';
    document.querySelector<HTMLElement>('#ffa-mode-note')!.hidden=document.querySelector<HTMLSelectElement>('#start-mode')!.value!=='ffa';document.querySelector<HTMLElement>('#survival-mode-note')!.hidden=document.querySelector<HTMLSelectElement>('#start-mode')!.value!=='survival';
    gameChoices.refresh();}
    for(const message of (world.consumeHighShots?.()??[])){document.querySelector('#elevated-alert')!.textContent=message;elevatedAlertUntil=performance.now()+4000;combatHudAt=-Infinity;}document.querySelector<HTMLElement>('#posture-controls')!.hidden=!canPlay;
    document.querySelector<HTMLElement>('#elevated-alert')!.hidden=!canPlay||performance.now()>=elevatedAlertUntil;
    noticeTime=Math.max(0,noticeTime-elapsed);refreshHud();if(uiTick)refreshInventory();refreshCombatHud();
    hitTime = Math.max(0, hitTime - elapsed);
    shotTime=Math.max(0,shotTime-elapsed);feedbackTime=Math.max(0,feedbackTime-elapsed);
    crosshair.classList.toggle('hit', hitTime > 0);
    crosshair.classList.toggle('firing',shotTime>0);shotFeedback.hidden=feedbackTime<=0||!picker.hidden||comparing;
    if(drawFrame)world.scene.render();
  });
  window.addEventListener('pagehide', () => { input.reset();audio.pause(true);online.leave();nameplates.clear();nicknameDialog.cancel();for(const p of onlineState?.players??[])if(p.guest)delete p.nickname; });window.addEventListener('pageshow',event=>{if(event.persisted)openHome();});
}
start().catch((error: unknown) => {
  console.error(error);
  loading.replaceChildren();
  const title = document.createElement('h2'); title.textContent = '화면을 열지 못했습니다';
  const message = document.createElement('p');
  message.textContent = error instanceof Error ? error.message : '새로고침 후 다시 시도해 주세요.';
  const retry = document.createElement('button'); retry.textContent = '다시 시도';
  retry.addEventListener('click', () => window.location.reload());
  loading.append(title, message, retry); loading.hidden = false;
});
