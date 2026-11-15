import type {PlaytestMode} from './playtest-metrics.ts';
export type PerformanceSample={mode:PlaytestMode;seconds:number|null;frames:number;fps:number|null;frameP95Ms:number|null;stalls:number;rttP50Ms:number|null;gapP95Ms:number|null};
const number=(n:number|null)=>n===null?'측정 없음':`${Math.round(n*10)/10}`;
export function performanceReadout(history:readonly PerformanceSample[],current:PerformanceSample){
 let start=history.length;while(start>0&&history[start-1]!.mode===current.mode)start--;
 const windows=[...history.slice(start),current].filter(w=>w.frames>0&&w.seconds!==null&&w.seconds>=5);
 const latest=current.frames>0?current:windows.at(-1),mode=current.mode==='online'?'온라인':current.mode==='bot'?'봇전':'연습';
 const lines=latest?[`${mode} · ${number(latest.fps)} FPS`, `프레임 P95 ${number(latest.frameP95Ms)} ms · 50ms 초과 ${latest.stalls}회`]:[`${mode} · 플레이하면 측정합니다`];
 if(current.mode==='online'&&latest)lines.push(`입력 확인 지연 ${number(latest.rttP50Ms)}${latest.rttP50Ms===null?'':' ms'} · 수신 P95 ${number(latest.gapP95Ms)}${latest.gapP95Ms===null?'':' ms'}`);
 if(windows.length>=8){const fps=(items:PerformanceSample[])=>items.reduce((n,w)=>n+w.frames,0)/items.reduce((n,w)=>n+(w.seconds??0),0);lines.push(`초반 → 최근 ${number(fps(windows.slice(0,4)))} → ${number(fps(windows.slice(-4)))} FPS`);}
 else lines.push('초반/최근 비교 대기 · 같은 모드로 2분 이상 플레이');
 return lines.join('\n');
}
