import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { createHarborScene } from '../src/scene.ts';
import { PROTOTYPE } from '../src/world.ts';

test('approved pistol rules drive actual target damage, reload gating, pauses and reset',()=>{
  const engine=new NullEngine({renderWidth:960,renderHeight:540,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
  try {
    const world=createHarborScene(engine);
    const pose={yaw:0,pitch:0};
    world.update(PROTOTYPE.spawn,0,pose);world.scene.render();
    for(let shot=1;shot<=4;shot++) {
      const hit=world.shoot();assert.equal(hit.hit,true);
      assert.equal(world.practiceState().targetHealth[0],100-shot*25);
      assert.equal(world.practiceState().ammo,12-shot);
      assert.equal(hit.eliminated,shot===4);
    }
    assert.equal(world.practiceState().destroyed,1);
    assert.equal(world.shoot().hit,false,'destroyed target cannot be hit again');
    assert.equal(world.practiceState().ammo,7,'miss consumes ammunition');
    assert.equal(world.reload(),true);assert.equal(world.reload(),false,'repeated reload does not restart');
    const emitted=world.effectsState().emitted;
    assert.equal(world.shoot().fired,false);assert.equal(world.practiceState().ammo,7);
    assert.equal(world.effectsState().emitted,emitted,'reloading cannot emit fake shots');
    world.update(PROTOTYPE.spawn,0.5,pose);assert.equal(world.practiceState().reloadRemaining,1);
    world.update(PROTOTYPE.spawn,5,pose,true);assert.equal(world.practiceState().reloadRemaining,1,'paused game cannot finish reload');
    world.update(PROTOTYPE.spawn,1,pose);assert.equal(world.practiceState().ammo,12);
    world.selectCharacter('robot-cat');assert.equal(world.practiceState().destroyed,1);
    for(let i=0;i<12;i++)world.shoot();
    assert.equal(world.practiceState().ammo,0);
    const shots=world.practiceState().shots,visualShots=world.effectsState().emitted;
    assert.equal(world.shoot().fired,false);assert.equal(world.practiceState().shots,shots);assert.equal(world.effectsState().emitted,visualShots);
    world.resetPractice();
    assert.deepEqual(world.practiceState().targetHealth,[100,100,100]);assert.equal(world.practiceState().ammo,12);
    assert.equal(world.practiceState().hits,0);assert.equal(world.practiceState().destroyed,0);
    assert.equal(world.scene.getTransformNodeByName('target-root-0')!.isEnabled(),true);
    for(const p of [{x:0,z:27},{x:-25,z:7},{x:25,z:7}]) {
      world.update(p,0,pose);world.scene.render();
      for(let i=0;i<4;i++)assert.equal(world.shoot().hit,true);
    }
    assert.equal(world.practiceState().complete,true);assert.equal(world.practiceState().destroyed,3);
    assert.equal(world.practiceState().ammo,0);
    world.resetPractice();world.update(PROTOTYPE.spawn,0,pose);
    assert.equal(world.jump(),true);assert.equal(world.jump(),false);
    world.update(PROTOTYPE.spawn,0.2,pose);
    assert.ok(world.camera.position.y>1.95);assert.equal(world.practiceState().ammo,12);
    const height=world.practiceState().jumpHeight;
    world.update(PROTOTYPE.spawn,4,pose,true);assert.equal(world.practiceState().jumpHeight,height);
    world.update(PROTOTYPE.spawn,0.6,pose);assert.equal(world.practiceState().grounded,true);
    world.scene.dispose();
  }finally{engine.dispose();}
});
