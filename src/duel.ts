import { canStand, moveWithCollisions, PROTOTYPE, type Point } from './world.ts';
import { createWeapon, advanceWeapon, beginReload, tryFire, PRACTICE_RULES } from './combat.ts';
export const DUEL_RULES = Object.freeze({health:100,damage:25,aimSeconds:1,fireSeconds:0.8,respawnSeconds:3,goal:10,warningSeconds:0.4});
export type BotDifficulty='easy'|'normal'|'hard';
export const BOT_DIFFICULTIES=Object.freeze({
 easy:{name:'쉬움',aimSeconds:1,warningSeconds:.4,speed:3,strafe:false},
 normal:{name:'보통',aimSeconds:.7,warningSeconds:.35,speed:4,strafe:true},
 hard:{name:'어려움',aimSeconds:.45,warningSeconds:.3,speed:5,strafe:true},
});
export function isBotDifficulty(value:unknown):value is BotDifficulty{return value==='easy'||value==='normal'||value==='hard';}
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
type BotProfile={aimSeconds:number;warningSeconds:number;speed:number;strafe:boolean;strafeSpeed?:number};
export function createDuel(difficulty:BotDifficulty='easy',spawnPoint:Point=BOT_SPAWN,override?:BotProfile){
  if(!canStand(spawnPoint,PROTOTYPE.radius))throw new Error('Invalid bot spawn');let respawnPoint={...spawnPoint};
  const selected=isBotDifficulty(difficulty)?difficulty:'easy';const profile:BotProfile=override??BOT_DIFFICULTIES[selected];let strafeDirection=1;
  let playerHealth=100,botHealth=100,playerKills=0,botKills=0,playerDead=0,botDead=0;
  let position={...respawnPoint},aim=0,cooldown=0,repath=0,route:Point[]=[],respawnVersion=0;
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
  function update(dt:number,player:Point,visible:(p:Point)=>boolean,fire:(p:Point,target:Point)=>boolean|void,hasTarget=true){
    if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid elapsed time');
    if(winner)return;
    if(playerHealth===0){playerDead=Math.max(0,playerDead-dt);if(playerDead===0){playerHealth=100;respawnVersion++;aim=0;cooldown=1;locked=null;warning=0;}return;}
    if(botHealth===0){botDead=Math.max(0,botDead-dt);if(botDead===0){botHealth=100;position={...respawnPoint};botWeapon=createWeapon(PRACTICE_RULES);aim=0;cooldown=0;repath=0;}return;}
    botWeapon=advanceWeapon(botWeapon,dt,PRACTICE_RULES);cooldown=Math.max(0,cooldown-dt);
    if(!hasTarget){aim=0;locked=null;warning=0;route=[];repath=0;return;}
    const sees=visible(position),distance=Math.hypot(player.x-position.x,player.z-position.z);
    if((!locked||!profile.strafe)&&(!sees||distance>12)){
      repath-=dt;if(repath<=0){route=findRoute(position,player);repath=0.75;}
      const next=route[0];if(next){const dx=next.x-position.x,dz=next.z-position.z,d=Math.hypot(dx,dz);if(d<0.2)route.shift();else{const travel=Math.min(d,profile.speed*Math.min(dt,0.05));position=moveWithCollisions(position,{x:dx/d*travel,z:dz/d*travel});}}
    }
    if(sees&&distance<=12&&!locked&&profile.strafe&&botWeapon.reloadRemaining===0&&distance>.01){
      const before=position,travel=(profile.strafeSpeed??profile.speed)*Math.min(dt,.05),dx=(player.z-position.z)/distance*strafeDirection,dz=-(player.x-position.x)/distance*strafeDirection;
      position=moveWithCollisions(position,{x:dx*travel,z:dz*travel});
      if(Math.hypot(position.x-before.x,position.z-before.z)<travel*.1)strafeDirection*=-1;
    }
    if(!sees||!visible(position)){aim=0;locked=null;warning=0;return;}
    if(locked){
      warning=Math.max(0,warning-dt);
      if(warning===0){
        const target=locked;locked=null;const shot=tryFire(botWeapon);botWeapon=shot.state;
        if(shot.fired){cooldown=DUEL_RULES.fireSeconds;aim=0;strafeDirection*=-1;
          const clear=fire(position,target)!==false;
          if(clear&&Math.hypot(player.x-target.x,player.z-target.z)<=0.65)hurt('player');
        }
      }
      return;
    }
    aim+=Math.min(dt,0.1);
    if(aim>=profile.aimSeconds&&cooldown===0){
      if(botWeapon.ammo>0&&botWeapon.reloadRemaining===0){locked={...player};warning=profile.warningSeconds;}
      else if(botWeapon.ammo===0)botWeapon=beginReload(botWeapon,PRACTICE_RULES);
    }
  }
  return {hurt,update,setSpawn(p:Point){if(!canStand(p,PROTOTYPE.radius))throw new Error('Invalid bot spawn');respawnPoint={...p};},state:()=>({difficulty:selected,playerHealth,botHealth,playerKills,botKills,playerDead,botDead,position:{...position},winner,respawnVersion,aim,warning,locked:locked?{...locked}:null,damageVersion,botAmmo:botWeapon.ammo})};
}

