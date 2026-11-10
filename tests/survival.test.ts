import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../src/duel.ts';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
function battle(level='easy'){assert.equal(typeof rules.createSurvivalMatch,'function','wave survival controller must exist');return rules.createSurvivalMatch(level);}
const tick=(match,seconds)=>match.update(seconds,{x:0,z:-8},()=>false,()=>false);
function combat(match){for(let i=0;i<200&&match.state().phase==='preparing';i++)tick(match,.05);assert.equal(match.state().phase,'combat');}
test('survival starts with three lives and the approved difficulty-specific wave goals',()=>{
 for(const [level,total] of [['easy',10],['normal',20],['hard',30]]){const match=battle(level);assert.equal(match.state().lives,3);assert.equal(match.state().totalWaves,total);assert.equal(match.state().wave,1);assert.equal(match.state().winner,'');}
});
test('a death spends exactly one life and retries the current wave; zero lives freezes defeat',()=>{
 const match=battle();combat(match);assert.equal(match.hurtPlayer('bot-1',100),true);assert.equal(match.state().lives,2);assert.equal(match.hurtPlayer('bot-2',100),false);assert.equal(match.state().lives,2);tick(match,3);assert.equal(match.state().phase,'combat');assert.equal(match.state().wave,1);assert.equal(match.state().playerHealth,100);assert.equal(match.state().defeated,0);assert.equal(match.state().respawnVersion,1);
 for(let i=0;i<2;i++){match.playerFired();match.hurtPlayer('bot-1',100);if(i===0)tick(match,3);}assert.equal(match.state().lives,0);assert.equal(match.state().winner,'bot');tick(match,100);assert.equal(match.state().lives,0);assert.equal(match.state().phase,'lost');
});
test('cleared waves advance without consuming lives and only the final wave wins',()=>{
 const match=battle();for(let wave=1;wave<=10;wave++){combat(match);assert.equal(match.state().wave,wave);let guard=0;while(match.state().phase==='combat'&&guard++<100){for(const bot of match.state().bots)if(bot.health>0)match.hurt(bot.id,100);if(match.state().phase==='combat')tick(match,3);}assert.ok(guard<100);assert.equal(match.state().lives,3);assert.equal(match.state().winner,wave===10?'player':'');}assert.equal(match.state().phase,'won');assert.ok(match.state().playerKills>10,'survival must not stop at the duel kill goal');
});
test('a dead wave enemy never revives after the wave quota is exhausted',()=>{
 const match=battle();combat(match);match.hurt('bot-1',100);tick(match,1.5);assert.equal(match.state().spawned,4);match.hurt('bot-1',100);tick(match,10);assert.equal(match.state().bots.find(b=>b.id==='bot-1').health,0);assert.equal(match.state().defeated,2);assert.equal(match.state().remaining,2);assert.ok(match.state().bots.filter(b=>b.health>0).length<=3);
});
test('survival mode is selectable combat and pausing freezes its initial preparation',()=>{
 const e=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});try{const world=createHarborScene(e,{randomSpawns:false});world.setMode('survival','normal');assert.equal(world.duelState().mode,'survival');assert.equal(world.duelState().lives,3);const before=world.duelState().prepareRemaining;world.update({x:0,z:-8},10,undefined,true);assert.equal(world.duelState().prepareRemaining,before);world.scene.dispose();}finally{e.dispose();}
});

