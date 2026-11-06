import { PRACTICE_RULES,type CombatRules } from './combat.ts';
export const WEAPON_IDS=['pistol','machinegun','shotgun','sniper'] as const;
export type WeaponId=typeof WEAPON_IDS[number];
export type WeaponSpec=CombatRules&{name:string;interval:number;automatic:boolean;pellets:number;spread:number};
export const WEAPONS:Record<WeaponId,Readonly<WeaponSpec>>={
 pistol:{...PRACTICE_RULES,name:'권총',interval:0,automatic:false,pellets:1,spread:0},
 machinegun:{maxHealth:100,damage:10,magazineSize:30,reloadSeconds:2,name:'기관총',interval:1/8,automatic:true,pellets:1,spread:0},
 shotgun:{maxHealth:100,damage:10,magazineSize:6,reloadSeconds:2.5,name:'산탄총',interval:.9,automatic:false,pellets:6,spread:.04},
 sniper:{maxHealth:100,damage:100,magazineSize:5,reloadSeconds:2.5,name:'저격총',interval:1.5,automatic:false,pellets:1,spread:0},
};
export function isWeaponId(v:unknown):v is WeaponId{return WEAPON_IDS.some(id=>id===v);}
export function pelletOffsets(spec:WeaponSpec){return Array.from({length:spec.pellets},(_,i)=>spec.pellets===1?{x:0,y:0}:{x:(i%2?1:-1)*spec.spread*.5,y:(Math.floor(i/2)-1)*spec.spread*.5});}
