// Render native select state through game UI so mobile browsers never open an OS sheet.
const CHOICES_MARKUP=`<section id="game-choice-dialog" class="game-choice-overlay" role="dialog" aria-modal="true" aria-labelledby="game-choice-title" hidden><div class="game-choice-panel"><header><div><span class="eyebrow">MISSION CONFIGURATION</span><h2 id="game-choice-title"></h2></div><button id="game-choice-close" aria-label="선택 취소하고 닫기">닫기 ×</button></header><p id="game-choice-hint">이번 출격에 사용할 설정을 선택하세요.</p><div id="game-choice-options" class="game-choice-options"></div><footer>선택하면 바로 적용됩니다.<span>ESC · 취소</span></footer></div></section>`;
const descriptions:Record<string,string>={smg:'40발 · 빠른 연사 · 근거리용',burst:'24발 · 한 번 누르면 3점사',dmr:'10발 · 반자동 · 2발 명중 처치',duel:'봇 한 명과 대결 · 먼저 10킬',ffa:'나와 봇 3명 · 각자 10킬 경쟁',survival:'생명 3개 · 웨이브를 돌파하세요',practice:'이동과 조준 · 표적 3개 연습',easy:'천천히 조준하는 봇 · 처음이라면 추천',normal:'좌우로 움직이는 봇 · 균형 잡힌 도전',hard:'빠른 이동과 조준 · 숙련자에게 추천',auto:'성과에 맞춰 조금씩 조절 · 생존 전용',pistol:'12발 · 단발 · 균형 잡힌 기본 무기',machinegun:'30발 · 연사 · 지속 사격',shotgun:'6발 · 넓게 퍼지는 근거리 사격',sniper:'5발 · 확대 조준 · 강한 한 발',robot:'푸른 눈빛의 소형 로봇','robot-cat':'고양이 귀와 따뜻한 눈빛'};
const marks:Record<string,string>={smg:'SMG',burst:'3RD',dmr:'DMR',duel:'1:1',ffa:'FFA',survival:'WAVE',practice:'AIM',easy:'I',normal:'II',hard:'III',auto:'AUTO',pistol:'PT',machinegun:'MG',shotgun:'SG',sniper:'SR',robot:'01','robot-cat':'02'};
function titleFor(select:HTMLSelectElement){
 if(select.id.includes('difficulty'))return '난이도 선택';if(select.id.endsWith('mode'))return '게임 모드 선택';if(select.id.includes('weapon'))return '시작 무기 선택';if(select.id.endsWith('character'))return '캐릭터 선택';
 return [...(select.closest('label')?.childNodes??[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||select.getAttribute('aria-label')||'설정 선택';
}
export function createGameChoices(actions:{opened():void}){
 document.querySelector('#app')!.insertAdjacentHTML('beforeend',CHOICES_MARKUP);
 const dialog=document.querySelector<HTMLElement>('#game-choice-dialog')!,options=document.querySelector<HTMLElement>('#game-choice-options')!,title=document.querySelector<HTMLElement>('#game-choice-title')!;
 const fields=[...document.querySelectorAll<HTMLSelectElement>('select')];
 const bindings=fields.map(select=>{
  const button=document.createElement('button');button.type='button';button.id=select.id+'-trigger';button.className='game-choice-trigger';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);button.setAttribute('aria-expanded','false');
  button.innerHTML='<span class="choice-trigger-value"></span><span class="choice-trigger-edit" aria-hidden="true">변경 <b>⌄</b></span>';
  select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.insertAdjacentElement('afterend',button);
  button.addEventListener('click',event=>{event.preventDefault();open(select);});
  return {select,button,label:button.querySelector<HTMLElement>('.choice-trigger-value')!};
 });
 let current:HTMLSelectElement|null=null;
 let inertBefore:Array<{element:HTMLElement;value:boolean}>=[];
 function close(){
  if(dialog.hidden)return;dialog.hidden=true;document.body.classList.remove('choice-open');const old=current;current=null;
  for(const {element,value} of inertBefore)element.inert=value;inertBefore=[];
  for(const {button} of bindings)button.setAttribute('aria-expanded','false');
  const trigger=bindings.find(b=>b.select===old)?.button;if(trigger&&!trigger.disabled&&!trigger.closest('[hidden]'))trigger.focus();
 }
 function open(select:HTMLSelectElement){
  if(select.disabled||select.parentElement?.closest('[hidden]'))return;
  close();current=select;title.textContent=titleFor(select);options.replaceChildren();
  for(const option of [...select.options]){
   if(option.disabled||option.hidden)continue;const button=document.createElement('button');button.type='button';button.className='game-choice-option';button.dataset.choiceValue=option.value;button.setAttribute('aria-pressed',String(option.value===select.value));
   const mark=document.createElement('span'),copy=document.createElement('span'),name=document.createElement('strong'),description=document.createElement('small'),check=document.createElement('span');
   mark.className='choice-option-mark';mark.textContent=marks[option.value]??String(options.children.length+1).padStart(2,'0');mark.setAttribute('aria-hidden','true');
   copy.className='choice-option-copy';name.textContent=option.textContent;description.textContent=descriptions[option.value]??'선택한 설정을 적용합니다.';
   if(!select.id.includes('difficulty')&&['easy','normal','hard','auto'].includes(option.value))description.textContent=select.id==='graphics-quality'?(option.value==='auto'?'기기 성능에 맞춰 해상도를 조절합니다.':'화질 설정을 적용합니다.'):'효과의 강도를 선택합니다.';
   check.className='choice-option-check';check.textContent=option.value===select.value?'선택됨 ✓':'선택 →';copy.append(name,description);button.append(mark,copy,check);
   button.addEventListener('click',()=>{if(select.disabled||option.disabled||option.hidden)return;select.value=option.value;close();select.dispatchEvent(new window.Event('change',{bubbles:true}));refresh();});options.append(button);
  }
  options.classList.toggle('four-options',options.children.length===4||options.children.length===2);dialog.dataset.choiceSource=select.id;
  dialog.hidden=false;document.body.classList.add('choice-open');bindings.find(b=>b.select===select)!.button.setAttribute('aria-expanded','true');
  inertBefore=[...dialog.parentElement!.children].filter(e=>e!==dialog).map(e=>({element:e as HTMLElement,value:(e as HTMLElement).inert}));for(const {element} of inertBefore)element.inert=true;
  actions.opened();(options.querySelector<HTMLButtonElement>('[aria-pressed="true"]')??options.querySelector<HTMLButtonElement>('button')??document.querySelector<HTMLButtonElement>('#game-choice-close'))!.focus();
 }
 function refresh(){
  for(const {select,button,label} of bindings){const option=[...select.options].find(o=>o.value===select.value);const text=option?.textContent??'선택하세요';if(label.textContent!==text)label.textContent=text;button.disabled=select.disabled;button.setAttribute('aria-label',titleFor(select)+': '+text);}
  if(current&&(current.disabled||current.parentElement?.closest('[hidden]')))close();
 }
 document.querySelector('#game-choice-close')!.addEventListener('click',close);dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
  const buttons=[...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')],index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  if(event.key==='Tab'){event.preventDefault();buttons[(index+(event.shiftKey?buttons.length-1:1))%buttons.length]?.focus();}
  if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();const choices=[...options.querySelectorAll<HTMLButtonElement>('button')],i=choices.indexOf(document.activeElement as HTMLButtonElement),next=event.key==='Home'?0:event.key==='End'?choices.length-1:(i+(event.key==='ArrowLeft'||event.key==='ArrowUp'?choices.length-1:1))%choices.length;choices[next]?.focus();
  }
 });refresh();return {get isOpen(){return !dialog.hidden;},refresh,close};
}
