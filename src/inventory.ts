import {createWeapon,advanceWeapon,type WeaponState} from './combat.ts';
import {WEAPONS,type WeaponId} from './weapons.ts';
import type {Point} from './world.ts';
export type WeaponSlot={id:WeaponId;weapon:WeaponState;cooldown:number};
export type Inventory={slots:WeaponSlot[];active:number};
export type Pickup=Point&{id:string;weaponId:WeaponId;remaining:number};
export function createInventory(id:WeaponId):Inventory{return {slots:[{id,weapon:createWeapon(WEAPONS[id]),cooldown:0}],active:0};}
export function createPickups():Pickup[]{return [
 {id:'crate-machinegun',weaponId:'machinegun',x:0,z:-4,remaining:0},
 {id:'crate-shotgun',weaponId:'shotgun',x:8,z:0,remaining:0},
 {id:'crate-sniper',weaponId:'sniper',x:-8,z:0,remaining:0},
 {id:'crate-pistol',weaponId:'pistol',x:0,z:12,remaining:0},
];}
export function syncSlot(inv:Inventory,weapon:WeaponState,cooldown:number){const s=inv.slots[inv.active]!;s.weapon=weapon;s.cooldown=cooldown;}
export function advanceStowed(inv:Inventory,dt:number,includeActive=false){for(const [i,s] of inv.slots.entries())if(includeActive||i!==inv.active){s.cooldown=Math.max(0,s.cooldown-dt);s.weapon=advanceWeapon(s.weapon,dt,WEAPONS[s.id]);}}
export function switchSlot(inv:Inventory,slot:unknown){if(!Number.isInteger(slot)||Number(slot)<0||Number(slot)>=inv.slots.length)return false;inv.active=Number(slot);return true;}
export function nearbyPickup(p:Point,pickups:Pickup[]){return pickups.filter(c=>c.remaining===0&&Math.hypot(c.x-p.x,c.z-p.z)<=2.5).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];}
export function tickPickups(pickups:Pickup[],dt:number){for(const c of pickups)c.remaining=Math.max(0,c.remaining-dt);}
export function takePickup(inv:Inventory,p:Point,pickups:Pickup[],id:string,replace?:number){
 const crate=pickups.find(c=>c.id===id);if(!crate||crate.remaining>0||Math.hypot(crate.x-p.x,crate.z-p.z)>2.5)return 'unavailable';
 if(inv.slots.some(s=>s.id===crate.weaponId))return 'duplicate';
 if(inv.slots.length===3&&(replace===undefined||!Number.isInteger(replace)||replace<0||replace>=3))return 'choose';
 const slot={id:crate.weaponId,weapon:createWeapon(WEAPONS[crate.weaponId]),cooldown:0};
 if(inv.slots.length<3){inv.active=inv.slots.length;inv.slots.push(slot);}else{inv.active=replace!;inv.slots[replace!]=slot;}
 crate.remaining=20;return 'added';
}
