import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createWorld} from '../src/world.ts';
import {createMatchPickups} from '../src/match-pickups.ts';
import {createNetworkGame} from '../src/network-game.ts';
import {createHarborScene} from '../src/scene.ts';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';

for(const [map,width,depth] of [['snow',160,120],['moon',140,112]] as const){
 test(`${map}: approved bounds, open entrances, solid walls, safe supplies and restored server map`,()=>{
  const world=createWorld(map);
  assert.equal(world.PROTOTYPE.halfWidth,width/2);
  assert.equal(world.PROTOTYPE.halfDepth,depth/2);
  assert.equal(world.PROTOTYPE.maxZ,depth/2);
  assert.ok(!world.canStand({x:width/2,z:0},.55));
  const room=world.BUILDINGS[0]!;
  const entrance={x:room.x,z:room.z-room.depth/2},doors=world.createDoors();
  world.updateAutomaticDoors(doors,[entrance]);
  assert.ok(world.canStand(entrance,.55,world.worldSolids(doors)));
  assert.ok(!world.canStand({x:room.x+room.width/2,z:room.z+5},.55,world.worldSolids()));
  assert.equal(world.stairways(room).length,map==='moon'?1:0);
  for(const pickup of createMatchPickups(world,()=>.25))assert.ok(world.canStand(pickup,1,world.worldSolids()));
  const game=createNetworkGame(undefined,map);
  game.join('one');game.join('two');
  assert.equal(game.state.map,map);
  assert.equal(createNetworkGame(game.checkpoint()).state.map,map);
 });

 test(`${map}: all three Blender graphics models load and preserve world geometry`,async()=>{
  const engine=new NullEngine();
  const requests:string[]=[];
  const bytes=Object.fromEntries(await Promise.all(['low','medium','high'].map(async quality=>[quality,await readFile(new URL(`../public/maps/${map}-${quality}.glb`,import.meta.url))])));
  const world=createHarborScene(engine,{map,expansionArtSource:(_map,quality)=>{requests.push(quality);return bytes[quality];}});
  try{
   assert.equal(world.scene.getMaterialByName('sea'),null,'new maps do not allocate harbor water and skyline resources');
   const solids=world.geometry.worldSolids();
   await world.setQuality(false);
   assert.deepEqual(requests,['medium']);
   assert.ok(world.scene.getNodeByName(`${map}-art-medium`));
   assert.ok(world.scene.getMeshByName('expansion-ground'),'fallback ground supports loading failure');
   await world.setPerformanceLow(true);
   assert.deepEqual(requests,['medium','low']);
   assert.ok(world.scene.getNodeByName(`${map}-art-low`));
   assert.equal(world.scene.getNodeByName(`${map}-art-medium`),null);
   await world.setQuality(true);
   assert.deepEqual(requests,['medium','low','high']);
   assert.ok(world.scene.getNodeByName(`${map}-art-high`));
   assert.equal(world.geometry.worldSolids(),solids);
   const room=world.geometry.BUILDINGS[0]!;
   const wall=new Ray(new Vector3(room.x+room.width/2-2,1.5,room.z+5),new Vector3(1,0,0),4);
   assert.ok(world.scene.pickWithRay(wall,m=>m.isPickable&&m.isEnabled())?.hit,'shared wall remains shot-blocking at every quality');
   for(const mode of ['duel','ffa','survival'] as const){world.setMode(mode,'easy');world.update({...world.geometry.PROTOTYPE.spawn},.05);assert.equal(world.duelState().playerHealth,100);}
  }finally{world.scene.dispose();engine.dispose();}
 });
}
