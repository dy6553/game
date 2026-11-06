import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
const engine=()=>new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
test('empty premium supply case stays visible during recharge and never blocks shots or changes pickup rules',()=>{
 const e=engine();try{const world=createHarborScene(e);world.setMode('practice');const p={x:0,z:-4};world.update(p,0);const shell=world.scene.getMeshByName('crate-machinegun')!;assert.ok(shell.isEnabled());assert.equal(world.pickup(p,'crate-machinegun'),'added');world.update(p,.1);
 assert.equal(shell.isEnabled(),true,'empty case must stay visible as a charging station');assert.equal(shell.isPickable,false);assert.equal(world.pickup(p,'crate-machinegun'),'unavailable');const data=world.inventoryState();assert.ok(data.pickups.find(c=>c.id==='crate-machinegun')!.remaining>19);assert.equal(data.inventory.slots.length,2);world.scene.dispose();}finally{e.dispose();}
});
test('case visual state changes reuse geometry and materials across recharge and restart',()=>{
 const e=engine();try{const world=createHarborScene(e);world.setMode('practice');const p={x:0,z:-4};world.update(p,0);const meshes=world.scene.meshes.length,materials=world.scene.materials.length;
 for(let i=0;i<10;i++){world.pickup(p,'crate-machinegun');world.update(p,.1);world.resetPractice();world.update(p,0);}
 assert.equal(world.scene.meshes.length,meshes);assert.equal(world.scene.materials.length,materials);world.setPreview(true);world.update(p,0,undefined,true);assert.equal(world.scene.getMeshByName('crate-machinegun')!.isEnabled(),false);world.scene.dispose();}finally{e.dispose();}
});
