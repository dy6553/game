import {LEGAL_VERSION} from './legal.ts';
import {performanceReadout,type PerformanceSample} from './performance-readout.ts';
import {createPlaytestWindow,type PlaytestMode} from './playtest-metrics.ts';
export function createPlaytest(serverBase=''){
 const manual=new URLSearchParams(window.location?.search??'').get('diagnostics')==='1';
 const endpoint=serverBase?serverBase.replace(/\/+$/,'')+'/playtest':'/api/playtest';
 let enabled=manual,uploadAllowed=false;
 let lastUpload=-Infinity;
 const report=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
 let metricsWindow=createPlaytestWindow(),mode:PlaytestMode='practice',active=false,lastPacket:number|null=null,age=0,sampleAge=0,index=0,uploaded=0;
 const history:PerformanceSample[]=[];let readoutAge=0,expires=performance.now()+600000;
 const panel=document.createElement('aside');panel.className='playtest-panel';panel.hidden=!manual;
 const ageLabel=document.createElement('label'),ageBox=document.createElement('input');ageBox.type='checkbox';ageBox.checked=false;ageLabel.append(ageBox,document.createTextNode('만 14세 이상이며 선택 성능 진단 안내를 확인했습니다.'));
 const start=document.createElement('button');start.type='button';start.textContent='선택: 성능 수치 전송 시작';
 const disclosure=document.createElement('p');disclosure.textContent='성능 개선을 위해 FPS·프레임 지연·통신 지연 요약을 전송합니다. Cloudflare 서버에 동의 버전·수신시각과 함께 48시간 보관합니다. 전송하지 않아도 게임과 기기 내 진단·파일 저장을 사용할 수 있습니다. 시작은 이번 방문에만 적용되며 언제든 중지할 수 있습니다.';
 const label=document.createElement('span'),stop=document.createElement('button'),save=document.createElement('button'),toggle=document.createElement('button'),actions=document.createElement('div');
 stop.textContent='수집 끄기';stop.className='playtest-stop';save.textContent='기록 저장';toggle.className='playtest-toggle';toggle.type=stop.type=save.type='button';actions.className='playtest-actions';actions.id=`playtest-actions-${report}`;actions.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',actions.id);toggle.setAttribute('aria-label',`진단 ${report} 도구 열기`);label.setAttribute('role','status');const readout=document.createElement('output');readout.className='playtest-metrics';readout.textContent='플레이를 시작하면 성능을 표시합니다.';actions.append(disclosure,ageLabel,label,readout,start,stop,save);panel.append(toggle,actions);document.querySelector('#app')!.append(panel);
 const summary=()=>{toggle.textContent=`진단 ${report} · ${uploaded}회 전송 ${actions.hidden?'▾':'▴'}`;};
 toggle.addEventListener('click',()=>{actions.hidden=!actions.hidden;toggle.setAttribute('aria-expanded',String(!actions.hidden));toggle.setAttribute('aria-label',`진단 ${report} 도구 ${actions.hidden?'열기':'닫기'}`);summary();});
 function status(text:string){label.textContent=`진단 ${report} · ${text}`;summary();}
 async function flush(){
  const stats=metricsWindow.read();
  metricsWindow=createPlaytestWindow();age=sampleAge=readoutAge=0;
  const now=performance.now();
  if(!stats.frames||!stats.seconds||(!manual&&(stats.seconds<5||now-lastUpload<60000)))return;
  lastUpload=now;
  const summary={v:1,mode,...stats,diagnosticConsent:LEGAL_VERSION,diagnosticAge14:true};
  const payload=manual?{...summary,source:'play',report,window:++index}:summary;
  if(manual){history.push(payload);readout.textContent=performanceReadout(history,{mode,...metricsWindow.read()});}
  try{
   if(!uploadAllowed)return;
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':serverBase?'text/plain':'application/json'},body:JSON.stringify(serverBase?summary:payload),keepalive:true,credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
   if(!r.ok){if(!manual&&(r.status===429||r.status===503))enabled=false;throw new Error('upload');}
   if(manual){uploaded++;status(`${uploaded}회 전송${enabled?' · 수집 중':' · 종료'}`);}
  }catch{if(manual)status('전송 실패 · 기록 저장 가능');}
 }
 start.addEventListener('click',()=>{if(!ageBox.checked){status('만 14세 이상 확인과 선택 진단 안내를 확인해 주세요.');return;}if(!serverBase){status('서버 전송을 사용할 수 없습니다.');return;}uploadAllowed=true;enabled=true;metricsWindow=createPlaytestWindow();age=sampleAge=readoutAge=0;expires=performance.now()+600000;index=0;start.disabled=true;stop.disabled=false;status('선택 동의 · 이후 성능 요약 전송 중');});
 stop.disabled=true;stop.addEventListener('click',()=>{uploadAllowed=false;ageBox.checked=false;enabled=false;active=false;stop.disabled=true;start.disabled=false;metricsWindow=createPlaytestWindow();status('전송 중지 · 남은 수치도 전송하지 않습니다.');});
 save.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({report,history,current:{mode,...metricsWindow.read()}},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`harbor-diagnostics-${report}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 status('기기 내 진단 · 서버 전송 꺼짐');
 document.addEventListener('visibilitychange',()=>{if(document.hidden){active=false;lastPacket=null;if(enabled)void flush();}});
 window.addEventListener('pagehide',()=>{if(enabled)void flush();});
 return {
  frame(dt:number,nextMode:PlaytestMode,playing:boolean,rtt:number|null){
   if(!enabled)return;
   if(manual&&(performance.now()>=expires||index>=40)){enabled=false;active=false;stop.disabled=true;if(index<40)void flush();status('10분 수집 종료');return;}
   if(mode!==nextMode){void flush();mode=nextMode;lastPacket=null;}
   if(!playing){if(active)void flush();active=false;lastPacket=null;return;}
   active=true;metricsWindow.frame(dt);age+=dt;sampleAge+=dt;readoutAge+=dt;if(manual&&readoutAge>=1){readoutAge=0;readout.textContent=performanceReadout(history,{mode,...metricsWindow.read()});}
   if(mode==='online'&&sampleAge>=.25){sampleAge=0;metricsWindow.network(rtt);}
   if(age>=(manual?15:60))void flush();
  },
  packet(){if(!enabled||!active||mode!=='online'){lastPacket=null;return;}const now=performance.now();if(lastPacket!==null)metricsWindow.gap(now-lastPacket);lastPacket=now;},
  correction(m:number){if(enabled&&active&&mode==='online')metricsWindow.correction(m);},
 };
}
