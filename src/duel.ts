import { canStand, moveWithCollisions, PROTOTYPE, type Point } from './world.ts';
import { createWeapon, advanceWeapon, beginReload, tryFire, PRACTICE_RULES } from './combat.ts';
export const DUEL_RULES = Object.freeze({health:100,damage:25,aimSeconds:1,fireSeconds:0.8,respawnSeconds:3,goal:10,warningSeconds:0.4});
export const BOT_SPAWN:Point={x:0,z:18};
// Grid routing uses the same collision geometry and radius as player movement.
const step=2;
function clearSegment(a:Point,b:Point){
  const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/0.2);
  for(let i=0;i<=n;i++){const t=n?i/n:0;if(!canStand({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},PROTOTYPE.radius))return false;}
  return true;
}
export function findRoute(start:Point,goal:Point):Point[]{
  if(!canStand(start,PROTOTYPE.radius)||!canStand(goal,PROTOTYPE.radius))return [];
  if(clearSegment(start,goal))return [{...goal}];
  const key=(p:Point)=>`${p.x},${p.z}`;
  const nearest=(p:Point)=>{
    const candidates:Point[]=[];
    const x=Math.round(p.x/step)*step,z=Math.round(p.z/step)*step;
    for(let dx=-step;dx<=step;dx+=step)for(let dz=-step;dz<=step;dz+=step)candidates.push({x:x+dx,z:z+dz});
    return candidates.filter(c=>canStand(c,PROTOTYPE.radius)&&clearSegment(p,c)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  };
  const first=nearest(start),last=nearest(goal);if(!first||!last)return [];
  const queue=[first],parents=new Map<string,Point|null>([[key(first),null]]);
  for(let i=0;i<queue.length;i++){
    const p=queue[i]!;
    if(key(p)===key(last)){
      const path:Point[]=[goal];let current:Point|null=p;
      while(current){path.push(current);current=parents.get(key(current))??null;}return path.reverse();
    }
    for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
      const next={x:p.x+dx!,z:p.z+dz!};
      if(!parents.has(key(next))&&canStand(next,PROTOTYPE.radius)&&clearSegment(p,next)){parents.set(key(next),p);queue.push(next);}
    }
  }
  return [];
}
export function createDuel(){
  let playerHealth=100,botHealth=100,playerKills=0,botKills=0,playerDead=0,botDead=0;
  let position={...BOT_SPAWN},aim=0,cooldown=0,repath=0,route:Point[]=[],respawnVersion=0;
  let locked:Point|null=null,warning=0,damageVersion=0;
  let botWeapon=createWeapon(PRACTICE_RULES);
  let winner:''|'player'|'bot'='';
  function hurt(who:'player'|'bot',damage:number=DUEL_RULES.damage){
    if(!Number.isFinite(damage)||damage<0)throw new Error('Invalid damage');
    if(winner||playerHealth===0||botHealth===0)return false;
    if(who==='bot'){
      botHealth=Math.max(0,botHealth-damage);
      if(botHealth===0){playerKills++;botDead=3;aim=0;locked=null;warning=0;if(playerKills===10)winner='player';return true;}
    }else{
      damageVersion++;playerHealth=Math.max(0,playerHealth-damage);
      if(playerHealth===0){botKills++;playerDead=3;aim=0;locked=null;warning=0;if(botKills===10)winner='bot';return true;}
    }
    return false;
  }
  function update(dt:number,player:Point,visible:(p:Point)=>boolean,fire:(p:Point,target:Point)=>boolean|void){
    if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid elapsed time');
    if(winner)return;
    if(playerHealth===0){playerDead=Math.max(0,playerDead-dt);if(playerDead===0){playerHealth=100;respawnVersion++;aim=0;cooldown=1;locked=null;warning=0;}return;}
    if(botHealth===0){botDead=Math.max(0,botDead-dt);if(botDead===0){botHealth=100;position={...BOT_SPAWN};botWeapon=createWeapon(PRACTICE_RULES);aim=0;cooldown=0;repath=0;}return;}
    botWeapon=advanceWeapon(botWeapon,dt,PRACTICE_RULES);cooldown=Math.max(0,cooldown-dt);
    const sees=visible(position),distance=Math.hypot(player.x-position.x,player.z-position.z);
    if(!sees||distance>12){
      repath-=dt;if(repath<=0){route=findRoute(position,player);repath=0.75;}
      const next=route[0];if(next){const dx=next.x-position.x,dz=next.z-position.z,d=Math.hypot(dx,dz);if(d<0.2)route.shift();else{const travel=Math.min(d,3*Math.min(dt,0.05));position=moveWithCollisions(position,{x:dx/d*travel,z:dz/d*travel});}}
    }
    if(!sees||!visible(position)){aim=0;locked=null;warning=0;return;}
    if(locked){
      warning=Math.max(0,warning-dt);
      if(warning===0){
        const target=locked;locked=null;const shot=tryFire(botWeapon);botWeapon=shot.state;
        if(shot.fired){cooldown=DUEL_RULES.fireSeconds;aim=0;
          const clear=fire(position,target)!==false;
          if(clear&&Math.hypot(player.x-target.x,player.z-target.z)<=0.65)hurt('player');
        }
      }
      return;
    }
    aim+=Math.min(dt,0.1);
    if(aim>=DUEL_RULES.aimSeconds&&cooldown===0){
      if(botWeapon.ammo>0&&botWeapon.reloadRemaining===0){locked={...player};warning=DUEL_RULES.warningSeconds;}
      else if(botWeapon.ammo===0)botWeapon=beginReload(botWeapon,PRACTICE_RULES);
    }
  }
  return {hurt,update,state:()=>({playerHealth,botHealth,playerKills,botKills,playerDead,botDead,position:{...position},winner,respawnVersion,aim,warning,locked:locked?{...locked}:null,damageVersion,botAmmo:botWeapon.ammo})};
}
