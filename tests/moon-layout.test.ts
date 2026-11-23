import {moonEclipse} from '../src/moon-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {createWorld} from '../src/world.ts';
import {createHarborScene} from '../src/scene.ts';
import {advancePlayerMotion,createNetworkGame} from '../src/network-game.ts';
import {firstShotBox} from '../src/combat-geometry.ts';
import {createJump} from '../src/jump.ts';
import {createWeapon} from '../src/combat.ts';
import {WEAPONS} from '../src/weapons.ts';
import {MOON_LAYOUT_REVISION,moonCorridor,nearbyMoonMaskRack,moonMaskRacks} from '../src/moon-layout.ts';
import {navigationLocation} from '../src/wayfinding.ts';

test('both interior ramps reach a supported second floor with a view of the landing area',()=>{
 const world=createWorld('moon'),doors=world.createDoors();
 for(const room of world.BUILDINGS.slice(0,2)){
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
  assert.match(navigationLocation(world,{x:8,z}).label,/연결 통로/);
  assert.equal(scene.doorState()['moon-airlock-1'],false);
  scene.update({x:21,z},.25);
  assert.equal(shoot()?.hit,false);
  assert.equal(scene.scene.getMeshByName('moon-airlock-1-panel-1')?.isEnabled(),false);
 }finally{scene.scene.dispose();engine.dispose();}
});

test('scene and shared online motion rise and land at Earth and lunar rates',()=>{
 const world=createWorld('moon');
 const engine=new NullEngine();
 const scene=createHarborScene(engine,{map:'moon',randomSpawns:false});
 const command={x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false};
 try{
  for(const [point,gravity,maxHeight] of [
   [{x:31,z:0},9.81,1],
      [{x:0,z:-8},1.62,1.7**2/(2*1.62)],
  ] as const){
   const p={...point},dt=.01;
   const launch=Math.sqrt(2*gravity*maxHeight),apex=launch/gravity;
   let player={...p,health:100,weapon:createWeapon(WEAPONS.pistol),cooldown:0,jump:createJump()};
   let peak=0,landing=0;
   scene.update(p,0);
   assert.equal(scene.jump(p),true);
   for(let tick=1;tick<=360;tick++){
    player={...player,...advancePlayerMotion(player,{...command,jump:tick===1},dt,world.createDoors(),world)};
    scene.update(p,dt);
    const t=tick*dt,expected=Math.max(0,launch*t-gravity*t*t/2);
    assert.ok(Math.abs(player.jump.height-expected)<1e-8,`online jump at ${t}s for gravity ${gravity}`);
    assert.ok(Math.abs(scene.practiceState().jumpHeight-expected)<1e-8,`local jump at ${t}s for gravity ${gravity}`);
    peak=Math.max(peak,player.jump.height);
    if(player.jump.velocity===0&&scene.practiceState().grounded){landing=t;break;}
   }
   assert.ok(Math.abs(peak-maxHeight)<.001);
   assert.ok(landing>=2*apex&&landing<=2*apex+dt);
  }
 }finally{scene.scene.dispose();engine.dispose();}
});

test('lunar falls accelerate continuously, including a jump off an upper floor',()=>{
 const world=createWorld('moon');
 for(const [point,gravity] of [[{x:31,z:0},9.81],[{x:0,z:-8},1.62]] as const){
  const start={...point,y:world.SECOND_FLOOR};
  const fall=world.advanceFall(start,.2);
  assert.ok(Math.abs(fall.y!-(start.y-.5*gravity*.2**2))<1e-8);
  assert.ok(Math.abs(fall.fallSpeed!-gravity*.2)<1e-8);
  const landed=world.advanceFall(fall,3);
  assert.equal(landed.y,0);
  assert.equal(landed.fallSpeed,0);
 }
 const p={x:31,z:0,y:world.SECOND_FLOOR};
 // The actor has moved beyond the mezzanine while still descending.
 const result=world.advanceJumpOnTerrain(p,{height:.04,velocity:-3},.05);
 assert.deepEqual(result.jump,createJump());
 assert.ok(Math.abs(result.position.y!-(p.y+.04-3*.05-.5*9.81*.05**2))<1e-8);
 assert.ok(Math.abs(result.position.fallSpeed!-(3+9.81*.05))<1e-8);
});

