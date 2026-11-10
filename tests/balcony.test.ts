import test from 'node:test';import assert from 'node:assert/strict';import {createWorld,type Point} from '../src/world.ts';
import {advancePlayerMotion,createNetworkGame,type Command} from '../src/network-game.ts';
import {createOnlineMotion} from '../src/online-motion.ts';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';

test('a jump from beside a staircase can land on a higher step',()=>{
 for(const map of ['harbor','factory'] as const){
  const world=createWorld(map),building=world.BUILDINGS.find(b=>b.enterable)!;
  const stair=world.stairways(building)[0]!;
  const z=stair.start.z+(stair.end.z-stair.start.z)*.2;
  const game=createNetworkGame(undefined,map),player=game.join('player');
  Object.assign(player,{x:stair.start.x+1.5,z,y:0});
  const command:Omit<Command,'seq'>={x:-1,y:0,yaw:0,pitch:0,jump:true,shot:false,fire:false,reload:false,sprint:false,scope:false};
  for(let frame=0;frame<40;frame++){
   Object.assign(player,advancePlayerMotion(player,{...command,jump:frame===0,x:frame<13?-1:0},.025,world.createDoors(),world));
  }
  assert.ok(player.x<stair.start.x+.9,'the airborne player clears the side of the stair');
  assert.ok(Math.abs(player.y!-.68)<1e-6,'landing keeps the player on the higher step');
  assert.equal(player.jump.height,0);
 }
});

test('offline scene uses jump height for stair collision and keeps the landing height',()=>{
 const engine=new NullEngine();
 try{
  const scene=createHarborScene(engine,{randomSpawns:false});
  const building=scene.geometry.BUILDINGS.find(b=>b.enterable)!;
  const stair=scene.geometry.stairways(building)[0]!;
  let p:Point={x:stair.start.x+1.5,z:stair.start.z+(stair.end.z-stair.start.z)*.2,y:0};
  assert.equal(scene.jump(),true);
  for(let frame=0;frame<40;frame++){
   p=scene.move(p,{x:frame<13?-.175:0,z:0});
   scene.update(p,.025);
  }
  assert.ok(p.x<stair.start.x+.9);
  assert.ok(Math.abs(p.y!-.68)<1e-6);
  assert.equal(scene.practiceState().grounded,true);
 }finally{engine.dispose();}
});

test('one online jump input cannot launch again on a stair landing in the same frame',()=>{
 const world=createWorld(),building=world.BUILDINGS.find(b=>b.enterable)!;
 const stair=world.stairways(building)[0]!,game=createNetworkGame();
 const me=game.join('me');game.join('opponent');
 Object.assign(me,{x:stair.start.x,z:stair.start.z+(stair.end.z-stair.start.z)*.2,y:0,jump:{height:.72,velocity:-3}});
 const motion=createOnlineMotion();motion.receive(game.state,me.id);
 const command:Omit<Command,'seq'>={x:0,y:0,yaw:0,pitch:0,jump:true,shot:false,fire:false,reload:false,sprint:false,scope:false};
 const landing=motion.advance(.1,command);
 assert.ok(Math.abs(landing.y!-.68)<1e-6);
 assert.deepEqual(motion.jump,{height:0,velocity:0});
});

test('falling across either stair surface lands on the ramp even at high speed',()=>{
 for(const map of ['harbor','factory'] as const){
  const world=createWorld(map),building=world.BUILDINGS.find(b=>b.enterable)!;
  for(const stair of world.stairways(building)){
   const x=stair.start.x,z=(stair.start.z+stair.end.z)/2,surface=(stair.start.y+stair.end.y)/2;
   const landed=world.advanceFall({x,z,y:surface+.35,fallSpeed:12},.05);
   assert.ok(Math.abs(landed.y!-surface)<1e-8);
   assert.equal(landed.fallSpeed,0);
  }
 }
});

test('players can leave the side of a staircase and steer while falling',()=>{
 const world=createWorld(),building=world.BUILDINGS.find(b=>b.enterable)!;
 const stair=world.stairways(building)[0]!;
 const start={x:stair.start.x,z:(stair.start.z+stair.end.z)/2,y:world.SECOND_FLOOR/2};
 const solids=world.worldSolids();
 const side=world.moveWithCollisions(start,{x:1.65,z:0},solids);
 assert.ok(side.x-start.x>1.55,'the interior must not act like an invisible railing');
 const falling=world.advanceFall(side,.05);
 assert.ok(falling.y!<start.y);
 const steered=world.moveWithCollisions(falling,{x:.2,z:0},solids);
 assert.ok(steered.x>falling.x);
 let landed=steered;
 for(let i=0;i<40;i++)landed=world.advanceFall(landed,.05);
 assert.equal(landed.y,0);
 assert.equal(landed.fallSpeed,0);
});
test('both maps provide a second-floor and rooftop balcony, with a gravity landing after leaving',()=>{
 for(const map of ['harbor','factory'] as const){const w=createWorld(map);for(const b of w.BUILDINGS.filter(b=>b.enterable))for(const y of [w.SECOND_FLOOR,b.height]){
  const f=b.z<0?1:-1;let p:Point={x:b.x,z:b.z+f*(b.depth/2-1),y};
  for(let i=0;i<18;i++)p=w.moveWithCollisions(p,{x:0,z:f*.1},w.worldSolids());
  assert.ok(Math.abs(p.z-b.z)>b.depth/2,'balcony reachable from inside');assert.equal(p.y,y);
  for(let i=0;i<30;i++)p=w.moveWithCollisions(p,{x:0,z:f*.1},w.worldSolids());
  const start=p.y; p=w.advanceFall(p,.05);assert.ok(p.y!<start!,'gravity starts outside balcony');
  for(let i=0;i<100;i++)p=w.advanceFall(p,.05);assert.equal(p.y,0);assert.equal(p.fallSpeed,0);
 }}
});
