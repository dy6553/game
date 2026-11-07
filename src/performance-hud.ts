import type { Engine } from '@babylonjs/core/Engines/engine.js';
import { createFrameMetrics } from './frame-metrics.ts';

// Temporary diagnostics: remove this module and its import/create/update in main.ts.
export function createPerformanceHud(engine:Engine){
 const label=document.createElement('div');
 label.setAttribute('aria-label','게임 성능');label.className='performance-hud';
 label.title='최근 최대 10초의 플레이 구간. P95는 프레임 시간의 95백분위, 끊김은 50ms를 넘은 프레임 수입니다. 메뉴와 일시정지 구간은 제외합니다.';
 document.querySelector('#app')!.appendChild(label);
 const metrics=createFrameMetrics();let elapsed=1,wasActive=false;
 return {update(dt:number,active:boolean){
   if(active&&!wasActive){metrics.reset();elapsed=1;}
   wasActive=active;
   if(active)metrics.sample(dt);
   elapsed+=dt;if(elapsed<1)return;elapsed=0;
   const state=metrics.read(),resolution=`${engine.getRenderWidth()}×${engine.getRenderHeight()}`;
   label.textContent=active?`평균 ${Math.round(state.fps)} FPS · ${resolution} · P95 ${Math.round(state.p95Ms)}ms · 끊김 ${state.stalls}회 (${state.seconds.toFixed(0)}초)`:`대기 · ${resolution}`;
 }};
}
