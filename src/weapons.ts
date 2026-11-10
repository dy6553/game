import { PRACTICE_RULES,type CombatRules } from './combat.ts';
export const WEAPON_IDS=['pistol','machinegun','shotgun','sniper','smg','burst','dmr','quad','bazooka'] as const;
export type WeaponId=typeof WEAPON_IDS[number];
export type WeaponSpec=CombatRules&{name:string;interval:number;automatic:boolean;pellets:number;spread:number;burstCount?:number;burstInterval?:number};
export const WEAPONS:Record<WeaponId,Readonly<WeaponSpec>>={
 pistol:{...PRACTICE_RULES,damage:22,name:'권총',interval:.25,automatic:false,pellets:1,spread:0},
 machinegun:{maxHealth:100,damage:11,magazineSize:30,reloadSeconds:2,name:'기관총',interval:1/8,automatic:true,pellets:1,spread:0},
 shotgun:{maxHealth:100,damage:15,magazineSize:6,reloadSeconds:2.5,name:'산탄총',interval:.9,automatic:false,pellets:6,spread:.04},
 sniper:{maxHealth:100,damage:70,magazineSize:5,reloadSeconds:2.5,name:'저격총',interval:1.5,automatic:false,pellets:1,spread:0},
 smg:{maxHealth:100,damage:8,magazineSize:40,reloadSeconds:1.8,name:'기관단총',interval:1/12,automatic:true,pellets:1,spread:.035},
 burst:{maxHealth:100,damage:17,magazineSize:24,reloadSeconds:2,name:'3점사 소총',interval:.65,automatic:false,pellets:1,spread:0,burstCount:3,burstInterval:.08},
 quad:{maxHealth:100,damage:16,magazineSize:32,reloadSeconds:2.2,name:'4점사 소총',interval:.75,automatic:false,pellets:1,spread:0,burstCount:4,burstInterval:.08},
 bazooka:{maxHealth:100,damage:110,magazineSize:1,reloadSeconds:3,name:'바주카',interval:1,automatic:false,pellets:1,spread:0},
 dmr:{maxHealth:100,damage:42,magazineSize:10,reloadSeconds:2.2,name:'반자동 소총',interval:.5,automatic:false,pellets:1,spread:0},
};
export function isWeaponId(v:unknown):v is WeaponId{return WEAPON_IDS.some(id=>id===v);}
export function pelletOffsets(spec:WeaponSpec,random:()=>number=Math.random){if(spec.pellets===1&&spec.spread>0){const r=Math.sqrt(random())*spec.spread,a=random()*Math.PI*2;return [{x:Math.cos(a)*r,y:Math.sin(a)*r}];}return Array.from({length:spec.pellets},(_,i)=>spec.pellets===1?{x:0,y:0}:{x:(i%2?1:-1)*spec.spread*.5,y:(Math.floor(i/2)-1)*spec.spread*.5});}

export function cancelBurst<T extends import('./combat.ts').WeaponState>(state:T):T{return state.burstRemaining?{...state,burstRemaining:0,burstWait:0}:state;}
export function startBurst<T extends import('./combat.ts').WeaponState>(state:T,spec:WeaponSpec):T{return spec.burstCount?{...state,burstRemaining:spec.burstCount-1,burstWait:spec.burstInterval}:state;}
export function advanceBurst<T extends import('./combat.ts').WeaponState>(state:T,dt:number):{state:T;due:number}{
 if(!state.burstRemaining)return {state,due:0};
 if(state.ammo<=0||state.reloadRemaining>0)return {state:cancelBurst(state),due:0};
 const wait=(state.burstWait??0)-dt;if(wait>1e-8)return {state:{...state,burstWait:wait},due:0};
 return {state:{...state,burstRemaining:state.burstRemaining-1,burstWait:wait+.08},due:1};
}
export function cadenceCarry(cooldown:number,dt:number){return cooldown>0?Math.max(0,dt-cooldown):0;}
export function upgradedWeapon(id:WeaponId,tier:number,botMode:boolean):Readonly<WeaponSpec>{
 const base=WEAPONS[id],n=botMode&&Number.isInteger(tier)?Math.max(0,Math.min(3,tier)):0;
 return n?{...base,damage:base.damage*(1+n*.05),reloadSeconds:base.reloadSeconds*(1-n*.05)}:base;
}
