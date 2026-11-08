import type {MatchResult,createResultJournal} from './results.ts';
export const RESULTS_MARKUP=`
<section id="match-results" class="results-panel" role="dialog" aria-modal="true" aria-labelledby="result-title" hidden><div class="result-card"><span class="eyebrow">MATCH COMPLETE</span><h2 id="result-title"></h2><p id="result-mode"></p><dl class="result-stats"><div><dt>처치</dt><dd id="result-kills"></dd></div><div><dt>사망</dt><dd id="result-deaths"></dd></div><div><dt>경기 시간</dt><dd id="result-time"></dd></div></dl><p id="result-survival" hidden></p><p id="result-growth" role="status"></p><p id="result-save" role="status"></p><div class="result-actions"><button id="result-retry">같은 설정으로 다시 하기</button><button id="result-home">홈으로</button></div></div></section>
<section id="personal-records" class="results-panel" role="dialog" aria-modal="true" aria-labelledby="records-title" hidden><div class="result-card history-card"><span class="eyebrow">YOUR RECORDS</span><h2 id="records-title">개인 전적</h2><p class="record-note">이 브라우저에만 저장됩니다. 브라우저 데이터를 삭제하면 사라지며 다른 기기와 공유되지 않습니다. 온라인 기록도 이 기기의 개인 기록입니다.</p><p id="record-summary"></p><div id="record-bests"></div><h3>최근 경기 · 최대 20개</h3><ol id="record-list"></ol><p id="record-storage" role="status"></p><button id="records-close">홈으로 돌아가기</button></div></section>`;
const modes={duel:'봇 1대1',ffa:'봇 3명 개인전',survival:'웨이브 생존',online:'온라인 1대1'};
const levels={easy:'쉬움',normal:'보통',hard:'어려움',auto:'자동'};
export function formatResultTime(seconds:number){const total=Math.floor(seconds);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;}
function modeText(r:MatchResult){return modes[r.mode]+(r.difficulty?' · '+levels[r.difficulty]:'');}
function survivalText(r:MatchResult){return r.mode==='survival'?`도달 웨이브 ${r.wave} / ${r.totalWaves}${r.outcome==='win'?' · 전체 클리어':''}${r.peakStage!==null?' · 최고 자동 난이도 '+r.peakStage+' / 9':''}`:'';}
export function createResultsView(journal:ReturnType<typeof createResultJournal>,actions:{retry(online:boolean):void;home():void;opened():void}){
 const el=(id:string)=>document.querySelector<HTMLElement>('#'+id)!;
 const result=el('match-results'),history=el('personal-records');
 const isOpen=()=>!result.hidden||!history.hidden;
 function hide(){result.hidden=history.hidden=true;document.body.classList.remove('results-open');}
 function opened(panel:HTMLElement,focus:string){panel.hidden=false;document.body.classList.add('results-open');actions.opened();el(focus).focus();}
 let online=false;
 el('result-retry').addEventListener('click',()=>{hide();actions.retry(online);});
 el('result-home').addEventListener('click',()=>{hide();actions.home();});
 el('records-close').addEventListener('click',()=>{hide();el('home-records').focus();});
 for(const panel of [result,history])panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(panel===history){hide();el('home-records').focus();}else el('result-retry').focus();}
  if(event.key==='Tab'){
   const buttons=[...panel.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
   if((event.shiftKey&&current<=0)||(!event.shiftKey&&(current<0||current===buttons.length-1))){event.preventDefault();buttons[event.shiftKey?buttons.length-1:0]?.focus();}
  }
 });
 return {
  get isOpen(){return isOpen();},hide,
  show(r:MatchResult){
   history.hidden=true;online=r.mode==='online';el('result-title').textContent=r.outcome==='win'?'승리':'패배';el('result-mode').textContent=modeText(r);
   el('result-kills').textContent=String(r.kills);el('result-deaths').textContent=String(r.deaths);el('result-time').textContent=formatResultTime(r.seconds);
   el('result-survival').hidden=r.mode!=='survival';el('result-survival').textContent=survivalText(r);
   el('result-save').textContent=journal.persisted?'이 브라우저의 개인 전적에 저장했습니다.':'브라우저에 저장하지 못했습니다. 이번 화면에서는 기록을 볼 수 있습니다.';
   el('result-retry').textContent=online?'새 온라인 경기':'같은 설정으로 다시 하기';opened(result,'result-retry');
  },
  history(){
   result.hidden=true;const data=journal.read();el('record-summary').textContent=`총 ${data.played}경기 · ${data.wins}승 ${data.played-data.wins}패`;
   const bests=el('record-bests');bests.replaceChildren();for(const [key,best] of Object.entries(data.bestSurvival)){
    const p=document.createElement('p');p.textContent=`생존 ${levels[key as keyof typeof levels]} 최고: ${best!.wave} / ${best!.totalWaves}${best!.cleared?' · 전체 클리어':''}`;bests.append(p);
   }
   if(data.peakStage){const p=document.createElement('p');p.textContent=`최고 자동 난이도 ${data.peakStage} / 9`;bests.append(p);}
   const list=el('record-list');list.replaceChildren();for(const r of data.recent){
    const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('p'),time=document.createElement('time');
    title.textContent=`${r.outcome==='win'?'승리':'패배'} · ${modeText(r)}`;title.className=r.outcome;
    detail.textContent=`처치 ${r.kills} · 사망 ${r.deaths} · ${formatResultTime(r.seconds)}${r.mode==='survival'?' · '+survivalText(r):''}`;
    time.textContent=new Date(r.endedAt).toLocaleString('ko-KR');time.dateTime=new Date(r.endedAt).toISOString();item.append(title,detail,time);list.append(item);
   }
   el('record-storage').textContent=!journal.persisted?'기록 저장소를 사용할 수 없습니다. 현재 접속 중의 기록만 표시할 수 있습니다.':data.recent.length?'':'아직 완료한 경기가 없습니다. 봇 대전이나 온라인 대전을 끝내면 기록됩니다.';
   opened(history,'records-close');
  },
 };
}
