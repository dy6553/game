import type {EquipmentId,Gear} from './equipment.ts';
import {createWeapon,advanceWeapon,type WeaponState} from './combat.ts';
import {WEAPONS,cancelBurst,cadenceCarry,type WeaponId} from './weapons.ts';
import type {Point} from './world.ts';
export type WeaponSlot={id:WeaponId;weapon:WeaponState;cooldown:number};
export type Inventory={slots:WeaponSlot[];active:number};
export type Pickup=Point&{id:string;weaponId:WeaponId;equipmentId?:EquipmentId;remaining:number};
export function createInventory(id:WeaponId):Inventory{return {slots:[{id,weapon:createWeapon(WEAPONS[id]),cooldown:0}],active:0};}
export function createPickups():Pickup[]{return [
 {id:'crate-machinegun',weaponId:'machinegun',x:0,z:-4,remaining:0},
 {id:'crate-shotgun',weaponId:'shotgun',x:8,z:0,remaining:0},
 {id:'crate-sniper',weaponId:'sniper',x:-8,z:0,remaining:0},
 {id:'crate-smg',weaponId:'smg',x:-5,z:-23,remaining:0},
 {id:'crate-burst',weaponId:'burst',x:5,z:20,remaining:0},
 {id:'crate-dmr',weaponId:'dmr',x:0,z:-34,remaining:0},
 {id:'crate-pistol',weaponId:'pistol',x:0,z:12,remaining:0},
];}
export function syncSlot(inv:Inventory,weapon:WeaponState,cooldown:number){const s=inv.slots[inv.active]!;s.weapon=weapon;s.cooldown=cooldown;}
export function advanceStowed(inv:Inventory,dt:number,includeActive=false){for(const [i,s] of inv.slots.entries())if(includeActive||i!==inv.active){const carry=s.id==='smg'&&i===inv.active?cadenceCarry(s.cooldown,dt):0;s.cooldown=Math.max(0,s.cooldown-dt);s.weapon=advanceWeapon(s.weapon,dt,WEAPONS[s.id]);if(s.id==='smg')s.weapon={...s.weapon,cadenceCarry:carry};}}
export function switchSlot(inv:Inventory,slot:unknown){if(!Number.isInteger(slot)||Number(slot)<0||Number(slot)>=inv.slots.length)return false;if(inv.active!==Number(slot))inv.slots[inv.active]!.weapon=cancelBurst(inv.slots[inv.active]!.weapon);inv.active=Number(slot);return true;}
export function nearbyPickup(p:Point,pickups:Pickup[]){return pickups.filter(c=>c.remaining===0&&Math.hypot(c.x-p.x,c.z-p.z,(c.y??0)-(p.y??0))<=2.5).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];}
export function tickPickups(pickups:Pickup[],dt:number){for(const c of pickups)c.remaining=Math.max(0,c.remaining-dt);}
export function takePickup(inv:Inventory,p:Point,pickups:Pickup[],id:string,replace?:number){
 const crate=pickups.find(c=>c.id===id);if(!crate||crate.equipmentId||crate.remaining>0||Math.hypot(crate.x-p.x,crate.z-p.z,(crate.y??0)-(p.y??0))>2.5)return 'unavailable';
 if(inv.slots.some(s=>s.id===crate.weaponId))return 'duplicate';
 if(inv.slots.length===3&&(replace===undefined||!Number.isInteger(replace)||replace<0||replace>=3))return 'choose';
 inv.slots[inv.active]!.weapon=cancelBurst(inv.slots[inv.active]!.weapon);
 const slot={id:crate.weaponId,weapon:createWeapon(WEAPONS[crate.weaponId]),cooldown:0};
 if(inv.slots.length<3){inv.active=inv.slots.length;inv.slots.push(slot);}else{inv.active=replace!;inv.slots[replace!]=slot;}
 crate.remaining=20;return 'added';
}

export function takeEquipmentPickup(gear:Gear,p:Point,pickups:Pickup[],id:string){const c=pickups.find(c=>c.id===id);if(!c?.equipmentId||c.remaining>0||Math.hypot(c.x-p.x,c.z-p.z,(c.y??0)-(p.y??0))>2.5)return false;if(gear[c.equipmentId]>=2)return false;gear[c.equipmentId]++;c.remaining=20;return true;}
