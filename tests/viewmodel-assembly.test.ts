import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
const setup=()=>{const e=new NullEngine({renderWidth:1728,renderHeight:1010,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4}),w=createHarborScene(e,{randomSpawns:false});return {e,w};};
test('palm covers the grip from the camera side and receiver has no intersecting lower shell',()=>{
 const {e,w}=setup();try{w.update({x:0,z:-8},1);w.scene.render();const s=w.scene,palm=s.getMeshByName('view-hand')!,grip=s.getMeshByName('view-grip')!,shell=s.getMeshByName('view-gun')!,receiver=s.getMeshByName('view-receiver')!;
 for(const m of [palm,grip,shell,receiver])m.computeWorldMatrix(true);
 const bounds=(m:typeof palm)=>m.getBoundingInfo().boundingBox;
 assert.ok(bounds(palm).minimumWorld.z<bounds(grip).minimumWorld.z-.02,'black grip must not slice through the back of the glove');
 assert.equal(palm.material,s.getMaterialByName('view-glove'),'visible palm should use the glove material');
 assert.ok(bounds(shell).maximumWorld.y<=bounds(receiver).minimumWorld.y+1e-6,'upper and lower receiver shells must meet without overlapping volume');
 }finally{w.scene.dispose();e.dispose();}
});
test('all glove parts remain attached during reload rather than rotating one palm block alone',()=>{
 const {e,w}=setup();try{w.update({x:0,z:-8},1);w.scene.render();w.shoot();w.reload();w.update({x:0,z:-8},.6);const hand=w.scene.getMeshByName('view-hand')!;assert.equal(hand.rotation.x,0,'reload transforms the held assembly, not a detached palm');}finally{w.scene.dispose();e.dispose();}
});
test('each gun barrel remains joined to its muzzle and bore after weapon changes',()=>{
 const {e,w}=setup();try{for(const id of ['pistol','sniper','smg','machinegun','dmr','shotgun'] as const){w.selectWeapon(id);w.update({x:0,z:-8},1);const s=w.scene,barrel=s.getMeshByName('view-barrel')!,muzzle=s.getMeshByName('view-muzzle')!,bore=s.getMeshByName('view-bore')!;const end=barrel.position.z+.12*barrel.scaling.z;assert.ok(Math.abs(muzzle.position.z-(end+.04))<1e-6,`${id} muzzle follows barrel length`);assert.ok(Math.abs(bore.position.z-(end+.105))<1e-6,`${id} bore is on the muzzle front`);if(id==='shotgun')assert.ok(Math.abs(s.getMeshByName('shotgun-second-barrel')!.position.z+.21-end)<1e-6,'shotgun barrels end together');}}finally{w.scene.dispose();e.dispose();}
});
