import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkGame,parseCommand,type Command } from '../src/network-game.ts';
const command=(seq:number,patch:Partial<Command>={}):Command=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...patch});
test('server rejects invalid/replayed inputs and bounds movement independently of client claims',()=>{
 const game=createNetworkGame();const a=game.join('a'),b=game.join('b');
 assert.equal(parseCommand(command(1,{x:100})),null);assert.equal(parseCommand(command(1,{pitch:NaN})),null);
 assert.equal(game.input('a',command(1,{y:1})),true);assert.equal(game.input('a',command(1,{y:1})),false);assert.equal(game.input('intruder',command(1)),false);
 const before=a.z;game.step();assert.ok(a.z-before<=.35+1e-8);
 for(let i=0;i<30;i++)game.step();assert.ok(a.z-before<3,'stale input stops movement');
 game.disconnect('b');const paused=a.z;game.input('a',command(2,{y:1}));game.step();assert.equal(a.z,paused);assert.equal(b.connected,false);
});
test('server verifies shots, ammo, walls, kill goal and respawn without trusting reported health',()=>{
 const game=createNetworkGame();const a=game.join('a','sniper'),b=game.join('b','pistol');a.z=10;
 game.input('a',{...command(1,{shot:true}),damage:99999,health:99999});game.step();assert.equal(b.health,0);assert.equal(a.kills,1);assert.equal(a.health,100);assert.equal(a.weapon.ammo,4);
 game.input('a',command(2,{shot:true}));game.step();assert.equal(a.weapon.ammo,4,'cooldown is enforced');
 for(let i=0;i<61;i++)game.step();assert.equal(b.health,100);assert.equal(b.weapon.ammo,12);
 game.input('a',command(3,{yaw:Math.PI,shot:true}));game.step();assert.equal(b.health,100,'opposite direction misses');
 a.x=-40;a.z=-19;b.x=-25;b.z=-19;a.cooldown=0;game.input('a',command(4,{yaw:Math.PI/2,shot:true}));game.step();assert.equal(b.health,100,'building occludes shot');
 a.x=0;a.z=10;b.x=0;b.z=18;a.kills=9;a.cooldown=0;game.input('a',command(5,{shot:true}));game.step();assert.equal(game.state.winner,'a');
 const ammo=a.weapon.ammo;game.input('a',command(6,{shot:true}));game.step();assert.equal(a.weapon.ammo,ammo,'finished match cannot continue firing');
});
test('rooms cap players and restore paused state for token-based reconnect',()=>{
 const game=createNetworkGame();game.join('a');game.join('b');assert.throws(()=>game.join('c'));
 const restored=createNetworkGame(game.state);assert.ok(restored.state.players.every(p=>!p.connected));restored.join('a');restored.join('b');assert.equal(restored.state.players.length,2);
});
