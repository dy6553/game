import test from 'node:test';import assert from 'node:assert/strict';import {createWorld,type Point} from '../src/world.ts';

test('falling across either stair surface lands on the ramp even at high speed',()=>{
 for(const map of ['harbor','factory'] as const){
  const world=createWorld(map),building=world.BUILDINGS.find(b=>b.enterable)!;
  for(const stair of world.stairways(building)){
   const x=stair.start.x,z=(stair.start.z+stair.end.z)/2,surface=(stair.start.y+stair.end.y)/2;
   const landed=world.advanceFall({x,z,y:surface+.35,fallSpeed:12},.05);
   assert.ok(Math.abs(landed.y!-surface)<1e-8);
   assert.equal(landed.fallSpeed,0);
  }
 }
});

test('players can leave the side of a staircase and steer while falling',()=>{
 const world=createWorld(),building=world.BUILDINGS.find(b=>b.enterable)!;
 const stair=world.stairways(building)[0]!;
 const start={x:stair.start.x,z:(stair.start.z+stair.end.z)/2,y:world.SECOND_FLOOR/2};
 const solids=world.worldSolids();
 const side=world.moveWithCollisions(start,{x:1.65,z:0},solids);
 assert.ok(side.x-start.x>1.55,'the interior must not act like an invisible railing');
 const falling=world.advanceFall(side,.05);
 assert.ok(falling.y!<start.y);
 const steered=world.moveWithCollisions(falling,{x:.2,z:0},solids);
 assert.ok(steered.x>falling.x);
 let landed=steered;
 for(let i=0;i<40;i++)landed=world.advanceFall(landed,.05);
 assert.equal(landed.y,0);
 assert.equal(landed.fallSpeed,0);
});
test('both maps provide a second-floor and rooftop balcony, with a gravity landing after leaving',()=>{
 for(const map of ['harbor','factory'] as const){const w=createWorld(map);for(const b of w.BUILDINGS.filter(b=>b.enterable))for(const y of [w.SECOND_FLOOR,b.height]){
  const f=b.z<0?1:-1;let p:Point={x:b.x,z:b.z+f*(b.depth/2-1),y};
  for(let i=0;i<18;i++)p=w.moveWithCollisions(p,{x:0,z:f*.1},w.worldSolids());
  assert.ok(Math.abs(p.z-b.z)>b.depth/2,'balcony reachable from inside');assert.equal(p.y,y);
  for(let i=0;i<30;i++)p=w.moveWithCollisions(p,{x:0,z:f*.1},w.worldSolids());
  const start=p.y; p=w.advanceFall(p,.05);assert.ok(p.y!<start!,'gravity starts outside balcony');
  for(let i=0;i<100;i++)p=w.advanceFall(p,.05);assert.equal(p.y,0);assert.equal(p.fallSpeed,0);
 }}
});
