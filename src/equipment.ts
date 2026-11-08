import type {World,Doors} from './world.ts';import {boxHit,unobstructed,type Vec3} from './combat-geometry.ts';
export type EquipmentId='grenade'|'flash'|'medkit';
export const EQUIPMENT={grenade:{name:'수류탄'},flash:{name:'섬광탄'},medkit:{name:'회복키트'}} as const;
export const EQUIPMENT_IDS=['grenade','flash','medkit'] as const;
export const isEquipmentId=(v:unknown):v is EquipmentId=>EQUIPMENT_IDS.includes(v as EquipmentId);
export function createGear(){return {grenade:0,flash:0,medkit:0};}
export type Gear=ReturnType<typeof createGear>;
export type GearActor={id:string;x:number;y?:number;z:number;yaw:number;pitch:number;health:number;jump?:{height:number};protection?:number;team?:number;gear:Gear;healing:number;flash:number;gearCooldown:number};
export type Projectile=Vec3&{id:number;owner:string;team?:number;kind:'grenade'|'flash'|'rocket';damage?:number;direct?:string;vx:number;vy:number;vz:number;remaining:number};
export type ToolEvent=Vec3&{id:number;kind:'grenade'|'flash'|'rocket'|'heal';owner:string};
export function blastDamage(distance:number){return Math.round(100*Math.max(0,1-Math.max(0,distance)/6));}
export function flashDuration(distance:number,facing:number){return 3*Math.max(0,1-Math.max(0,distance)/8)*(.25+.75*Math.max(0,Math.min(1,facing)));}
export function beginHealing(a:Pick<GearActor,'health'|'healing'|'gear'>){if(a.health<=0||a.health>=100||a.healing>0||a.gear.medkit<1)return false;a.healing=2;return true;}
export function useEquipment(a:GearActor,kind:EquipmentId,projectiles:Projectile[],id:number){
 if(a.health<=0||a.gearCooldown>0||a.gear[kind]<1)return false;
 if(kind==='medkit'){if(!beginHealing(a))return false;}else{if(projectiles.length>=80)return false;a.healing=0;a.gear[kind]--;a.protection=0;const cp=Math.cos(a.pitch);projectiles.push({id,owner:a.id,team:a.team,kind,x:a.x,y:(a.y??0)+(a.jump?.height??0)+1.7,z:a.z,vx:Math.sin(a.yaw)*cp*14,vy:-Math.sin(a.pitch)*14+5,vz:Math.cos(a.yaw)*cp*14,remaining:kind==='grenade'?3:1.5});}
 a.gearCooldown=.8;return true;
}
export function launchRocket(a:GearActor,projectiles:Projectile[],id:number,damage=100){if(projectiles.length>=80)return false;const cp=Math.cos(a.pitch);projectiles.push({id,owner:a.id,team:a.team,kind:'rocket',damage,x:a.x,y:(a.y??0)+(a.jump?.height??0)+1.95,z:a.z,vx:Math.sin(a.yaw)*cp*24,vy:-Math.sin(a.pitch)*24,vz:Math.cos(a.yaw)*cp*24,remaining:5});return true;}
export function advanceEquipment(actors:GearActor[],projectiles:Projectile[],dt:number,world:World,doors:Doors,damage:(target:GearActor,amount:number,owner:string)=>void,nextId:()=>number){
 const events:ToolEvent[]=[];
 for(const a of actors){a.flash=Math.max(0,a.flash-dt);a.gearCooldown=Math.max(0,a.gearCooldown-dt);if(a.health<=0){a.healing=0;continue;}if(a.healing>0){a.healing=Math.max(0,a.healing-dt);if(a.healing<1e-8){a.healing=0;if(a.gear.medkit>0){a.gear.medkit--;a.health=Math.min(100,a.health+50);events.push({id:nextId(),kind:'heal',owner:a.id,x:a.x,y:(a.y??0)+1,z:a.z});}}}}
 const solids=world.shotBoxes(doors);
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i]!;p.remaining-=dt;if(p.kind!=='rocket')p.vy-=9.8*dt;
  let time=dt;for(let bounce=0;bounce<3&&time>1e-6;bounce++){const end={x:p.x+p.vx*time,y:p.y+p.vy*time,z:p.z+p.vz*time};let hit:{t:number;axis:number}|null=null;
   if(end.y<.12&&p.y>=.119)hit={t:Math.max(0,(p.y-.12)/(p.y-end.y)),axis:1};
   for(const r of solids){const q=boxHit(p,end,r,.12);if(q&&q.t>1e-6&&(!hit||q.t<hit.t))hit=q;}
   if(p.kind==='rocket')for(const a of actors){if(a.id===p.owner||a.health<=0)continue;const q=boxHit(p,end,{id:a.id,x:a.x,z:a.z,width:1.1,depth:1.1,yMin:(a.y??0)+(a.jump?.height??0),yMax:(a.y??0)+(a.jump?.height??0)+2.5},.12);if(q&&(!hit||q.t<hit.t)){hit=q;p.direct=a.id;}}
   if(!hit){Object.assign(p,end);break;}p.x+=(end.x-p.x)*Math.max(0,hit.t-.001);p.y+=(end.y-p.y)*Math.max(0,hit.t-.001);p.z+=(end.z-p.z)*Math.max(0,hit.t-.001);if(p.kind==='rocket'){p.remaining=0;break;}const v=hit.axis===0?'vx':hit.axis===1?'vy':'vz';p[v]*=-.42;p.vx*=.8;p.vz*=.8;if(hit.axis===1&&Math.abs(p.vy)<.4)p.vy=0;time*=1-hit.t;
  }p.y=Math.max(.12,p.y);
  if(p.remaining>1e-8)continue;projectiles.splice(i,1);events.push({id:nextId(),kind:p.kind,owner:p.owner,x:p.x,y:p.y,z:p.z});
  for(const a of actors){if(a.health<=0||(a.protection??0)>0||(p.owner!==a.id&&p.team!==undefined&&a.team===p.team))continue;const eye={x:a.x,y:(a.y??0)+(a.jump?.height??0)+1.8,z:a.z},center={x:a.x,y:Math.max((a.y??0)+(a.jump?.height??0)+.2,Math.min((a.y??0)+(a.jump?.height??0)+1.8,p.y)),z:a.z};const distance=Math.hypot(p.x-center.x,p.y-center.y,p.z-center.z),origin={x:p.x,y:p.y+.02,z:p.z};if(!unobstructed(world,doors,origin,p.kind==='flash'?eye:center))continue;
   if(p.kind==='grenade'||p.kind==='rocket'){const amount=p.kind==='rocket'?(p.direct===a.id?(p.damage??100):Math.round((p.damage??100)*Math.max(0,1-distance/5))):blastDamage(distance);if(amount>0){a.healing=0;damage(a,amount,p.owner);}}
   else {const dx=p.x-a.x,dz=p.z-a.z,len=Math.hypot(dx,dz),facing=len?(Math.sin(a.yaw)*dx+Math.cos(a.yaw)*dz)/len:1;a.flash=Math.max(a.flash,flashDuration(Math.hypot(dx,dz,eye.y-p.y),facing));}
  }
 }
 return events;
}
