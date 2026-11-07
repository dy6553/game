import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkTiming} from '../src/network-timing.ts';
import {createRemoteMotion} from '../src/remote-motion.ts';
import {createNetworkGame} from '../src/network-game.ts';
test('latency uses acknowledged inputs on a single local clock and detects missing snapshots',()=>{
 let now=100;const timing=createNetworkTiming(()=>now);timing.sent(1);now=220;timing.received(1);assert.equal(timing.read().rttMs,120);
 now=270;timing.received(1);assert.equal(timing.read().rttMs,120,'repeated ack must not count the same packet twice');
 now=1000;assert.equal(timing.read().staleMs,730);timing.reset();assert.deepEqual(timing.read(),{rttMs:null,staleMs:null});
});
test('opponent display projects movement only for a bounded interval and stops on new idle snapshots',()=>{
 const game=createNetworkGame();game.join('me');const other=game.join('other');const remote=createRemoteMotion();game.state.tick=1;
 remote.receive(structuredClone(game.state),'me',0);game.state.tick=2;other.z+=.35;remote.receive(structuredClone(game.state),'me',50);
 const predicted=remote.sample(100,1000)!;assert.ok(predicted.z>other.z);assert.ok(predicted.z-other.z<=1.05+1e-8,'one second network delay never projects for one second');
 assert.equal(other.z,18.35,'render estimate never mutates the canonical player');
 game.state.tick=3;remote.receive(structuredClone(game.state),'me',100);assert.equal(remote.sample(150,1000)!.z,other.z);
 assert.equal(remote.sample(1000,1000)!.z,other.z);
});
test('respawn and teleport discard extrapolation instead of guessing impossible speed',()=>{
 const game=createNetworkGame();game.join('me');const other=game.join('other');const remote=createRemoteMotion();game.state.tick=1;
 remote.receive(structuredClone(game.state),'me',0);other.z=0;game.state.tick=2;remote.receive(structuredClone(game.state),'me',50);assert.equal(remote.sample(100,200)!.z,0);
 other.health=0;other.z=1;game.state.tick=3;remote.receive(structuredClone(game.state),'me',100);assert.equal(remote.sample(150,200)!.z,1);
 remote.reset();assert.equal(remote.sample(150,200),undefined);
});
