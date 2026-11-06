import {BOT_DIFFICULTIES,isSurvivalDifficulty} from './duel.ts';
import {nearbyPickup,createInventory} from './inventory.ts';
import { createPlaytest } from './playtest.ts';
import { createRemoteMotion } from './remote-motion.ts';
import { createOnlineMotion } from './online-motion.ts';
import { createOnlineClient } from './online.ts';
import type { MatchState,Command } from './network-game.ts';
import { simulationSteps } from './simulation.ts';
import { createPerformanceHud } from './performance-hud.ts';
import { createRenderBudget } from './render-budget.ts';
import { sprintMultiplier } from './sprint.ts';
import { createGameAudio,spatialSound } from './audio.ts';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { createInput } from './input.ts';
import { createHarborScene } from './scene.ts';
import { moveWithCollisions, PROTOTYPE,indoorAt } from './world.ts';
import { isCharacterType } from './characters.ts';
import { viewMovement } from './view.ts';
import { isWeaponId,WEAPONS } from './weapons.ts';
import './style.css';
const readMode=(value:string):'practice'|'duel'|'ffa'|'survival'=>value==='survival'?'survival':value==='ffa'?'ffa':value==='duel'?'duel':'practice';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <section id="home-screen" class="home-screen" aria-labelledby="home-title">
    <div class="home-intro"><span class="eyebrow">HARBOR / NIGHT ARENA</span><h1 id="home-title">항구의 밤</h1><p>불빛이 내려앉은 항구, 당신의 로봇으로 출격하세요.</p></div>
    <div class="home-modes"><button id="home-online"><span>01 / ONLINE</span><strong>온라인 대전</strong><p>사람 대 사람 1대1</p><small>방 코드 · 친구 초대 · 자동 매칭</small></button><button id="home-bot"><span>02 / SOLO</span><strong>봇 대전</strong><p>1대1 · 개인전 · 웨이브 생존</p><small>난이도·캐릭터·무기를 고르고 출격</small></button><button id="home-practice"><span>03 / TRAINING</span><strong>표적 연습</strong><p>이동과 조준, 네 가지 무기 익히기</p><small>부담 없이 연습하기</small></button></div>
    <p class="home-controls">PC: WASD 이동 · E 획득 · 1~3 무기 교체 · 마우스 조준 &nbsp; / &nbsp; 모바일: 가로 화면 · 터치 조작</p>
  </section>
  <section id="online-lobby" class="online-lobby" hidden aria-labelledby="online-title"><div><button id="online-back">홈으로</button><h2 id="online-title">온라인 1대1</h2><p>먼저 10킬 · 두 사람이 연결되면 시작합니다.</p><label>캐릭터<select id="online-character"><option value="robot">소형 로봇</option><option value="robot-cat">고양이형 로봇</option></select></label><label>시작 무기<select id="online-weapon"><option value="pistol">권총</option><option value="machinegun">기관총</option><option value="shotgun">산탄총</option><option value="sniper">저격총</option></select></label><div class="online-actions"><button id="online-create">방 만들기</button><button id="online-quick">자동 매칭</button></div><label>방 코드<input id="online-code" maxlength="8" autocomplete="off" placeholder="8자리 코드"></label><button id="online-join">코드로 입장</button><p id="online-message" role="status"></p><p>온라인 대전에서는 메뉴를 열어도 상대의 경기는 계속됩니다.</p></div></section>
  <canvas id="game" tabindex="0" aria-label="항구 도시 1인칭 탐색. WASD로 이동하고 화면을 드래그해 시점을 돌립니다."></canvas>
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
      <button id="help-toggle" aria-expanded="false" aria-controls="help">도움말</button>
    </div>
  </header>
  <div class="location"><span class="live-dot"></span><span id="zone">중앙 광장</span><span class="location-divider"></span><span>해안 지구</span></div>
  <section class="help" id="help" hidden>
    <button id="help-close" class="panel-close" aria-label="도움말 닫기">닫기</button><h2>조작과 게임 안내</h2><p>생존 자동 난이도는 9단계이며 보통에 해당하는 5단계에서 시작합니다. 총 20웨이브입니다. 체력 50 이상으로 2웨이브 연속 클리어하면 한 단계 상승하고, 사망 후 재도전할 때 한 단계 내려갑니다. 조준·경고 시간과 이동·좌우 이동 속도가 조금씩 변하며 전투 중에는 유지됩니다.</p><p>생존: 생명 3개, 쉬움 10·보통 20·어려움 30웨이브. 동시 최대 3명이며 첫 적 3명에서 2웨이브마다 1명씩 늘어 최대 12명입니다. 준비 시간은 5초이며 체력·탄창을 회복합니다. 사망 시 3초 후 현재 웨이브의 적·상자와 소지 무기를 초기화해 시작 총으로 재도전합니다.</p><p>봇 3명 개인전에서는 봇끼리 싸우지 않고 나만 공격합니다. 나와 각 봇의 점수를 따로 기록하며 먼저 10킬이면 승리합니다. 사망하면 3초 후 다른 캐릭터들과 먼 지점에서 시작 총으로 부활합니다.</p><p>봇 대전은 쉬움·보통·어려움 중 선택합니다. 보통·어려움은 더 빨리 조준하고 좌우로 움직이며, 발사 경고 중에는 멈춥니다. 난이도를 변경하면 새 경기를 시작합니다.</p><p>보급 상자 근처에서 E키 또는 획득 버튼으로 무기를 줍습니다. 최대 3개를 소지하며 숫자 1~3 또는 아래 슬롯 버튼으로 바꿉니다. 가득 차면 버릴 총을 선택하세요. 상자는 20초 후 다시 나오며, 사망하면 시작 총만 남습니다.</p>
    <p>로봇의 눈높이에서 거리를 탐색합니다. 화면 중앙의 조준점이 바라보는 방향입니다.</p>
    <p><strong>PC</strong> WASD 이동 · Shift 달리기 · 마우스 드래그로 시점 변경 · 짧게 클릭하면 발사. 메뉴의 마우스 고정 버튼으로 자유롭게 조준할 수 있습니다. Esc를 누르면 고정을 해제하고 일시정지합니다.</p>
    <p><strong>휴대폰</strong> 왼쪽 스틱 이동 · 화면 빈 공간을 좌우·위아래로 드래그해 시점 변경</p>
    <p><strong>달리기</strong> PC는 Shift를 누르고 앞으로 이동하세요. 휴대폰은 스틱 위의 달리기 버튼으로 켜고 끕니다. 이동 속도는 1.5배이며 발사·재장전·확대 조준 중에는 걷습니다. 스태미나 제한은 없습니다.</p>
    <p><strong>점프</strong> 휴대폰은 점프 버튼을 누릅니다. PC는 스페이스바로 점프합니다. 메뉴에서 J키로 변경할 수 있습니다.</p>
    <p id="weapon-help"></p>
    <p>봇 1대1: 양쪽 체력 100, 먼저 10킬 승리. 자동 회복 없이 사망 3초 후 부활합니다. 붉은 표시가 상대 봇입니다. 봇은 1초 조준 후 위치를 고정하고 0.4초 경고 뒤 발사합니다. 경고 때 옆으로 이동하면 피할 수 있으며, 벽 뒤로 숨으면 조준이 초기화됩니다.</p>
    <p>맵을 남쪽 상점 거리와 양옆 골목으로 넓혔습니다. 중앙 거리 양쪽의 열린 출입구와 남쪽 거리의 상점, 총 6곳의 1층에 들어갈 수 있습니다. 문 버튼 없이 걸어서 출입합니다.</p>
    <p>시작 무기는 메뉴에서 선택하며 변경하면 경기를 새로 시작합니다. 기관총은 발사 버튼을 누르고 있거나 PC 마우스 고정 상태에서 왼쪽 버튼을 누르면 연사합니다. 산탄총은 탄알 6개가 퍼지며, 저격총은 확대 버튼 또는 PC Q키로 조준합니다.</p>
    <p>야경 개선: 젖은 노면의 빛, 수면 반짝임, 벽·지붕 표면과 금속 광택을 추가했습니다. 자동 화질은 지속적인 프레임 저하가 있을 때 렌더 해상도를 조절합니다. 높음은 수동 고화질, 균형은 낮은 부하 설정입니다.</p>
    <p>성능 표시는 최근 최대 10초의 플레이 구간을 측정합니다. 평균 FPS는 높을수록, P95 프레임 시간은 낮을수록 부드럽습니다. 끊김은 50ms를 넘은 프레임 수입니다. 메뉴·일시정지 구간은 제외하며, 화질을 비교할 때는 같은 장소에서 같은 시간 동안 움직여 보세요.</p>
    <fieldset class="audio-settings"><legend>소리</legend><label><input id="audio-mute" type="checkbox"> 음소거</label><label>전체<input id="audio-master" type="range" min="0" max="100" aria-label="전체 음량"></label><label>효과음<input id="audio-effects" type="range" min="0" max="100" aria-label="효과음 음량"></label><label>환경음<input id="audio-environment" type="range" min="0" max="100" aria-label="환경음 음량"></label><small id="audio-status">시작 버튼을 누르면 소리를 켭니다.</small></fieldset>
    <label class="graphics-setting">화면 흔들림<select id="screen-shake"><option value="off">끄기</option><option value="low" selected>약하게</option><option value="normal">보통</option></select></label><p>총기 반동·로봇 피격·처치 연출을 추가했습니다. 화면 흔들림은 조절할 수 있으며, 조준 방향과 무기 피해량은 바꾸지 않습니다.</p>
    <label class="sensitivity-setting">모바일 조준 감도 <output id="look-sensitivity-value">1.00배</output><input id="look-sensitivity" type="range" min="25" max="200" step="5" value="100" aria-label="모바일 조준 감도"></label>
    <details class="developer-settings"><summary>개발용 도구</summary><button id="reference-open" aria-pressed="false">시안 비교</button><p>배경 시안과 현재 맵을 비교합니다.</p></details>
    <label class="graphics-setting">그래픽 화질 <select id="graphics-quality"><option value="auto" selected>자동 · 기기에 맞춤</option><option value="high">높음 · 선명한 화면</option><option value="balanced">균형 · 부드러운 실행</option></select></label>
  </section>
  <div class="desktop-hint"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><p>이동 <i>·</i> 드래그로 시점 변경</p></div>
  <div class="touch-controls">
    <button id="sprint" class="sprint-button" aria-pressed="false" aria-label="달리기 켜기">달리기</button>
    <div class="move-control"><div id="joystick" role="group" aria-label="이동 가상 스틱"><div class="stick-cross"></div><div id="joystick-thumb"></div></div><span>이동</span></div>
    <button id="fire" class="single-fire" aria-label="화면 중앙 정면으로 발사">발사</button>
    <button id="reload" class="reload-button" aria-label="무기 재장전">재장전</button>
    <button id="scope" class="scope-button" hidden aria-pressed="false">확대</button>
    <button id="jump" class="jump-button" aria-label="점프">점프</button>
  </div>
  <section id="inventory-ui" aria-label="무기 소지와 획득"><div id="pickup-panel" hidden><span id="pickup-label"></span><button id="pickup-action">획득 · E</button><button id="pickup-cancel" hidden>취소</button></div><div id="weapon-slots"><button data-slot="0" aria-label="무기 슬롯 1">1</button><button data-slot="1" aria-label="무기 슬롯 2">2</button><button data-slot="2" aria-label="무기 슬롯 3">3</button></div></section>
  <div id="scope-overlay" hidden aria-hidden="true"><i></i></div>
  <div id="damage-overlay" aria-hidden="true"><i id="damage-direction"></i></div><div id="impact-marker" aria-hidden="true">×</div>
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
      <p id="ffa-mode-note" hidden>봇 3명은 나만 공격합니다. 나와 각 봇이 먼저 10킬을 경쟁하며, 사망하면 3초 후 먼 지점에서 부활합니다.</p>
      <div class="character-options">
        <button data-character="robot"><span class="robot-icon" aria-hidden="true">▰<i>● ●</i></span><strong>소형 로봇</strong><span>둥근 머리 · 청록색 눈 · 작은 안테나</span><small>왼쪽 시안</small></button>
        <button data-character="robot-cat"><span class="robot-icon cat-icon" aria-hidden="true">▲ ▲<i>◆ ◆</i></span><strong>고양이형 로봇</strong><span>뾰족한 귀 · 금빛 눈 · 기계 꼬리</span><small>오른쪽 시안</small></button>
      </div><button id="character-start" class="character-start">시작 · 드래그로 조준</button><button id="character-start-locked" class="character-start mouse-only">마우스 고정하고 시작</button><p id="pointer-status" role="status"></p><p class="character-note">캐릭터를 고르면 오른쪽에서 실제 3D 모델을 볼 수 있습니다.</p>
    </div>
  </section>
  <section id="pause-panel" class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div><h2 id="pause-title">일시정지</h2><p id="pause-description">전투와 이동이 멈췄습니다.</p><button id="resume">계속하기</button><button id="resume-locked" class="mouse-only">마우스 고정하고 계속</button><p id="pause-lock-status" role="status"></p></div></section>
  <div class="loading" id="loading" role="status"><div class="loading-ring"></div><p>밤의 거리를 준비하고 있습니다</p></div>
  <footer class="phase-note">표적 연습 · 봇 1대1 · 봇 3명 개인전</footer>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;