export const GROUP_SPAWNS:readonly Point[]=[{x:0,z:-8},{x:0,z:18},{x:-24,z:0},{x:24,z:0},{x:0,z:-28},{x:0,z:30},{x:-40,z:-32},{x:40,z:-32},{x:-40,z:30},{x:40,z:30}];
export function distantSpawn(others:readonly Point[]):Point{
 const candidates=GROUP_SPAWNS.filter(p=>canStand(p,PROTOTYPE.radius));
 const score=(p:Point)=>others.length?Math.min(...others.map(o=>Math.hypot(o.x-p.x,o.z-p.z))):0;
 return {...candidates.reduce((best,p)=>score(p)>score(best)?p:best,candidates[0]!)};
}
export function createBotMatch(difficulty:BotDifficulty='easy'){
 const selected=isBotDifficulty(difficulty)?difficulty:'easy';
 const bots=[0,1,2].map(i=>({id:`bot-${i+1}`,name:`봇 ${i+1}`,kills:0,agent:createDuel(selected,GROUP_SPAWNS[i+1]!)}));
 let playerHealth=100,playerKills=0,playerDead=0,respawnVersion=0,damageVersion=0,playerPosition={...GROUP_SPAWNS[0]!},lastAttacker={...BOT_SPAWN};
 let winner:''|'player'|'bot'='',winnerName='';
 function livePositions(except?:string){return [...(playerHealth>0&&except!=='player'?[playerPosition]:[]),...bots.filter(b=>b.id!==except&&b.agent.state().botHealth>0).map(b=>b.agent.state().position)];}
 function hurt(id:string,damage=25){
  const bot=bots.find(b=>b.id===id);if(winner||playerHealth===0||!bot)return false;
  const killed=bot.agent.hurt('bot',damage);if(killed){playerKills++;if(playerKills>=10){winner='player';winnerName='나';}}return killed;
 }
 function hurtPlayer(id:string,damage=25){
  if(!Number.isFinite(damage)||damage<0)throw new Error('Invalid damage');
  const bot=bots.find(b=>b.id===id);if(winner||playerHealth===0||!bot||bot.agent.state().botHealth===0||damage===0)return false;
  damageVersion++;lastAttacker=bot.agent.state().position;playerHealth=Math.max(0,playerHealth-damage);
  if(playerHealth===0){bot.kills++;playerDead=3;if(bot.kills>=10){winner='bot';winnerName=bot.name;}return true;}return false;
 }
 function update(dt:number,p:Point,visible:(from:Point,id?:string)=>boolean,fire:(from:Point,target:Point,id?:string)=>boolean|void){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid elapsed time');if(winner)return;
  const wasDead=playerHealth===0;
  if(wasDead){playerDead=Math.max(0,playerDead-dt);if(playerDead<1e-8){playerHealth=100;playerDead=0;playerPosition=distantSpawn(livePositions('player'));respawnVersion++;}}
  else playerPosition={...p};
  for(const bot of bots){
   if(winner)break;
   const state=bot.agent.state();if(state.botHealth===0&&state.botDead<=dt+1e-8)bot.agent.setSpawn(distantSpawn(livePositions(bot.id)));
   bot.agent.update(dt,playerPosition,from=>visible(from,bot.id),(from,target)=>{
    const clear=fire(from,target,bot.id)!==false;if(clear&&playerHealth>0&&Math.hypot(playerPosition.x-target.x,playerPosition.z-target.z)<=.65)hurtPlayer(bot.id);return false;
   },!wasDead&&playerHealth>0);
  }
 }
 function state(){
  const rows=bots.map(b=>{const s=b.agent.state();return {id:b.id,name:b.name,health:s.botHealth,kills:b.kills,dead:s.botDead,position:s.position,locked:s.locked,warning:s.warning,aim:s.aim,ammo:s.botAmmo};});
  const warning=rows.find(b=>b.health>0&&b.locked),aim=Math.max(...rows.map(b=>b.aim));
  return {mode:'ffa' as const,difficulty:selected,playerHealth,playerKills,playerDead,respawnVersion,damageVersion,playerPosition:{...playerPosition},position:{...lastAttacker},winner,winnerName,bots:rows,botHealth:rows[0]!.health,botKills:Math.max(...rows.map(b=>b.kills)),botDead:0,aim,warning:warning?.warning??0,locked:warning?.locked??null,botAmmo:rows[0]!.ammo};
 }
 return {hurt,hurtPlayer,update,state};
}

