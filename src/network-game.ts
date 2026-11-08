import {createMatchPickups} from './match-pickups.ts';
import {createGear,launchRocket,useEquipment,advanceEquipment,isEquipmentId,type GearActor,type EquipmentId,type Projectile,type ToolEvent} from './equipment.ts';
import {createDash,beginDash,advanceDash,cancelDash,type DashState} from './dash.ts';
import {createInventory,createPickups,takeEquipmentPickup,syncSlot,advanceStowed,switchSlot,takePickup,tickPickups,type Inventory,type Pickup} from './inventory.ts';
import {harborWorld,createWorld,type World,type MapId,type Doors,type Point} from './world.ts';
import { WEAPONS,pelletOffsets,isWeaponId,startBurst,advanceBurst,cancelBurst,type WeaponId } from './weapons.ts';
import { createWeapon,beginReload,tryFire,type WeaponState } from './combat.ts';
import { createJump,beginJump,advanceJump,type JumpState } from './jump.ts';
import { viewMovement } from './view.ts';
export type Player = GearActor & {deaths:number;totalKills:number;playing?:boolean;abandoned?:boolean;id:string;y?:number;protection?:number;x:number;z:number;yaw:number;pitch:number;health:number;kills:number;dead:number;weaponId:WeaponId;weapon:WeaponState;jump:JumpState;cooldown:number;connected:boolean;character:'robot'|'robot-cat'|'welder';seq:number;startWeapon:WeaponId;inventory:Inventory;dash?:DashState};
export type Command={seq:number;x:number;y:number;yaw:number;pitch:number;fire:boolean;shot:boolean;reload:boolean;jump:boolean;sprint:boolean;scope:boolean;door?:string;dash?:boolean;slot?:number;pickup?:string;replace?:number;equipment?:EquipmentId};
export type ShotEvent={id:number;player:string;weapon:WeaponId;from:{x:number;y:number;z:number};to:{x:number;y:number;z:number};hit:boolean;killed:boolean;target?:string};
export type OnlineMode='duel'|'ffa'|'team';
export type NetworkOptions={mode?:OnlineMode;randomPickups?:boolean};
export type MatchState={mode?:OnlineMode;capacity?:number;started?:boolean;winningIds?:string[];teamScores?:number[];projectiles?:Projectile[];toolEvents?:ToolEvent[];map?:MapId;doors?:Doors;players:Player[];winner:string;tick:number;events:ShotEvent[];pickups:Pickup[]};
const empty=():Command=>({seq:-1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false});
export function parseCommand(v:unknown):Command|null{
 if(!v||typeof v!=='object')return null;const p=v as Record<string,unknown>;
 if(!['seq','x','y','yaw','pitch'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))return null;
 if(!Number.isSafeInteger(p.seq)||Number(p.seq)<0||Math.abs(Number(p.x))>1||Math.abs(Number(p.y))>1||Math.abs(Number(p.pitch))>1.2||Math.abs(Number(p.yaw))>Math.PI*2)return null;
 if(!['fire','shot','reload','jump','sprint','scope'].every(k=>typeof p[k]==='boolean'))return null;
 if(p.equipment!==undefined&&!isEquipmentId(p.equipment))return null;
 if(p.door!==undefined&&(typeof p.door!=='string'||p.door.length>40))return null;
 if(p.dash!==undefined&&typeof p.dash!=='boolean')return null;
 if(p.slot!==undefined&&(!Number.isInteger(p.slot)||Number(p.slot)<0||Number(p.slot)>2))return null;
 if(p.replace!==undefined&&(!Number.isInteger(p.replace)||Number(p.replace)<0||Number(p.replace)>2))return null;
 if(p.pickup!==undefined&&(typeof p.pickup!=='string'||p.pickup.length>40))return null;
 return p as unknown as Command;
}
export function moveNetworkPlayer(p:Pick<Player,'x'|'z'|'y'|'health'|'weapon'|'cooldown'>,c:Omit<Command,'seq'>,dt:number,doors?:Doors,world:World=harborWorld){
 const {normalized,moveWithCollisions,PROTOTYPE,worldSolids}=world;
 if(p.health<=0)return {x:p.x,z:p.z,y:p.y};
 const n=normalized(c.x,c.y),m=viewMovement(c.yaw,n.x,n.y),running=c.sprint&&n.y>0&&!c.fire&&!c.shot&&!c.scope&&p.weapon.reloadRemaining===0&&p.cooldown===0;
 return moveWithCollisions(p,{x:m.x*PROTOTYPE.speed*(running?1.5:1)*dt,z:m.z*PROTOTYPE.speed*(running?1.5:1)*dt},worldSolids(doors));
}
// Shared with prediction: only a server snapshot with dash state enables the feature.
export function advancePlayerMotion(p:Pick<Player,'x'|'z'|'y'|'health'|'weapon'|'cooldown'>&Partial<Pick<Player,'dash'|'jump'>>,c:Omit<Command,'seq'>,dt:number,doors?:Doors,world:World=harborWorld){
 const {moveWithCollisions,worldSolids}=world;
 let dash=p.dash,jump=p.jump??createJump();
 if(p.health<=0)return {x:p.x,z:p.z,y:p.y,jump,dash:dash?cancelDash(dash):undefined};
 if(dash&&c.dash)dash=beginDash(dash,{x:c.x,y:c.y,yaw:c.yaw,grounded:jump.height===0&&jump.velocity===0,canAct:true});
 if(c.jump&&(!dash||dash.remaining===0))jump=beginJump(jump);jump=advanceJump(jump,dt);
 let position:Point={x:p.x,z:p.z,y:p.y},walkTime=dt;
 if(dash){const result=advanceDash(dash,dt);dash=result.state;position=moveWithCollisions(position,result.delta,worldSolids(doors));walkTime-=result.activeSeconds;}
 if(walkTime>1e-8)position=moveNetworkPlayer({...p,...position},c,walkTime,doors,world);
 return {...position,jump,dash};
}
function rayBox(o:number[],d:number[],min:number[],max:number[]):number{
 let near=0,far=150;for(let i=0;i<3;i++){if(Math.abs(d[i]!)<1e-9){if(o[i]!<min[i]!||o[i]!>max[i]!)return Infinity;continue;}
 let a=(min[i]!-o[i]!)/d[i]!,b=(max[i]!-o[i]!)/d[i]!;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return near;
}
function wallDistance(origin:number[],direction:number[],doors:Doors|undefined,world:World){let result=150;
 for(const r of world.shotBoxes(doors))result=Math.min(result,rayBox(origin,direction,[r.x-r.width/2,r.yMin??0,r.z-r.depth/2],[r.x+r.width/2,r.yMax??20,r.z+r.depth/2]));
 return result;
}
export function onlinePlaying(state:MatchState,id?:string){
 const me=id?state.players.find(p=>p.id===id):undefined;if(state.winner||state.players.filter(p=>p.connected&&!p.abandoned).length<2||me?.playing===false||me?.abandoned)return false;
 if(state.mode==='team'&&new Set(state.players.filter(p=>p.connected&&!p.abandoned).map(p=>p.team)).size<2)return false;
 return (state.mode??'duel')==='duel'?state.players.length===2&&state.players.every(p=>p.connected):true;
}
export function wonOnline(state:MatchState,id:string){return state.winningIds?state.winningIds.includes(id):state.winner===id;}
export const ONLINE_MODES:OnlineMode[]=['duel','ffa','team'];
export function createNetworkGame(saved?:MatchState,map:MapId='harbor',options:NetworkOptions={}){
 const mapId=saved?.map==='factory'||!saved&&map==='factory'?'factory':'harbor',mode=saved?.mode??options.mode??'duel';
 const world=mapId==='factory'?createWorld('factory'):harborWorld;
 const state:MatchState=saved?structuredClone(saved):{players:[],winner:'',tick:0,events:[],pickups:options.randomPickups?createMatchPickups(world):createPickups()};
 state.map=mapId;state.mode=mode;state.capacity=mode==='duel'?2:20;state.teamScores??=[0,0];state.projectiles??=[];state.toolEvents??=[];state.pickups??=createMatchPickups(world);state.doors??=world.createDoors();
 const inputs=new Map<string,{command:Command;at:number}>();let now=0,eventId=state.tick*1000;
 const id=()=>++eventId;
 const spawn=(p:Player,index:number,respawn=false)=>{const point=respawn||mode!=='duel'?world.randomOutdoorSpawn(state.players.filter(o=>o!==p&&o.health>0&&o.playing!==false)):{x:0,z:index===0?-8:18};p.x=point.x;p.z=point.z;p.y=0;p.protection=respawn||mode!=='duel'?3:0;p.yaw=index===0?0:Math.PI;p.pitch=0;p.health=100;p.dead=0;p.jump=createJump();p.dash=createDash();p.weaponId=p.startWeapon;p.inventory=createInventory(p.startWeapon);p.weapon=createWeapon(WEAPONS[p.weaponId]);p.cooldown=0;p.gear=createGear();p.flash=0;p.healing=0;p.gearCooldown=0;};
 for(const p of state.players){p.connected=false;p.weapon=cancelBurst(p.weapon);p.dash=cancelDash(p.dash??createDash());p.startWeapon??=p.weaponId;p.inventory??=createInventory(p.weaponId);p.gear??=createGear();p.healing=0;p.flash??=0;p.gearCooldown??=0;p.deaths??=0;p.totalKills??=p.kills;syncSlot(p.inventory,p.weapon,p.cooldown);}
 function finish(winner:string,members:string[]){state.winner=winner;state.winningIds=members;for(const p of state.players)p.healing=0;}
 function scoreWin(p:Player){if(mode==='team')finish('team:'+p.team,state.players.filter(o=>o.team===p.team).map(o=>o.id));else finish(p.id,[p.id]);}
 function hurt(target:Player,amount:number,owner:string){if(target.health<=0||(target.protection??0)>0||state.winner||target.playing===false)return;target.health=Math.max(0,target.health-amount);target.healing=0;if(target.health>0)return;target.deaths++;target.dead=3;target.dash=cancelDash(target.dash??createDash());target.gear=createGear();const killer=state.players.find(p=>p.id===owner);if(!killer||killer===target)return;killer.kills++;killer.totalKills++;if(killer.team!==undefined){state.teamScores![killer.team]++;if(state.teamScores![killer.team]!>=30)scoreWin(killer);}else if(killer.kills>=10)scoreWin(killer);}
 const api={state,
  join(playerId:string,weapon:unknown='pistol',character:unknown='robot'){
   const existing=state.players.find(p=>p.id===playerId);if(existing){if(existing.abandoned)throw Error('재접속 시간이 지났습니다.');existing.connected=true;inputs.delete(playerId);return existing;}
   if(state.players.length>=state.capacity!||state.winner)throw Error('방이 가득 찼거나 이미 시작했습니다.');
   const team=mode==='team'?(state.players.filter(p=>p.team===0).length<=state.players.filter(p=>p.team===1).length?0:1):undefined;
   const p:Player={id:playerId,x:0,z:0,yaw:0,pitch:0,health:100,kills:0,totalKills:0,deaths:0,dead:0,weaponId:isWeaponId(weapon)?weapon:'pistol',weapon:createWeapon(WEAPONS.pistol),jump:createJump(),cooldown:0,connected:true,character:character==='welder'?'welder':character==='robot-cat'?'robot-cat':'robot',seq:-1,startWeapon:isWeaponId(weapon)?weapon:'pistol',inventory:createInventory(isWeaponId(weapon)?weapon:'pistol'),gear:createGear(),flash:0,healing:0,gearCooldown:0,team,playing:true};
   spawn(p,state.players.length);state.players.push(p);return p;
  },
  disconnect(playerId:string){const p=state.players.find(p=>p.id===playerId);if(p){p.connected=false;p.healing=0;p.weapon=cancelBurst(p.weapon);p.dash=cancelDash(p.dash??createDash());}inputs.delete(playerId);},
  abandon(playerId:string){const p=state.players.find(p=>p.id===playerId);if(p){p.abandoned=true;p.connected=false;p.healing=0;}inputs.delete(playerId);},
  input(playerId:string,raw:unknown){const c=parseCommand(raw),p=state.players.find(p=>p.id===playerId);if(!c||!p?.connected||p.abandoned||c.seq<=p.seq)return false;p.seq=c.seq;const old=inputs.get(playerId)?.command;c.shot ||=old?.shot??false;c.reload ||=old?.reload??false;c.jump ||=old?.jump??false;c.dash ||=old?.dash??false;c.door??=old?.door;c.slot??=old?.slot;if(c.pickup===undefined){c.pickup=old?.pickup;c.replace=old?.replace;}c.equipment??=old?.equipment;inputs.set(playerId,{command:c,at:now});return true;},
  step(){const dt=.05;now+=dt;state.tick++;state.events=[];state.toolEvents=[];
   if(!onlinePlaying(state)){inputs.clear();return;}state.started=true;tickPickups(state.pickups,dt);
   for(const [index,p] of state.players.entries()){
    if(!p.connected||p.abandoned||p.playing===false)continue;const entry=inputs.get(p.id),c=entry&&now-entry.at<.3?entry.command:empty();
    if(p.health===0){p.dead=Math.max(0,p.dead-dt);if(p.dead<1e-8)spawn(p,index,true);continue;}p.protection=Math.max(0,(p.protection??0)-dt);
    if(c.door)world.toggleDoor(state.doors!,c.door,p,state.players.filter(o=>o.health>0&&o.playing!==false));if(entry&&now-entry.at<.3){p.yaw=c.yaw;p.pitch=c.pitch;}
    syncSlot(p.inventory,p.weapon,p.cooldown);advanceStowed(p.inventory,dt,true);if(c.slot!==undefined)switchSlot(p.inventory,c.slot);if(c.pickup){const pickup=state.pickups.find(x=>x.id===c.pickup);if(pickup?.equipmentId)takeEquipmentPickup(p.gear,p,state.pickups,c.pickup);else takePickup(p.inventory,p,state.pickups,c.pickup,c.replace);}
    const slot=p.inventory.slots[p.inventory.active]!;p.weaponId=slot.id;p.weapon=slot.weapon;p.cooldown=slot.cooldown;const spec=WEAPONS[p.weaponId];if(c.reload){const next=beginReload(p.weapon,spec);if(next!==p.weapon)p.weapon=cancelBurst(next);}if(c.equipment)useEquipment(p,c.equipment,state.projectiles!,id());
    const sequence=advanceBurst(p.weapon,dt);p.weapon=sequence.state;Object.assign(p,advancePlayerMotion(p,c,dt,state.doors,world));
    if(sequence.due>0||((c.shot||(c.fire&&spec.automatic))&&p.cooldown<1e-8)){const attempt=tryFire(p.weapon);p.weapon=attempt.state;if(attempt.fired){p.healing=0;p.protection=0;if(!sequence.due){p.cooldown=Math.max(0,spec.interval-(p.weaponId==='smg'?(p.weapon.cadenceCarry??0):0));p.weapon=startBurst(p.weapon,spec);}const origin=[p.x,(p.character==='robot-cat'?1.9:1.95)+(p.y??0)+p.jump.height,p.z];
     if(p.weaponId==='bazooka'){launchRocket(p,state.projectiles!,id(),spec.damage);state.events.push({id:id(),player:p.id,weapon:p.weaponId,from:{x:origin[0]!,y:origin[1]!,z:origin[2]!},to:{x:p.x+Math.sin(p.yaw)*2,y:origin[1]!-Math.sin(p.pitch)*2,z:p.z+Math.cos(p.yaw)*2},hit:false,killed:false});}else for(const offset of pelletOffsets(spec)){const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch);let d=[sy*cp+cy*offset.x+sy*sp*offset.y,-sp+cp*offset.y,cy*cp-sy*offset.x+cy*sp*offset.y];const len=Math.hypot(...d);d=d.map(v=>v/len);const wall=wallDistance(origin,d,state.doors,world);let target:Player|undefined,range=wall;
      for(const foe of state.players){if(foe===p||foe.health<=0||!foe.connected||foe.abandoned||foe.playing===false)continue;const t=rayBox(origin,d,[foe.x-.55,(foe.y??0)+foe.jump.height,foe.z-.55],[foe.x+.55,(foe.y??0)+foe.jump.height+2.5,foe.z+.55]);if(t<range){range=t;target=foe;}}
      const hit=!!target&&(target.protection??0)<=0&&(p.team===undefined||target.team!==p.team);const before=target?.deaths??0;if(hit)hurt(target!,spec.damage,p.id);state.events.push({id:id(),player:p.id,weapon:p.weaponId,from:{x:origin[0]!,y:origin[1]!,z:origin[2]!},to:{x:origin[0]!+d[0]!*range,y:origin[1]!+d[1]!*range,z:origin[2]!+d[2]!*range},hit,killed:hit&&target!.deaths>before,target:target?.id});if(state.winner)break;
     }
    }}syncSlot(p.inventory,p.weapon,p.cooldown);c.door=undefined;c.shot=false;c.reload=false;c.jump=false;c.dash=false;c.slot=undefined;c.pickup=undefined;c.replace=undefined;c.equipment=undefined;if(state.winner)break;
   }
   if(!state.winner)state.toolEvents=advanceEquipment(state.players.filter(p=>p.connected&&!p.abandoned&&p.playing!==false),state.projectiles!,dt,world,state.doors!,(target,amount,owner)=>hurt(target as Player,amount,owner),id);
  },
 };
 return api;
}
