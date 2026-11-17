import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/world.ts';
import {firstShotBox} from '../src/combat-geometry.ts';

test('hub portals seal the corners above the tunnel arch without closing the doorway',()=>{
 const w=createWorld('snow');
 for(const side of [-1,1]){
  for(const x of [-2.8,2.8])assert.ok(firstShotBox(w,{}, {x,y:2.7,z:side*12},{x,y:2.7,z:side*22}),'daylight gap beside central arch');
  assert.equal(firstShotBox(w,{}, {x:0,y:1.8,z:side*12},{x:0,y:1.8,z:side*22}),null,'standing doorway remains open');
 }
});
test('lab end caps follow the shared curved roof instead of protruding stepped blocks',()=>{
 const w=createWorld('snow');
 for(const side of [-1,1])for(const lab of [-33,33]){
  assert.equal(firstShotBox(w,{}, {x:lab+3.9,y:5.05,z:side*28},{x:lab+3.9,y:5.05,z:side*25.8}),null,'no wall sticks through the roof');
 }
 assert.ok(w.worldSolids().filter(r=>r.id.includes('end-wall')).every(r=>r.shellVertices),'curved caps share their actual faces with shots and render');
});
