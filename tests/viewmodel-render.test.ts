import test from 'node:test';import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
test('first-person weapon is drawn after world depth is cleared, retaining its own depth',()=>{
 const engine=new NullEngine({renderWidth:844,renderHeight:390,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
 try{
  const world=createHarborScene(engine),scene=world.scene;world.selectWeapon('sniper');
  world.update({x:9,z:-19},.1,{yaw:Math.PI/2,pitch:.2});scene.render();
  const root=scene.getTransformNodeByName('first-person-hands')!,parts=root.getChildMeshes();assert.ok(parts.length>10);
  const groups:number[]=[];const clears:{group:number;depth:boolean}[]=[];let group=-1;
  scene.onBeforeRenderingGroupObservable.add(info=>{group=info.renderingGroupId;groups.push(group);});
  const clear=engine.clear.bind(engine);engine.clear=(color,back,depth,stencil)=>{clears.push({group,depth:!!depth});return clear(color,back,depth,stencil);};
  scene.render();
  assert.ok(parts.every(m=>m.renderingGroupId>0),'hands and gun must not share wall depth');
  const weaponGroup=parts[0].renderingGroupId;assert.ok(parts.every(m=>m.renderingGroupId===weaponGroup));assert.ok(groups.indexOf(weaponGroup)>groups.indexOf(0));
  assert.ok(clears.some(c=>c.group===weaponGroup&&c.depth),'clear world depth before drawing the weapon');
  assert.ok(parts.every(m=>!m.isPickable&&!m.receiveShadows));assert.ok(parts.every(m=>!m.material!.disableDepthWrite),'gun parts still occlude one another correctly');
  assert.equal(world.toggleScope(),true);world.update({x:8,z:-19},.1,{yaw:1,pitch:-.2});scene.render();assert.equal(root.isEnabled(),false);
  assert.equal(world.toggleScope(),false);world.update({x:7,z:-19},.1,{yaw:2,pitch:.2});scene.render();assert.equal(root.isEnabled(),true);
  world.setPreview(true,true);assert.equal(root.isEnabled(),false);scene.dispose();
 }finally{engine.dispose();}
});
