import test from 'node:test';import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
import {Ray} from '@babylonjs/core/Culling/ray.js';import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
for(const map of ['snow','moon'] as const)test(`${map}: three code-built profiles preserve collisions and landmark silhouettes within low GPU budgets`,async()=>{
 const e=new NullEngine(),w=createHarborScene(e,{map,randomSpawns:false});try{
 assert.equal(typeof w.mapArtState,'function','new maps must be generated directly from code');
 const solids=structuredClone(w.geometry.worldSolids()),profiles=[];
 for(const quality of ['low','medium','high','low'] as const){
  await w.setQuality(false);await w.setPerformanceLow(quality==='low');if(quality==='high')await w.setQuality(true);
  const s=w.mapArtState();assert.equal(s?.source,'procedural');assert.equal(s?.quality,quality);assert.equal(s?.map,map);assert.deepEqual(w.geometry.worldSolids(),solids);
  assert.equal(s?.collisionCount,solids.length);assert.ok(s!.landmarks.includes(map==='snow'?'observatory':'habitat-dome'));assert.ok(s!.landmarks.includes(map==='snow'?'mountain-ridge':'communications-dish'));
  assert.equal(s!.landmarks.includes('milky-way'),map==='moon'&&quality==='high');
  const art=w.scene.meshes.filter(m=>m.metadata?.proceduralMap===map);assert.ok(art.length<=24);const ground=art.find(m=>m.name.endsWith('0:ground'))!;const normals=ground.getVerticesData('normal')!;assert.ok(normals[1]>.99,'ground faces upward and is visible from the play area');assert.ok(art.every(m=>!m.isPickable&&!m.checkCollisions&&m.material?.alpha===1));
  assert.equal(w.scene.transformNodes.filter(n=>n.name.startsWith(map+'-procedural-')).length,1);
  if(quality==='low'){assert.ok(s!.triangles<12000);assert.ok(s!.textureBytes<=128*128*3);assert.equal(w.scene.shadowsEnabled,false);if(map==='snow'){w.setPreview(false);w.update({x:0,z:-38},.016);assert.equal(w.snowfallState()?.running,false,'low profile avoids ambient particle overdraw');}}
  const room=w.geometry.BUILDINGS[0]!,ray=new Ray(new Vector3(room.x+room.width/2-2,1.5,room.z+5),new Vector3(1,0,0),4);assert.ok(w.scene.pickWithRay(ray,m=>m.isPickable&&m.isEnabled())?.hit);
  profiles.push(s!);
 }
 assert.ok(profiles[0].triangles<profiles[1].triangles);assert.ok(profiles[1].triangles<profiles[2].triangles);assert.deepEqual(profiles[0],profiles[3],'switching profiles must not leak or accumulate scenery');
 }finally{w.scene.dispose();e.dispose();}
});

test('team pings validate against each expansion map rather than the old harbor bounds',async()=>{
 const {createNetworkGame}=await import('../src/network-game.ts');
 for(const [map,x,z] of [['snow',76,54],['moon',66,52]] as const){const g=createNetworkGame(undefined,map,{mode:'team'});g.join('a');g.join('b');const command={seq:1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,ping:{kind:'move',x,z}};assert.equal(g.input('a',command),true,'valid ping at the new map edge must work');g.step();assert.equal(g.state.pings?.[0]?.x,x);assert.equal(g.input('a',{...command,seq:2,ping:{kind:'move',x:map==='snow'?81:71,z}}),false);}
});
