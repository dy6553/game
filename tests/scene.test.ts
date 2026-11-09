import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { createHarborScene } from '../src/scene.ts';
import { PROTOTYPE } from '../src/world.ts';

test('FPS camera follows eyes, hides own body, previews and switches both robots', () => {
 const engine = new NullEngine({ renderWidth:1280, renderHeight:720, textureSize:512, deterministicLockstep:false, lockstepMaxSteps:4 });
 try {
  const world=createHarborScene(engine);
  world.update(PROTOTYPE.spawn,1,{yaw:0.7,pitch:0.2});world.scene.render();
  assert.equal(world.camera.mode,0);
  assert.equal(world.camera.position.x,PROTOTYPE.spawn.x);
  assert.equal(world.camera.position.z,PROTOTYPE.spawn.z);
  assert.ok(world.camera.position.y>1.5 && world.camera.position.y<2.5);
  assert.equal(world.camera.rotation.y,0.7);assert.equal(world.camera.rotation.x,0.2);
  assert.equal(world.player.isEnabled(),false);
  assert.ok(world.scene.meshes.every(mesh=>mesh.visibility===1));
  const halos=world.scene.getTransformNodeByName('street-light-halos')!.getChildMeshes();
  assert.equal(halos.length,8);
  assert.ok(halos.every(mesh=>!mesh.isPickable),'transparent decorative light must not block shooting');
  world.update(PROTOTYPE.spawn,1,{yaw:0,pitch:0});world.scene.render();
  assert.equal(world.shoot().hit,true,'screen center ray hits the target straight ahead');
  const wall=MeshBuilder.CreateBox('test-shot-wall',{width:4,height:4,depth:0.5},world.scene);
  wall.position.set(0,2,4);world.scene.render();
  world.update(PROTOTYPE.spawn,.25,{yaw:0,pitch:0});const blocked=world.shoot();
  assert.equal(blocked.hit,false,'opaque geometry blocks the same centered target');
  assert.ok(blocked.point && blocked.point.z<5,'ray stops at the wall');
  wall.dispose();
  world.update(PROTOTYPE.spawn,1);
  const materialCount=world.scene.materials.length;
  world.setPreview(true);world.update(PROTOTYPE.spawn,0.05);
  assert.equal(world.shoot().fired,false,'character menu cannot fire');
  assert.equal(world.player.isEnabled(),true);
  assert.equal(world.scene.getTransformNodeByName('first-person-hands')!.isEnabled(),false);
  world.selectCharacter('robot-cat');world.scene.render();
  assert.ok(world.scene.getMeshByName('cat-tail'));
  assert.equal(world.scene.getMeshByName('antenna-tip'),null);
  const meshCount=world.scene.meshes.length;
  for(let i=0;i<10;i++){world.selectCharacter('robot');world.selectCharacter('robot-cat');}
  assert.equal(world.scene.meshes.length,meshCount);assert.equal(world.scene.materials.length,materialCount);
  world.setPreview(false);world.update({x:0,z:30},0.05,{yaw:-1,pitch:-0.3});
  assert.equal(world.player.isEnabled(),false);assert.equal(world.camera.position.z,30);
  assert.ok(world.camera.getDirection(Vector3.Forward()).y>0);
  world.scene.render();
  world.setReference(true);world.update({x:0,z:30},0.05,{yaw:-1,pitch:-0.3});world.scene.render();
  assert.equal(world.camera.position.y,50,'comparison uses a fixed high view');
  assert.equal(world.shoot().fired,false,'comparison cannot fire');
  assert.equal(world.scene.getMeshByName('preview-plinth')!.isEnabled(),false);
  world.setReference(false);world.update({x:0,z:30},0.05,{yaw:-1,pitch:-0.3});
  assert.equal(world.camera.position.z,30,'leaving comparison restores first-person position');
  assert.equal(world.camera.rotation.y,-1);
  world.scene.render();world.scene.dispose();
 }finally{engine.dispose();}
});

test('static map transforms are frozen while player, camera and targets stay dynamic',()=>{
 const engine=new NullEngine({renderWidth:960,renderHeight:540,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
 try{
  const world=createHarborScene(engine);world.update(PROTOTYPE.spawn,0);world.scene.render();
  const fixed=world.scene.meshes.filter(m=>m.name.startsWith('batch-'));
  assert.ok(fixed.length>0);assert.ok(fixed.every(m=>m.isWorldMatrixFrozen));
  assert.equal(world.scene.getMeshByName('practice-target-0')!.isWorldMatrixFrozen,false);
  world.setQuality(false);world.setQuality(false);world.setQuality(true);
  const position={x:2,z:-9};world.update(position,0,{yaw:.5,pitch:0});world.scene.render();
  assert.equal(world.camera.position.x,2);assert.equal(world.camera.rotation.y,.5);
  world.scene.dispose();
 }finally{engine.dispose();}
});
