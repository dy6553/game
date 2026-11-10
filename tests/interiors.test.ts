import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createHarborScene } from '../src/scene.ts';
import { BUILDINGS,PROTOTYPE,SECOND_FLOOR,canStand,moveWithCollisions,buildingWalls,indoorAt } from '../src/world.ts';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { findRoute } from '../src/duel.ts';

test('six interiors have traversable doorways and furniture and walls stay solid',()=>{
 const rooms=BUILDINGS.filter(b=>b.enterable);assert.equal(rooms.length,6);
 for(const b of rooms){
  assert.ok(canStand(b,PROTOTYPE.radius));assert.equal(indoorAt(b)?.id,b.id);
  const front=b.z<0?1:-1;let p={x:b.x,z:b.z+front*(b.depth/2+2)};
  for(let i=0;i<24;i++)p=moveWithCollisions(p,{x:0,z:-front*.3});
  assert.ok(Math.abs(p.z-b.z)<2,`walk into ${b.id}`);
  for(const wall of buildingWalls(b))assert.equal(canStand(wall,PROTOTYPE.radius),false);
  const route=findRoute(PROTOTYPE.spawn,b);assert.ok(route.length,`bot route into ${b.id}`);
  for(const waypoint of route)assert.ok(canStand(waypoint,PROTOTYPE.radius));
 }
 assert.ok(canStand({x:0,z:-57},PROTOTYPE.radius));assert.ok(canStand({x:61,z:0},PROTOTYPE.radius));
 assert.equal(canStand({x:0,z:36},PROTOTYPE.radius),false,'harbor water stays outside walking bounds');
});

test('interior lighting eases in at the doorway and follows upper floors without lighting the roof',()=>{
 const engine=new NullEngine();
 try{
  const world=createHarborScene(engine),b=BUILDINGS.find(item=>item.enterable)!;
  const lamp=world.scene.getLightByName(b.id+'-interior-light');
  assert.ok(lamp instanceof PointLight);
  const front=b.z<0?1:-1;
  const doorway=(inset:number)=>({x:b.x,z:b.z+front*(b.depth/2-inset)});
  world.update(doorway(-1.4),0);
  assert.equal(lamp.isEnabled(),false);
  world.update(doorway(.3),0);
  assert.ok(lamp.isEnabled());
  const threshold=lamp.intensity;
  world.update(b,0);
  assert.ok(threshold>0&&threshold<lamp.intensity,'room light changes gradually instead of switching at the wall');
  assert.ok(lamp.intensity<1.4,'direct room light is capped below the previous value');
  const downstairs=lamp.position.y;
  world.update({...b,y:SECOND_FLOOR},0);
  assert.ok(lamp.position.y>downstairs+2);
  world.update({...b,y:b.height},0);
  assert.equal(lamp.isEnabled(),false);
 }finally{engine.dispose();}
});
test('actual scene doorway rays pass through openings while adjacent walls block shots',()=>{
 const engine=new NullEngine({renderWidth:960,renderHeight:540,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
 try{
  const world=createHarborScene(engine);world.update(PROTOTYPE.spawn,0);world.scene.render();
  for(const b of BUILDINGS.filter(b=>b.enterable)){
   const front=b.z<0?1:-1;
   const start=new Vector3(b.x,1.95,b.z+front*(b.depth/2+1));
   const pick=(x:number)=>world.scene.pickWithRay(new Ray(new Vector3(x,start.y,start.z),new Vector3(0,0,-front),4),m=>m.isPickable&&m.isEnabled());
   assert.equal(pick(b.x)?.hit,true,'closed door blocks bullets');assert.equal(world.toggleDoor({x:b.x,z:start.z},b.id),true);world.scene.render();
   assert.equal(pick(b.x)?.hit,false,`${b.id} doorway has no invisible visual wall`);
   assert.equal(pick(b.x+b.width*.35)?.hit,true,`${b.id} wall blocks bullets`);
  }
  const b=BUILDINGS.find(b=>b.enterable)!;world.update(b,0);world.scene.render();
  assert.ok(world.scene.getLightByName(b.id+'-interior-light')!.isEnabled());
  world.update(PROTOTYPE.spawn,0);assert.equal(world.scene.getLightByName(b.id+'-interior-light')!.isEnabled(),false);
  world.scene.dispose();
 }finally{engine.dispose();}
});
