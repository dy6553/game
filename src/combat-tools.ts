import {weaponComparison} from './weapons.ts';
import {drawCombatMap} from './combat-hud.ts';
import type {Point,World} from './world.ts';
import type {TeamPing} from './network-game.ts';
type TeamView={enabled:boolean;world:World;me:Point;yaw:number;pings:TeamPing[]};
export function installCombatTools(options:{beforeOpen:()=>void;afterClose:()=>void;practice:()=>boolean;setRange:(distance:number,moving:boolean)=>void;ping:(ping:Pick<TeamPing,'kind'|'x'|'z'>)=>boolean}){
 const dialog=document.createElement('dialog');dialog.id='combat-tools';dialog.setAttribute('aria-labelledby','combat-tools-title');dialog.innerHTML=`<header><h2 id="combat-tools-title">무기 비교</h2><button id="combat-tools-close" autofocus>닫기</button></header><section id="weapon-comparison"><label>비교 거리 <input id="compare-distance" type="range" min="0" max="100" step="5" value="0"><output id="compare-distance-label">0 m</output></label><p>온라인 기본 수치 · 한 발 피해 / 산탄은 탄환 1개 기준 · 헤드샷 1.5배 (바주카 제외)</p><div class="comparison-scroll"><table><thead><tr><th>무기</th><th>몸통</th><th>머리</th><th>탄환 수</th><th>탄창</th><th>발사 간격</th><th>재장전</th><th>감쇠 시작</th></tr></thead><tbody id="compare-rows"></tbody></table></div><p>점사는 첫 발 기준 발사 간격 / 점사 내부 간격 0.08초. 산탄 전탄 명중과 바주카 직격 피해는 최대치이며, 산포·엄폐·폭발 거리로 실제 피해는 줄어듭니다. 봇전 강화 수치는 제외합니다.</p></section><section id="range-options" hidden><p>출발 위치 기준 10·20·40 m에 세 표적을 배치합니다. 이동 표적은 좌우로 움직이며, 일시정지하면 멈춥니다. 적용하면 탄약과 표적 체력을 초기화합니다.</p><div id="range-distances"><button data-distance="0">기존 배치</button><button data-distance="10">10 m</button><button data-distance="20">20 m</button><button data-distance="40">40 m</button></div><label><input id="range-moving" type="checkbox"> 이동 표적</label><button id="range-apply">연습 적용 · 초기화</button></section><section id="team-ping-options" hidden><p>종류를 고른 뒤 지도를 누르세요. 아군에게 6초간 표시됩니다. 1.5초마다 한 번 보낼 수 있습니다.</p><div id="ping-kinds"><button data-ping="enemy" aria-pressed="true">! 적 발견</button><button data-ping="move" aria-pressed="false">◆ 이동</button><button data-ping="help" aria-pressed="false">+ 지원</button></div><canvas id="team-ping-map" width="640" height="470" tabindex="0" aria-label="핑을 보낼 위치를 지도에서 누르세요"></canvas><button id="ping-here">내 위치에 표시</button><p id="ping-result" role="status"></p></section>`;
 document.querySelector('#app')!.append(dialog);
 let team:TeamView|undefined,mode='compare',distance=0,kind:TeamPing['kind']='enemy',previous:HTMLElement|null=null;
 const q=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>('#'+id)!;
 const map=q<HTMLCanvasElement>('team-ping-map');
 const renderComparison=()=>{const d=Number(q<HTMLInputElement>('compare-distance').value);q('compare-distance-label').textContent=d+' m';q('compare-rows').innerHTML=weaponComparison(d).map(r=>`<tr><th>${r.name}</th><td>${r.body.toFixed(1)}</td><td>${r.head.toFixed(1)}</td><td>${r.pellets}</td><td>${r.magazine}</td><td>${r.interval.toFixed(3)}초${r.burst>1?` / ${r.burst}점사`:''}</td><td>${r.reload}초</td><td>${r.id==='bazooka'?'폭발 6 m':r.range+' m'}</td></tr>`).join('');};
 function open(next:string){previous=document.activeElement as HTMLElement;options.beforeOpen();mode=next;q('combat-tools-title').textContent=next==='compare'?'무기 비교':next==='range'?'거리·이동 표적 연습':'아군 지도 핑';q('weapon-comparison').hidden=next!=='compare';q('range-options').hidden=next!=='range';q('team-ping-options').hidden=next!=='ping';q('ping-result').textContent='';renderComparison();dialog.showModal();draw();}
 function draw(){if(dialog.open&&mode==='ping'&&team)drawCombatMap(map,team.world,team.me,team.yaw,[],team.pings);}
 dialog.addEventListener('close',()=>{options.afterClose();previous?.focus();});
 dialog.addEventListener('keydown',e=>{e.stopPropagation();});
 q('combat-tools-close').onclick=()=>dialog.close();
 q('compare-distance').addEventListener('input',renderComparison);
 function addButton(parent:Element,label:string,id:string,action:()=>void){const b=document.createElement('button');b.textContent=label;b.id=id;b.onclick=action;parent.append(b);return b;}
 addButton(document.querySelector('#home-settings')!.parentElement!,'무기 비교','home-compare',()=>open('compare'));
 const menuButton=addButton(document.querySelector('#environment-open')!.parentElement!,'무기 비교','menu-compare',()=>open('compare'));
 menuButton.classList.add('combat-tool-button');
 addButton(document.querySelector('.practice-score')!,'거리·이동 표적','practice-range-open',()=>{if(options.practice())open('range');});
 const pingButton=addButton(document.querySelector('#combat-map')!,'아군 핑','team-ping-open',()=>{if(team?.enabled)open('ping');});pingButton.hidden=true;
 for(const b of dialog.querySelectorAll<HTMLButtonElement>('[data-distance]'))b.setAttribute('aria-pressed',String(Number(b.dataset.distance)===distance));
 for(const b of dialog.querySelectorAll<HTMLButtonElement>('[data-distance]'))b.onclick=()=>{distance=Number(b.dataset.distance);for(const node of dialog.querySelectorAll('[data-distance]'))node.setAttribute('aria-pressed',String(node===b));};
 q('range-apply').onclick=()=>{if(options.practice()){options.setRange(distance,q<HTMLInputElement>('range-moving').checked);dialog.close();}};
 for(const b of dialog.querySelectorAll<HTMLButtonElement>('[data-ping]'))b.onclick=()=>{kind=b.dataset.ping as TeamPing['kind'];for(const node of dialog.querySelectorAll('[data-ping]'))node.setAttribute('aria-pressed',String(node===b));};
 function send(p:Point){if(!team?.enabled)return;const ok=options.ping({kind,x:p.x,z:p.z});q('ping-result').textContent=ok?'아군에게 핑을 보냈습니다.':'잠시 후 다시 보내세요.';if(ok)dialog.close();}
 map.onclick=e=>{if(!team)return;const r=map.getBoundingClientRect(),b=team.world.PROTOTYPE;send({x:((e.clientX-r.left)/r.width*2-1)*b.halfWidth,z:b.maxZ-(e.clientY-r.top)/r.height*(b.halfDepth+b.maxZ)});};
 q('ping-here').onclick=()=>{if(team)send(team.me);};
 return {get isOpen(){return dialog.open;},updateTeam(view:TeamView){team=view;pingButton.hidden=!view.enabled;if(dialog.open&&mode==='ping'&&!view.enabled)dialog.close();draw();}};
}