test('the suit drains in vacuum, refills in an outer shelter and takes damage when empty',()=>{
 const world=createWorld('moon'),game=createNetworkGame(undefined,'moon',{mode:'ffa'});
 const player=game.join('oxygen','pistol');
 Object.assign(player,{x:0,z:-8,y:0,protection:0});
 for(let i=0;i<200;i++)game.step();
 assert.ok(Math.abs(player.oxygen!-80)<.001);
 const shelter=world.BUILDINGS.find(b=>b.id.startsWith('moon-shelter-'))!;
 assert.ok(shelter&&Math.abs(shelter.x)>50);
 Object.assign(player,{x:shelter.x,z:shelter.z});
 for(let i=0;i<40;i++)game.step();
 assert.equal(player.oxygen,100);
 Object.assign(player,{x:0,z:-8,oxygen:0});
 for(let i=0;i<20;i++)game.step();
 assert.ok(Math.abs(player.health-92)<.001);
});

test('the eclipse clock warns, darkens the surface, and stays synchronized with an online match',()=>{
 const engine=new NullEngine(),scene=createHarborScene(engine,{map:'moon',randomSpawns:false});
 try{
  const game=createNetworkGame(undefined,'moon',{mode:'ffa'}),player=game.join('viewer','pistol');
  const outside={x:0,z:-8};
  Object.assign(player,outside);
  const seed=game.state.weatherSeed!,cycle=moonEclipse(0,seed);
  const restart=moonEclipse(cycle.end,seed);
  assert.equal(createNetworkGame(game.checkpoint()).state.weatherSeed,seed);
  assert.ok(restart.start-cycle.end>=55);
  const lengths=new Set(Array.from({length:24},(_,i)=>moonEclipse(0,i+1)).map(e=>e.end-e.start));
  assert.ok(lengths.size>1&&[...lengths].every(n=>n>=15&&n<=35));
  for(const [seconds,warning,active] of [[cycle.start-4,4,false],[cycle.start+5,0,true],[cycle.end,0,false],[restart.start-4,4,false]] as const){
   game.state.weatherTime=seconds;
   scene.renderOnline(game.state,player.id,{yaw:0,pitch:0},.05);
   assert.equal(scene.eclipseState()?.warning,warning);
   assert.equal(scene.eclipseState()?.active,active);
   assert.ok(scene.scene.getLightByName('moon')!.intensity>=.7,'outdoor eclipse retains direct illumination');
   assert.equal(scene.scene.getMeshByName('eclipse-solar-corona')?.isEnabled(),active);
  }
 }finally{scene.scene.dispose();engine.dispose();}
});

test('four refill shelters have walkable entrances and keep vacuum outdoors',()=>{
 const world=createWorld('moon'),doors=world.createDoors();
 const shelters=world.BUILDINGS.filter(b=>b.id.startsWith('moon-shelter-'));
 assert.equal(shelters.length,4);
 for(const b of shelters){
  const side=b.z<0?1:-1;
  let point={x:b.x,z:b.z+side*5};
  assert.equal(world.hasLunarOxygen(point),false);
  for(let i=0;i<25;i++){world.updateAutomaticDoors(doors,[point]);point=world.moveWithCollisions(point,{x:0,z:-side*.2},world.worldSolids(doors));}
  assert.ok(Math.abs(b.z-point.z)<.01);
  assert.equal(world.hasLunarOxygen(point),true);
  assert.equal(world.hasLunarOxygen({...point,y:b.height+.5}),false);
 }
});

