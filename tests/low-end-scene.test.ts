import test from 'node:test';import assert from 'node:assert/strict';import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';import {createHarborScene} from '../src/scene.ts';
test('low performance profile removes shadow and transparent decoration passes while preserving terrain and collisions',()=>{const e=new NullEngine(),w=createHarborScene(e,{randomSpawns:false});try{const before=w.geometry.worldSolids(w.doorState()),scene=w.scene;w.setQuality(false);(w as any).setPerformanceLow?.(true);assert.equal(scene.shadowsEnabled,false,'low profile must remove the shadow pass');assert.equal(scene.meshes.filter(m=>m.name.startsWith('atmosphere-wet')&&m.isEnabled()).length,0,'transparent wet cards are optional');assert.deepEqual(w.geometry.worldSolids(w.doorState()),before);(w as any).setPerformanceLow?.(false);w.setShadows(true);assert.equal(scene.shadowsEnabled,true);}finally{w.scene.dispose();e.dispose();}});
test('AI visibility queries use authoritative collision geometry without per-frame triangle picking',()=>{const e=new NullEngine(),w=createHarborScene(e,{randomSpawns:false});try{w.setMode('duel','hard');let picks=0;const original=w.scene.pickWithRay.bind(w.scene);w.scene.pickWithRay=(...args)=>{picks++;return original(...args);};for(let i=0;i<20;i++)w.update({x:0,z:10},.05);assert.equal(picks,0,'AI update should not raycast rendered triangles');}finally{w.scene.dispose();e.dispose();}});

test('interiors retain indirect fill in low quality without adding light sources',()=>{
 const e=new NullEngine(),w=createHarborScene(e,{randomSpawns:false});try{
  const count=w.scene.lights.length,sky=w.scene.getLightByName('sky')!;
  w.setQuality(false);w.setPerformanceLow(true);
  assert.ok(sky.intensity>=.6,'walls and interior props need a readable light floor');
  assert.ok(w.scene.ambientColor.r>=.18,'indirect material fill stays visible');
  assert.equal(w.scene.lights.length,count,'readability does not add GPU light passes');
 }finally{w.scene.dispose();e.dispose();}
});
test('unchanged low performance profile does not rewrite decoration visibility every frame',()=>{
 const e=new NullEngine(),w=createHarborScene(e,{randomSpawns:false});try{
  w.setPerformanceLow(true);let writes=0;
  for(const mesh of w.scene.meshes.filter(m=>m.name.startsWith('atmosphere-')||m.name==='lantern-atmospheric-glow')){
   const original=mesh.setEnabled.bind(mesh);mesh.setEnabled=(value:boolean)=>{writes++;return original(value);};
  }
  for(let i=0;i<60;i++)w.setPerformanceLow(true);
  assert.equal(writes,0,'stable profile must not traverse/write decorations60 times');
 }finally{w.scene.dispose();e.dispose();}
});