// User-approved survival tuning; tests may inject explicit boundary fixtures.
export type SurvivalOptions={prepareSeconds:number;initialEnemies:number;increaseEvery:number;maxEnemies:number;restoreBetweenWaves:boolean};
export const SURVIVAL_RULES:Readonly<SurvivalOptions>=Object.freeze({prepareSeconds:5,initialEnemies:3,increaseEvery:2,maxEnemies:12,restoreBetweenWaves:true});
export type SurvivalDifficulty=BotDifficulty|'auto';
export function isSurvivalDifficulty(value:unknown):value is SurvivalDifficulty{return value==='auto'||isBotDifficulty(value);}
export function createSurvivalMatch(difficulty:SurvivalDifficulty='easy',options:SurvivalOptions=SURVIVAL_RULES){
 if(!Number.isFinite(options.prepareSeconds)||options.prepareSeconds<0||![options.initialEnemies,options.increaseEvery,options.maxEnemies].every(n=>Number.isInteger(n)&&n>0)||options.initialEnemies>options.maxEnemies)throw new Error('Invalid survival options');
 const automatic=difficulty==='auto',adaptive=automatic?createAdaptiveDifficulty({initial:'normal',healthyThreshold:50,clearsToRaise:2,stepsPerTier:4}):null;
 let selected:BotDifficulty=automatic?'normal':isBotDifficulty(difficulty)?difficulty:'easy';const totalWaves=automatic?20:{easy:10,normal:20,hard:30}[selected];
 type Slot={id:string;name:string;agent:ReturnType<typeof createDuel>;delay:number};
 let slots:Slot[]=[],wave=1,lives=3,playerHealth=100,playerKills=0,playerDead=0,respawnVersion=0,damageVersion=0,ammoRefreshVersion=0;
 let phase:'preparing'|'combat'|'respawning'|'won'|'lost'='preparing',prepareRemaining=options.prepareSeconds,spawned=0,defeated=0;
 let playerPosition={...GROUP_SPAWNS[0]!},lastAttacker={...BOT_SPAWN};
 const total=()=>Math.min(options.maxEnemies,options.initialEnemies+Math.floor((wave-1)/options.increaseEvery));
 function spawnWave(){
  if(options.restoreBetweenWaves){playerHealth=100;ammoRefreshVersion++;}phase='combat';spawned=Math.min(3,total());defeated=0;
  const occupied:Point[]=[playerPosition];slots=Array.from({length:spawned},(_,i)=>{let point=GROUP_SPAWNS[i+1]!;if(occupied.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<PROTOTYPE.radius*2))point=distantSpawn(occupied);occupied.push(point);return {id:`bot-${i+1}`,name:`봇 ${i+1}`,agent:createDuel(selected,point,adaptive?adaptiveBotProfile(adaptive.state().stage):undefined),delay:0};});
 }
 function hurt(id:string,damage=25){
  if(!Number.isFinite(damage)||damage<0)throw new Error('Invalid damage');
  const slot=slots.find(b=>b.id===id);if(phase!=='combat'||playerHealth===0||!slot)return false;
  const killed=slot.agent.hurt('bot',damage);if(killed){playerKills++;defeated++;slot.delay=3;
   if(defeated===total()){if(wave===totalWaves){phase='won';}else{if(adaptive){adaptive.completeWave(playerHealth);selected=adaptive.state().difficulty;}wave++;spawned=0;defeated=0;phase='preparing';prepareRemaining=options.prepareSeconds;if(options.restoreBetweenWaves){playerHealth=100;ammoRefreshVersion++;}}}
  }return killed;
 }
 function hurtPlayer(id:string,damage=25){
  if(!Number.isFinite(damage)||damage<0)throw new Error('Invalid damage');const slot=slots.find(b=>b.id===id);
  if(phase!=='combat'||playerHealth===0||!slot||slot.agent.state().botHealth===0||damage===0)return false;
  playerHealth=Math.max(0,playerHealth-damage);damageVersion++;lastAttacker=slot.agent.state().position;
  if(playerHealth===0){lives--;if(lives===0){phase='lost';playerDead=0;}else{phase='respawning';playerDead=3;}return true;}return false;
 }
 function update(dt:number,p:Point,visible:(from:Point,id?:string)=>boolean,fire:(from:Point,target:Point,id?:string)=>boolean|void){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid elapsed time');if(phase==='won'||phase==='lost')return;
  if(phase==='respawning'){playerDead=Math.max(0,playerDead-dt);if(playerDead<1e-8){playerDead=0;if(adaptive){adaptive.retryAfterDeath();selected=adaptive.state().difficulty;}playerHealth=100;respawnVersion++;playerPosition={...GROUP_SPAWNS[0]!};spawnWave();}return;}
  playerPosition={...p};
  if(phase==='preparing'){prepareRemaining=Math.max(0,prepareRemaining-dt);if(prepareRemaining<1e-8){prepareRemaining=0;spawnWave();}return;}
  for(const slot of slots){
   if(phase!=='combat')break;const state=slot.agent.state();
   if(state.botHealth===0){slot.delay=Math.max(0,slot.delay-dt);if(slot.delay<1e-8&&spawned<total()){const others=[playerPosition,...slots.filter(b=>b.id!==slot.id&&b.agent.state().botHealth>0).map(b=>b.agent.state().position)];slot.agent=createDuel(selected,distantSpawn(others),adaptive?adaptiveBotProfile(adaptive.state().stage):undefined);spawned++;}continue;}
   slot.agent.update(dt,playerPosition,from=>visible(from,slot.id),(from,target)=>{const clear=fire(from,target,slot.id)!==false;if(clear&&Math.hypot(playerPosition.x-target.x,playerPosition.z-target.z)<=.65)hurtPlayer(slot.id);return false;});
  }
 }
 function state(){
  const bots=slots.map(b=>{const s=b.agent.state();return {id:b.id,name:b.name,health:s.botHealth,kills:0,dead:b.delay,position:s.position,locked:phase==='combat'?s.locked:null,warning:s.warning,aim:s.aim,ammo:s.botAmmo};});
  const warning=bots.find(b=>b.health>0&&b.locked);
  return {mode:'survival' as const,automatic,adaptiveStage:adaptive?.state().stage??0,difficulty:selected,wave,totalWaves,lives,phase,prepareRemaining,total:total(),spawned,defeated,remaining:total()-defeated,ammoRefreshVersion,
   playerHealth,playerKills,playerDead,respawnVersion,damageVersion,playerPosition:{...playerPosition},position:{...lastAttacker},winner:phase==='won'?'player' as const:phase==='lost'?'bot' as const:'',winnerName:phase==='won'?'생존 성공':phase==='lost'?'생명 소진':'',bots,
   botHealth:bots[0]?.health??0,botKills:3-lives,botDead:0,aim:phase==='combat'?Math.max(0,...bots.map(b=>b.aim)):0,warning:warning?.warning??0,locked:warning?.locked??null,botAmmo:bots[0]?.ammo??0};
 }
 return {hurt,hurtPlayer,update,state};
}

