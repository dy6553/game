import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame} from '../src/network-game.ts';
import {advanceWildlife,animalPose,nearbyMeat,takeMeat,meatRecovery,MEAT_CAPACITY,createWildlife,hurtWildlife,wildlifeHit} from '../src/wildlife.ts';
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
  for(let seq=0;seq<10 && game.checkpoint().animals![0]!.health>0;seq++){
    assert.equal(game.input(player.id,{...command,seq}),true);
    for(let i=0;i<8;i++)game.step();
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
