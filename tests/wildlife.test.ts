import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame} from '../src/network-game.ts';
import {advanceWildlife,animalPose,collectMeat,createWildlife,hurtWildlife,wildlifeHit} from '../src/wildlife.ts';
import {createWorld} from '../src/world.ts';

test('one meat drop heals a wounded player and the animal respawns',()=>{
  const animals=createWildlife();
  const world=createWorld('snow');
  const position=animalPose(0,1);
  assert.equal(hurtWildlife(animals,0,100,1),55);
  assert.equal(hurtWildlife(animals,0,100,2),0);
  assert.equal(collectMeat(animals,position,100,world,{}),0);
  assert.equal(collectMeat(animals,{...position,y:3},50,world,{}),0);
  assert.equal(collectMeat(animals,position,89,world,{}),11);
  assert.equal(collectMeat(animals,position,50,world,{}),0);
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
  Object.assign(player,{...animal.meat,health:60});
  game.step();
  assert.equal(player.health,85);
  assert.equal(game.checkpoint().animals![0]!.meat,undefined);
});
