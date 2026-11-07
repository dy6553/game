import {isCharacterType,type CharacterType} from './characters.ts';
import {isWeaponId,WEAPONS,type WeaponId} from './weapons.ts';
import {isSurvivalDifficulty,type SurvivalDifficulty} from './duel.ts';
export type HomeMode='duel'|'ffa'|'survival'|'practice'|'online';
export type HomeSelection={mode:HomeMode;difficulty:SurvivalDifficulty;weapon:WeaponId;character:CharacterType};
const characterNames={robot:'소형 로봇','robot-cat':'고양이형 로봇'};
function weaponArt(id:WeaponId){const paths={pistol:'M36 24h104v22h-43l-8 30H63l4-30H36z',machinegun:'m12 31 39-7h102v7h36v10h-36v9h-45l-4 27H80l3-27H55L41 62H20l7-20H12z',shotgun:'m9 25 30-5h103v7h48v11H91l-9 15H56L37 72H11l14-34H9z',sniper:'M8 35h49V24h29v-8h45v11h-23v8h83v7h-68l-21 15H79l-8 19H50l4-29-40 17H8z'};return `<svg viewBox="0 0 200 85" aria-hidden="true"><path d="${paths[id]}" fill="currentColor"/><path d="M60 29h54m-42 10h43" fill="none" stroke="#091c28" stroke-width="3"/></svg>`;}
export const HOME_MARKUP=`
<section id="home-screen" class="home-screen home-lobby shooter-lobby" aria-labelledby="home-title">
 <header class="lobby-header"><div class="lobby-brand"><span class="lobby-mark" aria-hidden="true">H</span><div><span class="eyebrow">HARBOR / NIGHT ARENA</span><h1 id="home-title">항구의 밤</h1></div></div><nav class="lobby-nav" aria-label="로비 메뉴"><button id="lobby-tab-home" aria-current="page">플레이</button><button id="lobby-tab-character">캐릭터</button><button id="lobby-tab-loadout">장비</button></nav><div class="lobby-header-actions"><span class="lobby-ready"><i></i> 출격 준비 완료</span><button id="home-account" hidden>계정 · 공식 전적</button><button id="home-records">개인 전적 ↗</button></div></header>
 <div class="shooter-lobby-body">
  <aside class="lobby-side" aria-label="현재 장비">
   <div class="lobby-operation"><span class="eyebrow">NIGHT OPERATIONS</span><h2>항구 지구</h2><p>불빛 사이로, 다음 교전을 준비하세요.</p><div class="operation-lines" aria-hidden="true"><i></i><i></i><i></i></div><span class="operation-tag">HARBOR / NIGHT SHIFT</span></div>
   <div class="equipped-heading"><span>MY LOADOUT</span><i aria-hidden="true"></i></div>
   <label class="equipped-character">캐릭터<select id="home-character" aria-label="캐릭터 선택"><option value="robot">소형 로봇</option><option value="robot-cat">고양이형 로봇</option></select></label>
   <div class="equipped-weapon"><span class="equipped-label">시작 무기</span><div id="home-equipped-art" class="equipped-art" aria-hidden="true"></div><label class="equipped-weapon-label"><span class="sr-only">시작 무기 선택</span><select id="home-weapon"><option value="pistol">권총</option><option value="machinegun">기관총</option><option value="shotgun">산탄총</option><option value="sniper">저격총</option></select></label><p id="home-loadout-summary" class="loadout-summary" role="status"></p></div>
  </aside>
  <section id="lobby-model-stage" class="lobby-model-stage" tabindex="0" aria-label="캐릭터 회전: 좌우 드래그 또는 방향키, Home 키로 초기화"><div class="operator-nameplate"><span class="operator-connection"><i></i> OPERATOR READY</span><h2 id="home-character-name">소형 로봇</h2><span id="home-character-code">UNIT / 01</span></div><div class="operator-caption"><span class="operator-status">✓ 준비 완료</span><div class="lobby-rotate-hint">드래그해서 회전 <button id="lobby-rotation-reset" aria-label="캐릭터 회전 초기화">↺</button></div><p id="home-character-description">항구의 밤으로 출격할 준비가 됐습니다.</p></div></section>
  <section class="lobby-match-dock" aria-label="매치 설정과 출격"><div class="match-dock-heading"><span class="eyebrow">PLAY / DEPLOY</span><span class="match-signal"><i></i><i></i><i></i></span></div>
   <div class="home-mode-tabs" role="group" aria-label="플레이 종류"><button id="home-bot" aria-pressed="true">봇 대전</button><button id="home-online" aria-pressed="false">온라인</button><button id="home-practice" aria-pressed="false">연습</button></div>
   <div id="home-bot-settings" class="home-match-settings"><label>게임 모드<select id="home-mode"><option value="duel">봇 1대1</option><option value="ffa">봇 3명 개인전</option><option value="survival">웨이브 생존</option></select></label><label>난이도<select id="home-difficulty"><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option><option value="auto" disabled hidden>자동 · 생존 9단계</option></select></label></div>
   <p id="home-mode-summary" class="home-mode-summary" role="status"></p>
   <div class="home-start-actions"><button id="home-start"><span>게임 시작</span><span aria-hidden="true">→</span></button><button id="home-start-locked" class="mouse-only">마우스 고정하고 시작</button></div>
  </section>
 </div>
 <footer class="lobby-footer"><span>HARBOR DISTRICT · FIRST PERSON ARENA</span><span>PC · WASD / 마우스 &nbsp; 모바일 · 가로 / 터치</span></footer>
</section>`;
export function createHomeScreen(actions:{selectCharacter(type:CharacterType):void;selectWeapon(id:WeaponId):void;start(selection:HomeSelection,locked:boolean):void}){
 const el=(id:string)=>document.querySelector<HTMLElement>('#'+id)!;
 const mode=el('home-mode') as HTMLSelectElement,difficulty=el('home-difficulty') as HTMLSelectElement,character=el('home-character') as HTMLSelectElement,weapon=el('home-weapon') as HTMLSelectElement;
 let category:'bot'|'online'|'practice'='bot';
 function read():HomeSelection{return {mode:category==='bot'?mode.value as 'duel'|'ffa'|'survival':category,difficulty:difficulty.value as SurvivalDifficulty,character:isCharacterType(character.value)?character.value:'robot',weapon:isWeaponId(weapon.value)?weapon.value:'pistol'};}
 function refresh(){
  const auto=difficulty.querySelector<HTMLOptionElement>('option[value="auto"]')!;auto.disabled=auto.hidden=mode.value!=='survival';if(auto.disabled&&difficulty.value==='auto')difficulty.value='normal';
  el('home-bot-settings').hidden=category!=='bot';
  for(const [id,value] of [['home-bot','bot'],['home-online','online'],['home-practice','practice']])el(id!).setAttribute('aria-pressed',String(value===category));
  const selection=read();el('home-character-name').textContent=characterNames[selection.character];el('home-character-code').textContent=selection.character==='robot'?'UNIT / 01':'UNIT / 02';
  const spec=WEAPONS[selection.weapon];el('home-equipped-art').innerHTML=weaponArt(selection.weapon);el('home-loadout-summary').textContent=`${spec.name} · 피해 ${spec.pellets>1?spec.damage+'×'+spec.pellets:spec.damage} · ${spec.magazineSize}발 · 재장전 ${spec.reloadSeconds}초`;
  el('home-mode-summary').textContent=category==='online'?'방 만들기 · 친구 코드 · 자동 매칭':category==='practice'?'표적 3개 · 이동과 조준 연습':mode.value==='survival'?`생명 3개 · ${difficulty.value==='hard'?30:difficulty.value==='easy'?10:20}웨이브${difficulty.value==='auto'?' · 자동 5/9단계 시작':''}`:mode.value==='ffa'?'나와 봇 3명 · 먼저 10킬':'봇 1대1 · 먼저 10킬';
  el('home-start').querySelector('span')!.textContent=category==='online'?'온라인 로비 입장':'게임 시작';el('home-start-locked').hidden=category==='online';
 }
 el('lobby-tab-home').addEventListener('click',()=>el('home-start').focus());el('lobby-tab-character').addEventListener('click',()=>el('home-character-trigger').click());el('lobby-tab-loadout').addEventListener('click',()=>el('home-weapon-trigger').click());
 for(const [id,value] of [['home-bot','bot'],['home-online','online'],['home-practice','practice']] as const)el(id).addEventListener('click',()=>{category=value;refresh();});
 character.addEventListener('change',()=>{if(isCharacterType(character.value))actions.selectCharacter(character.value);refresh();});weapon.addEventListener('change',()=>{if(isWeaponId(weapon.value))actions.selectWeapon(weapon.value);refresh();});mode.addEventListener('change',refresh);difficulty.addEventListener('change',refresh);
 el('home-start').addEventListener('click',()=>actions.start(read(),false));el('home-start-locked').addEventListener('click',()=>actions.start(read(),true));refresh();
 return {read,sync(selection:HomeSelection){character.value=selection.character;weapon.value=selection.weapon;category=selection.mode==='online'?'online':selection.mode==='practice'?'practice':'bot';if(category==='bot')mode.value=selection.mode;difficulty.value=isSurvivalDifficulty(selection.difficulty)?selection.difficulty:'easy';refresh();}};
}
