import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame} from '../src/network-game.ts';
import {frightenWildlife,wildlifeMovementRange,advanceWildlife,animalPose,nearbyMeat,takeMeat,meatRecovery,MEAT_CAPACITY,createWildlife,hurtWildlife,wildlifeHit} from '../src/wildlife.ts';
import {createWorld} from '../src/world.ts';

test('a meat drop can be stored once at full health and the animal respawns',()=>{
  const animals=createWildlife();
  const world=createWorld('snow');
  const position=animalPose(0,1);
  assert.equal(hurtWildlife(animals,0,100,1),55);
  assert.equal(hurtWildlife(animals,0,100,2),0);
  const id=nearbyMeat(animals,position,world,{})!.id;
  assert.equal(takeMeat(animals,{...position,y:3},0,world,{},id),false);
  assert.equal(takeMeat(animals,position,MEAT_CAPACITY,world,{},id),false);
  assert.equal(takeMeat(animals,position,0,world,{},id),true);
  assert.equal(takeMeat(animals,position,1,world,{},id),false);
  assert.equal(meatRecovery(1,100),0);
  assert.equal(meatRecovery(1,89),11);
  assert.equal(meatRecovery(1,0),0);
  assert.equal(meatRecovery(0,60),0);
  advanceWildlife(animals,30.99);
  assert.equal(animals[0]!.health,0);
  advanceWildlife(animals,31);
  assert.deepEqual(animals[0],{health:55,respawnAt:0});
});

test('an animal behind a nearer wall or player cannot be hit',()=>{
  const animals=createWildlife();
  const {x,z}=animalPose(1,0);
  const origin={x,y:1,z:z-5};
  const direction={x:0,y:0,z:1};
  assert.equal(wildlifeHit(animals,0,origin,direction,3),undefined);
  assert.equal(wildlifeHit(animals,0,origin,direction,8)?.index,1);
});

test('online snow room processes shooting, meat and recovery on the server',()=>{
  const game=createNetworkGame(undefined,'snow',{mode:'ffa'});
  const player=game.join('hunter','pistol');
  const {x,z}=animalPose(0,.05);
  Object.assign(player,{x,z:z-3,y:0});
  const command={x:0,y:0,yaw:0,pitch:Math.atan2(1.55,3),fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false};
  for(let seq=0;seq<10 && game.state.animals![0]!.health>0;seq++){
    const target=animalPose(0,game.state.weatherTime!+.05,game.state.animals![0]);
    Object.assign(player,{x:target.x,z:target.z-3});
    assert.equal(game.input(player.id,{...command,seq}),true);
    game.step();
    if(seq===0)assert.ok(game.state.animals![0]!.flight);
    for(let i=0;i<7;i++)game.step();
  }
  const animal=game.checkpoint().animals![0]!;
  assert.equal(animal.health,0);
  assert.ok(animal.meat);
  assert.equal(player.kills,0);
  Object.assign(player,{...animal.meat,health:100});
  game.step();
  assert.ok(game.state.animals![0]!.meat,'walking past a drop leaves it on the ground');
  const pickup=nearbyMeat(game.state.animals,player,createWorld('snow'),game.state.doors!)!.id;
  assert.equal(game.input(player.id,{...command,seq:20,shot:false,pickup}),true);
  game.step();
  assert.equal(player.meat,1);
  assert.equal(player.health,100);
  assert.equal(game.state.animals![0]!.meat,undefined);
  assert.equal(game.input(player.id,{...command,seq:21,shot:false,eatMeat:true}),true);
  game.step();
  assert.equal(player.meat,1,'full health preserves the stored meat');
  player.health=60;
  assert.equal(game.input(player.id,{...command,seq:22,shot:false,eatMeat:true}),true);
  assert.equal(game.input(player.id,{...command,seq:23,shot:false}),true);
  game.step();
  assert.equal(player.health,85);
  assert.equal(player.meat,0);
  assert.equal(game.state.toolEvents[0]?.kind,'heal');
  game.step();
  assert.equal(player.health,85);
});

