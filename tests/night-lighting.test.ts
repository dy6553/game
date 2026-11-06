import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleNightGround } from '../src/night-lighting.ts';

test('night lighting preserves orange pools and blue shadows rather than a uniform grey floor',()=>{
  const warm=sampleNightGround(-9,-9),cool=sampleNightGround(43,0);
  assert.ok(warm.r/warm.b>1.15,'warm paving near lamps');
  assert.ok(cool.b>cool.r,'cool unlit paving');
  assert.ok(warm.r>cool.r*1.4,'lighting has spatial contrast');
});
test('authored ground lighting remains valid over the whole playable map',()=>{
  for(let x=-44;x<=44;x+=2)for(let z=-34;z<=34;z+=2){
    const color=sampleNightGround(x,z);
    for(const value of Object.values(color))assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
  }
});
