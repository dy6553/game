import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
import {createNetworkGame,parseCommand} from '../src/network-game.ts';
import {statePacket,privatePacket,readState} from '../src/network-wire.ts';
const command=(seq=1)=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false});
test('practice distance lanes move actual pickable targets and pause freezes motion without allocating meshes',()=>{
 const e=new NullEngine(),w=createHarborScene(e,{randomSpawns:false});try{
 assert.equal(typeof w.setPracticeRange,'function','practice range must be configurable');
 w.setPracticeRange?.(20,true);const n=w.scene.meshes.length;
 const before=w.targetContacts();assert.equal(before[0].z,12);
 w.update({x:0,z:-8},.4);const moved=w.targetContacts();assert.notEqual(moved[0].x,before[0].x);
 w.update({x:0,z:-8},1,undefined,true);assert.deepEqual(w.targetContacts(),moved);
 const mesh=w.scene.getMeshByName('practice-target-0');mesh?.computeWorldMatrix(true);assert.ok(Math.abs(mesh!.absolutePosition.x-moved[0].x)<1e-5);
 assert.equal(w.scene.meshes.length,n);w.setMode('duel');assert.equal(w.setPracticeRange?.(10,false),false);
 }finally{w.scene.dispose();e.dispose();}
});
test('team pings validate coordinates, limit spam, expire, and never appear in enemy packets',()=>{
 assert.equal(parseCommand({...command(),ping:{kind:'enemy',x:Infinity,z:0}}),null);
 assert.equal(parseCommand({...command(),ping:{kind:['help'],x:0,z:0}}),null);
 const g=createNetworkGame(undefined,'harbor',{mode:'team'});const a=g.join('a'),b=g.join('b'),c=g.join('c');
 g.input(a.id,{...command(),ping:{kind:'help',x:2,z:1}});g.step();assert.equal(g.state.pings?.length,1);
 const packet=statePacket(g.state);assert.ok(!packet.includes('"help"'),'shared state must not contain pings');
 const own=readState(JSON.parse(privatePacket(packet,g.state,c.id)),c.id);assert.equal(own.pings?.length,1);
 const enemy=readState(JSON.parse(privatePacket(packet,g.state,b.id)),b.id);assert.equal(enemy.pings?.length,0);
 g.input(a.id,{...command(2),ping:{kind:'move',x:3,z:2}});g.step();assert.equal(g.state.pings?.length,1);
 for(let i=0;i<125;i++)g.step();assert.equal(g.state.pings?.length,0);
});
test('protected enemy hit is authoritative feedback with zero damage',()=>{
 const g=createNetworkGame(),a=g.join('a'),b=g.join('b');a.x=0;a.z=-8;b.x=0;b.z=8;b.protection=3;
 g.input('a',{...command(),shot:true});g.step();assert.equal(b.health,100);assert.equal(g.state.events[0]?.protected,true);assert.equal(g.state.events[0]?.hit,false);
});
test('weapon comparison uses actual range falloff, pellets and rocket headshot exception',async()=>{
 const weapons=await import('../src/weapons.ts');assert.equal(typeof weapons.weaponComparison,'function');
 const near=weapons.weaponComparison?.(0),far=weapons.weaponComparison?.(40);
 assert.equal(near?.length,9);assert.equal(near?.find(r=>r.id==='shotgun')?.pellets,6);
 assert.equal(near?.find(r=>r.id==='sniper')?.head,82.5);
 assert.equal(near?.find(r=>r.id==='bazooka')?.head,80);
 assert.ok(far!.find(r=>r.id==='smg')!.body<near!.find(r=>r.id==='smg')!.body);
});
test('feedback distinguishes body, headshot, kill and protected hit without claiming damage',async()=>{
 const {hitFeedback}=await import('../src/combat-hud.ts');assert.equal(hitFeedback({damage:22}).kind,'body');assert.equal(hitFeedback({headshot:true}).kind,'head');assert.match(hitFeedback({headshot:true,killed:true}).text,/처치/);assert.deepEqual(hitFeedback({protected:true,headshot:true,damage:33}),{kind:'protected',text:'부활 보호 · 피해 없음'});
});
test('pings cannot be sent by dead players, in non-team games, or beyond map bounds',()=>{
 for(const mode of ['duel','ffa','team'] as const){const g=createNetworkGame(undefined,'harbor',{mode});const a=g.join('a');g.join('b');if(mode==='team')a.health=0;assert.equal(parseCommand({...command(),ping:{kind:'move',x:65,z:0}}),null);g.input('a',{...command(),ping:{kind:'enemy',x:0,z:0}});g.step();assert.equal(g.state.pings?.length,0);}
});
