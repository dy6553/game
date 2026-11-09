import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleNightGround } from '../src/night-lighting.ts';

test('night lighting preserves orange pools and blue shadows rather than a uniform grey floor',()=>{
  const warm=sampleNightGround(-9,-9),cool=sampleNightGround(60,0);
  assert.ok(warm.r/warm.b>1.15,'warm paving near lamps');
  assert.ok(cool.b>cool.r,'cool unlit paving');
  assert.ok(warm.r>cool.r*1.4,'lighting has spatial contrast');
});
test('authored ground lighting remains valid over the whole playable map',()=>{
  for(let x=-64;x<=64;x+=2)for(let z=-60;z<=34;z+=2){
    const color=sampleNightGround(x,z);
    for(const value of Object.values(color))assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
  }
});

test('unlit outer lanes retain a readable baked light floor without extra dynamic lights',()=>{
 for(const [x,z] of [[-63,-59],[63,-59],[-63,33],[63,33],[60,0]]){
  const c=sampleNightGround(x,z);assert.ok(.2126*c.r+.7152*c.g+.0722*c.b>=.32,`outer lane ${x},${z} is too dark`);
 }
});
