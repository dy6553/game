import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { createHarborScene } from '../src/scene.ts';
import { WEAPONS,pelletOffsets } from '../src/weapons.ts';

test('approved weapons have distinct magazines and shotgun spread',()=>{
 assert.deepEqual(Object.values(WEAPONS).map(w=>w.magazineSize),[12,30,6,5]);
 const offsets=pelletOffsets(WEAPONS.shotgun);assert.equal(offsets.length,6);assert.equal(new Set(offsets.map(p=>`${p.x},${p.y}`)).size,6);
});

test('actual scene uses machinegun cadence, shotgun pellet damage, sniper scope and resets',()=>{
 const engine=new NullEngine({renderWidth:960,renderHeight:540,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
 try{
  const world=createHarborScene(engine,{randomSpawns:false}),p={x:0,z:27};
  const frame=(dt=0)=>{world.update(p,dt,{yaw:0,pitch:0});world.scene.render();};
  world.selectWeapon('machinegun');frame();
  assert.equal(world.shoot().damage,10);assert.equal(world.shoot().fired,false);assert.equal(world.practiceState().ammo,29);
  frame(.125);assert.equal(world.shoot().fired,true);assert.equal(world.practiceState().targetHealth[0],80);
  assert.equal(world.reload(),true);frame(1);assert.equal(world.shoot().fired,false);
  world.update(p,10,{yaw:0,pitch:0},true);assert.equal(world.practiceState().reloadRemaining,1);
  frame(1);assert.equal(world.practiceState().ammo,30);
  world.selectWeapon('shotgun');frame();const blast=world.shoot();assert.equal(blast.damage,60);assert.equal(world.practiceState().ammo,5);assert.equal(world.practiceState().targetHealth[0],40);
  frame(.9);assert.equal(world.shoot().eliminated,true);assert.equal(world.practiceState().destroyed,1);
  world.selectWeapon('sniper');frame();assert.equal(world.toggleScope(),true);frame();assert.ok(world.camera.fov<.5);
  assert.equal(world.shoot().damage,100);assert.equal(world.practiceState().destroyed,1);assert.equal(world.shoot().fired,false);
  world.resetPractice();assert.equal(world.practiceState().scoped,false);assert.equal(world.practiceState().ammo,5);
  world.setMode('duel');p.z=10;frame();assert.equal(world.shoot().eliminated,true);assert.equal(world.duelState().playerKills,1);
  world.selectWeapon('pistol');frame();assert.equal(world.duelState().playerKills,0);assert.equal(world.practiceState().ammo,12);assert.equal(world.toggleScope(),false);
  world.scene.dispose();
 }finally{engine.dispose();}
});
