import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuel,findRoute } from '../src/duel.ts';
import { canStand,PROTOTYPE } from '../src/world.ts';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { createHarborScene } from '../src/scene.ts';

test('route goes around buildings and every segment respects collider clearance',()=>{
  const from={x:-17,z:8},to={x:-17,z:30};const path=findRoute(from,to);
  assert.ok(path.length>2);let previous=from;
  for(const next of path){for(let i=0;i<=20;i++)assert.ok(canStand({x:previous.x+(next.x-previous.x)*i/20,z:previous.z+(next.z-previous.z)*i/20},PROTOTYPE.radius));previous=next;}
  assert.deepEqual(path.at(-1),to);
});

test('bot needs continuous sight, respects cadence, kills once and respawns player',()=>{
  const duel=createDuel();let shots=0;
  const tick=(count:number,visible:boolean)=>{for(let i=0;i<count;i++)duel.update(0.05,{x:0,z:10},()=>visible,()=>shots++);};
  tick(19,true);assert.equal(shots,0);tick(20,false);assert.equal(shots,0);
  tick(20,true);assert.equal(shots,0);assert.ok(duel.state().locked);
  tick(9,true);assert.equal(shots,1);assert.equal(duel.state().playerHealth,75);
  tick(15,true);assert.equal(shots,1);
  for(let i=0;i<200&&duel.state().playerHealth>0;i++)tick(1,true);
  assert.equal(duel.state().playerHealth,0);assert.equal(duel.state().botKills,1);
  tick(59,true);assert.equal(duel.state().playerHealth,0);
  tick(2,true);assert.equal(duel.state().playerHealth,100);assert.equal(duel.state().respawnVersion,1);
});

test('ten eliminations end match and freeze scoring; dead bot cannot be damaged',()=>{
  const duel=createDuel();
  for(let kill=1;kill<=10;kill++){
    for(let shot=0;shot<4;shot++)duel.hurt('bot');
    assert.equal(duel.state().playerKills,kill);assert.equal(duel.hurt('bot'),false);
    duel.update(3,{x:0,z:-8},()=>false,()=>assert.fail());
  }
  assert.equal(duel.state().winner,'player');assert.equal(duel.state().botHealth,0);
  duel.update(100,{x:0,z:-8},()=>true,()=>assert.fail());assert.equal(duel.state().playerKills,10);
});

test('scene switches modes, robot receives real ray hits, pause freezes duel, restart clears score',()=>{
  const engine=new NullEngine({renderWidth:960,renderHeight:540,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
  try{
    const world=createHarborScene(engine),position={x:0,z:10};world.setMode('duel');
    world.update(position,0,{yaw:0,pitch:0});world.scene.render();
    assert.equal(world.scene.getTransformNodeByName('target-root-0')!.isEnabled(),false);
    for(let i=0;i<4;i++)assert.equal(world.shoot().hit,true);
    assert.equal(world.duelState().playerKills,1);assert.equal(world.duelState().botHealth,0);
    world.update(position,10,{yaw:0,pitch:0},true);assert.equal(world.duelState().botDead,3);
    world.update(position,3,{yaw:0,pitch:0});assert.equal(world.duelState().botHealth,100);
    world.resetPractice();assert.equal(world.duelState().playerKills,0);
    world.setMode('practice');assert.equal(world.duelState().active,false);
    assert.equal(world.scene.getTransformNodeByName('opponent')!.isEnabled(),false);
    assert.equal(world.scene.getTransformNodeByName('target-root-0')!.isEnabled(),true);
    world.scene.dispose();
  }finally{engine.dispose();}
});

test('actual scene blocks enemy fire through buildings and allows visible fire; respawn restores magazine',()=>{
  const engine=new NullEngine({renderWidth:960,renderHeight:540,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
  try{
    const world=createHarborScene(engine);world.setMode('duel');
    const hidden={x:27,z:19};world.update(hidden,0);world.scene.render();
    for(let i=0;i<25;i++){world.update(hidden,0.05);world.scene.render();}
    assert.equal(world.duelState().playerHealth,100,'building prevents enemy shot');
    world.resetPractice();const position={x:0,z:10};world.update(position,0,{yaw:Math.PI,pitch:0});world.scene.render();
    world.shoot();assert.equal(world.practiceState().ammo,11);
    for(let i=0;i<200&&world.duelState().playerHealth>0;i++){world.update(position,0.05);world.scene.render();}
    assert.equal(world.duelState().playerHealth,0);assert.equal(world.duelState().botKills,1);
    assert.equal(world.shoot().fired,false);assert.equal(world.jump(),false);assert.equal(world.reload(),false);
    world.update(position,3);assert.equal(world.duelState().playerHealth,100);
    assert.deepEqual(position,{x:0,z:-8});assert.equal(world.practiceState().ammo,12);
    world.scene.dispose();
  }finally{engine.dispose();}
});


test('locked aim can be dodged laterally and wall cover cancels warning',()=>{
  const duel=createDuel();let fired=0;
  for(let i=0;i<20;i++)duel.update(.05,{x:0,z:10},()=>true,()=>{fired++;});
  assert.deepEqual(duel.state().locked,{x:0,z:10});
  for(let i=0;i<9;i++)duel.update(.05,{x:2,z:10},()=>true,(_from,target)=>{fired++;assert.deepEqual(target,{x:0,z:10});});
  assert.equal(fired,1);assert.equal(duel.state().playerHealth,100);
  for(let i=0;i<40&&!duel.state().locked;i++)duel.update(.05,{x:2,z:10},()=>true,()=>{});
  assert.ok(duel.state().locked);
  duel.update(.05,{x:2,z:10},()=>false,()=>assert.fail('cover should cancel shot'));
  assert.equal(duel.state().locked,null);assert.equal(duel.state().aim,0);
});

test('scene hit obstruction callback prevents damage and consumes ammo for blocked shot',()=>{
 const duel=createDuel();for(let i=0;i<30;i++)duel.update(.05,{x:0,z:10},()=>true,()=>false);
 assert.equal(duel.state().playerHealth,100);assert.equal(duel.state().botAmmo,11);
});
