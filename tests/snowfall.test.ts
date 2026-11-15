import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
import {Scene} from '@babylonjs/core/scene.js';
import {createSnowfall} from '../src/snowfall.ts';

test('snow map has bounded snowfall outdoors and clears it inside, in menus and on pause',()=>{
 const engine=new NullEngine();
 const world=createHarborScene(engine,{map:'snow'});
 try{
  assert.ok(world.snowfallState?.(),'snow map supplies a snow effect');
  world.setPreview(false);
  world.update({x:0,z:-38},.016,{yaw:0,pitch:0});
  assert.equal(world.snowfallState().running,true);
  assert.ok(world.snowfallState().capacity<=160);
  world.update({x:0,z:0},.016,{yaw:0,pitch:0});
  assert.equal(world.snowfallState().running,false,'no flakes emitted inside the research building');
  world.update({x:0,z:-38},.016,{yaw:0,pitch:0});
  assert.equal(world.snowfallState().running,true);
  world.update({x:0,z:-38},.016,{yaw:0,pitch:0},true);
  assert.equal(world.snowfallState().running,false,'pause stops particle work');
  world.setPreview(true);
  assert.equal(world.snowfallState().running,false);
 }finally{world.scene.dispose();engine.dispose();}
});

test('moon map does not create snowfall',()=>{
 const engine=new NullEngine();const world=createHarborScene(engine,{map:'moon'});
 try{assert.equal(world.snowfallState?.(),null);}finally{world.scene.dispose();engine.dispose();}
});

test('snow density changes without allocating another particle system and scene disposal releases it',()=>{
 const engine=new NullEngine();const scene=new Scene(engine);const snow=createSnowfall(scene);
 try{
  const medium=snow.state().emitRate;
  snow.setLow(true);const low=snow.state().emitRate;
  snow.setQuality(true);const high=snow.state().emitRate;
  assert.ok(low<medium&&medium<high);
  assert.equal(scene.particleSystems.length,1);
  assert.equal(snow.state().textureSize,32);
  snow.update({x:0,z:0},true);assert.equal(snow.state().running,true);
  scene.dispose();assert.equal(snow.state().running,false);
 }finally{if(!scene.isDisposed)scene.dispose();engine.dispose();}
});

test('snow toggle stops and clears particles immediately and remains off across updates',()=>{
 const engine=new NullEngine();const world=createHarborScene(engine,{map:'snow'});
 try{
  world.setPreview(false);world.update({x:0,z:-38},.016,{yaw:0,pitch:0});
  assert.equal(typeof (world as any).setSnowfall,'function');
  (world as any).setSnowfall(false);
  assert.equal(world.snowfallState().running,false);
  world.update({x:0,z:-38},.016,{yaw:0,pitch:0});assert.equal(world.snowfallState().running,false);
  (world as any).setSnowfall(true);world.update({x:0,z:-38},.016,{yaw:0,pitch:0});
  assert.equal(world.snowfallState().running,true);
 }finally{world.scene.dispose();engine.dispose();}
});
