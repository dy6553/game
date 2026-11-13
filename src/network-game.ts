import {rangedDamage} from './weapon-range.ts';
import {isStance,stanceStats,type Stance} from './stance.ts';
export {normalizeNickname} from './nickname.ts';
import {normalizeNickname} from './nickname.ts';
import {createMatchPickups} from './match-pickups.ts';
import {createGear,launchRocket,useEquipment,advanceEquipment,isEquipmentId,type GearActor,type EquipmentId,type Projectile,type ToolEvent} from './equipment.ts';
import {createDash,beginDash,advanceDash,cancelDash,type DashState} from './dash.ts';
import {createInventory,createPickups,takeEquipmentPickup,syncSlot,advanceStowed,switchSlot,takePickup,tickPickups,type Inventory,type Pickup} from './inventory.ts';
import {harborWorld,createWorld,type World,type MapId,type Doors,type Point} from './world.ts';
import { WEAPONS,pelletOffsets,isWeaponId,startBurst,advanceBurst,cancelBurst,type WeaponId } from './weapons.ts';
import { createWeapon,beginReload,tryFire,type WeaponState } from './combat.ts';
import { createJump,beginJump,type JumpState } from './jump.ts';
import { viewMovement } from './view.ts';
export type Player = GearActor & {revealedUntil?:number;nickname?:string;guest?:boolean;participated?:boolean;deaths:number;totalKills:number;playing?:boolean;abandoned?:boolean;id:string;y?:number;fallSpeed?:number;protection?:number;x:number;z:number;yaw:number;pitch:number;health:number;kills:number;dead:number;weaponId:WeaponId;weapon:WeaponState;jump:JumpState;cooldown:number;connected:boolean;character:'robot'|'robot-cat'|'welder';seq:number;startWeapon:WeaponId;inventory:Inventory;dash?:DashState};
export type TeamPing={kind:'enemy'|'move'|'help';x:number;z:number;player:string;team:number;expires:number};
export type Command={ping?:Pick<TeamPing,'kind'|'x'|'z'>;stance?:Stance;seq:number;x:number;y:number;yaw:number;pitch:number;fire:boolean;shot:boolean;reload:boolean;jump:boolean;sprint:boolean;scope:boolean;door?:string;dash?:boolean;slot?:number;pickup?:string;replace?:number;equipment?:EquipmentId};
export type ShotEvent={id:number;player:string;weapon:WeaponId;from:{x:number;y:number;z:number};to:{x:number;y:number;z:number};hit:boolean;killed:boolean;target?:string;headshot?:boolean;protected?:boolean;elevated?:boolean};
export type OnlineMode='duel'|'ffa'|'team';
export type NetworkOptions={clock?:()=>number;waitingRoom?:boolean;mode?:OnlineMode;randomPickups?:boolean};
export type MatchState={pings?:TeamPing[];phase?:'waiting'|'playing';hostId?:string;mode?:OnlineMode;capacity?:number;started?:boolean;winningIds?:string[];teamScores?:number[];projectiles?:Projectile[];toolEvents?:ToolEvent[];map?:MapId;doors?:Doors;players:Player[];winner:string;tick:number;events:ShotEvent[];pickups:Pickup[]};
const empty=():Command=>({seq:-1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false});
export function parseCommand(v:unknown):Command|null{
 if(!v||typeof v!=='object')return null;const p=v as Record<string,unknown>;
 if(!['seq','x','y','yaw','pitch'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))return null;
 if(!Number.isSafeInteger(p.seq)||Number(p.seq)<0||Math.abs(Number(p.x))>1||Math.abs(Number(p.y))>1||Math.abs(Number(p.pitch))>1.2||Math.abs(Number(p.yaw))>Math.PI*2)return null;
 if(!['fire','shot','reload','jump','sprint','scope'].every(k=>typeof p[k]==='boolean'))return null;
 if(p.ping!==undefined){const q=p.ping as Record<string,unknown>;if(!q||typeof q!=='object'||typeof q.kind!=='string'||!['enemy','move','help'].includes(q.kind)||typeof q.x!=='number'||typeof q.z!=='number'||!Number.isFinite(q.x)||!Number.isFinite(q.z)||Math.abs(q.x)>64||q.z< -60||q.z>34)return null;}
 if(p.equipment!==undefined&&!isEquipmentId(p.equipment))return null;
 if(p.door!==undefined&&(typeof p.door!=='string'||p.door.length>40))return null;
 if(p.stance!==undefined&&!isStance(p.stance))return null;
 if(p.dash!==undefined&&typeof p.dash!=='boolean')return null;
 if(p.slot!==undefined&&(!Number.isInteger(p.slot)||Number(p.slot)<0||Number(p.slot)>2))return null;
 if(p.replace!==undefined&&(!Number.isInteger(p.replace)||Number(p.replace)<0||Number(p.replace)>2))return null;
 if(p.pickup!==undefined&&(typeof p.pickup!=='string'||p.pickup.length>40))return null;
 return p as unknown as Command;
}
export function moveNetworkPlayer(p:Pick<Player,'x'|'z'|'y'|'health'|'weapon'|'cooldown'>,c:Omit<Command,'seq'>,dt:number,doors?:Doors,world:World=harborWorld,stairLift=0){
 const {normalized,moveWithCollisions,PROTOTYPE,worldSolids}=world;
 if(p.health<=0)return {x:p.x,z:p.z,y:p.y};
 const n=normalized(c.x,c.y),m=viewMovement(c.yaw,n.x,n.y),running=c.sprint&&n.y>0&&!c.fire&&!c.shot&&!c.scope&&p.weapon.reloadRemaining===0&&p.cooldown===0;
 return moveWithCollisions(p,{x:m.x*PROTOTYPE.speed*stanceStats(c.stance).speed*(running&&(!c.stance||c.stance==='stand')?1.5:1)*dt,z:m.z*PROTOTYPE.speed*stanceStats(c.stance).speed*(running&&(!c.stance||c.stance==='stand')?1.5:1)*dt},worldSolids(doors),PROTOTYPE.radius,stairLift);
}
// Shared with prediction: only a server snapshot with dash state enables the feature.
export function advancePlayerMotion(p:Pick<Player,'x'|'z'|'y'|'health'|'weapon'|'cooldown'>&Partial<Pick<Player,'dash'|'jump'|'fallSpeed'|'stance'>>,c:Omit<Command,'seq'>,dt:number,doors?:Doors,world:World=harborWorld){
 const {moveWithCollisions,worldSolids}=world;
 // Missing input stops actions, but posture persists until explicitly changed.
 c={...c,stance:c.stance??p.stance??'stand'};
 let dash=p.dash,jump=p.jump??createJump();
 if(p.health<=0)return {x:p.x,z:p.z,y:p.y,jump,dash:dash?cancelDash(dash):undefined};
 if(dash&&c.dash&&(!c.stance||c.stance==='stand'))dash=beginDash(dash,{x:c.x,y:c.y,yaw:c.yaw,grounded:jump.height===0&&jump.velocity===0&&!(p.fallSpeed&&p.fallSpeed>0),canAct:true});
 if((!c.stance||c.stance==='stand')&&c.jump&&(!dash||dash.remaining===0)&&!(p.fallSpeed&&p.fallSpeed>0))jump=beginJump(jump);
 let position:Point={x:p.x,z:p.z,y:p.y,fallSpeed:p.fallSpeed,stance:c.stance},walkTime=dt;
 if(dash){const result=advanceDash(dash,dt);dash=result.state;position=moveWithCollisions(position,result.delta,worldSolids(doors));walkTime-=result.activeSeconds;}
 if(walkTime>1e-8)position=moveNetworkPlayer({...p,...position},c,walkTime,doors,world,jump.height);
 const vertical=world.advanceJumpOnTerrain(position,jump,dt);
 return {...vertical.position,jump:vertical.jump,dash};
}
function rayBox(o:number[],d:number[],min:number[],max:number[]):number{
 let near=0,far=150;for(let i=0;i<3;i++){if(Math.abs(d[i]!)<1e-9){if(o[i]!<min[i]!||o[i]!>max[i]!)return Infinity;continue;}
 let a=(min[i]!-o[i]!)/d[i]!,b=(max[i]!-o[i]!)/d[i]!;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return near;
}
function actorHit(origin:number[],direction:number[],p:Player,head=false){
 const base=(p.y??0)+p.jump.height,cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),dx=origin[0]!-p.x,dz=origin[2]!-p.z;
 const o=[dx*cy-dz*sy,origin[1]!-base,dx*sy+dz*cy],d=[direction[0]!*cy-direction[2]!*sy,direction[1]!,direction[0]!*sy+direction[2]!*cy];
 if(p.stance==='prone')return rayBox(o,d,head?[-.52,.1,1.62]:[-.55,0,0],head?[.52,.9,2.44]:[.55,1,2.5]);
 const h=stanceStats(p.stance).height;return rayBox(o,d,head?[-.52,h*.648,-.4]:[-.55,0,-.55],head?[.52,h*.976,.4]:[.55,h,.55]);
}
function wallDistance(origin:number[],direction:number[],doors:Doors|undefined,world:World){let result=150;
 for(const r of world.shotBoxes(doors))result=Math.min(result,rayBox(origin,direction,[r.x-r.width/2,r.yMin??0,r.z-r.depth/2],[r.x+r.width/2,r.yMax??20,r.z+r.depth/2]));
 return result;
}
export const availablePlayer=(p:Player)=>p.connected&&!p.abandoned&&p.playing!==false&&(!p.guest||!!normalizeNickname(p.nickname));
export function onlinePlaying(state:MatchState,id?:string){
 const me=id?state.players.find(p=>p.id===id):undefined;if(id&&(!me||!availablePlayer(me)))return false;if(state.phase==='waiting'||state.winner||state.players.filter(availablePlayer).length<((state.mode??'duel')==='duel'?2:1)||me?.playing===false||me?.abandoned)return false;
 return (state.mode??'duel')==='duel'?state.players.length===2&&state.players.every(availablePlayer):true;
}
export function wonOnline(state:MatchState,id:string){return state.winningIds?state.winningIds.includes(id):state.winner===id;}
export const ONLINE_MODES:OnlineMode[]=['duel','ffa','team'];
export function createNetworkGame(saved?:MatchState,map:MapId='harbor',options:NetworkOptions={}){
 const mapId=saved?.map==='factory'||!saved&&map==='factory'?'factory':'harbor',mode=saved?.mode??options.mode??'duel';
 const world=mapId==='factory'?createWorld('factory'):harborWorld;
 const state:MatchState=saved?structuredClone(saved):{players:[],winner:'',tick:0,events:[],pickups:options.randomPickups?createMatchPickups(world):createPickups()};
 if(!saved&&options.waitingRoom)state.phase='waiting';state.map=mapId;state.mode=mode;state.capacity=mode==='duel'?2:20;state.teamScores??=[0,0];state.projectiles??=[];state.toolEvents??=[];state.pickups??=createMatchPickups(world);state.doors??=world.createDoors();
 const pingAt=new Map<string,number>();state.pings=[];
 const inputs=new Map<string,{command:Command;at:number}>();let now=0,eventId=state.tick*1000;
 const id=()=>++eventId;
 const spawn=(p:Player,index:number,respawn=false)=>{const point=respawn||mode!=='duel'?world.randomOutdoorSpawn(state.players.filter(o=>o!==p&&o.health>0&&o.playing!==false)):{x:0,z:index===0?-8:18};p.x=point.x;p.z=point.z;p.y=0;p.fallSpeed=0;p.stance='stand';p.protection=respawn||mode!=='duel'?3:0;p.yaw=index===0?0:Math.PI;p.pitch=0;p.health=100;p.dead=0;p.jump=createJump();p.dash=createDash();p.weaponId=p.startWeapon;p.inventory=createInventory(p.startWeapon);p.weapon=createWeapon(WEAPONS[p.weaponId]);p.cooldown=0;p.gear=createGear();p.flash=0;p.healing=0;p.gearCooldown=0;};
 for(const p of state.players){p.connected=false;p.weapon=cancelBurst(p.weapon);p.dash=cancelDash(p.dash??createDash());p.startWeapon??=p.weaponId;p.inventory??=createInventory(p.weaponId);p.gear??=createGear();p.healing=0;p.flash??=0;p.gearCooldown??=0;p.deaths??=0;p.totalKills??=p.kills;syncSlot(p.inventory,p.weapon,p.cooldown);}
 function finish(winner:string,members:string[]){state.winner=winner;state.winningIds=members;for(const p of state.players)p.healing=0;}
 function scoreWin(p:Player){if(mode==='team')finish('team:'+p.team,state.players.filter(o=>o.team===p.team&&o.participated!==false).map(o=>o.id));else finish(p.id,[p.id]);}
 function hurt(target:Player,amount:number,owner:string){if(target.health<=0||(target.protection??0)>0||state.winner||target.playing===false)return;target.health=Math.max(0,target.health-amount);target.healing=0;if(target.health>0)return;target.deaths++;target.dead=3;target.dash=cancelDash(target.dash??createDash());target.gear=createGear();const killer=state.players.find(p=>p.id===owner);if(!killer||killer===target||(killer.team!==undefined&&killer.team===target.team))return;killer.kills++;killer.totalKills++;if(killer.team!==undefined){state.teamScores![killer.team]++;if(state.teamScores![killer.team]!>=30)scoreWin(killer);}else if(killer.kills>=10)scoreWin(killer);}
 const api={state,
  join(playerId:string,weapon:unknown='pistol',character:unknown='robot',identity?:{nickname:string;guest:boolean}){
   const existing=state.players.find(p=>p.id===playerId);if(existing){if(existing.abandoned)throw Error('재접속 시간이 지났습니다.');existing.connected=true;state.hostId??=existing.id;inputs.delete(playerId);return existing;}
   if(state.players.length>=state.capacity!||state.winner)throw Error('방이 가득 찼거나 경기가 끝났습니다.');
   const team=mode==='team'?(state.players.filter(p=>p.team===0).length<=state.players.filter(p=>p.team===1).length?0:1):undefined;
   const p:Player={id:playerId,x:0,z:0,yaw:0,pitch:0,health:100,kills:0,totalKills:0,deaths:0,dead:0,weaponId:isWeaponId(weapon)?weapon:'pistol',weapon:createWeapon(WEAPONS.pistol),jump:createJump(),cooldown:0,connected:true,character:character==='welder'?'welder':character==='robot-cat'?'robot-cat':'robot',seq:-1,startWeapon:isWeaponId(weapon)?weapon:'pistol',inventory:createInventory(isWeaponId(weapon)?weapon:'pistol'),gear:createGear(),flash:0,healing:0,gearCooldown:0,team,playing:state.phase?false:true,participated:state.phase?false:true,nickname:identity?.nickname,guest:identity?.guest};
   spawn(p,state.players.length);state.players.push(p);state.hostId??=p.id;return p;
  },
  checkpoint(){const saved=structuredClone(state);for(const p of saved.players)if(p.guest)delete p.nickname;return saved;},
  startMatch(playerId:string){if(state.phase!=='waiting'||state.hostId!==playerId)return false;const host=state.players.find(p=>p.id===playerId);if(!host?.connected||host.guest&&!normalizeNickname(host.nickname))return false;const players=state.players.filter(p=>p.connected&&!p.abandoned&&(!p.guest||!!normalizeNickname(p.nickname)));if(players.length<(mode==='duel'?2:1))return false;state.phase='playing';state.started=true;inputs.clear();for(const p of players){p.playing=true;p.participated=true;}for(const p of players)spawn(p,state.players.indexOf(p));return true;},
  deploy(playerId:string){const p=state.players.find(p=>p.id===playerId);if(state.phase!=='playing'||state.winner||!p?.connected||p.abandoned||p.playing!==false||p.guest&&!normalizeNickname(p.nickname))return false;p.playing=true;p.participated=true;spawn(p,state.players.indexOf(p),true);inputs.delete(p.id);return true;},
  leaveWaiting(playerId:string){if(state.phase!=='waiting')return false;const index=state.players.findIndex(p=>p.id===playerId);if(index<0)return false;state.players.splice(index,1);inputs.delete(playerId);if(state.hostId===playerId)state.hostId=state.players.find(p=>p.connected)?.id??state.players[0]?.id;state.players.forEach((p,i)=>{if(mode==='team')p.team=i%2;spawn(p,i);});return true;},
  setGuestNickname(playerId:string,value:unknown){const p=state.players.find(p=>p.id===playerId),name=normalizeNickname(value);if(!p?.connected||!p.guest||!name)return false;p.nickname=name;if(!state.hostId)state.hostId=p.id;return true;},
  disconnect(playerId:string){const p=state.players.find(p=>p.id===playerId);if(p){p.connected=false;if(p.guest)delete p.nickname;if(state.phase==='waiting'&&state.hostId===p.id)state.hostId=state.players.find(o=>o!==p&&o.connected&&!o.abandoned)?.id;p.healing=0;p.weapon=cancelBurst(p.weapon);p.dash=cancelDash(p.dash??createDash());}inputs.delete(playerId);},
  abandon(playerId:string){const p=state.players.find(p=>p.id===playerId);if(p){p.abandoned=true;p.connected=false;if(p.guest)delete p.nickname;p.healing=0;}inputs.delete(playerId);},
  input(playerId:string,raw:unknown){const c=parseCommand(raw),p=state.players.find(p=>p.id===playerId);if(!c||!p?.connected||p.abandoned||state.phase==='waiting'||p.playing===false||p.guest&&!normalizeNickname(p.nickname)||c.seq<=Math.max(p.seq,inputs.get(playerId)?.command.seq??-1))return false;const old=inputs.get(playerId)?.command;c.shot ||=old?.shot??false;c.reload ||=old?.reload??false;c.jump ||=old?.jump??false;c.dash ||=old?.dash??false;c.door??=old?.door;c.slot??=old?.slot;if(c.pickup===undefined){c.pickup=old?.pickup;c.replace=old?.replace;}c.equipment??=old?.equipment;c.ping??=old?.ping;inputs.set(playerId,{command:c,at:options.clock?options.clock()/1000:now});return true;},
  step(){const dt=.05;now+=dt;const inputTime=options.clock?options.clock()/1000:now;state.tick++;state.pings=state.pings!.filter(p=>p.expires>state.tick);state.events=[];state.toolEvents=[];
   if(!onlinePlaying(state)){inputs.clear();return;}state.started=true;tickPickups(state.pickups,dt);
   for(const [index,p] of state.players.entries()){
    if(!availablePlayer(p))continue;const entry=inputs.get(p.id),c=entry&&inputTime-entry.at<.3?entry.command:empty();
    if(entry)p.seq=entry.command.seq;
    if(p.health===0){inputs.delete(p.id);p.dead=Math.max(0,p.dead-dt);if(p.dead<1e-8)spawn(p,index,true);continue;}p.protection=Math.max(0,(p.protection??0)-dt);
    if(c.ping&&mode==='team'&&p.team!==undefined&&state.tick-(pingAt.get(p.id)??-1000)>=30){state.pings=state.pings!.filter(q=>q.player!==p.id);state.pings.push({kind:c.ping.kind,x:c.ping.x,z:c.ping.z,player:p.id,team:p.team,expires:state.tick+120});pingAt.set(p.id,state.tick);}c.ping=undefined;
    if(c.door)world.toggleDoor(state.doors!,c.door,p,state.players.filter(o=>o.health>0&&o.playing!==false));if(entry&&inputTime-entry.at<.3){p.yaw=c.yaw;p.pitch=c.pitch;}
    syncSlot(p.inventory,p.weapon,p.cooldown);advanceStowed(p.inventory,dt,true);if(c.slot!==undefined)switchSlot(p.inventory,c.slot);if(c.pickup){const pickup=state.pickups.find(x=>x.id===c.pickup);if(pickup?.equipmentId)takeEquipmentPickup(p.gear,p,state.pickups,c.pickup);else takePickup(p.inventory,p,state.pickups,c.pickup,c.replace);}
    const slot=p.inventory.slots[p.inventory.active]!;p.weaponId=slot.id;p.weapon=slot.weapon;p.cooldown=slot.cooldown;const spec=WEAPONS[p.weaponId];if(c.reload){const next=beginReload(p.weapon,spec);if(next!==p.weapon)p.weapon=cancelBurst(next);}if(c.equipment)useEquipment(p,c.equipment,state.projectiles!,id());
    c.stance??=p.stance??'stand';p.stance=c.stance;const sequence=advanceBurst(p.weapon,dt);p.weapon=sequence.state;Object.assign(p,advancePlayerMotion(p,c,dt,state.doors,world));
    if(sequence.due>0||((c.shot||(c.fire&&spec.automatic))&&p.cooldown<1e-8)){const attempt=tryFire(p.weapon);p.weapon=attempt.state;if(attempt.fired){if((p.y??0)>=3.35)p.revealedUntil=state.tick+80;p.healing=0;p.protection=0;if(!sequence.due){p.cooldown=Math.max(0,spec.interval-(spec.automatic?(p.weapon.cadenceCarry??0):0));p.weapon=startBurst(p.weapon,spec);}const origin=[p.x,(stanceStats(p.stance).eye-(p.character==='robot-cat'?.05:0))+(p.y??0)+p.jump.height,p.z];
     if(p.weaponId==='bazooka'){launchRocket(p,state.projectiles!,id(),spec.damage);state.events.push({elevated:(p.y??0)>=3.35,id:id(),player:p.id,weapon:p.weaponId,from:{x:origin[0]!,y:origin[1]!,z:origin[2]!},to:{x:p.x+Math.sin(p.yaw)*2,y:origin[1]!-Math.sin(p.pitch)*2,z:p.z+Math.cos(p.yaw)*2},hit:false,killed:false});}else for(const offset of pelletOffsets(spec)){const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch);let d=[sy*cp+cy*offset.x+sy*sp*offset.y,-sp+cp*offset.y,cy*cp-sy*offset.x+cy*sp*offset.y];const len=Math.hypot(...d);d=d.map(v=>v/len);const wall=wallDistance(origin,d,state.doors,world);let target:Player|undefined,range=wall;
      for(const foe of state.players){if(foe===p||foe.health<=0||!availablePlayer(foe))continue;const t=actorHit(origin,d,foe);if(t<range){range=t;target=foe;}}
      const hit=!!target&&(target.protection??0)<=0&&(p.team===undefined||target.team!==p.team);const headDistance=target?actorHit(origin,d,target,true):Infinity;const headshot=!!hit&&headDistance<wall;const before=target?.deaths??0;if(hit)hurt(target!,rangedDamage(p.weaponId,spec.damage,range)*(headshot?1.5:1),p.id);state.events.push({elevated:(p.y??0)>=3.35,id:id(),player:p.id,weapon:p.weaponId,from:{x:origin[0]!,y:origin[1]!,z:origin[2]!},to:{x:origin[0]!+d[0]!*range,y:origin[1]!+d[1]!*range,z:origin[2]!+d[2]!*range},hit,killed:hit&&target!.deaths>before,target:target?.id,headshot,protected:!!target&&(target.protection??0)>0&&(p.team===undefined||target.team!==p.team)});if(state.winner)break;
     }
    }}syncSlot(p.inventory,p.weapon,p.cooldown);c.door=undefined;c.shot=false;c.reload=false;c.jump=false;c.dash=false;c.slot=undefined;c.pickup=undefined;c.replace=undefined;c.equipment=undefined;if(state.winner)break;
   }
   if(!state.winner)state.toolEvents=advanceEquipment(state.players.filter(availablePlayer),state.projectiles!,dt,world,state.doors!,(target,amount,owner)=>hurt(target as Player,amount,owner),id);
  },
 };
 return api;
}