async function start() {
  if (!Engine.IsSupported) throw new Error('이 브라우저에서 WebGL을 사용할 수 없습니다. 하드웨어 가속을 켜거나 다른 브라우저를 사용해 주세요.');
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, false);
  const mobile=matchMedia('(pointer: coarse)').matches;
  let graphicsMode='auto';
  const densityCap=()=>Math.min(window.devicePixelRatio||1,graphicsMode==='high'?2:graphicsMode==='balanced'?1:mobile?1.5:1.75);
  let budget=createRenderBudget(densityCap()),qualityHigh=!mobile;
  engine.setHardwareScalingLevel(1/budget.density);
  const performanceHud=createPerformanceHud(engine);const playtest=createPlaytest();
  const world = createHarborScene(engine);
  world.setQuality(qualityHigh);
  world.setMode('duel');
  const shake=document.querySelector<HTMLSelectElement>('#screen-shake')!;
  const setShake=(value:string)=>{const level=value==='off'||value==='normal'?value:'low';shake.value=level;world.setShake(level);return level;};
  let savedShake='low';try{savedShake=localStorage.getItem('harbor-screen-shake')??'low';}catch{}setShake(savedShake);
  shake.addEventListener('change',()=>{const level=setShake(shake.value);try{localStorage.setItem('harbor-screen-shake',level);}catch{}});
  document.querySelector<HTMLSelectElement>('#graphics-quality')!.addEventListener('change',event=>{
    graphicsMode=(event.currentTarget as HTMLSelectElement).value;budget=createRenderBudget(densityCap());
    engine.setHardwareScalingLevel(1/budget.density);qualityHigh=graphicsMode==='high'||(graphicsMode==='auto'&&!mobile);
    world.setQuality(qualityHigh);engine.resize();world.resize();
  });
  const input = createInput(canvas);
  input.setEnabled(false);
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
  const audio=createGameAudio();
  document.addEventListener('pointerdown',()=>{void audio.unlock();});
  document.addEventListener('keydown',()=>{void audio.unlock();});
  for(const key of ['master','effects','environment'] as const){const slider=document.querySelector<HTMLInputElement>(`#audio-${key}`)!;slider.value=String(audio.settings[key]*100);slider.addEventListener('input',()=>audio.configure({[key]:Number(slider.value)/100}));}
  const mute=document.querySelector<HTMLInputElement>('#audio-mute')!;mute.checked=audio.settings.muted;mute.addEventListener('change',()=>audio.configure({muted:mute.checked}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause(true);});
  window.addEventListener('blur',()=>audio.pause(true));
  let lastReload=0,lastGrounded=true,lastPlayerHealth=100,lastRespawn=0,lastWinner='',footDistance=0,footAlternating=false,emptyAt=0;

  document.querySelector<HTMLSelectElement>('#jump-key')!.addEventListener('change',event=>{
    const code=(event.currentTarget as HTMLSelectElement).value;
    if(code==='Space'||code==='KeyJ'){input.reset();input.setJumpKey(code);canvas.focus();}
  });
  let onlineState:MatchState|null=null,onlineId='',onlineActive=false,onlineSendTime=0,onlineEventId=-1;
  let onlineStatus='',onlineCode='';const onlineMotion=createOnlineMotion(m=>playtest.correction(m)),remoteMotion=createRemoteMotion();
  const onlineLobby=document.querySelector<HTMLElement>('#online-lobby')!;
  const online=createOnlineClient(import.meta.env?.VITE_ONLINE_URL??(import.meta.env?.DEV?'http://127.0.0.1:8787':''),(state,id)=>{
    playtest.packet();onlineState=state;onlineId=id;onlineMotion.receive(state,id);remoteMotion.receive(state,id,performance.now());
    if(!onlineActive){onlineActive=true;homeOpen=false;home.hidden=true;onlineLobby.hidden=true;document.body.classList.remove('at-home');picker.hidden=true;manualPaused=false;pausePanel.hidden=true;world.setPreview(false);const me=state.players.find(p=>p.id===id);if(me){world.selectCharacter(me.character);world.selectWeapon(me.weaponId);input.resetLook();input.setLook(me.yaw,me.pitch);}hasPlayed=true;canvas.focus();}
  },status=>{onlineStatus=status;document.querySelector('#online-message')!.textContent=status;},session=>{onlineCode=session.code;});
  let pendingSlot:number|undefined,pendingTake:{pickup:string;replace?:number}|undefined,choosePickupId:string|undefined;
  const inventoryUi=document.querySelector<HTMLElement>('#inventory-ui')!,slotButtons=[...document.querySelectorAll<HTMLButtonElement>('#weapon-slots button')];
  function inventoryData(){
    if(onlineActive&&onlineState){const me=onlineState.players.find(p=>p.id===onlineId)!;return {inventory:me.inventory??createInventory(me.weaponId),pickups:onlineState.pickups??[],position:me,ready:!!me.inventory&&!!onlineState.pickups,blocked:me.health===0||!!onlineState.winner||onlineState.players.length<2||onlineState.players.some(p=>!p.connected)||!online.connected};}
    const battle=world.duelState();return {...world.inventoryState(),position,ready:true,blocked:battle.active&&(battle.playerHealth===0||!!battle.winner)};
  }
  function canUseInventory(){return !homeOpen&&!manualPaused&&picker.hidden&&!menuOpen&&help.hidden&&!comparing&&!document.hidden&&document.hasFocus()&&!matchMedia('(pointer: coarse) and (orientation: portrait)').matches;}
  function requestPickup(replace?:number){
    if(!canUseInventory())return;const data=inventoryData(),crate=nearbyPickup(data.position,data.pickups);if(data.blocked||!data.ready||!crate)return;
    if(data.inventory.slots.some(s=>s.id===crate.weaponId)){notice='이미 가진 무기입니다';noticeTime=1;return;}
    if(data.inventory.slots.length===3&&replace===undefined){choosePickupId=crate.id;return;}
    if(onlineActive)pendingTake={pickup:crate.id,replace};else world.pickup(data.position,crate.id,replace);choosePickupId=undefined;
  }
  function requestSlot(slot:number){if(!canUseInventory())return;const data=inventoryData();if(data.blocked||!data.ready)return;if(choosePickupId){requestPickup(slot);return;}if(onlineActive)pendingSlot=slot;else world.switchWeapon(slot);}
  slotButtons.forEach((button,i)=>button.addEventListener('click',()=>requestSlot(i)));
  document.querySelector('#pickup-action')!.addEventListener('click',()=>requestPickup());
  document.querySelector('#pickup-cancel')!.addEventListener('click',()=>{choosePickupId=undefined;});
  window.addEventListener('keydown',event=>{const tag=(event.target as HTMLElement|null)?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag??''))return;if(event.code==='Escape')choosePickupId=undefined;if(!canUseInventory()||event.repeat)return;if(event.code==='KeyE'){event.preventDefault();requestPickup();}if(/^Digit[123]$/.test(event.code)){event.preventDefault();requestSlot(Number(event.code.slice(-1))-1);}});
  function refreshInventory(){
    inventoryUi.hidden=homeOpen||!picker.hidden||comparing;if(inventoryUi.hidden)return;
    const data=inventoryData(),crate=nearbyPickup(data.position,data.pickups)??data.pickups.filter(c=>c.remaining>0&&Math.hypot(c.x-data.position.x,c.z-data.position.z)<=2.5).sort((a,b)=>Math.hypot(a.x-data.position.x,a.z-data.position.z)-Math.hypot(b.x-data.position.x,b.z-data.position.z))[0];if(!crate||crate.remaining>0||crate.id!==choosePickupId||data.blocked)choosePickupId=undefined;
    slotButtons.forEach((button,i)=>{const slot=data.inventory.slots[i],text=slot?`${i+1} · ${WEAPONS[slot.id].name}${choosePickupId?' 버리기':''}`:`${i+1} · 비어 있음`;if(button.textContent!==text)button.textContent=text;button.disabled=!slot||data.blocked||!canUseInventory()||!data.ready;button.setAttribute('aria-pressed',String(i===data.inventory.active));});
    const panel=document.querySelector<HTMLElement>('#pickup-panel')!;panel.hidden=!crate||data.blocked||!canUseInventory()||!data.ready;
    if(crate){const duplicate=data.inventory.slots.some(s=>s.id===crate.weaponId),waiting=crate.remaining>0;document.querySelector('#pickup-label')!.textContent=waiting?`${WEAPONS[crate.weaponId].name} 보급 상자 · ${Math.ceil(crate.remaining)}초 후 재보급`:choosePickupId?'버릴 무기를 아래에서 고르세요':`${WEAPONS[crate.weaponId].name} 보급 상자${duplicate?' · 이미 소지 중':''}`;const action=document.querySelector<HTMLButtonElement>('#pickup-action')!;action.disabled=waiting||duplicate||!!choosePickupId;action.textContent=waiting?'재보급 대기':'획득 · E';document.querySelector<HTMLElement>('#pickup-cancel')!.hidden=!choosePickupId;}
  }
  let onlineControlsActive=false;const updateOnlineControls=(active:boolean)=>{if(active===onlineControlsActive)return;onlineControlsActive=active;document.querySelector<HTMLElement>('#online-copy')!.hidden=!active;for(const id of ['character-open','game-mode','bot-difficulty','weapon-select','practice-reset','reset'])document.querySelector<HTMLButtonElement>('#'+id)!.disabled=active;};
  document.querySelector('#online-copy')!.addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('room',onlineCode);try{await navigator.clipboard.writeText(url.href);document.querySelector('#online-copy')!.textContent='초대 링크 복사됨';}catch{document.querySelector('#online-copy')!.textContent=`방 코드 ${onlineCode}`;}});
  document.querySelector('#home-online')!.addEventListener('click',()=>{home.hidden=true;onlineLobby.hidden=false;document.querySelector('#online-message')!.textContent=online.available?'방을 만들거나 친구의 코드를 입력하세요.':'온라인 서버 연결 준비 중입니다. 봇 대전과 표적 연습은 바로 이용할 수 있습니다.';for(const id of ['online-create','online-join','online-quick'])document.querySelector<HTMLButtonElement>('#'+id)!.disabled=!online.available;});
  for(const [id,action] of [['online-create','create'],['online-join','join'],['online-quick','quick']] as const)document.querySelector('#'+id)!.addEventListener('click',async()=>{
    const buttons=['online-create','online-join','online-quick'].map(id=>document.querySelector<HTMLButtonElement>('#'+id)!);buttons.forEach(button=>button.disabled=true);
    try{await online.enter(action,document.querySelector<HTMLInputElement>('#online-code')!.value.trim().toUpperCase(),document.querySelector<HTMLSelectElement>('#online-weapon')!.value,document.querySelector<HTMLSelectElement>('#online-character')!.value);}catch(error){document.querySelector('#online-message')!.textContent=error instanceof Error?error.message:'방에 입장하지 못했습니다.';}finally{buttons.forEach(button=>button.disabled=!online.available);}
  });
  let homeOpen=true;
  let manualPaused=false,hasPlayed=false,wasLocked=false;
  const pausePanel=document.querySelector<HTMLElement>('#pause-panel')!;
  const pauseGame=()=>{
    if(!hasPlayed||homeOpen||!picker.hidden)return;
    manualPaused=true;input.setEnabled(false);audio.pause(true);
    if(document.pointerLockElement)document.exitPointerLock();
    pausePanel.hidden=false;document.querySelector<HTMLButtonElement>('#resume')!.focus();
  };
  const resumeGame=()=>{manualPaused=false;pausePanel.hidden=true;input.reset();canvas.focus();};
  const lockMouse=()=>{
    const report=(message:string)=>{
      for(const id of ['pointer-status','pause-lock-status'])document.querySelector(`#${id}`)!.textContent=message;
      if(message){pauseGame();document.querySelector('#pause-lock-status')!.textContent=message;}
    };
    if(!canvas.requestPointerLock){report('마우스 고정을 지원하지 않습니다. 계속하기를 누르면 드래그로 조준할 수 있습니다.');return;}
    try{const result=canvas.requestPointerLock();result?.catch(()=>report('마우스를 고정하지 못했습니다. 계속하기로 드래그 조준을 사용하거나 고정을 다시 시도하세요.'));}catch{report('마우스를 고정하지 못했습니다. 계속하기로 드래그 조준을 사용할 수 있습니다.');}
  };
  document.querySelector('#pause-open')!.addEventListener('click',pauseGame);
  document.querySelector('#resume')!.addEventListener('click',resumeGame);
  document.querySelector('#resume-locked')!.addEventListener('click',()=>{resumeGame();lockMouse();});
  document.querySelector('#pointer-lock')!.addEventListener('click',()=>{canvas.focus();lockMouse();});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(wasLocked&&!locked)pauseGame();wasLocked=locked;});
  window.addEventListener('blur',pauseGame);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
  let menuOpen=false;
  const menuButton=document.querySelector<HTMLButtonElement>('#menu-toggle')!;
  const closeMenu=()=>{menuOpen=false;document.body.classList.remove('menu-open');menuButton.setAttribute('aria-expanded','false');input.reset();};
  menuButton.addEventListener('click',()=>{
    menuOpen=!menuOpen;document.body.classList.toggle('menu-open',menuOpen);menuButton.setAttribute('aria-expanded',String(menuOpen));input.setEnabled(false);input.reset();
    if(menuOpen){document.querySelector<HTMLElement>('#help')!.hidden=true;document.querySelector('#help-toggle')!.setAttribute('aria-expanded','false');if(document.pointerLockElement)document.exitPointerLock();}
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
  const openPicker = () => { setComparison(false);input.setEnabled(false);document.querySelector<HTMLSelectElement>('#start-mode')!.value=document.querySelector<HTMLSelectElement>('#game-mode')!.value;document.querySelector<HTMLSelectElement>('#start-difficulty')!.value=document.querySelector<HTMLSelectElement>('#bot-difficulty')!.value;document.querySelector<HTMLSelectElement>('#start-weapon')!.value=document.querySelector<HTMLSelectElement>('#weapon-select')!.value; input.reset(); if (document.pointerLockElement) document.exitPointerLock(); world.setPreview(true); refreshCharacter(); picker.hidden = false; choices[0]!.focus(); };
  const home=document.querySelector<HTMLElement>('#home-screen')!;
  const openHome=()=>{online.leave();onlineMotion.reset();remoteMotion.reset();pendingSlot=undefined;pendingTake=undefined;choosePickupId=undefined;onlineActive=false;onlineState=null;onlineId='';onlineEventId=-1;world.endOnline();onlineLobby.hidden=true;updateOnlineControls(false);homeOpen=true;home.hidden=false;document.body.classList.add('at-home');manualPaused=false;pausePanel.hidden=true;closeMenu();document.querySelector<HTMLElement>('#help')!.hidden=true;picker.hidden=true;setComparison(false);input.setEnabled(false);world.setPreview(true);document.querySelector<HTMLButtonElement>('#home-bot')!.focus();};
  const chooseMode=(value:'duel'|'practice')=>{homeMatchPending=true;homeOpen=false;home.hidden=true;document.body.classList.remove('at-home');openPicker();document.querySelector<HTMLSelectElement>('#start-mode')!.value=value;};
  document.querySelector('#online-back')!.addEventListener('click',openHome);
  document.querySelector('#home-bot')!.addEventListener('click',()=>chooseMode('duel'));
  document.querySelector('#home-practice')!.addEventListener('click',()=>chooseMode('practice'));
  document.querySelector('#home-open')!.addEventListener('click',openHome);
  document.querySelector('#setup-home')!.addEventListener('click',openHome);
  openCharacter.addEventListener('click', openPicker);
  choices.forEach(button => button.addEventListener('click', () => {
    const type = button.dataset.character;
    if (!isCharacterType(type)) return;
    world.selectCharacter(type); refreshCharacter(); input.reset();
  }));
  const startLocked=document.querySelector<HTMLButtonElement>('#character-start-locked')!;
  let homeMatchPending=true;
  const syncDifficultyOptions=()=>{
    for(const [modeId,levelId] of [['game-mode','bot-difficulty'],['start-mode','start-difficulty']]){
      const mode=document.querySelector<HTMLSelectElement>('#'+modeId)!,level=document.querySelector<HTMLSelectElement>('#'+levelId)!;
      const option=level.querySelector<HTMLOptionElement>('option[value="auto"]')!;option.disabled=option.hidden=mode.value!=='survival';
      if(option.disabled&&level.value==='auto')level.value='normal';
    }
  };
  document.querySelector('#start-mode')!.addEventListener('change',syncDifficultyOptions);
  const beginGame=(locked:boolean)=>{
    syncDifficultyOptions();
    const mode=document.querySelector<HTMLSelectElement>('#game-mode')!;
    const weapon=document.querySelector<HTMLSelectElement>('#weapon-select')!;
    const nextMode=document.querySelector<HTMLSelectElement>('#start-mode')!.value;
    const nextWeapon=document.querySelector<HTMLSelectElement>('#start-weapon')!.value;
    const nextDifficulty=document.querySelector<HTMLSelectElement>('#start-difficulty')!.value;const difficulty=document.querySelector<HTMLSelectElement>('#bot-difficulty')!;
    const changed=mode.value!==nextMode||weapon.value!==nextWeapon||difficulty.value!==nextDifficulty;
    mode.value=nextMode;weapon.value=nextWeapon;if(isSurvivalDifficulty(nextDifficulty))difficulty.value=nextDifficulty;
    if((changed||homeMatchPending)&&isWeaponId(nextWeapon)){world.setMode(readMode(nextMode),isSurvivalDifficulty(nextDifficulty)?nextDifficulty:'easy');world.selectWeapon(nextWeapon);restart();}
    homeMatchPending=false;void audio.unlock();input.reset();picker.hidden=true;world.setPreview(false);closeMenu();hasPlayed=true;resumeGame();
    if(locked)lockMouse();
  };
  startButton.addEventListener('click',()=>beginGame(false));
  startLocked.addEventListener('click',()=>beginGame(true));
  picker.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const buttons=[...picker.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')].filter(element=>element.getClientRects().length>0);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement|HTMLSelectElement);
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]!.focus();
    }
  });
  let position = { ...PROTOTYPE.spawn };
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
      document.querySelector('#duel-score')!.textContent=`나 ${me.kills} : ${foe?.kills??0} 상대 · 목표 10킬`;
      const net=online.network;const latency=net.rttMs===null?'통신 측정 중':`통신 ${net.rttMs}ms${net.rttMs>300?' · 지연 높음':''}`;
      document.querySelector('#duel-health')!.textContent=`내 체력 ${me.health} · 방 ${onlineCode}`;
      document.querySelector('#network-status')!.textContent=latency+((net.staleMs??0)>500?' · 수신 지연':'');
      document.querySelector<HTMLProgressElement>('#player-health')!.value=me.health;
      document.querySelector('#duel-status')!.textContent=onlineState.winner?(onlineState.winner===onlineId?'승리!':'패배')+' · 홈에서 새 경기':me.health===0?`${Math.ceil(me.dead)}초 후 부활`:onlineStatus;
      document.querySelector('#weapon-name')!.textContent=state.weaponName;ammo.textContent=String(me.weapon.ammo);document.querySelector('#magazine-size')!.textContent=` / ${state.magazineSize}`;weaponStatus.textContent=me.weapon.reloadRemaining>0?`재장전 ${me.weapon.reloadRemaining.toFixed(1)}초`:'발사 준비';
      document.querySelector<HTMLButtonElement>('#fire')!.disabled=me.health===0||!!onlineState.winner;document.querySelector<HTMLButtonElement>('#scope')!.hidden=me.weaponId!=='sniper';document.querySelector('#scope')!.textContent=state.scoped?'원래 시야':'확대';document.querySelector<HTMLElement>('#scope-overlay')!.hidden=!state.scoped;
      reloadButton.disabled=me.health===0||me.weapon.reloadRemaining>0;reloadProgress.hidden=true;complete.hidden=true;
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
    jumpButton.disabled=blocked||!state.grounded;
    reloadButton.textContent=reloading?'재장전 중':'재장전';
    weaponStatus.textContent=reloading?`재장전 ${state.reloadRemaining.toFixed(1)}초`:noticeTime>0?notice:state.ammo===0?'탄창이 비었습니다 · 재장전하세요':'발사 준비';
    complete.hidden=duel.active||!state.complete;
  };
  const reset = () => { position = { ...PROTOTYPE.spawn }; input.resetLook();world.resetJump(); };
  document.querySelector('#reset')!.addEventListener('click', reset);
  const restart=()=>{reset();world.resetPractice();lastReload=0;lastGrounded=true;lastPlayerHealth=100;lastRespawn=0;lastWinner='';footDistance=0;footAlternating=false;emptyAt=0;lastHudKey='';noticeTime=0;hitTime=0;shotTime=0;feedbackTime=0;damageTime=0;impactTime=0;previousDamage=0;refreshHud();};
  document.querySelector('#practice-reset')!.addEventListener('click',restart);
  document.querySelector('#practice-again')!.addEventListener('click',restart);
  document.querySelector<HTMLSelectElement>('#bot-difficulty')!.addEventListener('change',event=>{const level=(event.currentTarget as HTMLSelectElement).value;if(onlineActive||!isSurvivalDifficulty(level))return;world.setMode(readMode(document.querySelector<HTMLSelectElement>('#game-mode')!.value),level);restart();canvas.focus();});
  document.querySelector<HTMLSelectElement>('#game-mode')!.addEventListener('change',event=>{
    syncDifficultyOptions();const level=document.querySelector<HTMLSelectElement>('#bot-difficulty')!.value;world.setMode(readMode((event.currentTarget as HTMLSelectElement).value),isSurvivalDifficulty(level)?level:'easy');restart();canvas.focus();
  });
  document.querySelector<HTMLSelectElement>('#weapon-select')!.addEventListener('change',event=>{
    const id=(event.currentTarget as HTMLSelectElement).value;if(isWeaponId(id)){world.selectWeapon(id);restart();canvas.focus();}
  });
  window.addEventListener('keydown',event=>{
    const tag=(event.target as HTMLElement|null)?.tagName;
    if(event.code==='KeyQ'&&!event.repeat&&!manualPaused&&!menuOpen&&picker.hidden&&!comparing&&document.querySelector<HTMLElement>('#help')!.hidden&&!['INPUT','SELECT','TEXTAREA'].includes(tag??'')){event.preventDefault();world.toggleScope();audio.play('scope');}
  });
  document.querySelector('#scope')!.addEventListener('click',()=>{if(manualPaused||menuOpen||!picker.hidden||comparing||!document.querySelector<HTMLElement>('#help')!.hidden)return;world.toggleScope();audio.play('scope');canvas.focus();});
  const help = document.querySelector<HTMLElement>('#help')!;
  const closeHelp=()=>{help.hidden=true;document.querySelector('#help-toggle')!.setAttribute('aria-expanded','false');input.reset();};
  document.querySelector('#pause-continue')!.addEventListener('click',()=>{closeHelp();closeMenu();resumeGame();});
  document.querySelector('#help-close')!.addEventListener('click',()=>{closeHelp();canvas.focus();});
  document.querySelector('#help-toggle')!.addEventListener('click', event => {
    help.hidden = !help.hidden;input.setEnabled(false);input.reset();
    (event.currentTarget as HTMLElement).setAttribute('aria-expanded', String(!help.hidden));
  });
  window.addEventListener('keydown',event=>{
    if(event.code!=='Escape'||homeOpen||!picker.hidden)return;
    if(!help.hidden){event.preventDefault();closeHelp();canvas.focus();}
    else if(comparing){event.preventDefault();setComparison(false);}
    else if(menuOpen){event.preventDefault();closeMenu();canvas.focus();}
    else if(!manualPaused&&!document.pointerLockElement){event.preventDefault();pauseGame();}
  });
  pausePanel.addEventListener('keydown',event=>{if(event.key!=='Tab')return;event.preventDefault();const buttons=[...pausePanel.querySelectorAll<HTMLButtonElement>('button')].filter(button=>button.getClientRects().length>0);const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(index+(event.shiftKey?buttons.length-1:1))%buttons.length]!.focus();});
  window.addEventListener('resize', () => { closeMenu(); engine.resize(); world.resize(); });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  world.update(position, 1);
  await world.scene.whenReadyAsync();
  loading.hidden = true;
  openHome();
  const invited=new URLSearchParams(window.location?.search??'').get('room');if(invited&&/^[0-9A-F]{8}$/.test(invited.toUpperCase())){document.querySelector<HTMLInputElement>('#online-code')!.value=invited.toUpperCase();document.querySelector<HTMLButtonElement>('#home-online')!.click();}
  let resetClock=true;
  document.addEventListener('visibilitychange',()=>{resetClock=true;});
  window.addEventListener('focus',()=>{resetClock=true;});
  engine.runRenderLoop(() => {
    const elapsed=resetClock?0:Math.max(0,engine.getDeltaTime()/1000);resetClock=false;
    const dt = Math.min(elapsed, 0.05);
    const portraitTouch = matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
    const canPlay=!homeOpen&&!manualPaused&&!document.hidden&&!portraitTouch&&picker.hidden&&!comparing&&!menuOpen&&help.hidden&&document.hasFocus();
    input.setEnabled(canPlay);
    document.querySelector('#pause-description')!.textContent=onlineActive?'내 조작만 멈춥니다. 상대의 경기는 계속됩니다.':'전투와 이동이 멈췄습니다.';
    document.querySelector<HTMLElement>('#pause-indicator')!.hidden=manualPaused||!picker.hidden||comparing||portraitTouch||(!menuOpen&&help.hidden);
    performanceHud.update(elapsed,canPlay);playtest.frame(elapsed,onlineActive?'online':world.duelState().active?'bot':'practice',canPlay,onlineActive?online.network.rttMs:null);
    if(graphicsMode==='auto'){
      const density=budget.sample(elapsed,canPlay);
      if(density!==null){engine.setHardwareScalingLevel(1/density);engine.resize();world.resize();}
      const detailed=!mobile&&budget.density>=Math.min(densityCap(),1.1);
      if(detailed!==qualityHigh){qualityHigh=detailed;world.setQuality(detailed);}
    }
    audio.pause(!canPlay);
    document.querySelector('#audio-status')!.textContent=audio.available?'사운드 활성화':'화면을 눌러 소리 켜기';
    if(onlineActive&&onlineState){
      updateOnlineControls(true);
      const command:Omit<Command,'seq'>={x:canPlay?input.move.x:0,y:canPlay?input.move.y:0,yaw:input.look.yaw,pitch:input.look.pitch,fire:canPlay&&input.firing,shot:false,reload:false,jump:false,sprint:canPlay&&input.sprintingRequested,scope:world.practiceState().scoped};
      const predictedPosition=onlineMotion.advance(elapsed,command,online.connected);
      onlineSendTime+=Math.min(elapsed,.1);
      if(onlineSendTime>=.05){onlineSendTime%=.05;command.shot=canPlay&&input.consumeShots()>0;command.reload=canPlay&&input.consumeReloads()>0;command.jump=canPlay&&input.consumeJumps()>0;if(canPlay){command.slot=pendingSlot;command.pickup=pendingTake?.pickup;command.replace=pendingTake?.replace;}const seq=online.send(command);if(seq!==null){onlineMotion.sent(seq,command);pendingSlot=undefined;pendingTake=undefined;}}
      world.renderOnline(onlineState,onlineId,input.look,Math.min(elapsed,.1),predictedPosition,remoteMotion.sample(performance.now(),online.network.rttMs));
      for(const event of onlineState.events)if(event.id>onlineEventId){onlineEventId=event.id;audio.play(event.weapon);if(event.hit&&event.player===onlineId){audio.play(event.killed?'kill':'hit');impactTime=.2;feedbackTime=.35;shotFeedback.textContent=event.killed?'상대 처치':'명중';document.querySelector('#impact-marker')!.classList.toggle('kill',event.killed);}}
    } else if (canPlay) {
      for(const step of simulationSteps(elapsed)){
        const queued=input.consumeShots(),reloadRequested=input.consumeReloads();
        const before=world.practiceState();
        const movement = viewMovement(input.look.yaw, input.move.x, input.move.y);
        const duel=world.duelState(),canAct=!duel.active||(duel.playerHealth>0&&!duel.winner);
        const runScale=sprintMultiplier({requested:input.sprintingRequested,forward:input.move.y,canAct,firing:queued>0||input.firing||before.cooldown>0||shotTime>0,reloading:before.reloadRemaining>0||reloadRequested>0,scoped:before.scoped},1.5);
        const oldPosition={...position};
        if(canAct)position = moveWithCollisions(position, {
          x: movement.x * PROTOTYPE.speed * runScale * step, z: movement.z * PROTOTYPE.speed * runScale * step,
        });
        if(input.consumeJumps()>0&&canAct&&world.jump())audio.play('jump');
        world.update(position, step, input.look);
        if(reloadRequested>0&&world.reload())audio.play('reload');
        const current=world.practiceState();
        if(lastReload>0&&current.reloadRemaining===0)audio.play('ready');
        lastReload=current.reloadRemaining;
        if(!lastGrounded&&current.grounded)audio.play('land');lastGrounded=current.grounded;
        const walked=Math.hypot(position.x-oldPosition.x,position.z-oldPosition.z);
        if(canAct&&current.grounded&&walked<2){footDistance+=walked;if(footDistance>2.2){footDistance=0;footAlternating=!footAlternating;audio.play(footAlternating?'step':'step2');}}
        const battle=world.duelState();
        if(battle.active&&battle.playerHealth<lastPlayerHealth)audio.play(battle.playerHealth===0?'death':'hurt');
        if(battle.respawnVersion>lastRespawn)audio.play('respawn');
        if(battle.winner&&battle.winner!==lastWinner)audio.play(battle.winner==='player'?'win':'lose');
        lastPlayerHealth=battle.playerHealth;lastRespawn=battle.respawnVersion;lastWinner=battle.winner;
        for(const event of world.consumeSounds()){const spatial=spatialSound(event.x-position.x,event.z-position.z,input.look.yaw);audio.play(event.kind,spatial.pan,spatial.gain);}
        const shots=queued>0?queued:(input.firing&&world.practiceState().automatic?1:0);
        for (let i = 0; i < shots; i++) {
          const shot = world.shoot();
          if(shot.fired){shotTime=0.08;audio.play(world.practiceState().weaponId);if(shot.hit)audio.play(shot.eliminated?'kill':'hit',0,.6);else if('impact' in shot&&shot.impact)audio.play('wall',0,.35);}
          if(!shot.fired&&'reason' in shot&&shot.reason==='empty'&&performance.now()>emptyAt){audio.play('empty');emptyAt=performance.now()+500;}
          if (shot.hit) {impactTime=0.2;document.querySelector('#impact-marker')!.classList.toggle('kill','eliminated' in shot&&!!shot.eliminated);hitTime=0.16;feedbackTime=0.35;shotFeedback.textContent='eliminated' in shot&&shot.eliminated?(world.duelState().active?'봇 처치':'표적 파괴'):`명중 −${'damage' in shot?shot.damage:0}`;}
          else if(!shot.fired && 'reason' in shot && shot.reason!=='cooldown'){notice=shot.reason==='empty'?'탄창이 비었습니다 · 재장전하세요':'재장전 중에는 발사할 수 없습니다';noticeTime=0.8;}
        }
      }
      zone.textContent = indoorAt(position)?'상점 내부':position.z < -28?'남쪽 상점 거리':position.z > 28 ? '항구 산책로' : Math.abs(position.x) > 20 ? '건물 사이 골목'
        : Math.abs(position.z) < 11 && Math.abs(position.x) < 11 ? '중앙 광장' : '해안 거리';
    } else { input.consumeShots();input.consumeReloads();input.consumeJumps();world.update(position, dt, input.look,true);world.consumeSounds(); }
    const runButton=document.querySelector<HTMLButtonElement>('#sprint')!;
    const runningRequested=input.sprintingRequested;
    runButton.setAttribute('aria-pressed',String(runningRequested));runButton.setAttribute('aria-label',runningRequested?'달리기 끄기':'달리기 켜기');
    runButton.textContent=runningRequested?'달리기 켜짐':'달리기';
    const runBattle=world.duelState();runButton.disabled=runBattle.active&&(runBattle.playerHealth===0||!!runBattle.winner);
    damageTime=Math.max(0,damageTime-elapsed);impactTime=Math.max(0,impactTime-elapsed);document.querySelector<HTMLElement>('#impact-marker')!.hidden=impactTime<=0||!picker.hidden||comparing;
    syncDifficultyOptions();
    document.querySelector<HTMLElement>('#bot-difficulty-setting')!.hidden=onlineActive||document.querySelector<HTMLSelectElement>('#game-mode')!.value==='practice';document.querySelector<HTMLElement>('#start-difficulty-setting')!.hidden=document.querySelector<HTMLSelectElement>('#start-mode')!.value==='practice';
    document.querySelector<HTMLElement>('#ffa-mode-note')!.hidden=document.querySelector<HTMLSelectElement>('#start-mode')!.value!=='ffa';document.querySelector<HTMLElement>('#survival-mode-note')!.hidden=document.querySelector<HTMLSelectElement>('#start-mode')!.value!=='survival';
    noticeTime=Math.max(0,noticeTime-elapsed);refreshHud();refreshInventory();
    hitTime = Math.max(0, hitTime - elapsed);
    shotTime=Math.max(0,shotTime-elapsed);feedbackTime=Math.max(0,feedbackTime-elapsed);
    crosshair.classList.toggle('hit', hitTime > 0);
    crosshair.classList.toggle('firing',shotTime>0);shotFeedback.hidden=feedbackTime<=0||!picker.hidden||comparing;
    world.scene.render();
  });
  window.addEventListener('pagehide', () => { input.reset();audio.pause(true); });
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