test('the server only gives one wall mask and requires discarding it after use',()=>{
 const game=createNetworkGame(undefined,'moon',{mode:'ffa'}),p=game.join('mask','pistol');
 const command={seq:0,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false};
 const act=(oxygenMask:string)=>{assert.ok(game.input(p.id,{...command,seq:++command.seq,oxygenMask}));game.step();};
 Object.assign(p,{x:0,z:-8,y:0});
 act('light');
 assert.equal(p.oxygenMask?.id,undefined);
 const rack=moonMaskRacks(game.state.weatherSeed!)[0]!;
 const spot={x:rack.x-rack.side*.85,z:rack.z};
 Object.assign(p,{...spot,y:0});
 act('light');
 assert.equal(p.oxygenMask?.id,'light');
 assert.equal(p.oxygenMask?.remaining,0);
 act('extended');act('discard');
 assert.equal(p.oxygenMask?.id,'light');
 Object.assign(p,{x:0,z:-8,y:0});
 act('wear');
 assert.ok(p.oxygenMask!.remaining>19);
 act('discard');
 assert.equal(p.oxygenMask?.id,'light');
 for(let tick=0;tick<400;tick++)game.step();
 assert.equal(p.oxygenMask?.remaining,0);
 act('discard');
 assert.equal(p.oxygenMask?.id,undefined);
 Object.assign(p,{...spot,y:3.4});
 act('extended');
 assert.equal(p.oxygenMask?.id,undefined);
 Object.assign(p,{y:0});
 act('extended');
 assert.equal(p.oxygenMask?.id,'extended');
});

test('match seeds choose multiple wall racks in every building',()=>{
 const world=createWorld('moon');
 const layout=(seed:number)=>world.BUILDINGS.map(room=>{
  const racks=new Set();
  for(let x=room.x-room.width/2+.6;x<=room.x+room.width/2-.5;x+=.5){
   for(let z=room.z-room.depth/2+.6;z<room.z+room.depth/2-.5;z+=.5){
    const rack=nearbyMoonMaskRack({x,z},seed);
    if(rack)racks.add(`${rack.x},${rack.z}`);
   }
  }
  return [...racks].sort();
 });
 assert.deepEqual(layout(101).map(racks=>racks.length),[3,3,2,2,2,2]);
 assert.deepEqual(layout(101),layout(101));
 assert.notDeepEqual(layout(101),layout(501));
});

test('exterior airlocks block shots until approached and moon ceilings stop jumps',()=>{
 const world=createWorld('moon'),doors=world.createDoors(),room=world.BUILDINGS[0]!;
 const z=-room.depth/2;
 const ray=()=>firstShotBox(world,doors,{x:room.x,y:1,z:z-3},{x:room.x,y:1,z:z+2});
 assert.ok(ray());
 world.updateAutomaticDoors(doors,[{x:room.x,z:z-2}]);
 assert.equal(ray(),null);
 world.updateAutomaticDoors(doors,[]);
 assert.ok(ray());
 const point={x:8,z:moonCorridor.z};
 let jump=world.beginJumpAt(point,createJump()),peak=0;
 for(let i=0;i<100;i++){jump=world.advanceJumpOnTerrain(point,jump,.01).jump;peak=Math.max(peak,jump.height);}
 assert.ok(peak>.6&&peak<=.68001);
 assert.deepEqual(jump,createJump());
});

test('the center plaza can be crossed without jumping through the link walls',()=>{
 const world=createWorld('moon'),doors=world.createDoors();
 let p={x:0,z:5};
 for(let i=0;i<60;i++)p=world.moveWithCollisions(p,{x:0,z:.25},world.worldSolids(doors));
 assert.ok(p.z>19);
 assert.equal(world.hasLunarOxygen({x:0,z:moonCorridor.z}),false);
 assert.equal(world.hasLunarOxygen({x:8,z:moonCorridor.z}),true);
});
