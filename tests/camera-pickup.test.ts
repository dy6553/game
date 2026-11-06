import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {createHarborScene} from '../src/scene.ts';
import {createNetworkGame,type Command} from '../src/network-game.ts';
const c=(seq:number,extra:Record<string,unknown>={}):Command=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...extra});
const engine=()=>new NullEngine({renderWidth:640,renderHeight:360,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
test('dragging after recoil recovery keeps the horizon level at different yaw and pitch',()=>{
 const e=engine();try{const world=createHarborScene(e);world.setMode('practice');world.update({x:0,z:-8},.016,{yaw:0,pitch:.6});world.shoot();world.update({x:0,z:-8},.01,{yaw:0,pitch:.6});world.scene.render();world.update({x:0,z:-8},2,{yaw:0,pitch:.6});world.scene.render();
 for(const yaw of [1,2,-2,-1]){world.update({x:0,z:-8},.016,{yaw,pitch:.4});world.scene.render();assert.ok(Math.abs(world.camera.getDirection(Vector3.Right()).y)<1e-5,'world horizontal must remain horizontal after a drag');}world.scene.dispose();}finally{e.dispose();}
});
test('online jump advances smoothly between server snapshots instead of repeating step heights',()=>{
 const e=engine();try{const world=createHarborScene(e),game=createNetworkGame();game.join('me');game.join('other');game.input('me',c(1,{jump:true}));game.step();
 world.renderOnline(game.state,'me',{yaw:0,pitch:0},1/60);const first=world.camera.position.y;
 world.renderOnline(game.state,'me',{yaw:0,pitch:0},1/60);assert.ok(world.camera.position.y>first+.02,'camera continues its jump between 20Hz packets');world.scene.dispose();}finally{e.dispose();}
});
test('server validates nearby pickups, capacity, replacement, slot ammo and start-weapon respawn',()=>{
 const game=createNetworkGame(),a:any=game.join('a','pistol');game.join('b');a.z=-4;
 game.input('a',c(1,{pickup:'crate-machinegun'}));game.step();assert.equal(a.weaponId,'machinegun','nearby supply box must grant its gun without resetting the match');
 a.weapon.ammo=19;a.x=8;a.z=0;game.input('a',c(2,{pickup:'crate-shotgun'}));game.step();assert.deepEqual(a.inventory.slots.map((s:any)=>s.id),['pistol','machinegun','shotgun']);
 a.x=-8;game.input('a',c(3,{pickup:'crate-sniper'}));game.step();assert.equal(a.weaponId,'shotgun','full inventory must wait for explicit replacement');
 game.input('a',c(4,{pickup:'crate-sniper',replace:2}));game.step();assert.equal(a.weaponId,'sniper');
 game.input('a',c(5,{slot:1}));game.step();assert.equal(a.weaponId,'machinegun');assert.equal(a.weapon.ammo,19,'switching preserves ammo');
 a.health=0;a.dead=.05;game.step();assert.equal(a.weaponId,'pistol');assert.deepEqual(a.inventory.slots.map((s:any)=>s.id),['pistol']);
});
test('out-of-range, duplicate and consumed boxes cannot grant extra weapons; boxes return after 20 seconds',()=>{
 const game=createNetworkGame(),a:any=game.join('a');game.join('b');game.input('a',c(1,{pickup:'crate-machinegun'}));game.step();assert.equal(a.weaponId,'pistol');
 a.z=-4;game.input('a',c(2,{pickup:'crate-machinegun'}));game.step();const crate=(game.state as any).pickups.find((p:any)=>p.id==='crate-machinegun');assert.ok(crate.remaining>19);
 a.weapon.ammo=7;game.input('a',c(3,{pickup:'crate-machinegun'}));game.step();assert.equal(a.weapon.ammo,7);assert.equal(a.inventory.slots.length,2);
 for(let i=0;i<402;i++)game.step();assert.equal(crate.remaining,0);game.input('a',c(4,{pickup:'crate-machinegun'}));game.step();assert.equal(a.weapon.ammo,7,'duplicate gun never refills ammo');assert.equal(crate.remaining,0);
});
test('online weapon switch clears sniper scope without resetting scores or health',()=>{
 const e=engine();try{const world=createHarborScene(e),game=createNetworkGame(),a=game.join('me','sniper');game.join('other');world.selectWeapon('sniper');world.renderOnline(game.state,'me',{yaw:0,pitch:0},.016);assert.equal(world.toggleScope(),true);
 a.kills=3;a.health=75;a.z=-4;game.input('me',c(1,{pickup:'crate-machinegun'}));game.step();world.renderOnline(game.state,'me',{yaw:0,pitch:0},.016);assert.equal(world.practiceState().scoped,false,'non-sniper weapons must not stay zoomed');assert.equal(a.kills,3);assert.equal(a.health,75);world.scene.dispose();}finally{e.dispose();}
});
test('changing to a stowed gun advances its cooldown exactly once per server step',()=>{
 const game=createNetworkGame(),a:any=game.join('a');game.join('b');a.z=-4;game.input('a',c(1,{pickup:'crate-machinegun'}));game.step();a.inventory.slots[0].cooldown=.2;
 game.input('a',c(2,{slot:0}));game.step();assert.ok(Math.abs(a.cooldown-.15)<1e-8,'switching cannot accelerate a cooldown');
});
