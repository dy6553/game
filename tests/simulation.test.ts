import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationSteps } from '../src/simulation.ts';
import { advanceWeapon,beginReload,createWeapon,tryFire,PRACTICE_RULES } from '../src/combat.ts';
import { moveWithCollisions,PROTOTYPE } from '../src/world.ts';
import { createFrameMetrics } from '../src/frame-metrics.ts';

test('10 FPS and 60 FPS advance movement and reload by the same second',()=>{
  const simulate=(fps:number)=>{
    let position={x:0,z:0};let weapon=beginReload(tryFire(createWeapon(PRACTICE_RULES)).state,PRACTICE_RULES);
    for(let frame=0;frame<fps;frame++)for(const dt of simulationSteps(1/fps)){
      position=moveWithCollisions(position,{x:PROTOTYPE.speed*dt,z:0},[]);
      weapon=advanceWeapon(weapon,dt,PRACTICE_RULES);
    }
    return {position,weapon};
  };
  const slow=simulate(10),fast=simulate(60);
  assert.ok(Math.abs(slow.position.x-PROTOTYPE.speed)<1e-8);
  assert.ok(Math.abs(slow.position.x-fast.position.x)<1e-8);
  assert.ok(Math.abs(slow.weapon.reloadRemaining-fast.weapon.reloadRemaining)<1e-8);
  assert.ok(Math.abs(slow.weapon.reloadRemaining-.5)<1e-8);
});
test('long stalls use bounded time for all simulation rules and invalid frames do no work',()=>{
  const steps=simulationSteps(5);assert.ok(steps.every(dt=>dt<=.025));
  assert.ok(Math.abs(steps.reduce((sum,dt)=>sum+dt,0)-.25)<1e-9);
  for(const invalid of [0,-1,NaN,Infinity])assert.deepEqual(simulationSteps(invalid),[]);
});
test('frame metrics expose brief stalls and retain only a bounded recent play window',()=>{
  const metrics=createFrameMetrics();
  for(let i=0;i<9;i++)metrics.sample(.01);metrics.sample(.1);
  const state=metrics.read();assert.equal(state.stalls,1);assert.equal(state.p95Ms,100);assert.ok(Math.abs(state.fps-10/.19)<1e-8);
  for(let i=0;i<1100;i++)metrics.sample(.01);
  assert.equal(metrics.read().stalls,0);assert.ok(metrics.read().seconds<=10);
  metrics.reset();metrics.sample(NaN);assert.equal(metrics.read().fps,0);
});
