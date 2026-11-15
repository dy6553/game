import test from 'node:test';import assert from 'node:assert/strict';
import {createNetworkGame,parseCommand} from '../src/network-game.ts';
import {createOnlineMotion} from '../src/online-motion.ts';
const command=(seq,patch={})=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...patch});
function game(){const g=createNetworkGame();g.join('a');g.join('b');assert.ok(g.state.players[0].dash,'server must expose authoritative dash capability');return g;}
test('server owns distance and cooldown and remains compatible with old input packets',()=>{
 assert.ok(parseCommand(command(0)));assert.equal(parseCommand(command(0,{dash:'yes'})),null);const g=game(),a=g.state.players[0];g.input('a',command(0,{dash:true,dashDistance:999}));for(let i=0;i<4;i++)g.step();assert.ok(Math.abs(a.z+4)<1e-8);g.input('a',command(1,{dash:true}));g.step();assert.ok(Math.abs(a.z+4)<1e-8);assert.ok(a.dash.cooldown>2);assert.equal(a.health,100);
});
test('airborne dash is rejected and dash prevents jumping while retaining weapon actions',()=>{
 const g=game(),a=g.state.players[0];g.input('a',command(0,{jump:true}));g.step();g.input('a',command(1,{dash:true}));g.step();assert.equal(a.dash.remaining,0);assert.equal(a.dash.cooldown,0);
 const h=game(),p=h.state.players[0];h.input('a',command(0,{dash:true,jump:true,shot:true}));h.step();assert.equal(p.jump.height,0);assert.ok(p.dash.remaining>0);assert.equal(p.weapon.ammo,11);h.input('a',command(1,{reload:true}));h.step();assert.ok(p.weapon.reloadRemaining>0);
});
test('server dashes cannot cross buildings; death has no invulnerability and resets on respawn',()=>{
 const g=game(),a=g.state.players[0];a.x=9;a.z=-19;g.input('a',command(0,{dash:true,yaw:Math.PI/2}));for(let i=0;i<4;i++)g.step();assert.ok(a.x<10.5);
 const h=createNetworkGame();const p=h.join('a'),b=h.join('b','sniper');assert.ok(p.dash);p.health=80;h.input('a',command(0,{dash:true}));h.input('b',command(0,{shot:true,yaw:Math.PI}));h.step();assert.equal(p.health,0);assert.equal(p.dash.remaining,0);for(let i=0;i<61;i++)h.step();assert.equal(p.health,100);assert.equal(p.dash.cooldown,0);
});
test('disconnect and server restore preserve cooldown but cancel a dash in progress',()=>{
 const g=game();g.input('a',command(0,{dash:true}));g.step();const cooldown=g.state.players[0].dash.cooldown;g.disconnect('a');assert.equal(g.state.players[0].dash.remaining,0);const restored=createNetworkGame(g.state);assert.equal(restored.state.players[0].dash.cooldown,cooldown);restored.join('a');restored.join('b');assert.equal(restored.state.players[0].dash.cooldown,cooldown);
});
test('prediction starts before reply, matches server dash state, and never enables dash for an old server',()=>{
 const g=game(),motion=createOnlineMotion();motion.receive(structuredClone(g.state),'a');for(let i=0;i<4;i++){const c=command(i,{dash:i===0});motion.sent(i,c);const p=motion.advance(.05,c);if(i===0)assert.ok(p.z>-7.1,'first dash frame moves immediately');g.input('a',c);g.step();motion.receive(structuredClone(g.state),'a');}assert.ok(Math.abs(motion.advance(0,command(4)).z+4)<.05);assert.equal(g.state.players[0].weapon.ammo,12);
 const old=structuredClone(g.state);for(const p of old.players)delete p.dash;const legacy=createOnlineMotion();legacy.receive(old,'a');assert.equal(legacy.advance(.1,command(0,{dash:true})).z,old.players[0].z);
});
