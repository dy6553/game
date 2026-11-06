import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuel} from '../src/duel.ts';
import {canStand,PROTOTYPE} from '../src/world.ts';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
const levels=['easy','normal','hard'] as const;
function firstShot(level:typeof levels[number]){const duel=createDuel(level);let firedAt=0;for(let i=1;i<=100;i++){duel.update(.025,{x:0,z:10},()=>true,()=>{firedAt||=i*.025;});if(firedAt)return firedAt;}return Infinity;}
test('normal and hard react sooner, without changing health or shot damage',()=>{
 const times=levels.map(firstShot);assert.ok(times[0]!>times[1]!&&times[1]!>times[2]!,`first shots must differ: ${times}`);
 for(const level of levels){const duel=createDuel(level);for(let i=0;i<100&&duel.state().playerHealth===100;i++)duel.update(.025,{x:0,z:10},()=>true,()=>{});assert.equal(duel.state().playerHealth,75);assert.equal(duel.state().botHealth,100);}
});
test('higher difficulties strafe during aim while easy keeps its existing close-range behavior',()=>{
 const positions=levels.map(level=>{const d=createDuel(level);for(let i=0;i<8;i++)d.update(.025,{x:0,z:10},()=>true,()=>{});return d.state().position;});
 assert.equal(positions[0]!.x,0);assert.ok(Math.abs(positions[1]!.x)>.1);assert.ok(Math.abs(positions[2]!.x)>Math.abs(positions[1]!.x));for(const p of positions)assert.ok(canStand(p,PROTOTYPE.radius));
});
test('all difficulty warnings stay dodgable, stop movement and cancel behind cover',()=>{
 for(const level of levels){const duel=createDuel(level);for(let i=0;i<100&&!duel.state().locked;i++)duel.update(.025,{x:0,z:10},()=>true,()=>{});assert.ok(duel.state().locked);const start=duel.state().position;let shots=0;
 for(let i=0;i<4;i++)duel.update(.025,{x:3,z:10},()=>true,()=>{shots++;});assert.deepEqual(duel.state().position,start,'warning must not turn into a moving aimbot');
 for(let i=0;i<30&&shots===0;i++)duel.update(.025,{x:3,z:10},()=>true,(_from,target)=>{shots++;assert.deepEqual(target,{x:0,z:10});});assert.equal(shots,1);assert.equal(duel.state().playerHealth,100);
 for(let i=0;i<100&&!duel.state().locked;i++)duel.update(.025,{x:3,z:10},()=>true,()=>{});duel.update(.025,{x:3,z:10},()=>false,()=>assert.fail());assert.equal(duel.state().locked,null);assert.equal(duel.state().aim,0);
 }
});
test('selected difficulty survives scene restart and practice round trips',()=>{
 const e=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});try{
  const world=createHarborScene(e);world.setMode('duel','hard');assert.equal(world.duelState().difficulty,'hard');world.resetPractice();assert.equal(world.duelState().difficulty,'hard');world.setMode('practice');world.setMode('duel');assert.equal(world.duelState().difficulty,'hard');world.scene.dispose();
 }finally{e.dispose();}
});
