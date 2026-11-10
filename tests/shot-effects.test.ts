import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {createShotEffects} from '../src/shot-effects.ts';

test('shot visuals move toward the actual impact, stay bounded and never become collision targets',()=>{
  const engine=new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
  try{
    const scene=new Scene(engine),camera=new FreeCamera('test-camera',new Vector3(0,2,0),scene);
    const effects=createShotEffects(scene,camera);
    const meshes=scene.meshes.length,materials=scene.materials.length;
    effects.emit(new Vector3(0,2,1),new Vector3(0,2,31),new Vector3(0,0,-1),true,false);
    effects.update(0.01);
    const tracer=effects.meshes.find(m=>m.name==='fx-tracer'&&m.isEnabled())!;
    assert.ok(tracer.position.z>1&&tracer.position.z<31);
    assert.equal(effects.stats().marks,1);
    for(let i=0;i<100;i++)effects.emit(new Vector3(0,2,1),new Vector3(0,2,31),new Vector3(0,0,-1),true,false);
    assert.ok(effects.stats().traces<=8&&effects.stats().marks<=24&&effects.stats().sparks<=48&&effects.stats().shells<=12);
    assert.equal(scene.meshes.length,meshes);assert.equal(scene.materials.length,materials);
    assert.ok(effects.meshes.every(m=>!m.isPickable));
    effects.update(2);assert.equal(effects.stats().traces,0);assert.equal(effects.stats().sparks,0);assert.equal(effects.stats().shells,0);
    effects.clear();assert.equal(effects.stats().marks,0);assert.ok(effects.meshes.every(m=>!m.isEnabled()));
    scene.dispose();
  }finally{engine.dispose();}
});

test('camera-origin and near-wall shots cannot put a muzzle billboard inside the camera',()=>{const e=new NullEngine(),s=new Scene(e),c=new FreeCamera('c',new Vector3(0,2,0),s);try{const fx=createShotEffects(s,c);fx.emit(c.position.clone(),new Vector3(0,2,20),Vector3.Backward(),false,false);assert.equal(fx.meshes.find(m=>m.name==='fx-muzzle-flash')!.isEnabled(),false);assert.equal(fx.stats().traces,1);}finally{s.dispose();e.dispose();}});

test('reduced shot effects retain tracers and impact feedback without flashes or shells',()=>{const e=new NullEngine(),s=new Scene(e),c=new FreeCamera('c',new Vector3(0,2,0),s);try{const fx=createShotEffects(s,c);fx.setReduced(true);fx.emit(new Vector3(.3,1.8,1),new Vector3(0,2,20),Vector3.Backward(),true,true);assert.equal(fx.meshes.find(m=>m.name==='fx-muzzle-flash')!.isEnabled(),false);assert.equal(fx.stats().shells,0);assert.equal(fx.stats().traces,1);assert.equal(fx.stats().sparks,2);}finally{s.dispose();e.dispose();}});

test('switching to reduced effects immediately clears active decorative shot meshes',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try{
  const camera=new FreeCamera('test',new Vector3(0,2,0),scene);
  const fx=createShotEffects(scene,camera);
  fx.emit(new Vector3(0,2,2),new Vector3(0,2,20),Vector3.Backward(),true,false);
  assert.equal(fx.stats().shells,1);
  assert.equal(fx.stats().marks,1);
  fx.setReduced(true);
  assert.equal(fx.stats().shells,0);
  assert.equal(fx.stats().marks,0);
  assert.ok(fx.meshes.filter(m=>m.name==='fx-impact-dust').every(m=>!m.isEnabled()));
  assert.equal(fx.stats().traces,1);
 }finally{scene.dispose();engine.dispose();}
});
