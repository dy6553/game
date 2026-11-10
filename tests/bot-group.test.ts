import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../src/duel.ts';
import {canStand,PROTOTYPE} from '../src/world.ts';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
function battle(){assert.equal(typeof rules.createBotMatch,'function','four-participant bot match must be implemented');return rules.createBotMatch('normal');}
test('personal match has three independent bots and only targets the human player',()=>{
 const match=battle();assert.equal(match.state().bots.length,3);const hits:string[]=[];
 for(let i=0;i<160;i++)match.update(.025,{x:0,z:10},()=>true,(_from,_target,id)=>{hits.push(id);return false;});
 assert.ok(hits.length>=3);assert.equal(match.state().playerHealth,100);for(const bot of match.state().bots){assert.equal(bot.health,100);assert.equal(bot.kills,0);assert.ok(canStand(bot.position,PROTOTYPE.radius));}
});
test('kills are credited once, dead bots cannot be farmed, and any individual ten kills ends the match',()=>{
 const match=battle();assert.equal(match.hurt('bot-2',100),true);assert.equal(match.hurt('bot-2',100),false);assert.equal(match.state().playerKills,1);assert.equal(match.state().bots.find(b=>b.id==='bot-1').health,100);
 for(let i=0;i<9;i++){match.update(3,{x:0,z:-8},()=>false,()=>false);match.hurt('bot-2',100);}assert.equal(match.state().winner,'player');const score=match.state().playerKills;match.update(100,{x:0,z:-8},()=>true,()=>true);assert.equal(match.state().playerKills,score);
 const lose=battle();for(let i=0;i<10;i++){lose.playerFired();assert.equal(lose.hurtPlayer('bot-3',100),true);assert.equal(lose.hurtPlayer('bot-1',100),false);if(i<9)lose.update(3,{x:0,z:-8},()=>false,()=>false);}assert.equal(lose.state().winner,'bot');assert.equal(lose.state().winnerName,'봇 3');assert.equal(lose.state().bots.find(b=>b.id==='bot-3').kills,10);
});
test('respawn picks a clear distant point and living bots remain frozen while their target is dead',()=>{
 const match=battle();match.hurtPlayer('bot-1',100);const before=match.state().bots.map(b=>b.position);
 match.update(2.9,{x:0,z:-8},()=>true,()=>assert.fail('dead human cannot be shot'));assert.equal(match.state().playerHealth,0);assert.deepEqual(match.state().bots.map(b=>b.position),before);
 match.update(.1,{x:0,z:-8},()=>true,()=>assert.fail());const state=match.state();assert.equal(state.playerHealth,100);assert.equal(state.respawnVersion,1);assert.ok(canStand(state.playerPosition,PROTOTYPE.radius));assert.ok(state.bots.every(b=>Math.hypot(b.position.x-state.playerPosition.x,b.position.z-state.playerPosition.z)>8));
});
test('scene personal mode shows three damageable robots, pause freezes all and restart keeps difficulty',()=>{
 const e=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});try{
  const world=createHarborScene(e,{randomSpawns:false});world.setMode('ffa','hard');const p={x:0,z:10};world.update(p,0);world.scene.render();assert.equal(world.duelState().active,true,'personal mode is combat, not practice');assert.equal(world.duelState().bots.length,3);
  for(const id of ['opponent','opponent-bot-2','opponent-bot-3'])assert.equal(world.scene.getTransformNodeByName(id).isEnabled(),true);
  world.selectWeapon('sniper');world.update(p,0,{yaw:0,pitch:0});world.scene.render();assert.equal(world.shoot().eliminated,true);assert.equal(world.duelState().playerKills,1);
  const before=world.duelState().bots.map(b=>({...b.position}));world.update(p,5,undefined,true);assert.deepEqual(world.duelState().bots.map(b=>b.position),before);
  world.resetPractice();assert.equal(world.duelState().playerKills,0);assert.equal(world.duelState().difficulty,'hard');world.setMode('practice');world.update(p,0);assert.equal(world.scene.getTransformNodeByName('opponent-bot-2').isEnabled(),false);world.scene.dispose();
 }finally{e.dispose();}
});
test('individual bot hitboxes award separate kills and repeated mode changes keep mesh pools bounded',()=>{
 const e=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});try{
  const world=createHarborScene(e,{randomSpawns:false});world.setMode('ffa','normal');world.selectWeapon('sniper');const p={x:0,z:10};world.update(p,0);world.scene.render();assert.equal(world.shoot().eliminated,true);
  p.z=0;for(const id of ['bot-2','bot-3']){world.update(p,1.6);const target=world.duelState().bots.find(b=>b.id===id)!;world.update(p,0,{yaw:Math.atan2(target.position.x-p.x,target.position.z-p.z),pitch:0});world.scene.render();assert.equal(world.shoot().eliminated,true,id+' must have its own damageable body');assert.equal(world.duelState().bots.find(b=>b.id===id)!.health,0);}
  assert.equal(world.duelState().playerKills,3);const meshes=world.scene.meshes.length,materials=world.scene.materials.length;for(let i=0;i<5;i++){world.setMode('duel');world.setMode('ffa');world.update(p,0);}assert.equal(world.scene.meshes.length,meshes);assert.equal(world.scene.materials.length,materials);world.scene.dispose();
 }finally{e.dispose();}
});
test('real three-bot player respawn moves the camera and restores only the selected start gun',()=>{
 const e=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});try{
  const world=createHarborScene(e,{randomSpawns:false});world.setMode('ffa','hard');world.selectWeapon('sniper');const p={x:0,z:-4};world.update(p,0);assert.equal(world.pickup(p,'crate-machinegun'),'added');assert.equal(world.inventoryState().inventory.slots.length,2);
  p.z=10;world.update(p,0);world.scene.render();for(let i=0;i<800&&world.duelState().playerHealth>0;i++)world.update(p,.025);assert.equal(world.duelState().playerHealth,0);
  world.update(p,3);assert.equal(world.duelState().playerHealth,100);assert.deepEqual({x:p.x,z:p.z},world.duelState().playerPosition);assert.equal((p as {fallSpeed?:number}).fallSpeed,0);assert.ok(canStand(p,PROTOTYPE.radius));assert.equal(world.practiceState().weaponId,'sniper');assert.equal(world.inventoryState().inventory.slots.length,1);world.scene.dispose();
 }finally{e.dispose();}
});
