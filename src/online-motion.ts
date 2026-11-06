import { moveNetworkPlayer,type Command,type MatchState,type Player } from './network-game.ts';
type Move=Omit<Command,'seq'>;
type Point={x:number;z:number};
// Only presentation is predicted. Health, ammo, hits, kills and the canonical position remain server owned.
export function createOnlineMotion(onCorrection:(meters:number)=>void=()=>{}){
 let me:Player|null=null,position:Point={x:0,z:0},offset:Point={x:0,z:0},active=false,age=0;
 let pending:{seq:number;command:Move}[]=[];
 function snap(p:Player){position={x:p.x,z:p.z};offset={x:0,z:0};pending=[];}
 return {
  reset(){me=null;active=false;pending=[];offset={x:0,z:0};age=0;},
  receive(state:MatchState,id:string){
   const next=state.players.find(p=>p.id===id);if(!next)return;
   const playing=!state.winner&&state.players.length===2&&state.players.every(p=>p.connected)&&next.health>0;
   const discontinuity=!me||me.id!==id||!active||!playing||(me.health===0)!==(next.health===0)||age>.5;
   pending=pending.filter(p=>p.seq>next.seq);
   if(discontinuity){snap(next);}else{
    let target:Point={x:next.x,z:next.z};
    for(const p of pending)target=moveNetworkPlayer({...next,...target},p.command,.05);
    const distance=Math.hypot(target.x-position.x,target.z-position.z);onCorrection(distance);
    if(distance>3){snap(next);}else{
     offset.x+=position.x-target.x;offset.z+=position.z-target.z;position=target;
    }
   }
   me=next;active=playing;age=0;
  },
  sent(seq:number,command:Move){if(active){pending.push({seq,command:{...command}});if(pending.length>40)pending.shift();}},
  advance(dt:number,command:Move,connected=true):Point{
   const elapsed=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.1));age+=elapsed;
   if(me){
    if(!connected||age>.5){snap(me);active=false;}
    else if(active){let remaining=elapsed;while(remaining>1e-8){const step=Math.min(remaining,.025);position=moveNetworkPlayer({...me,...position},command,step);remaining-=step;}}
   }
   const decay=Math.exp(-elapsed*18);offset.x*=decay;offset.z*=decay;
   return {x:position.x+offset.x,z:position.z+offset.z};
  },
 };
}
