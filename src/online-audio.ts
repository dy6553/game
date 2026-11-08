import {onlinePlaying,type MatchState,type Player} from './network-game.ts';
import {spatialSound,type Sound} from './audio.ts';
export type AudioCue={kind:Sound;pan:number;volume:number};
type Baseline={tick:number;id:string;me:Player;connected:boolean;eventId:number};
// Snapshots are mutable in local tests: retain only an owned baseline, never the live object.
export function createOnlineAudio(){
 let previous:Baseline|undefined,footDistance=0,alternate=false;
 return {reset(){previous=undefined;footDistance=0;alternate=false;},update(state:MatchState,id:string,yaw:number,audible:boolean):AudioCue[]{
  const me=state.players.find(p=>p.id===id);if(!me){previous=undefined;footDistance=0;return [];}
  if(previous&&previous.id===id&&state.tick<=previous.tick)return [];
  const old=previous,connected=onlinePlaying(state,id);
  const eventId=Math.max(old?.eventId??-1,...state.events.map(e=>e.id));
  previous={tick:state.tick,id,me:structuredClone(me),connected,eventId};
  if(!old||old.id!==id||!audible||!connected||!old.connected){footDistance=0;return [];}
  const cues:AudioCue[]=[],cue=(kind:Sound)=>cues.push({kind,pan:0,volume:1});
  // A server tick can contain several shotgun pellets, but only one blast per shooter.
  const groups=new Map<string,typeof state.events>();
  for(const event of state.events)if(event.id>old.eventId){const key=event.player+':'+event.weapon;const group=groups.get(key)??[];group.push(event);groups.set(key,group);}
  for(const events of groups.values()){
   const event=events[0]!,own=event.player===id;
   const spatial=own?{pan:0,gain:1}:spatialSound(event.from.x-me.x,event.from.z-me.z,yaw);
   cues.push({kind:event.weapon,pan:spatial.pan,volume:spatial.gain});
   if(own&&events.some(e=>e.hit))cue(events.some(e=>e.killed)?'kill':'hit');
  }
  const before=old.me;
  if(me.health===0&&before.health>0){cue('death');footDistance=0;return cues;}
  if(me.health>0&&before.health===0){cue('respawn');footDistance=0;return cues;}
  if(me.health<=0)return cues;
  if(me.health<before.health)cue('hurt');
  const inventory=me.inventory.slots.map(s=>s.id).join(','),wasInventory=before.inventory.slots.map(s=>s.id).join(',');
  if(inventory!==wasInventory)cue('pickup');else if(me.weaponId!==before.weaponId)cue('equip');
  // Switching slots must not sound like a completed or newly started reload.
  if(me.weaponId===before.weaponId&&inventory===wasInventory){
   if(me.weapon.reloadRemaining>0&&before.weapon.reloadRemaining===0)cue('reload');
   if(me.weapon.reloadRemaining===0&&before.weapon.reloadRemaining>0&&me.weapon.ammo>before.weapon.ammo)cue('ready');
  }
  if((me.dash?.cooldown??0)>(before.dash?.cooldown??0)+.1)cue('dash');
  if(me.jump.height>0&&before.jump.height===0)cue('jump');
  if(me.jump.height===0&&before.jump.height>0)cue('land');
  const walked=Math.hypot(me.x-before.x,me.z-before.z),dashing=(me.dash?.remaining??0)>0||(before.dash?.remaining??0)>0;
  // Discontinuities are reconnects/teleports, never footsteps. Gaps establish a fresh baseline.
  if(state.tick-old.tick>4||walked>4||dashing||me.jump.height>0||before.jump.height>0)footDistance=0;
  else {footDistance+=walked;if(footDistance>=2.2){footDistance%=2.2;alternate=!alternate;cue(alternate?'step':'step2');}}
  return cues;
 }};
}
