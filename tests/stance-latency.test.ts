import test from 'node:test';import assert from 'node:assert/strict';
import {createNetworkGame,advancePlayerMotion} from '../src/network-game.ts';
const command=(seq:number,extra={})=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...extra});
test('input timeout stops movement but preserves crouch/prone hit volume until an explicit change',()=>{
 for(const stance of ['crouch','prone'] as const){
  const g=createNetworkGame(),a=g.join('a'),b=g.join('b');a.x=b.x=0;a.z=-8;b.z=8;
  g.input('b',command(1,{stance,y:1}));g.step();for(let i=0;i<10;i++)g.step();
  const frozen={x:b.x,z:b.z};assert.equal(b.stance,stance);for(let i=0;i<10;i++)g.step();assert.deepEqual({x:b.x,z:b.z},frozen);
  g.input('a',command(1,{shot:true}));g.step();assert.equal(b.health,100,'standing ray stays above the lowered body after timeout');
  g.input('b',command(2,{stance:'stand'}));g.step();assert.equal(b.stance,'stand');
 }
});
test('shared prediction and commands without a posture preserve the last known posture',()=>{
 const g=createNetworkGame(),p=g.join('a');g.join('b');p.stance='prone';
 const move=advancePlayerMotion(p,command(1,{y:1}),.05);assert.equal(move.stance,'prone');assert.ok(move.z-p.z<.1);
 g.input('a',command(1));g.step();assert.equal(p.stance,'prone');
 const restored=createNetworkGame(g.checkpoint());restored.join('a');restored.join('b');restored.step();assert.equal(restored.state.players[0].stance,'prone');
});
