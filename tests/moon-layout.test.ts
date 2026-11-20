import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {createWorld} from '../src/world.ts';
import {createHarborScene} from '../src/scene.ts';
import {createNetworkGame} from '../src/network-game.ts';
import {firstShotBox} from '../src/combat-geometry.ts';
import {beginJump,createJump} from '../src/jump.ts';
import {MOON_LAYOUT_REVISION,moonCorridor} from '../src/moon-layout.ts';
import {navigationLocation} from '../src/wayfinding.ts';

test('both interior ramps reach a supported second floor with a view of the landing area',()=>{
 const world=createWorld('moon'),doors=world.createDoors();
 for(const room of world.BUILDINGS){
  const ramp=world.stairways(room)[0]!;
  let position={...ramp.start,z:ramp.start.z-.5};
  for(let step=0;step<110;step++){
   position=world.moveWithCollisions(position,{x:0,z:.15},world.worldSolids(doors)) as typeof position;
   position=world.advanceFall(position,.02) as typeof position;
  }
  assert.equal(position.y,world.SECOND_FLOOR);
  assert.equal(navigationLocation(world,position).floor,'2F');
  const side=Math.sign(room.x);
  assert.ok(!firstShotBox(world,doors,{x:side*23,y:5.1,z:5.5},{x:side*9,y:4.7,z:4.5}));
  assert.ok(firstShotBox(world,doors,{x:side*23,y:3.75,z:5.5},{x:side*9,y:3.75,z:4.5}));
 }
});

test('the authoritative airlocks track nearby players and close behind them',()=>{
 const game=createNetworkGame(undefined,'moon',{mode:'ffa'});
 const player=game.join('one','pistol');
 game.step();
 assert.equal(game.state.layoutRevision,MOON_LAYOUT_REVISION);
 const doors=game.state.doors!,world=createWorld('moon'),z=moonCorridor.z;
 const door=world.automaticDoors[1]!,shot=()=>firstShotBox(world,doors,{x:door.x+2,y:1,z},{x:door.x-2,y:1,z});
 Object.assign(player,{x:door.x+1,y:0,z});
 game.step();
 assert.equal(doors[door.id],true);
 assert.equal(shot(),null);
 Object.assign(player,{x:door.x-3.5,y:0,z});
 game.step();
 assert.equal(doors[door.id],true);
 Object.assign(player,{x:0,y:0,z:-8});
 game.step();
 assert.equal(doors[door.id],false);
 assert.ok(shot());
 const legacy=game.checkpoint();
 delete legacy.layoutRevision;
 legacy.doors={};
 assert.ok(Object.hasOwn(createNetworkGame(legacy).state.doors!,door.id));
});

test('airlock artwork agrees with collision, including a full traversal between the buildings',()=>{
 const engine=new NullEngine();
 const scene=createHarborScene(engine,{map:'moon',randomSpawns:false});
 try{
  const world=scene.geometry,z=moonCorridor.z;
  const shoot=()=>scene.scene.pickWithRay(new Ray(new Vector3(19,1,z),new Vector3(1,0,0),3),mesh=>mesh.isPickable&&mesh.isEnabled());
  assert.equal(shoot()?.pickedMesh?.name,'moon-airlock-1-collider');
  let p={x:30,z};
  for(let i=0;i<240;i++){
   scene.update(p,.05);
   p=scene.move(p,{x:-.25,z:0});
  }
  assert.ok(p.x < -29,JSON.stringify(p));
  assert.match(navigationLocation(world,{x:0,z}).label,/연결 통로/);
  assert.equal(scene.doorState()['moon-airlock-1'],false);
  scene.update({x:21,z},.25);
  assert.equal(shoot()?.hit,false);
  assert.equal(scene.scene.getMeshByName('moon-airlock-1-panel-1')?.isEnabled(),false);
 }finally{scene.scene.dispose();engine.dispose();}
});

test('lower lunar gravity adds about thirty percent to outdoor jump height',()=>{
 const world=createWorld('moon');
 const height=(p:{x:number;z:number})=>{
  let state=beginJump(createJump()),peak=0;
  for(let tick=0;tick<100;tick++){
   state=world.advanceJumpOnTerrain(p,state,.01).jump;
   peak=Math.max(peak,state.height);
  }
  return peak;
 };
 const indoor=height({x:31,z:0}),outdoor=height({x:0,z:-8});
 assert.ok(indoor>.99&&indoor<=1.01);
 assert.ok(outdoor>1.29&&outdoor<1.31);
 assert.equal(world.jumpGravityAt({x:0,z:moonCorridor.z}),18);
});