test('all twelve wildlife paths and meat drops stay outdoors and respawn independently',()=>{
  const world=createWorld('snow');
  const solids=world.worldSolids(world.createDoors());
  const animals=createWildlife();
  assert.equal(animals.length,12);
  for(const index of animals.keys()){
    for(let time=0;time<50;time+=.25){
      const pose=animalPose(index,time);
      assert.equal(world.indoorAt(pose),undefined);
      assert.ok(world.canStand(pose,1.36,solids));
    }
  }
  hurtWildlife(animals,3,1000,12);
  hurtWildlife(animals,6,1000,17);
  assert.equal(world.indoorAt(animals[3]!.meat!),undefined);
  advanceWildlife(animals,42);
  assert.equal(animals[3]!.health,55);
  assert.equal(animals[6]!.health,0);
  advanceWildlife(animals,47);
  assert.equal(animals[6]!.health,55);
});

test('old snow room checkpoints keep original animals and add new ones',()=>{
  const game=createNetworkGame(undefined,'snow');
  const old=game.checkpoint();
  old.animals=old.animals!.slice(0,3);
  hurtWildlife(old.animals,1,1000,10);
  const restored=createNetworkGame(old).state.animals!;
  assert.deepEqual(restored.slice(0,3),old.animals);
  assert.equal(restored.length,12);
});


test('quiet movement leaves wildlife alone and nearby sprinting causes a quick outdoor retreat',()=>{
  const world=createWorld('snow');
  const doors=world.createDoors();
  const solids=world.worldSolids(doors);
  const animals=createWildlife();
  const start=animalPose(0,0);
  const source={x:start.x,z:start.z-3};
  frightenWildlife(animals,0,source,wildlifeMovementRange(7),world,doors);
  assert.equal(animals[0]!.flight,undefined);
  frightenWildlife(animals,0,source,wildlifeMovementRange(10.5),world,doors);
  const flight=animals[0]!.flight!;
  assert.ok(flight);
  const after=animalPose(0,.5,animals[0]);
  assert.ok(after.speed>start.speed&&after.speed<animalPose(0,1,animals[0]).speed);
  assert.ok(Math.hypot(after.x-source.x,after.z-source.z)>3);
  assert.ok(Math.hypot(flight.to.x-start.x,flight.to.z-start.z)>19);
  for(let time=0;time<flight.resume;time+=.05){
    const position=animalPose(0,time,animals[0]);
    assert.equal(world.indoorAt(position),undefined);
    assert.ok(world.canStand(position,.7,solids));
  }
  advanceWildlife(animals,flight.resume);
  assert.equal(animals[0]!.flight,undefined);
  const returned=animalPose(0,flight.resume,animals[0]);
  assert.ok(Math.hypot(flight.to.x-returned.x,flight.to.z-returned.z)<.001);
  const later=animalPose(0,flight.resume+8,animals[0]);
  assert.ok(Math.hypot(later.x-flight.to.x,later.z-flight.to.z)<5.3);
  assert.equal(world.indoorAt(later),undefined);
});

test('a sustained threat can extend an escape without snapping the animal back or turning instantly',()=>{
  const world=createWorld('snow'),doors=world.createDoors();
  const index=6,animals=createWildlife(),animal=animals[index]!,start=animalPose(index,0);
  frightenWildlife(animals,0,{x:start.x,z:start.z-4},30,world,doors);
  const first=animal.flight!;
  const interrupted=first.start+first.travel*.8;
  const before=animalPose(index,interrupted,animal);
  frightenWildlife(animals,interrupted,{x:before.x,z:before.z-3},30,world,doors,index);
  assert.equal(animal.flight?.start,interrupted);
  const next=animal.flight!;
  const after=animalPose(index,interrupted,animal);
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.001);
  assert.ok(Math.abs(Math.sin(after.yaw-before.yaw))<.01);
  assert.ok(Math.hypot(next.to.x-start.x,next.to.z-start.z)>26);
  for(let time=interrupted;time<next.resume+20;time+=.05){
    const pose=animalPose(index,time,animal);
    assert.equal(world.indoorAt(pose),undefined);
    assert.ok(world.canStand(pose,.73),JSON.stringify(pose));
  }
  advanceWildlife(animals,next.resume+1);
  const standing=animalPose(index,next.resume+1,animal);
  frightenWildlife(animals,next.resume+1,{x:standing.x,z:standing.z-3},30,world,doors,index);
  assert.ok(animal.flight);
});
