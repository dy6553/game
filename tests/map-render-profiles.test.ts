import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
import {createNetworkGame} from '../src/network-game.ts';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';

// Fault switches are limited to this test fixture; production rendering is unchanged.
type World=ReturnType<typeof createHarborScene>;
type Quality='low'|'medium'|'high';
function profile(w:World,q:Quality){if(q==='high'){w.setQuality(true);w.setPerformanceLow(false);}else{w.setPerformanceLow(q==='low');w.setQuality(false);}}
function inspect(w:World,map:'snow'|'moon',q:Quality){
 const art=w.scene.meshes.filter(m=>m.metadata?.proceduralMap===map);
 assert.equal(w.mapArtState()?.quality,q);
 assert.ok(art.length>0&&art.every(m=>m.isEnabled()&&m.isVisible&&m.visibility===1),'visible map art must exist, regardless of the quality label');
 assert.ok(w.scene.meshes.filter(m=>m.name.startsWith('expansion-')).every(m=>m.visibility===0||!m.isVisible),'collision-only boxes must never appear as map art');
 for(const m of art){assert.ok(m.material,'map material must exist; GPU readiness is checked in the browser suite');assert.equal(m.getVerticesData('position')?.length,m.getVerticesData('normal')?.length);assert.equal((m.getVerticesData('position')!.length/3)*4,m.getVerticesData('color')?.length);}
 const room=w.geometry.BUILDINGS[0]!,ray=new Ray(new Vector3(room.x+room.width/2-2,1.5,room.z+5),new Vector3(1,0,0),4);
 assert.ok(w.scene.pickWithRay(ray,m=>m.metadata?.proceduralMap===map&&m.isEnabled())?.hit,'visible wall triangles must exist at the shared collision wall');
}
for(const map of ['snow','moon'] as const)for(const q of ['low','medium','high'] as const){
 test(`${map} ${q} keeps visible building geometry, not only a correct settings label`,async()=>{
  const e=new NullEngine({renderWidth:1280,renderHeight:750,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4}),w=createHarborScene(e,{map,randomSpawns:false});
  try{profile(w,q);w.setPreview(false);w.update({x:0,z:map==='snow'?-38:-27},.016,{yaw:0,pitch:0});
   if(process.env.TEST_MAP_RENDER_FAULT==='hide-art')for(const m of w.scene.meshes.filter(m=>m.metadata?.proceduralMap))m.setEnabled(false);
   if(process.env.TEST_MAP_RENDER_FAULT==='show-colliders')for(const m of w.scene.meshes.filter(m=>m.name.startsWith('expansion-')))m.visibility=1;
   for(let i=0;i<3;i++)w.scene.render();inspect(w,map,q);
  }finally{w.scene.dispose();e.dispose();}
 });
}
for(const map of ['snow','moon'] as const)test(`${map} retains visible art through lobby, pause, reset, online rendering and repeated quality changes`,async()=>{
 const e=new NullEngine(),w=createHarborScene(e,{map,randomSpawns:false});try{
  const solids=w.geometry.worldSolids();
  for(const q of ['high','low','medium','high','medium','low'] as const){profile(w,q);w.setPreview(true,true);w.update(w.geometry.PROTOTYPE.spawn,.016);w.scene.render();w.setPreview(false);w.update({x:0,z:-27},.016,{yaw:0,pitch:0},true);w.resetPractice();w.scene.render();inspect(w,map,q);assert.equal(w.geometry.worldSolids(),solids);const g=createNetworkGame(undefined,map);g.join('a');g.join('b');w.renderOnline(g.state,'a',{yaw:0,pitch:0},.016);w.scene.render();inspect(w,map,q);w.endOnline();}
 }finally{w.scene.dispose();e.dispose();}
});
