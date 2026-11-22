import {nearbyMoonMaskRack} from './moon-layout.ts';
import type {Point} from './world.ts';
import {weatherRandom} from './snow-weather.ts';

export function advanceOxygen(oxygen:number,sheltered:boolean,seconds:number){
 if(sheltered)return {oxygen:Math.min(100,oxygen+seconds*12),damage:0};
 const available=oxygen/2;
 return {oxygen:Math.max(0,oxygen-seconds*2),damage:8*Math.max(0,seconds-available)};
}

export const oxygenMasks={
 light:{label:'경량',seconds:20},
 standard:{label:'표준',seconds:35},
 extended:{label:'장시간',seconds:50},
} as const;
export type OxygenMaskId=keyof typeof oxygenMasks;
export type OxygenMaskAction=OxygenMaskId|'wear'|'discard';
export type OxygenMask={id?:OxygenMaskId;remaining:number;worn?:boolean};
export const createOxygenMask=():OxygenMask=>({remaining:0});
export const isOxygenMaskAction=(value:unknown):value is OxygenMaskAction=>
 value==='wear'||value==='discard'||(typeof value==='string'&&Object.hasOwn(oxygenMasks,value));

export function applyOxygenMaskAction(mask:OxygenMask,action:OxygenMaskAction,position:Point,seed:number){
 if(action==='discard'){
  if(!mask.id||!mask.worn||mask.remaining>0)return false;
  delete mask.id;delete mask.worn;
 }else if(action==='wear'){
  if(!mask.id||mask.worn)return false;
  mask.worn=true;
  mask.remaining=oxygenMasks[mask.id].seconds;
 }else{
  if(mask.id||!nearbyMoonMaskRack(position,seed))return false;
  mask.id=action;
 }
 return true;
}

export function advanceLunarAir(oxygen:number,mask:OxygenMask,sheltered:boolean,seconds:number){
 const protectedTime=Math.min(seconds,mask.remaining);
 mask.remaining=Math.max(0,mask.remaining-seconds);
 if(mask.remaining<1e-8)mask.remaining=0;
 return advanceOxygen(oxygen,sheltered,sheltered?seconds:seconds-protectedTime);
}

export function moonEclipse(seconds:number,seed=1){
 let start=0,end=0,index=0;
 do{
  start=end+55+Math.floor(weatherRandom(seed,index*2)*66);
  end=start+15+Math.floor(weatherRandom(seed,index*2+1)*21);
  index++;
 }while(end<=seconds);
 const warning=seconds>=start-10&&seconds<start?Math.ceil(start-seconds):0;
 const active=seconds>=start;
 const darkness=active?Math.max(0,Math.min(1,(seconds-start)/4,(end-seconds)/4)):0;
 return {warning,active,darkness,start,end,endsIn:Math.max(0,end-seconds)};
}
