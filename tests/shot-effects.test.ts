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
