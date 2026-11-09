import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame,type Command} from '../src/network-game.ts';
import {createOnlineMotion} from '../src/online-motion.ts';
import {createOnlinePump} from '../src/online-pump.ts';

const move=(seq:number):Command=>({seq,x:0,y:1,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false});

// A delayed snapshot is correct at ACK0. Commands after it cover elapsed time,
// regardless of how many urgent packets the pump sends during that interval.
function delayedAck(intervals:number[]){
 const game=createNetworkGame();game.join('a');game.join('b');
 const corrections:number[]=[];
 const motion=createOnlineMotion(meters=>corrections.push(meters));
 motion.receive(structuredClone(game.state),'a');
 let now=0,seq=0;
 const pump=createOnlinePump(()=>{const c=move(seq++);motion.sent(c.seq,c);game.input('a',c);},()=>now);
 pump.pump();motion.advance(.05,move(0));game.step();
 const acknowledged=structuredClone(game.state);
 assert.equal(acknowledged.players[0]!.seq,0);
 now=50;
 for(const seconds of intervals){
  assert.equal(pump.pump(true),true,'each urgent packet respects the16ms minimum');
  motion.advance(seconds,move(seq-1));now+=seconds*1000;
 }
 const before=motion.advance(0,move(seq-1));
 motion.receive(acknowledged,'a');
 assert.equal(game.state.players[0]!.z,acknowledged.players[0]!.z,'prediction cannot move the server');
 return {correction:corrections.at(-1)!,before,motion};
}

test('a delayed ACK with one ordinary50ms packet needs no movement correction',()=>{
 const result=delayedAck([.05]);
 assert.ok(result.correction<1e-8,`unexpected correction ${result.correction}m`);
});

test('three urgent16ms packets must not become150ms of replay movement',()=>{
 const result=delayedAck([.016,.016,.016]);
 assert.ok(result.correction<.01,`48ms of unacknowledged movement required ${result.correction}m of artificial correction`);
});
