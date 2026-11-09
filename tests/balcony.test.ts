import test from 'node:test';import assert from 'node:assert/strict';import {createWorld,type Point} from '../src/world.ts';
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
