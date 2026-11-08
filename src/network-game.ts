import {createDash,beginDash,advanceDash,cancelDash,type DashState} from './dash.ts';
import {createInventory,createPickups,syncSlot,advanceStowed,switchSlot,takePickup,tickPickups,type Inventory,type Pickup} from './inventory.ts';
import { moveWithCollisions,normalized,PROTOTYPE,createDoors,worldSolids,shotBoxes,toggleDoor,randomOutdoorSpawn,type Doors,type Point } from './world.ts';
import { WEAPONS,pelletOffsets,isWeaponId,startBurst,advanceBurst,cancelBurst,type WeaponId } from './weapons.ts';
import { createWeapon,beginReload,tryFire,type WeaponState } from './combat.ts';
import { createJump,beginJump,advanceJump,type JumpState } from './jump.ts';
import { viewMovement } from './view.ts';
export type Player = {id:string;y?:number;protection?:number;x:number;z:number;yaw:number;pitch:number;health:number;kills:number;dead:number;weaponId:WeaponId;weapon:WeaponState;jump:JumpState;cooldown:number;connected:boolean;character:'robot'|'robot-cat';seq:number;startWeapon:WeaponId;inventory:Inventory;dash?:DashState};
export type Command={seq:number;x:number;y:number;yaw:number;pitch:number;fire:boolean;shot:boolean;reload:boolean;jump:boolean;sprint:boolean;scope:boolean;door?:string;dash?:boolean;slot?:number;pickup?:string;replace?:number};
export type ShotEvent={id:number;player:string;weapon:WeaponId;from:{x:number;y:number;z:number};to:{x:number;y:number;z:number};hit:boolean;killed:boolean};
export type MatchState={doors?:Doors;players:Player[];winner:string;tick:number;events:ShotEvent[];pickups:Pickup[]};
const empty=():Command=>({seq:-1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false});
export function parseCommand(v:unknown):Command|null{
 if(!v||typeof v!=='object')return null;const p=v as Record<string,unknown>;
 if(!['seq','x','y','yaw','pitch'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))return null;
 if(!Number.isSafeInteger(p.seq)||Number(p.seq)<0||Math.abs(Number(p.x))>1||Math.abs(Number(p.y))>1||Math.abs(Number(p.pitch))>1.2||Math.abs(Number(p.yaw))>Math.PI*2)return null;
 if(!['fire','shot','reload','jump','sprint','scope'].every(k=>typeof p[k]==='boolean'))return null;
 if(p.door!==undefined&&(typeof p.door!=='string'||p.door.length>40))return null;
 if(p.dash!==undefined&&typeof p.dash!=='boolean')return null;
 if(p.slot!==undefined&&(!Number.isInteger(p.slot)||Number(p.slot)<0||Number(p.slot)>2))return null;
 if(p.replace!==undefined&&(!Number.isInteger(p.replace)||Number(p.replace)<0||Number(p.replace)>2))return null;
 if(p.pickup!==undefined&&(typeof p.pickup!=='string'||p.pickup.length>40))return null;
 return p as unknown as Command;
}
export function moveNetworkPlayer(p:Pick<Player,'x'|'z'|'y'|'health'|'weapon'|'cooldown'>,c:Omit<Command,'seq'>,dt:number,doors?:Doors){
 if(p.health<=0)return {x:p.x,z:p.z,y:p.y};
 const n=normalized(c.x,c.y),m=viewMovement(c.yaw,n.x,n.y),running=c.sprint&&n.y>0&&!c.fire&&!c.shot&&!c.scope&&p.weapon.reloadRemaining===0&&p.cooldown===0;
 return moveWithCollisions(p,{x:m.x*PROTOTYPE.speed*(running?1.5:1)*dt,z:m.z*PROTOTYPE.speed*(running?1.5:1)*dt},worldSolids(doors));
}
// Shared with prediction: only a server snapshot with dash state enables the feature.
export function advancePlayerMotion(p:Pick<Player,'x'|'z'|'y'|'health'|'weapon'|'cooldown'>&Partial<Pick<Player,'dash'|'jump'>>,c:Omit<Command,'seq'>,dt:number,doors?:Doors){
 let dash=p.dash,jump=p.jump??createJump();
 if(p.health<=0)return {x:p.x,z:p.z,y:p.y,jump,dash:dash?cancelDash(dash):undefined};
 if(dash&&c.dash)dash=beginDash(dash,{x:c.x,y:c.y,yaw:c.yaw,grounded:jump.height===0&&jump.velocity===0,canAct:true});
 if(c.jump&&(!dash||dash.remaining===0))jump=beginJump(jump);jump=advanceJump(jump,dt);
 let position:Point={x:p.x,z:p.z,y:p.y},walkTime=dt;
 if(dash){const result=advanceDash(dash,dt);dash=result.state;position=moveWithCollisions(position,result.delta,worldSolids(doors));walkTime-=result.activeSeconds;}
 if(walkTime>1e-8)position=moveNetworkPlayer({...p,...position},c,walkTime,doors);
 return {...position,jump,dash};
}
function rayBox(o:number[],d:number[],min:number[],max:number[]):number{
 let near=0,far=150;for(let i=0;i<3;i++){if(Math.abs(d[i]!)<1e-9){if(o[i]!<min[i]!||o[i]!>max[i]!)return Infinity;continue;}
 let a=(min[i]!-o[i]!)/d[i]!,b=(max[i]!-o[i]!)/d[i]!;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return near;
}
function wallDistance(origin:number[],direction:number[],doors?:Doors){let result=150;
 for(const r of shotBoxes(doors))result=Math.min(result,rayBox(origin,direction,[r.x-r.width/2,r.yMin??0,r.z-r.depth/2],[r.x+r.width/2,r.yMax??20,r.z+r.depth/2]));
 return result;
}
export function createNetworkGame(saved?:MatchState){
 const state:MatchState=saved?structuredClone(saved):{players:[],winner:'',tick:0,events:[],pickups:createPickups()};
 state.pickups??=createPickups();state.doors??=createDoors();
 const inputs=new Map<string,{command:Command;at:number}>();let now=0,eventId=state.tick*10;
 for(const p of state.players){p.connected=false;p.weapon=cancelBurst(p.weapon);p.dash=cancelDash(p.dash??createDash());p.startWeapon??=p.weaponId;p.inventory??=createInventory(p.weaponId);syncSlot(p.inventory,p.weapon,p.cooldown);}
 const spawn=(p:Player,index:number,respawn=false)=>{const point=respawn?randomOutdoorSpawn(state.players.filter(o=>o!==p&&o.health>0)):{x:0,z:index===0?-8:18};p.x=point.x;p.z=point.z;p.y=0;p.protection=respawn?3:0;p.yaw=index===0?0:Math.PI;p.pitch=0;p.health=100;p.dead=0;p.jump=createJump();p.dash=createDash();p.weaponId=p.startWeapon;p.inventory=createInventory(p.startWeapon);p.weapon=createWeapon(WEAPONS[p.weaponId]);p.cooldown=0;};
 return {state,
  join(id:string,weapon:unknown='pistol',character:unknown='robot'){
   const existing=state.players.find(p=>p.id===id);if(existing){existing.connected=true;inputs.delete(id);return existing;}
   if(state.players.length>=2||state.winner)throw new Error('방이 가득 찼습니다.');
   const p:Player={id,x:0,z:0,yaw:0,pitch:0,health:100,kills:0,dead:0,weaponId:isWeaponId(weapon)?weapon:'pistol',weapon:createWeapon(WEAPONS.pistol),jump:createJump(),cooldown:0,connected:true,character:character==='robot-cat'?'robot-cat':'robot',seq:-1,startWeapon:isWeaponId(weapon)?weapon:'pistol',inventory:createInventory(isWeaponId(weapon)?weapon:'pistol')};
   spawn(p,state.players.length);state.players.push(p);return p;
  },
  disconnect(id:string){const p=state.players.find(p=>p.id===id);if(p){p.connected=false;p.weapon=cancelBurst(p.weapon);p.dash=cancelDash(p.dash??createDash());}inputs.delete(id);},
  input(id:string,raw:unknown){const command=parseCommand(raw),p=state.players.find(p=>p.id===id);if(!command||!p?.connected||command.seq<=p.seq)return false;p.seq=command.seq;
   const old=inputs.get(id)?.command;command.shot ||=old?.shot??false;command.reload ||=old?.reload??false;command.jump ||=old?.jump??false;command.dash ||=old?.dash??false;if(command.door===undefined)command.door=old?.door;if(command.slot===undefined)command.slot=old?.slot;if(command.pickup===undefined){command.pickup=old?.pickup;command.replace=old?.replace;}inputs.set(id,{command,at:now});return true;},
  step(){const dt=.05;now+=dt;state.tick++;state.events=[];
   if(state.winner||state.players.length!==2||state.players.some(p=>!p.connected)){inputs.clear();return;}
   tickPickups(state.pickups,dt);
   for(const [index,p] of state.players.entries()){
    const entry=inputs.get(p.id),c=entry&&now-entry.at<.3?entry.command:empty();
    if(p.health===0){p.weapon=cancelBurst(p.weapon);p.dead=Math.max(0,p.dead-dt);if(p.dead<1e-8)spawn(p,index,true);continue;}
    p.protection=Math.max(0,(p.protection??0)-dt);
    if(c.door)toggleDoor(state.doors!,c.door,p,state.players.filter(o=>o.health>0));
    if(entry&&now-entry.at<.3){p.yaw=c.yaw;p.pitch=c.pitch;}
    syncSlot(p.inventory,p.weapon,p.cooldown);advanceStowed(p.inventory,dt,true);
    if(c.slot!==undefined)switchSlot(p.inventory,c.slot);
    if(c.pickup)takePickup(p.inventory,p,state.pickups,c.pickup,c.replace);
    const active=p.inventory.slots[p.inventory.active]!;p.weaponId=active.id;p.weapon=active.weapon;p.cooldown=active.cooldown;
    const spec=WEAPONS[p.weaponId];
    if(c.reload){const next=beginReload(p.weapon,spec);if(next!==p.weapon)p.weapon=cancelBurst(next);}
    const sequence=advanceBurst(p.weapon,dt);p.weapon=sequence.state;
    Object.assign(p,advancePlayerMotion(p,c,dt,state.doors));
    if(sequence.due>0||((c.shot||(c.fire&&spec.automatic))&&p.cooldown<1e-8)){const attempt=tryFire(p.weapon);p.weapon=attempt.state;if(attempt.fired){p.protection=0;if(!sequence.due){p.cooldown=Math.max(0,spec.interval-(p.weaponId==='smg'?(p.weapon.cadenceCarry??0):0));p.weapon=startBurst(p.weapon,spec);}
     const foe=state.players[1-index]!,origin=[p.x,(p.character==='robot-cat'?1.9:1.95)+(p.y??0)+p.jump.height,p.z];
     for(const offset of pelletOffsets(spec)){
      const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch);
      let direction=[sy*cp+cy*offset.x+sy*sp*offset.y,-sp+cp*offset.y,cy*cp-sy*offset.x+cy*sp*offset.y];const length=Math.hypot(...direction);direction=direction.map(v=>v/length);
      const wall=wallDistance(origin,direction,state.doors),target=foe.health>0?rayBox(origin,direction,[foe.x-.55,(foe.y??0)+foe.jump.height,foe.z-.55],[foe.x+.55,(foe.y??0)+foe.jump.height+2.5,foe.z+.55]):Infinity;
      const hit=target<wall&&(foe.protection??0)<=0,range=Math.min(wall,target);let killed=false;
      if(hit){foe.health=Math.max(0,foe.health-spec.damage);if(foe.health===0){foe.dead=3;foe.dash=cancelDash(foe.dash??createDash());p.kills++;killed=true;if(p.kills>=10)state.winner=p.id;}}
      state.events.push({id:++eventId,player:p.id,weapon:p.weaponId,from:{x:origin[0]!,y:origin[1]!,z:origin[2]!},to:{x:origin[0]!+direction[0]!*range,y:origin[1]!+direction[1]!*range,z:origin[2]!+direction[2]!*range},hit,killed});
     }
    }}
    syncSlot(p.inventory,p.weapon,p.cooldown);c.door=undefined;c.shot=false;c.reload=false;c.jump=false;c.dash=false;c.slot=undefined;c.pickup=undefined;c.replace=undefined;
   }
  },
 };
}
