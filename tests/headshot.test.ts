import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame} from '../src/network-game.ts';

test('server awards 1.5 times damage for a head hit and normal damage for a body hit',()=>{
 for(const [pitch,expected,headshot] of [[.04,78,false],[0,67,true]] as const){
  const game=createNetworkGame(),shooter=game.join('a'),target=game.join('b');
  shooter.x=0;shooter.z=-8;target.x=0;target.z=8;
  game.input('a',{seq:1,x:0,y:0,yaw:0,pitch,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false});game.step();
  assert.equal(target.health,expected);assert.equal(game.state.events[0]?.headshot??false,headshot);
 }
});
