import {isCharacterType,type CharacterType} from './characters.ts';
import {isWeaponId,WEAPONS,type WeaponId} from './weapons.ts';
import {isSurvivalDifficulty,type SurvivalDifficulty} from './duel.ts';
export type HomeMode='duel'|'ffa'|'survival'|'practice'|'online';
export type HomeSelection={mode:HomeMode;difficulty:SurvivalDifficulty;weapon:WeaponId;character:CharacterType};
const characterNames={robot:'소형 로봇','robot-cat':'고양이형 로봇'};
// Original inline vector art; no downloads, image requests or new 3D assets.
function avatar(cat=false){const accent=cat?'#ffc66f':'#7ee6df';return `<svg viewBox="0 0 360 430" role="img" aria-label="${cat?'고양이형':'소형'} 로봇 미리보기"><ellipse cx="180" cy="401" rx="120" ry="16" fill="#020b12" opacity=".7"/><ellipse cx="180" cy="390" rx="107" ry="18" fill="#19343c" stroke="${accent}" stroke-width="2"/><path d="M137 306v61l-26 13v11h58v-85m23 0v85h58v-11l-25-13v-61" fill="#263d4a" stroke="#82958d" stroke-width="5"/><path d="M131 348h38m25 0h35" stroke="#e0dbbd" stroke-width="16"/><path d="M110 200l-25 13-14 81 27 7 24-64m115-37 24 13 14 81-27 7-24-64" fill="#c9cbb7" stroke="#263e49" stroke-width="8"/><circle cx="84" cy="296" r="17" fill="#283e49" stroke="#a4b3a6" stroke-width="5"/><circle cx="262" cy="296" r="17" fill="#283e49" stroke="#a4b3a6" stroke-width="5"/><rect x="110" y="188" width="133" height="132" rx="30" fill="#dedbc0" stroke="#52676b" stroke-width="6"/><path d="M127 213h100v65H127z" fill="#18323d"/><path d="M144 228h31v31h-31z" fill="${accent}"/><path d="M186 233h25m-25 13h18m-18 13h25" stroke="#a2b6b0" stroke-width="4"/><rect x="131" y="290" width="89" height="12" rx="5" fill="#324b54"/><path d="M155 179v20h40v-20" fill="#324b54"/>${cat?'<path d="M100 106 93 46l59 38m58 0 57-38-6 62" fill="#d9d6bf" stroke="#6c807e" stroke-width="6"/><path d="m107 83-2-23 26 21m102 0 23-20-1 22" fill="#b59669"/>':'<path d="M174 76V47" stroke="#6c858b" stroke-width="7"/><circle cx="174" cy="42" r="9" fill="'+accent+'"/>'}<rect x="91" y="81" width="170" height="103" rx="${cat?35:25}" fill="#e1ddc6" stroke="#7d918d" stroke-width="6"/><rect x="109" y="103" width="135" height="57" rx="20" fill="#102a35"/><path d="M134 123v15m84-15v15" stroke="${accent}" stroke-linecap="round" stroke-width="9"/>${cat?'<path d="m165 143 12 6 12-6" fill="none" stroke="'+accent+'" stroke-width="3"/>':''}<rect x="77" y="111" width="16" height="40" rx="7" fill="#49606a"/><rect x="260" y="111" width="16" height="40" rx="7" fill="#49606a"/><path d="M140 175h73" stroke="#acb4a3" stroke-width="4"/></svg>`;}
function weaponArt(id:WeaponId){const paths={pistol:'M36 24h104v22h-43l-8 30H63l4-30H36z',machinegun:'m12 31 39-7h102v7h36v10h-36v9h-45l-4 27H80l3-27H55L41 62H20l7-20H12z',shotgun:'m9 25 30-5h103v7h48v11H91l-9 15H56L37 72H11l14-34H9z',sniper:'M8 35h49V24h29v-8h45v11h-23v8h83v7h-68l-21 15H79l-8 19H50l4-29-40 17H8z'};return `<svg viewBox="0 0 200 85" aria-hidden="true"><path d="${paths[id]}" fill="currentColor"/><path d="M60 29h54m-42 10h43" fill="none" stroke="#091c28" stroke-width="3"/></svg>`;}
export const HOME_MARKUP=`
<section id="home-screen" class="home-screen home-lobby" aria-labelledby="home-title">
 <header class="lobby-header"><div class="lobby-brand"><span class="lobby-mark" aria-hidden="true">H</span><div><span class="eyebrow">HARBOR / NIGHT ARENA</span><h1 id="home-title">항구의 밤</h1></div></div><div class="lobby-header-actions"><span class="lobby-ready"><i></i> 출격 준비</span><button id="home-records">개인 전적 ↗</button></div></header>
 <div class="lobby-layout">
  <section class="lobby-preview" aria-labelledby="home-character-name"><div class="preview-heading"><span class="eyebrow">YOUR OPERATOR</span><span class="preview-tag">CHARACTER</span></div><div class="avatar-stage"><div data-avatar="robot">${avatar()}</div><div data-avatar="robot-cat" hidden>${avatar(true)}</div></div><div class="avatar-caption"><span id="home-character-code">UNIT / 01</span><h2 id="home-character-name">소형 로봇</h2><p id="home-character-description">푸른 눈빛의 소형 로봇. 항구의 밤을 탐색하세요.</p></div><div class="preview-coordinate" aria-hidden="true">HARBOR DISTRICT / 35° N</div></section>
  <section class="lobby-setup" aria-label="출격 설정">
   <div class="lobby-section-heading"><span class="eyebrow">01 / OPERATOR</span><h2>캐릭터 선택</h2></div>
   <div class="home-character-options"><button data-home-character="robot" aria-pressed="true"><span class="operator-icon robot-icon" aria-hidden="true">▰</span><span><strong>소형 로봇</strong><small>ROBOT / 01</small></span><i aria-hidden="true">✓</i></button><button data-home-character="robot-cat" aria-pressed="false"><span class="operator-icon cat-icon" aria-hidden="true">▰</span><span><strong>고양이형 로봇</strong><small>ROBOT CAT / 02</small></span><i aria-hidden="true">✓</i></button></div>
   <div class="lobby-section-heading"><span class="eyebrow">02 / LOADOUT</span><h2>시작 무기 선택</h2></div>
   <div class="home-weapon-options">${(['pistol','machinegun','shotgun','sniper'] as const).map((id,i)=>`<button data-home-weapon="${id}" aria-pressed="${i===0}"><span class="weapon-index">0${i+1}</span>${weaponArt(id)}<strong>${WEAPONS[id].name}</strong><small>${WEAPONS[id].magazineSize}발</small></button>`).join('')}</div>
   <p id="home-loadout-summary" class="loadout-summary" role="status"></p>
   <div class="lobby-section-heading"><span class="eyebrow">03 / PLAY</span><h2>플레이 모드</h2></div>
   <div class="home-mode-tabs" role="group" aria-label="플레이 종류"><button id="home-bot" aria-pressed="true">봇 대전</button><button id="home-online" aria-pressed="false">온라인 대전</button><button id="home-practice" aria-pressed="false">표적 연습</button></div>
   <div id="home-bot-settings" class="home-match-settings"><label>게임 모드<select id="home-mode"><option value="duel">봇 1대1</option><option value="ffa">봇 3명 개인전</option><option value="survival">웨이브 생존</option></select></label><label>난이도<select id="home-difficulty"><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option><option value="auto" disabled hidden>자동 · 생존 9단계</option></select></label></div>
   <p id="home-mode-summary" class="home-mode-summary" role="status"></p>
   <div class="home-start-actions"><button id="home-start"><span>게임 시작</span><span aria-hidden="true">↗</span></button><button id="home-start-locked" class="mouse-only">마우스 고정하고 시작</button></div>
  </section>
 </div>
 <footer class="lobby-footer"><span>PC · WASD 이동 / 마우스 조준</span><span>모바일 · 가로 화면 / 터치 조작</span><span>선택한 시작 무기로 출격합니다.</span></footer>
</section>`;
export function createHomeScreen(actions:{selectCharacter(type:CharacterType):void;start(selection:HomeSelection,locked:boolean):void}){
 const el=(id:string)=>document.querySelector<HTMLElement>('#'+id)!;
 const mode=el('home-mode') as HTMLSelectElement,difficulty=el('home-difficulty') as HTMLSelectElement;
 let character:CharacterType='robot',weapon:WeaponId='pistol',category:'bot'|'online'|'practice'='bot';
 function read():HomeSelection{return {mode:category==='bot'?mode.value as 'duel'|'ffa'|'survival':category,difficulty:difficulty.value as SurvivalDifficulty,character,weapon};}
 function refresh(){
  const auto=difficulty.querySelector<HTMLOptionElement>('option[value="auto"]')!;auto.disabled=auto.hidden=mode.value!=='survival';if(auto.disabled&&difficulty.value==='auto')difficulty.value='normal';
  el('home-bot-settings').hidden=category!=='bot';
  for(const [id,value] of [['home-bot','bot'],['home-online','online'],['home-practice','practice']])el(id!).setAttribute('aria-pressed',String(value===category));
  document.querySelectorAll<HTMLButtonElement>('[data-home-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.homeCharacter===character)));
  document.querySelectorAll<HTMLButtonElement>('[data-home-weapon]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.homeWeapon===weapon)));
  document.querySelectorAll<HTMLElement>('[data-avatar]').forEach(v=>v.hidden=v.dataset.avatar!==character);
  el('home-character-name').textContent=characterNames[character];el('home-character-code').textContent=character==='robot'?'UNIT / 01':'UNIT / 02';
  el('home-character-description').textContent=character==='robot'?'푸른 눈빛의 소형 로봇. 항구의 밤을 탐색하세요.':'고양이 귀와 따뜻한 눈빛. 나만의 로봇으로 출격하세요.';
  const spec=WEAPONS[weapon];el('home-loadout-summary').textContent=`${spec.name} · 피해 ${spec.pellets>1?spec.damage+'×'+spec.pellets:spec.damage} · 탄창 ${spec.magazineSize}발 · 재장전 ${spec.reloadSeconds}초`;
  el('home-mode-summary').textContent=category==='online'?'로비에서 방 만들기·친구 코드 입장·자동 매칭을 선택하세요.':category==='practice'?'표적 3개를 맞히며 이동과 네 가지 무기를 연습하세요.':mode.value==='survival'?`생명 3개 · ${difficulty.value==='hard'?30:difficulty.value==='easy'?10:20}웨이브${difficulty.value==='auto'?' · 자동 5/9단계 시작':''}`:mode.value==='ffa'?'나와 봇 3명 · 먼저 10킬 · 봇은 나만 공격합니다.':'봇과 1대1 · 먼저 10킬 · 사망 3초 후 부활';
  el('home-start').querySelector('span')!.textContent=category==='online'?'온라인 로비 입장':'게임 시작';el('home-start-locked').hidden=category==='online';
 }
 for(const [id,value] of [['home-bot','bot'],['home-online','online'],['home-practice','practice']] as const)el(id).addEventListener('click',()=>{category=value;refresh();});
 document.querySelectorAll<HTMLButtonElement>('[data-home-character]').forEach(b=>b.addEventListener('click',()=>{const value=b.dataset.homeCharacter;if(isCharacterType(value)){character=value;actions.selectCharacter(value);refresh();}}));
 document.querySelectorAll<HTMLButtonElement>('[data-home-weapon]').forEach(b=>b.addEventListener('click',()=>{const value=b.dataset.homeWeapon;if(isWeaponId(value)){weapon=value;refresh();}}));
 mode.addEventListener('change',refresh);difficulty.addEventListener('change',refresh);
 el('home-start').addEventListener('click',()=>actions.start(read(),false));el('home-start-locked').addEventListener('click',()=>actions.start(read(),true));refresh();
 return {read,sync(selection:HomeSelection){character=selection.character;weapon=selection.weapon;category=selection.mode==='online'?'online':selection.mode==='practice'?'practice':'bot';if(category==='bot')mode.value=selection.mode;difficulty.value=isSurvivalDifficulty(selection.difficulty)?selection.difficulty:'easy';refresh();}};
}
