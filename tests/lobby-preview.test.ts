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
test('lobby guns are visual-only, attached to the posed hand and bounded across selections and character changes',()=>{
 const engine=new NullEngine();try{const w=createHarborScene(engine);assert.equal(typeof w.setLobbyWeapon,'function','visual-only held weapon selection must exist');assert.equal(typeof w.rotateLobby,'function');assert.equal(typeof w.setLobbyMotion,'function');w.setPreview(true,true);w.setLobbyMotion(false);
 const before=w.practiceState();for(const id of ['pistol','machinegun','shotgun','sniper']){w.setLobbyWeapon(id);w.update({x:0,z:-8},.05,undefined,true);const active=w.scene.meshes.filter(m=>m.metadata?.lobbyWeapon===id&&m.isEnabled());assert.ok(active.length>0,`${id} must be visible`);assert.ok(active.every(m=>!m.isPickable&&!m.checkCollisions));assert.ok(active[0].parent?.parent?.name.includes('palm'),'gun mount follows the character hand');assert.equal(w.practiceState().weaponId,before.weaponId);assert.equal(w.practiceState().ammo,before.ammo);}
 w.rotateLobby(.8);w.update({x:0,z:-8},.05,undefined,true);assert.ok(Math.abs(w.player.rotation.y-.7)<1e-5);const base=w.player.rotation.y;w.update({x:0,z:-8},1,undefined,true);assert.equal(w.player.rotation.y,base,'reduced motion keeps the pose still');w.setLobbyMotion(true);w.update({x:0,z:-8},.05,undefined,true);assert.notEqual(w.player.rotation.y,base);
 const counts={};for(const type of ['robot','robot-cat','robot','robot-cat']){w.selectCharacter(type);w.setLobbyWeapon('sniper');w.update({x:0,z:-8},.05,undefined,true);const pair=[w.scene.meshes.length,w.scene.materials.length];if(counts[type])assert.deepEqual(pair,counts[type]);counts[type]=pair;assert.ok(w.scene.meshes.some(m=>m.metadata?.lobbyWeapon==='sniper'&&m.isEnabled()));}
 w.setPreview(false);w.update({x:0,z:-8},0);assert.equal(w.scene.meshes.some(m=>m.metadata?.lobbyWeapon&&m.isEnabled()),false);w.rotateLobby(1);w.update({x:0,z:-8},0,{yaw:.2,pitch:0});assert.equal(w.player.rotation.y,.2);w.scene.dispose();}finally{engine.dispose();}
});