test('all wave quotas scale to twelve, active enemies stay capped and hard wins only after thirty',()=>{
 for(const [level,goal] of [['normal',20],['hard',30]]){
  const match=battle(level);for(let wave=1;wave<=goal;wave++){
   combat(match);assert.equal(match.state().total,Math.min(12,4+Math.floor((wave-1)/2)));
   if(wave===19){for(let i=0;i<10;i++){assert.equal(match.hurt('bot-1',100),true);tick(match,3);}assert.equal(match.state().phase,'combat');assert.equal(match.state().remaining,2);}
   let guard=0;while(match.state().phase==='combat'&&guard++<50){assert.ok(match.state().bots.filter(b=>b.health>0).length<=3);for(const bot of match.state().bots)if(bot.health>0)match.hurt(bot.id,100);if(match.state().phase==='combat')tick(match,3);}assert.ok(guard<50);assert.equal(match.state().winner,wave===goal?'player':'');
  }assert.equal(match.state().wave,goal);
 }
});
test('real wave clear heals and refills every held gun while keeping the acquired inventory',()=>{
 const e=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});try{
  const world=createHarborScene(e,{randomSpawns:false});world.setMode('survival','easy');world.selectWeapon('sniper');const p={x:0,z:-4};world.update(p,0);assert.equal(world.pickup(p,'crate-machinegun'),'added');world.switchWeapon(0);world.update(p,5);assert.equal(world.duelState().phase,'combat');
  p.z=10;world.update(p,0,{yaw:0,pitch:0});world.scene.render();finishTarget(world,p);
  p.z=0;for(const id of ['bot-2','bot-3']){world.update(p,1.6);const target=world.duelState().bots.find(b=>b.id===id);world.update(p,0,{yaw:Math.atan2(target.position.x-p.x,target.position.z-p.z),pitch:0});world.scene.render();finishTarget(world,p);}
  world.update(p,1.6);const reinforcement=world.duelState().bots.find(b=>b.health>0)!;p.x=reinforcement.position.x;p.z=reinforcement.position.z-5;world.update(p,0,{yaw:0,pitch:0});world.scene.render();finishTarget(world,p);
  world.update(p,0);assert.equal(world.duelState().wave,2);assert.equal(world.duelState().phase,'preparing');assert.equal(world.duelState().playerHealth,100);const bag=world.inventoryState();assert.deepEqual(bag.inventory.slots.map(s=>s.id),['sniper','machinegun']);assert.deepEqual(bag.inventory.slots.map(s=>s.weapon.ammo),[5,30]);assert.ok(bag.pickups.find(c=>c.id==='crate-machinegun').remaining>0,'normal wave progression preserves supply timers');
  world.scene.dispose();
 }finally{e.dispose();}
});
test('real survival death spends one life and resets the current wave, supply cases and starting gun',()=>{
 const e=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});try{
  const world=createHarborScene(e,{randomSpawns:false});world.setMode('survival','hard');world.selectWeapon('sniper');const p={x:0,z:-4};world.update(p,0);world.pickup(p,'crate-machinegun');world.update(p,5);p.z=10;world.update(p,0);world.scene.render();for(let i=0;i<1000&&world.duelState().playerHealth>0;i++)world.update(p,.025);assert.equal(world.duelState().playerHealth,0);assert.equal(world.duelState().lives,2);
  const meshes=world.scene.meshes.length,materials=world.scene.materials.length;world.update(p,3);assert.equal(world.duelState().wave,1);assert.equal(world.duelState().phase,'combat');assert.equal(world.duelState().playerHealth,100);assert.equal(world.duelState().lives,2);assert.deepEqual({x:p.x,z:p.z},world.duelState().playerPosition);assert.equal((p as {fallSpeed?:number}).fallSpeed,0);assert.equal(world.duelState().protection,3);assert.deepEqual(world.inventoryState().inventory.slots.map(s=>s.id),['sniper']);assert.ok(world.inventoryState().pickups.every(c=>c.remaining===0));for(let i=0;i<4;i++){world.resetPractice();world.update(p,5);}assert.equal(world.scene.meshes.length,meshes);assert.equal(world.scene.materials.length,materials);world.scene.dispose();
 }finally{e.dispose();}
});
test('moving onto a spawn point during preparation never creates an enemy inside the player',()=>{
 const match=battle();match.update(5,{x:0,z:18},()=>false,()=>false);assert.equal(match.state().phase,'combat');assert.ok(match.state().bots.every(b=>Math.hypot(b.position.x,b.position.z-18)>=1.1),'preparation movement must not overlap an enemy spawn');
});

function finishTarget(world:any,p:{x:number;z:number}){const target=world.duelState().bots.filter((b:any)=>b.health>0).sort((a:any,b:any)=>Math.abs(Math.atan2(a.position.x-p.x,a.position.z-p.z)-world.camera.rotation.y)-Math.abs(Math.atan2(b.position.x-p.x,b.position.z-p.z)-world.camera.rotation.y))[0];if(world.practiceState().ammo<2){world.reload();world.update(p,2.5);}for(let i=0;i<2;i++){if(i)world.update(p,1.5);const t=world.duelState().bots.find((b:any)=>b.id===target.id);world.update(p,0,{yaw:Math.atan2(t.position.x-p.x,t.position.z-p.z),pitch:0});world.scene.render();assert.equal(world.shoot().eliminated,i===1);}}
