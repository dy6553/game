import { Engine } from '@babylonjs/core/Engines/engine.js';
import { createInput } from './input.ts';
import { createHarborScene } from './scene.ts';
import { moveWithCollisions, PROTOTYPE } from './world.ts';
import { isCharacterType } from './characters.ts';
import { viewMovement } from './view.ts';
import { isWeaponId } from './weapons.ts';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="game" tabindex="0" aria-label="항구 도시 1인칭 탐색. WASD로 이동하고 화면을 드래그해 시점을 돌립니다."></canvas>
  <header class="topbar">
    <div class="brand"><span class="eyebrow">HARBOR / FIRST PERSON</span><h1>항구의 밤<span>1인칭</span></h1></div>
    <button id="menu-toggle" aria-expanded="false" aria-controls="game-toolbar">메뉴</button>
    <div id="game-toolbar" class="toolbar" aria-label="화면 설정">
      <button id="character-open">캐릭터 선택</button>
      <button id="reference-open" aria-pressed="false">시안 비교</button>
      <button id="reset">출발점</button>
      <button id="practice-reset">다시 시작</button>
      <select id="game-mode" aria-label="게임 모드"><option value="duel">봇 1대1 · 쉬움</option><option value="practice">표적 연습</option></select>
      <label class="pc-jump-setting"><select id="jump-key" aria-label="PC 점프 키 선택"><option value="Space" selected>스페이스: 점프</option><option value="KeyJ">J: 점프</option></select></label>
      <label class="weapon-setting">시작 무기 · 변경 시 새 경기<select id="weapon-select" aria-label="시작 무기 선택, 변경 시 경기 초기화"><option value="pistol">권총</option><option value="machinegun">기관총</option><option value="shotgun">산탄총</option><option value="sniper">저격총</option></select></label>
      <button id="help-toggle" aria-expanded="false" aria-controls="help">도움말</button>
    </div>
  </header>
  <div class="location"><span class="live-dot"></span><span id="zone">중앙 광장</span><span class="location-divider"></span><span>해안 지구</span></div>
  <section class="help" id="help" hidden>
    <h2>밤의 거리를 걸어보세요</h2>
    <p>로봇의 눈높이에서 거리를 탐색합니다. 화면 중앙의 조준점이 바라보는 방향입니다.</p>
    <p><strong>PC</strong> WASD 이동 · 마우스 드래그로 시점 변경 · 짧게 클릭하면 발사. 더블클릭으로 마우스 고정을 시도하며 ESC로 해제합니다.</p>
    <p><strong>휴대폰</strong> 왼쪽 스틱 이동 · 화면 빈 공간을 좌우·위아래로 드래그해 시점 변경</p>
    <p><strong>점프</strong> 휴대폰은 점프 버튼을 누릅니다. PC는 스페이스바로 점프합니다. 메뉴에서 J키로 변경할 수 있습니다.</p>
    <p>권총은 탄창 12발, 표적은 체력 100입니다. 4발 맞히면 파괴됩니다. PC R키 또는 재장전 버튼으로 1.5초 동안 재장전합니다. 예비 탄약은 무제한입니다.</p>
    <p>봇 1대1: 양쪽 체력 100, 먼저 10킬 승리. 자동 회복 없이 사망 3초 후 부활합니다. 붉은 표시가 상대 봇입니다. 봇은 1초 조준 후 위치를 고정하고 0.4초 경고 뒤 발사합니다. 경고 때 옆으로 이동하면 피할 수 있으며, 벽 뒤로 숨으면 조준이 초기화됩니다.</p>
    <p>시작 무기는 메뉴에서 선택하며 변경하면 경기를 새로 시작합니다. 기관총은 발사 버튼을 누르고 있거나 PC 마우스 고정 상태에서 왼쪽 버튼을 누르면 연사합니다. 산탄총은 탄알 6개가 퍼지며, 저격총은 확대 버튼 또는 PC Q키로 조준합니다.</p>
    <p>야경 개선: 젖은 노면의 빛, 수면 반짝임, 벽·지붕 표면과 금속 광택을 추가했습니다. 균형 화질에서는 추가 가로등 빛 번짐을 줄입니다.</p>
    <label class="graphics-setting">그래픽 화질 <select id="graphics-quality"><option value="high">높음 · 선명한 화면</option><option value="balanced">균형 · 부드러운 실행</option></select></label>
  </section>
  <div class="desktop-hint"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><p>이동 <i>·</i> 드래그로 시점 변경</p></div>
  <div class="touch-controls">
    <div class="move-control"><div id="joystick" role="group" aria-label="이동 가상 스틱"><div class="stick-cross"></div><div id="joystick-thumb"></div></div><span>이동</span></div>
    <button id="fire" class="single-fire" aria-label="화면 중앙 정면으로 발사">발사</button>
    <button id="reload" class="reload-button" aria-label="권총 재장전">재장전</button>
    <button id="scope" class="scope-button" hidden aria-pressed="false">확대</button>
    <button id="jump" class="jump-button" aria-label="점프">점프</button>
  </div>
  <div id="scope-overlay" hidden aria-hidden="true"><i></i></div>
  <div id="damage-overlay" aria-hidden="true"><i id="damage-direction"></i></div><div id="impact-marker" aria-hidden="true">×</div>
  <div class="crosshair" aria-hidden="true"><i></i><b></b></div>
  <div id="shot-feedback" class="shot-feedback" role="status" hidden></div>
  <div class="look-hint">빈 화면을 드래그해 둘러보세요</div>
  <section class="practice-score" aria-label="표적 연습 현황"><div>명중 <span id="hits">0</span> · 파괴 <span id="destroyed">0</span>/3</div><div class="target-health">${[0,1,2].map(i=>`<div><span>표적 ${i+1}</span><progress id="health-${i}" max="100" value="100" aria-label="표적 ${i+1} 체력"></progress><b id="health-value-${i}">100</b></div>`).join('')}</div></section>
  <section id="duel-hud" class="duel-hud" aria-label="봇 대전 현황"><strong id="duel-score"></strong><div id="duel-health"></div><progress id="player-health" max="100" value="100" aria-label="내 체력"></progress><div id="health-segments" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p id="duel-status" role="status"></p></section>
  <div class="ammo-hud" aria-label="권총 탄약"><span id="weapon-name">권총</span><div><b id="ammo">12</b><span id="magazine-size"> / 12</span><small>예비 ∞</small></div><p id="weapon-status">발사 준비</p><progress id="reload-progress" max="1.5" value="0" aria-label="재장전 진행" hidden></progress></div>
  <div id="practice-complete" class="practice-complete" role="status" hidden>표적 연습 완료 <button id="practice-again">다시 연습</button></div>
  <figure id="reference-panel" class="reference-panel" hidden><figcaption>기준 시안</figcaption><div class="reference-load"><p>비교할 배경 시안을 선택해 주세요</p><label>이미지 선택<input id="reference-file" type="file" accept="image/*" /></label><p id="reference-status">게임은 이미지를 선택하지 않아도 실행됩니다.</p></div><img id="reference-image" alt="선택한 배경 시안" hidden /></figure>
  <div class="live-reference-label" hidden>현재 3D 배경 · 제작 중</div>
  <div class="rotate-notice"><span>↻</span><h2>가로로 돌려주세요</h2><p>넓은 화면에서 이동과 조준을 함께 사용할 수 있습니다.</p></div>
  <section id="character-picker" class="character-picker" role="dialog" aria-modal="true" aria-labelledby="character-title" hidden>
    <div class="character-sheet"><span class="eyebrow">CHOOSE YOUR CHARACTER</span>
      <h2 id="character-title">함께 거리를 누빌 캐릭터</h2><p>마음에 드는 로봇을 선택해 주세요. 플레이 중에도 바꿀 수 있습니다.</p>
      <div class="character-options">
        <button data-character="robot"><span class="robot-icon" aria-hidden="true">▰<i>● ●</i></span><strong>소형 로봇</strong><span>둥근 머리 · 청록색 눈 · 작은 안테나</span><small>왼쪽 시안</small></button>
        <button data-character="robot-cat"><span class="robot-icon cat-icon" aria-hidden="true">▲ ▲<i>◆ ◆</i></span><strong>고양이형 로봇</strong><span>뾰족한 귀 · 금빛 눈 · 기계 꼬리</span><small>오른쪽 시안</small></button>
      </div><button id="character-start" class="character-start">이 캐릭터로 시작</button><p class="character-note">캐릭터를 고르면 오른쪽에서 실제 3D 모델을 볼 수 있습니다.</p>
    </div>
  </section>
  <div class="loading" id="loading" role="status"><div class="loading-ring"></div><p>밤의 거리를 준비하고 있습니다</p></div>
  <footer class="phase-note">03 / 표적 연습 · 봇 1대1</footer>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;
