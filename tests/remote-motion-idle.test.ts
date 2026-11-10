import test from 'node:test';import assert from 'node:assert/strict';import {createRemoteMotion} from '../src/remote-motion.ts';import {createNetworkGame} from '../src/network-game.ts';import {harborWorld} from '../src/world.ts';
test('stationary remote players avoid collision prediction on every displayed frame',()=>{
 const g=createNetworkGame(undefined,'harbor',{mode:'ffa'});for(let i=0;i<20;i++)g.join('p'+i);const motion=createRemoteMotion();motion.receive(g.state,'p0',0);
 const original=harborWorld.moveWithCollisions;let calls=0;harborWorld.moveWithCollisions=(...args)=>{calls++;return original(...args);};
 try{for(let i=0;i<60;i++){const players=motion.sampleAll(i*16,600);assert.equal(players.length,19);assert.equal(players[0].x,g.state.players[1].x);}assert.equal(calls,0);}finally{harborWorld.moveWithCollisions=original;}
});
