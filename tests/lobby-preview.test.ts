import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
import {PROTOTYPE} from '../src/world.ts';
test('the lobby shows the real character at a fixed centered preview regardless of the last match position',()=>{
 const engine=new NullEngine();try{
  const world=createHarborScene(engine);world.setPreview(true,true);world.update({x:24,z:16},.1,undefined,true);
  world.camera.getViewMatrix(true);assert.equal(world.player.position.x,PROTOTYPE.spawn.x);assert.equal(world.player.position.z,PROTOTYPE.spawn.z);assert.ok(Math.abs(world.camera.getTarget().x-PROTOTYPE.spawn.x)<1e-5);assert.ok(world.camera.getTarget().y>.8&&world.camera.getTarget().y<1.8,'camera targets the character body rather than the street');
  world.selectCharacter('robot-cat');world.update({x:-24,z:20},.1,undefined,true);assert.equal(world.characterType,'robot-cat');assert.equal(world.player.position.z,PROTOTYPE.spawn.z);assert.equal(world.player.isEnabled(),true);
  const meshes=world.scene.meshes.length,materials=world.scene.materials.length;for(let i=0;i<4;i++){world.setPreview(true,true);world.update({x:44,z:20},.1,undefined,true);}assert.equal(world.scene.meshes.length,meshes);assert.equal(world.scene.materials.length,materials);
  world.setPreview(false);world.update({x:24,z:16},0);assert.equal(world.camera.position.x,24);assert.equal(world.camera.position.z,16);assert.equal(world.camera.fov,1.25);world.scene.dispose();
 }finally{engine.dispose();}
});
