import test from 'node:test';
import assert from 'node:assert/strict';
import * as world from '../src/world.ts';
import {createDuel,createBotMatch,createSurvivalMatch} from '../src/duel.ts';
test('respawn grants three seconds of protection and firing ends it',()=>{
 const duel=createDuel();duel.hurt('player',100);duel.update(3,{x:0,z:-8},()=>false,()=>false);
 assert.equal((duel.state() as any).protection,3,'respawn must provide three protected seconds');
 duel.hurt('player',100);assert.equal(duel.state().playerHealth,100,'protected player ignores damage');
 (duel as any).playerFired();duel.hurt('player',25);assert.equal(duel.state().playerHealth,75);
});
test('doors start closed, block movement, validate distance and refuse to close on an actor',()=>{
 const w=world as any;assert.equal(typeof w.createDoors,'function','buildings need per-match door state');
 const doors=w.createDoors(),b=world.BUILDINGS.find(b=>b.enterable)!,front=b.z<0?1:-1;
 const p={x:b.x,z:b.z+front*(b.depth/2+1),y:0};const rect=w.doorRect(b);
 assert.equal(world.canStand(rect,world.PROTOTYPE.radius,w.worldSolids(doors)),false);
 assert.equal(w.toggleDoor(doors,b.id,{x:0,z:0},[]),false,'remote requests are rejected');
 assert.equal(w.toggleDoor(doors,b.id,p,[]),true);assert.equal(world.canStand(rect,world.PROTOTYPE.radius,w.worldSolids(doors)),true);
 assert.equal(w.toggleDoor(doors,b.id,p,[rect]),false,'closing never traps an actor');
});
test('stairs continuously connect ground, second floor and roof without teleporting between floors',()=>{
 const w=world as any;assert.equal(typeof w.stairways,'function');
 for(const b of world.BUILDINGS.filter(b=>b.enterable))for(const s of w.stairways(b)){
  let p={...s.start};const dx=s.end.x-s.start.x,dz=s.end.z-s.start.z,n=120;
  for(let i=0;i<n;i++)p=world.moveWithCollisions(p,{x:dx/n,z:dz/n},w.worldSolids(w.createDoors()));
  assert.ok(Math.abs(p.y-s.end.y)<.05,`${b.id} stair reaches ${s.end.y}`);
  assert.ok(Math.hypot(p.x-s.end.x,p.z-s.end.z)<.1);
 }
});
test('random bot spawn candidates are outdoors on ground with clearance from all actors',()=>{
 const w=world as any;assert.equal(typeof w.randomOutdoorSpawn,'function');
 const points=new Set<string>();for(let i=0;i<80;i++){const p=w.randomOutdoorSpawn([{x:0,z:-8}],()=>i/80);assert.equal(p.y??0,0);assert.equal(world.indoorAt(p),undefined);assert.ok(world.canStand(p,world.PROTOTYPE.radius));assert.ok(Math.hypot(p.x,p.z+8)>=12);points.add(`${p.x},${p.z}`);}assert.ok(points.size>10);
});
test('group and survival respawn protection blocks a surrounding mob and expires during play',()=>{
 for(const match of [createBotMatch(),createSurvivalMatch('easy',{prepareSeconds:0,initialEnemies:3,increaseEvery:2,maxEnemies:12,restoreBetweenWaves:true})]){
  match.update(.05,{x:0,z:-8},()=>false,()=>false);match.hurtPlayer('bot-1',100);match.update(3,{x:0,z:-8},()=>false,()=>false);
  assert.equal((match.state() as any).protection,3);match.hurtPlayer('bot-1',100);assert.equal(match.state().playerHealth,100);
  match.update(3,{x:0,z:-8},()=>false,()=>false);match.hurtPlayer('bot-1',25);assert.equal(match.state().playerHealth,75);
 }
});