async function start() {
  if (!Engine.IsSupported) throw new Error('이 브라우저에서 WebGL을 사용할 수 없습니다. 하드웨어 가속을 켜거나 다른 브라우저를 사용해 주세요.');
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, false);
  // Limit drawing-buffer density on phones; CSS and input remain at full device coordinates.
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const world = createHarborScene(engine);
  world.setQuality(true);
  world.setMode('duel');
  document.querySelector<HTMLSelectElement>('#graphics-quality')!.addEventListener('change',event=>{
    const high=(event.currentTarget as HTMLSelectElement).value==='high';
    engine.setHardwareScalingLevel(1/Math.min(window.devicePixelRatio||1,high?2:1.25));
    world.setQuality(high);engine.resize();world.resize();
  });
  const input = createInput(canvas);
  document.querySelector<HTMLSelectElement>('#jump-key')!.addEventListener('change',event=>{
    const code=(event.currentTarget as HTMLSelectElement).value;
    if(code==='Space'||code==='KeyJ'){input.reset();input.setJumpKey(code);canvas.focus();}
  });
  let menuOpen=false;
  const menuButton=document.querySelector<HTMLButtonElement>('#menu-toggle')!;
  const closeMenu=()=>{menuOpen=false;document.body.classList.remove('menu-open');menuButton.setAttribute('aria-expanded','false');input.reset();};
  menuButton.addEventListener('click',()=>{
    menuOpen=!menuOpen;document.body.classList.toggle('menu-open',menuOpen);menuButton.setAttribute('aria-expanded',String(menuOpen));input.reset();
    if(menuOpen){document.querySelector<HTMLElement>('#help')!.hidden=true;if(document.pointerLockElement)document.exitPointerLock();}
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
    referenceButton.textContent=value?'1인칭 돌아가기':'시안 비교';
    referenceButton.setAttribute('aria-pressed',String(value));
    if(document.pointerLockElement)document.exitPointerLock();
    engine.resize();world.resize();
  };
  referenceButton.addEventListener('click',()=>setComparison(!comparing));
  const picker = document.querySelector<HTMLElement>('#character-picker')!;
  const openCharacter = document.querySelector<HTMLButtonElement>('#character-open')!;
  const choices = [...document.querySelectorAll<HTMLButtonElement>('[data-character]')];
  const startButton = document.querySelector<HTMLButtonElement>('#character-start')!;
  const refreshCharacter = () => choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.character === world.characterType)));
  const openPicker = () => { setComparison(false); input.reset(); if (document.pointerLockElement) document.exitPointerLock(); world.setPreview(true); refreshCharacter(); picker.hidden = false; choices[0]!.focus(); };
  openCharacter.addEventListener('click', openPicker);
  choices.forEach(button => button.addEventListener('click', () => {
    const type = button.dataset.character;
    if (!isCharacterType(type)) return;
    world.selectCharacter(type); refreshCharacter(); input.reset();
  }));
  startButton.addEventListener('click', () => { input.reset(); picker.hidden=true; world.setPreview(false); closeMenu(); canvas.focus(); });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const buttons=[...choices,startButton];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
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
    const state=world.practiceState();
    const duel=world.duelState();
    document.querySelector<HTMLElement>('.practice-score')!.hidden=duel.active;
    document.querySelector<HTMLElement>('#duel-hud')!.hidden=!duel.active;
    document.querySelector('#duel-score')!.textContent=`나 ${duel.playerKills} : ${duel.botKills} 봇 · 목표 10킬`;
    document.querySelector('#duel-health')!.textContent=`내 체력 ${duel.playerHealth} · 봇 체력 ${duel.botHealth}`;
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
    document.querySelector('#duel-status')!.textContent=duel.winner?(duel.winner==='player'?'승리!':'패배')+' · 다시 시작으로 재경기':duel.playerDead>0?`쓰러졌습니다 · ${Math.ceil(duel.playerDead)}초 후 부활`:duel.botDead>0?`봇 처치 · ${Math.ceil(duel.botDead)}초 후 상대 부활`:duel.locked?'발사 임박! 옆으로 이동하세요':duel.aim>0?'상대가 조준 중 · 엄폐하세요':'벽과 건물로 몸을 숨기세요';
    document.body.classList.toggle('player-hurt',duel.active&&duel.playerHealth>0&&duel.playerHealth<=50);
    document.querySelector<HTMLButtonElement>('#reset')!.disabled=duel.active;
    const blocked=duel.active&&(duel.playerHealth===0||!!duel.winner);
    document.querySelector<HTMLButtonElement>('#fire')!.disabled=blocked;
    document.querySelector('#weapon-name')!.textContent=state.weaponName;
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
  const restart=()=>{reset();world.resetPractice();noticeTime=0;hitTime=0;shotTime=0;feedbackTime=0;damageTime=0;impactTime=0;previousDamage=0;refreshHud();};
  document.querySelector('#practice-reset')!.addEventListener('click',restart);
  document.querySelector('#practice-again')!.addEventListener('click',restart);
  document.querySelector<HTMLSelectElement>('#game-mode')!.addEventListener('change',event=>{
    world.setMode((event.currentTarget as HTMLSelectElement).value==='duel'?'duel':'practice');restart();canvas.focus();
  });
  document.querySelector<HTMLSelectElement>('#weapon-select')!.addEventListener('change',event=>{
    const id=(event.currentTarget as HTMLSelectElement).value;if(isWeaponId(id)){world.selectWeapon(id);restart();canvas.focus();}
  });
  window.addEventListener('keydown',event=>{
    const tag=(event.target as HTMLElement|null)?.tagName;
    if(event.code==='KeyQ'&&!event.repeat&&!menuOpen&&picker.hidden&&!comparing&&document.querySelector<HTMLElement>('#help')!.hidden&&!['INPUT','SELECT','TEXTAREA'].includes(tag??'')){event.preventDefault();world.toggleScope();}
  });
  document.querySelector('#scope')!.addEventListener('click',()=>{world.toggleScope();canvas.focus();});
  const help = document.querySelector<HTMLElement>('#help')!;
  document.querySelector('#help-toggle')!.addEventListener('click', event => {
    help.hidden = !help.hidden;
    (event.currentTarget as HTMLElement).setAttribute('aria-expanded', String(!help.hidden));
  });
  window.addEventListener('resize', () => { closeMenu(); engine.resize(); world.resize(); });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  world.update(position, 1);
  await world.scene.whenReadyAsync();
  loading.hidden = true;
  openPicker();
  let resetClock=true;
  document.addEventListener('visibilitychange',()=>{resetClock=true;});
  window.addEventListener('focus',()=>{resetClock=true;});
  engine.runRenderLoop(() => {
    const elapsed=resetClock?0:Math.max(0,engine.getDeltaTime()/1000);resetClock=false;
    const dt = Math.min(elapsed, 0.05);
    const portraitTouch = matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
    if (!document.hidden && !portraitTouch && picker.hidden && !comparing && !menuOpen && help.hidden) {
      const movement = viewMovement(input.look.yaw, input.move.x, input.move.y);
      const duel=world.duelState(),canAct=!duel.active||(duel.playerHealth>0&&!duel.winner);
      if(canAct)position = moveWithCollisions(position, {
        x: movement.x * PROTOTYPE.speed * dt, z: movement.z * PROTOTYPE.speed * dt,
      });
      if(input.consumeJumps()>0&&canAct)world.jump();
      world.update(position, elapsed, input.look);
      if(input.consumeReloads()>0)world.reload();
      const queued=input.consumeShots();
      const shots=queued>0?queued:(input.firing&&world.practiceState().automatic?1:0);
      for (let i = 0; i < shots; i++) {
        const shot = world.shoot();
        if(shot.fired)shotTime=0.08;
        if (shot.hit) {impactTime=0.2;document.querySelector('#impact-marker')!.classList.toggle('kill','eliminated' in shot&&!!shot.eliminated);hitTime=0.16;feedbackTime=0.35;shotFeedback.textContent='eliminated' in shot&&shot.eliminated?(world.duelState().active?'봇 처치':'표적 파괴'):`명중 −${'damage' in shot?shot.damage:0}`;}
        else if(!shot.fired && 'reason' in shot && shot.reason!=='cooldown'){notice=shot.reason==='empty'?'탄창이 비었습니다 · 재장전하세요':'재장전 중에는 발사할 수 없습니다';noticeTime=0.8;}
      }
      zone.textContent = position.z > 28 ? '항구 산책로' : Math.abs(position.x) > 20 ? '건물 사이 골목'
        : Math.abs(position.z) < 11 && Math.abs(position.x) < 11 ? '중앙 광장' : '해안 거리';
    } else { input.consumeShots();input.consumeReloads();input.consumeJumps();world.update(position, dt, input.look,true); }
    damageTime=Math.max(0,damageTime-elapsed);impactTime=Math.max(0,impactTime-elapsed);document.querySelector<HTMLElement>('#impact-marker')!.hidden=impactTime<=0||!picker.hidden||comparing;
    noticeTime=Math.max(0,noticeTime-elapsed);refreshHud();
    hitTime = Math.max(0, hitTime - elapsed);
    shotTime=Math.max(0,shotTime-elapsed);feedbackTime=Math.max(0,feedbackTime-elapsed);
    crosshair.classList.toggle('hit', hitTime > 0);
    crosshair.classList.toggle('firing',shotTime>0);shotFeedback.hidden=feedbackTime<=0||!picker.hidden||comparing;
    world.scene.render();
  });
  window.addEventListener('pagehide', () => { input.reset(); });
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
