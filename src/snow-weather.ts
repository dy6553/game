import type {MapId} from './maps.ts';
export type SnowWeather={phase:'clear'|'building'|'blizzard'|'clearing';intensity:number;visibility:number;seconds:number};
/** Match time, not wall clock: pause-safe locally and authoritative online. */
export function snowWeather(seconds:number):SnowWeather{
 const time=Number.isFinite(seconds)?Math.max(0,seconds):0,t=time%120;
 let intensity=0,phase:SnowWeather['phase']='clear';
 if(t>=60&&t<68){intensity=(t-60)/8;phase='building';}else if(t>=68&&t<98){intensity=1;phase='blizzard';}else if(t>=98&&t<110){intensity=1-(t-98)/12;phase='clearing';}
 const smooth=intensity*intensity*(3-2*intensity);
 return {phase,intensity:smooth,visibility:150-122*smooth,seconds:time};
}
export function weatherVisibility(map:MapId|undefined,seconds:number){return map==='snow'?snowWeather(seconds).visibility:150;}
export function inWeatherRange(map:MapId|undefined,seconds:number,a:{x:number;z:number},b:{x:number;z:number}){return map!=='snow'||Math.hypot(a.x-b.x,a.z-b.z)<=weatherVisibility(map,seconds);}
