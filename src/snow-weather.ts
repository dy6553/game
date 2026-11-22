import type {MapId} from './maps.ts';
export type SnowWeather={phase:'clear'|'building'|'blizzard'|'clearing';intensity:number;visibility:number;seconds:number;startsIn:number;endsIn:number;warning:number};
// User-approved timing bounds; total storm duration includes both transitions.
export const SNOW_WEATHER_TIMING={clearMin:40,clearMax:80,stormMin:20,stormMax:35,notice:10} as const;
export const newWeatherSeed=()=>1+Math.floor(Math.random()*0xffffffff);
type Cycle={start:number;end:number};
const schedules=new Map<number,Cycle[]>();
export function weatherRandom(seed:number,index:number){
 let x=(seed+Math.imul(index+1,0x9e3779b9))|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296;
}
function schedule(seed:number,time:number){
 let cycles=schedules.get(seed);if(!cycles){if(schedules.size>=8)schedules.delete(schedules.keys().next().value!);cycles=[];schedules.set(seed,cycles);}
 // The seed is chosen once per match. Only newly reached cycles are generated;
 // ordinary render frames reuse the schedule and binary-search its boundaries.
 while(!cycles.length||cycles[cycles.length-1]!.end<=time){
  const i=cycles.length,t=SNOW_WEATHER_TIMING,previous=cycles[i-1]?.end??0;
  const start=previous+t.clearMin+Math.floor(weatherRandom(seed,i*2)*(t.clearMax-t.clearMin+1));
  cycles.push({start,end:start+t.stormMin+Math.floor(weatherRandom(seed,i*2+1)*(t.stormMax-t.stormMin+1))});
 }
 let lo=0,hi=cycles.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(cycles[mid]!.end<=time)lo=mid+1;else hi=mid;}
 return cycles[lo]!;
}
/** Match time, not wall clock: pause-safe locally and authoritative online. */
export function snowWeather(seconds:number,seed=1):SnowWeather{
 const time=Number.isFinite(seconds)?Math.max(0,seconds):0,cycle=schedule(seed>>>0,time),startsIn=Math.max(0,cycle.start-time),endsIn=cycle.end-time;
 let intensity=0,phase:SnowWeather['phase']='clear';
 if(time>=cycle.start){const elapsed=time-cycle.start;if(elapsed<4){intensity=elapsed/4;phase='building';}else if(endsIn<=6){intensity=endsIn/6;phase='clearing';}else{intensity=1;phase='blizzard';}}
 const smooth=intensity*intensity*(3-2*intensity);
 return {phase,intensity:smooth,visibility:150-122*smooth,seconds:time,startsIn,endsIn,warning:startsIn>0&&startsIn<=SNOW_WEATHER_TIMING.notice?Math.ceil(startsIn):0};
}
export function weatherVisibility(map:MapId|undefined,seconds:number,seed=1){return map==='snow'?snowWeather(seconds,seed).visibility:150;}
export function inWeatherRange(map:MapId|undefined,seconds:number,a:{x:number;z:number},b:{x:number;z:number},seed=1){return map!=='snow'||Math.hypot(a.x-b.x,a.z-b.z)<=weatherVisibility(map,seconds,seed);}
export function weatherMessage(weather:SnowWeather|null){
 if(!weather)return '';
 if(weather.warning)return `폭설까지 ${weather.warning}초`;
 if(weather.phase==='clear')return '맑음 · 폭설 예고 대기';
 if(weather.phase==='clearing')return '폭설이 걷히고 있습니다';
 return `${weather.phase==='building'?'폭설이 강해집니다':'폭설 · 시야 제한'} · ${Math.ceil(weather.endsIn)}초 남음`;
}
/** Shared match-time lighting; durations are independent of the storm schedule. */
export function snowDaylight(seconds:number,seed=1){
 const time=Number.isFinite(seconds)?Math.max(0,seconds):0;let start=0,index=0,end=0;
 do{start=end;end=start+40+Math.floor(weatherRandom((seed>>>0)^0x61c88647,index+733)*41);index++;}while(end<=time);
 const target=(index-1)%2,previous=1-target,progress=index===1?1:Math.min(1,(time-start)/6),smooth=progress*progress*(3-2*progress);
 return {night:index===1?0:previous+(target-previous)*smooth,nextChange:end};
}