// No application defaults: the caller must supply an approved adaptation policy.
export type AdaptiveDifficultyPolicy={initial:BotDifficulty;healthyThreshold:number;clearsToRaise:number;stepsPerTier?:number};
export function createAdaptiveDifficulty(policy:AdaptiveDifficultyPolicy){
 const subdivisions=policy.stepsPerTier??1;
 if(!Number.isInteger(subdivisions)||subdivisions<1)throw new Error('Invalid adaptation steps');
 if(!isBotDifficulty(policy.initial)||!Number.isFinite(policy.healthyThreshold)||policy.healthyThreshold<0||policy.healthyThreshold>100||!Number.isInteger(policy.clearsToRaise)||policy.clearsToRaise<1)throw new Error('Invalid adaptive difficulty policy');
 const levels:BotDifficulty[]=['easy','normal','hard'];
 const threshold=policy.healthyThreshold,required=policy.clearsToRaise;
 let index=levels.indexOf(policy.initial)*subdivisions,streak=0;
 return {
  completeWave(health:number){
   if(!Number.isFinite(health)||health<0||health>100)throw new Error('Invalid wave health');
   streak=health>=threshold?streak+1:0;
   if(streak>=required){index=Math.min((levels.length-1)*subdivisions,index+1);streak=0;}
  },
  retryAfterDeath(){index=Math.max(0,index-1);streak=0;},
  state:()=>({difficulty:levels[Math.round(index/subdivisions)]!,streak,stage:index+1}),
 };
}

export function adaptiveBotProfile(stage:number):BotProfile{
 if(!Number.isInteger(stage)||stage<1||stage>9)throw new Error('Invalid adaptive stage');
 const low=stage<=5?BOT_DIFFICULTIES.easy:BOT_DIFFICULTIES.normal,high=stage<=5?BOT_DIFFICULTIES.normal:BOT_DIFFICULTIES.hard,t=stage<=5?(stage-1)/4:(stage-5)/4;
 const lerp=(a:number,b:number)=>a+(b-a)*t,speed=lerp(low.speed,high.speed);
 return {aimSeconds:lerp(low.aimSeconds,high.aimSeconds),warningSeconds:lerp(low.warningSeconds,high.warningSeconds),speed,strafe:stage>1,strafeSpeed:speed*Math.min(1,(stage-1)/4)};
}
