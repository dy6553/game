import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {createWildlifeArt} from '../src/wildlife-art.ts';
import {animalPose,createWildlife} from '../src/wildlife.ts';

test('living wildlife has a visible body before its model arrives at every quality',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try{
  const update=createWildlifeArt(scene),animals=createWildlife(),pose=animalPose(0,0,animals[0]);
  for(const quality of ['low','medium','high'] as const){
   update(animals,0,pose,quality,150);
   const body=scene.getMeshByName('wildlife-fallback-0');
   assert.ok(body?.isEnabled());
   assert.ok(body.getTotalVertices()>0);
   assert.equal(body.isPickable,false);
   assert.equal(body.position.x,pose.x);
  }
  animals[0]!.health=0;
  update(animals,0,pose,'high',150);
  assert.equal(scene.getMeshByName('wildlife-fallback-0')?.isEnabled(),false);
 }finally{scene.dispose();engine.dispose();}
});
