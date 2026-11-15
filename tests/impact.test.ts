import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createRecoil } from '../src/impact.ts';
import { createRobotImpact } from '../src/robot-impact.ts';
import { createHarborScene } from '../src/scene.ts';

const engine=()=>new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
test('weapon recoil differs, recovers over elapsed time and camera motion can be disabled',()=>{
 const recoil=createRecoil();recoil.fire('machinegun');const light=recoil.read().push;
 recoil.clear();recoil.fire('shotgun');assert.ok(recoil.read().push>light*3);
 recoil.update(.02);assert.notEqual(recoil.read().roll,0);
 recoil.setShake('off');assert.equal(recoil.read().roll,0);assert.equal(recoil.read().fov,0);assert.ok(recoil.read().push>0,'disabling screen shake keeps weapon animation');
 for(let i=0;i<200;i++)recoil.fire('machinegun');assert.ok(recoil.read().kick<=1.6,'automatic recoil cannot accumulate without bound');
 recoil.update(2);assert.equal(recoil.read().kick,0);
 const a=createRecoil(),b=createRecoil();a.fire('sniper');b.fire('sniper');a.update(.1);for(let i=0;i<10;i++)b.update(.01);assert.ok(Math.abs(a.read().push-b.read().push)<1e-10);
});
test('robot impact uses a fixed noncolliding pool, private materials and cleans up on reset',()=>{
 const e=engine();try{
  const scene=new Scene(e),root=new TransformNode('robot',scene);
  const shared=new StandardMaterial('shared-eye',scene);shared.emissiveColor=new Color3(1,.7,.2);
  const eye=MeshBuilder.CreateBox('eye',{},scene);eye.parent=root;eye.material=shared;
  const fx=createRobotImpact(scene,root,[eye]),meshCount=scene.meshes.length,matCount=scene.materials.length;
  fx.hit(new Vector3(0,2,0),1,false);fx.update(.02);assert.notEqual(root.rotation.z,0);
  assert.equal(eye.material===shared,false);assert.equal(shared.emissiveColor.r,1,'player material is never modified');
  fx.reset();fx.hit(new Vector3(0,2,0),-1,true);fx.update(.3);
  assert.ok(root.rotation.z<-.5);assert.equal((eye.material as StandardMaterial).emissiveColor.r,0);assert.equal(fx.showingDeath,true);
  for(let i=0;i<100;i++){fx.reset();fx.hit(new Vector3(0,2,0),1,true);}
  assert.equal(scene.meshes.length,meshCount);assert.equal(scene.materials.length,matCount);assert.ok(fx.stats().active<=32);assert.ok(fx.meshes.every(mesh=>!mesh.isPickable));
  fx.update(2);assert.equal(fx.stats().active,0);assert.equal(fx.showingDeath,false);
  fx.reset();assert.equal(root.rotation.z,0);assert.equal(fx.stats().active,0);assert.equal((eye.material as StandardMaterial).emissiveColor.r,1);
  fx.setQuality(false);fx.hit(new Vector3(0,2,0),1,true);assert.ok(fx.stats().active<=16);
  scene.dispose();
 }finally{e.dispose();}
});
test('real duel keeps a dying robot visible but unpickable, then restores it on respawn',()=>{
 const e=engine();try{
  const world=createHarborScene(e,{randomSpawns:false}),position={x:0,z:10};world.setMode('duel');world.selectWeapon('sniper');
  world.update(position,0);world.scene.render();
  const body=world.scene.getTransformNodeByName('opponent')!;
  const root=body.getChildren().find(node=>node.name==='character-robot-cat') as TransformNode;
  const meshes=world.scene.meshes.length,materials=world.scene.materials.length;
  assert.equal(world.shoot().eliminated,false);world.update(position,1.5);const target=world.duelState().position;world.update(position,0,{yaw:Math.atan2(target.x-position.x,target.z-position.z),pitch:0});world.scene.render();assert.equal(world.shoot().eliminated,true);assert.equal(world.duelState().playerKills,1);
  assert.equal(body.isEnabled(),true,'collapse stays visible after the kill');assert.ok(body.getChildMeshes().every(mesh=>!mesh.isPickable));
  world.update(position,.3);assert.ok(Math.abs(root.rotation.z)>.5);assert.ok(world.impactState().active>0);
  const pose=root.rotation.z;world.update(position,.5,undefined,true);assert.equal(root.rotation.z,pose,'pause freezes collapse');
  world.setPreview(true);assert.equal(world.impactState().active,0,'character preview removes floating effect particles');world.setPreview(false);
  world.update(position,1);assert.equal(body.isEnabled(),false,'corpse disappears before logical respawn');
  world.update(position,1.8);assert.equal(world.duelState().botHealth,100);assert.equal(body.isEnabled(),true);assert.equal(root.rotation.z,0);assert.ok(body.getChildMeshes().some(mesh=>mesh.isPickable));
  assert.equal(sceneCount(),meshes);assert.equal(world.scene.materials.length,materials);
  world.resetPractice();assert.equal(world.impactState().active,0);assert.equal(world.impactState().recoil.kick,0);
  world.setShake('off');assert.equal(world.impactState().recoil.roll,0);world.scene.dispose();
  function sceneCount(){return world.scene.meshes.length;}
 }finally{e.dispose();}
});

test('online snapshots render both character types and leave without growing effect pools',async()=>{
 const {createNetworkGame}=await import('../src/network-game.ts');const e=engine();try{
  const world=createHarborScene(e,{randomSpawns:false}),game=createNetworkGame();game.join('me');game.join('other','pistol','robot-cat');
  world.renderOnline(game.state,'me',{yaw:0,pitch:0},.05);world.scene.render();
  const count=world.scene.meshes.length;for(let i=0;i<20;i++)world.renderOnline(game.state,'me',{yaw:0,pitch:0},.05);assert.equal(world.scene.meshes.length,count);
  assert.equal(world.scene.getTransformNodeByName('online-opponent')!.isEnabled(),true);
  world.endOnline();world.setMode('duel');world.update({x:0,z:-8},0);world.scene.render();assert.equal(world.duelState().active,true);world.scene.dispose();
 }finally{e.dispose();}
});
