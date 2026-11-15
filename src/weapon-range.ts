import type {WeaponId} from './weapons.ts';
// Start/end distance and minimum damage fraction. Rocket flight/blast has its own model.
export const WEAPON_RANGES:Record<WeaponId,readonly [number,number,number]>={pistol:[40,80,.75],machinegun:[35,80,.8],smg:[12,36,.55],shotgun:[8,28,.35],burst:[40,80,.8],quad:[35,80,.75],dmr:[55,110,.85],sniper:[100,150,.9],bazooka:[150,150,1]};
export function rangedDamage(id:WeaponId,damage:number,distance:number){const [start,end,min]=WEAPON_RANGES[id],t=end>start?Math.max(0,Math.min(1,((Number.isFinite(distance)?distance:0)-start)/(end-start))):0;return damage*(1-(1-min)*t);}
