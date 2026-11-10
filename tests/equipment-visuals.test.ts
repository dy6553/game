import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {createEquipmentVisuals} from '../src/equipment-visuals.ts';
import type {Projectile,ToolEvent} from '../src/equipment.ts';

test('idle equipment visuals do not touch disabled projectiles or bursts',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try{
  const visuals=createEquipmentVisuals(scene);
  const meshes=scene.meshes.filter(m=>m.name.startsWith('thrown-tool-')||m.name.startsWith('tool-burst-'));
  let writes=0;
  for(const mesh of meshes){
   const setEnabled=mesh.setEnabled.bind(mesh);
   mesh.setEnabled=value=>{writes++;setEnabled(value);};
  }
  for(let i=0;i<60;i++)visuals.update([],[],1/60);
  assert.equal(writes,0);
 }finally{scene.dispose();engine.dispose();}
});

test('projectiles and bursts retain visibility, expire and clear on restart',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);
 try{
  const visuals=createEquipmentVisuals(scene);
  const ball=scene.getMeshByName('thrown-tool-0')!,burst=scene.getMeshByName('tool-burst-0')!;
  const p:Projectile={id:1,kind:'grenade',owner:'a',x:1,y:2,z:3,vx:0,vy:0,vz:0,remaining:1};
  const e:ToolEvent={id:2,kind:'grenade',owner:'a',x:1,y:2,z:3};
  visuals.update([p],[],0);assert.equal(ball.isEnabled(),true);
  visuals.update([p],[],0,false);assert.equal(ball.isEnabled(),false);
  visuals.update([p],[],0);assert.equal(ball.isEnabled(),true);
  visuals.update([],[e],0);assert.equal(ball.isEnabled(),false);assert.equal(burst.isEnabled(),true);
  visuals.update([],[e],.6);assert.equal(burst.isEnabled(),false);
  visuals.update([p],[],0);visuals.clear();assert.equal(ball.isEnabled(),false);
 }finally{scene.dispose();engine.dispose();}
});