test('server owns door interaction, stair height and protected damage',async()=>{
 const {createNetworkGame}=await import('../src/network-game.ts');const game=createNetworkGame();const a=game.join('a','sniper'),b=game.join('b');const w=world as any;
 const building=world.BUILDINGS.find(b=>b.enterable)!,door=w.doorRect(building);a.x=door.x;a.z=door.z+1;
 const command=(seq:number,extra:any={})=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...extra});
 game.input('a',command(1,{door:building.id}));game.step();assert.equal(game.state.doors?.[building.id],true);
 game.step();assert.equal(game.state.doors?.[building.id],true,'one-shot door command does not repeat');
 const stair=w.stairways(building)[0];a.x=stair.start.x;a.z=stair.start.z;a.y=0;
 for(let i=0;i<32;i++){game.input('a',command(i+2,{y:-1}));game.step();}
 assert.ok((a.y??0)>3.3,'server steps reach the second floor');
 a.x=0;a.z=-8;a.y=0;a.yaw=0;b.x=0;b.z=0;b.y=0;b.protection=3;
 game.input('a',command(100,{shot:true}));game.step();assert.equal(b.health,100,'server rejects damage during protection');
 b.protection=3;game.input('b',command(1,{shot:true}));game.step();assert.equal(b.protection,0,'firing clears own protection');
 b.health=0;b.dead=.01;game.step();assert.equal(b.protection,3);assert.equal(b.y,0);assert.equal(world.indoorAt(b),undefined);
});
test('bots navigate the stair route to an upstairs target rather than aiming through its floor',async()=>{
 const {verticalRoute}=await import('../src/duel.ts');const w=world as any,b=world.BUILDINGS.find(b=>b.enterable)!,stairs=w.stairways(b);
 const route=verticalRoute({x:0,z:-8},{...stairs[1].end});assert.ok(route.length>=4,'route includes both stairs and the second-floor landing');
 let p:any={x:0,z:-8};for(const target of route){const distance=Math.hypot(target.x-p.x,target.z-p.z),steps=Math.max(1,Math.ceil(distance/.08));const dx=(target.x-p.x)/steps,dz=(target.z-p.z)/steps;for(let i=0;i<steps;i++)p=world.moveWithCollisions(p,{x:dx,z:dz},w.worldSolids());}
 assert.ok(Math.abs(p.y-b.height)<.1,'bot route actually walks to roof');
});

test('server floors block cross-storey bullets while same-storey hits remain authoritative',async()=>{
 const {createNetworkGame}=await import('../src/network-game.ts');const game=createNetworkGame(),a=game.join('a','sniper'),b=game.join('b');const house=world.BUILDINGS.find(b=>b.enterable)!;
 a.x=house.x;a.z=house.z;a.y=0;b.x=house.x;b.z=house.z+3;b.y=3.4;
 const command=(seq:number,pitch:number)=>({seq,x:0,y:0,yaw:0,pitch,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false});
 game.input('a',command(1,-Math.atan2(3.4,3)));game.step();assert.equal(b.health,100,'second-floor slab intercepts the rising bullet');
 a.y=3.4;a.cooldown=0;game.input('a',command(2,0));game.step();assert.equal(b.health,17.5,'same-floor sniper headshot damages without one-shot elimination');
});
test('actual doors stay dynamic after batching and rooftop scenery matches collision height',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine.js');const {createHarborScene}=await import('../src/scene.ts');const e=new NullEngine();try{
  const scene=createHarborScene(e),building=world.BUILDINGS.find(b=>b.enterable)!,door=(world as any).doorRect(building),actor={x:door.x,z:door.z+1};
  const mesh=scene.scene.getMeshByName(building.id+'-interactive-door')!;assert.ok(mesh&&!mesh.isDisposed(),'door must survive static batching');assert.equal(mesh.isWorldMatrixFrozen,false);
  assert.equal(scene.toggleDoor(actor,building.id),true);assert.ok(Math.abs(mesh.rotation.y)>1.5);assert.equal(mesh.isPickable,false);
  assert.equal(scene.toggleDoor(actor,building.id),true);assert.equal(mesh.rotation.y,0);assert.equal(mesh.isPickable,true);
  assert.equal(scene.scene.meshes.filter(m=>m.material?.name==='navigation-signs').reduce((n,m)=>n+m.getTotalIndices()/12,0),18,'six buildings have three complete double-sided floor signs in one batch');
  const roof={x:building.x,z:building.z,y:building.height};scene.setMode('practice');scene.update(roof,0);assert.equal(scene.camera.position.y,building.height+1.95);
  for(let i=0;i<5;i++){scene.setMode('duel');const state=scene.duelState();assert.equal(world.indoorAt(state.position),undefined);assert.equal(state.position.y??0,0);}
  scene.scene.dispose();
 }finally{e.dispose();}
});

test('a pursuing bot opens the real door and climbs both stairs to a rooftop target',()=>{
 const b=world.BUILDINGS.find(b=>b.enterable)!,doors=world.createDoors(),d=world.doorRect(b),goal=world.stairways(b)[1]!.end;
 const bot=createDuel('normal',{x:b.x,z:d.z+4},undefined,{doors,randomSpawns:true});for(let i=0;i<900;i++)bot.update(.05,goal,()=>false,()=>false);
 assert.equal(doors[b.id],true);assert.ok(Math.hypot(bot.state().position.x-goal.x,bot.state().position.z-goal.z)<.2);assert.ok(Math.abs((bot.state().position.y??0)-goal.y)<.1);
});
test('bot separation resolves crowding without walking through collision walls',()=>{
 const a=createDuel('normal',{x:0,z:18}),b=createDuel('normal',{x:.2,z:18});
 for(let i=0;i<30;i++){a.separate([b.state().position]);b.separate([a.state().position]);}
 assert.ok(Math.hypot(a.state().position.x-b.state().position.x,a.state().position.z-b.state().position.z)>=1.4);assert.ok(world.canStand(a.state().position,world.PROTOTYPE.radius));assert.ok(world.canStand(b.state().position,world.PROTOTYPE.radius));
});
