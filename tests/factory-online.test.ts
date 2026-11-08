import test from 'node:test';import assert from 'node:assert/strict';
import {createNetworkGame,advancePlayerMotion} from '../src/network-game.ts';import {createWorld} from '../src/world.ts';
import {createOnlineMotion} from '../src/online-motion.ts';
test('factory room keeps map across checkpoints and uses matching prediction collision',()=>{
 const game=createNetworkGame(undefined,'factory');assert.equal(game.state.map,'factory');const a=game.join('a'),b=game.join('b');
 assert.ok(Object.hasOwn(game.state.doors!,'factory-hall-0-0'));
 a.x=-24;a.z=-10;const c={seq:1,x:0,y:1,yaw:Math.PI,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false};
 const world=createWorld('factory'),expected=advancePlayerMotion(a,c,.05,game.state.doors,world);
 game.input('a',c);game.step();assert.equal(a.z,expected.z);assert.ok(a.z>=-12,'factory closed door blocks entry');
 const restored=createNetworkGame(game.state);assert.equal(restored.state.map,'factory');
 const motion=createOnlineMotion();motion.receive(game.state,'a');const p=motion.advance(.05,c);assert.ok(p.z>=-12);
 assert.equal(b.health,100);
});
