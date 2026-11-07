import { moveWithCollisions,PROTOTYPE } from './world.ts';
import type { MatchState,Player } from './network-game.ts';
// A bounded display estimate; never fed back into server hit or movement validation.
export function createRemoteMotion(){
 let player:Player|null=null,tick=0,received=0,vx=0,vz=0;
 return {
  reset(){player=null;vx=vz=0;},
  receive(state:MatchState,id:string,now:number){
   const next=state.players.find(p=>p.id!==id);if(!next){player=null;return;}
   const gap=state.tick-tick,canEstimate=player&&player.id===next.id&&player.health>0&&next.health>0&&state.players.every(p=>p.connected)&&!state.winner&&gap>0&&gap<=6;
   vx=canEstimate?(next.x-player!.x)/(gap*.05):0;vz=canEstimate?(next.z-player!.z)/(gap*.05):0;
   const speed=Math.hypot(vx,vz),limit=PROTOTYPE.speed*1.5;if(speed>limit){vx=vz=0;}
   player=next;tick=state.tick;received=now;
  },
  sample(now:number,rttMs:number|null){
   if(!player)return undefined;
   const age=Math.max(0,now-received),horizon=age>300?0:Math.min(.15,(age+Math.max(0,rttMs??0)/2)/1000);
   const p=moveWithCollisions(player,{x:vx*horizon,z:vz*horizon});return {...p,id:player.id};
  },
 };
}
