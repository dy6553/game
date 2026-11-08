import test from 'node:test';import assert from 'node:assert/strict';
import {createNetworkGame,onlinePlaying,wonOnline} from '../src/network-game.ts';
import {createGear,advanceEquipment,useEquipment,type GearActor,type Projectile} from '../src/equipment.ts';
import {createWorld} from '../src/world.ts';import {captureOfficialResult} from '../server/official-records.js';
const command=(seq:number,extra={})=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...extra});
const actor=(id:string,x=0):GearActor=>({id,x,y:0,z:0,yaw:Math.PI,pitch:0,health:100,gear:createGear(),flash:0,healing:0,gearCooldown:0});
test('grenade fuse, self damage, wall shielding, ally immunity and protection are authoritative',()=>{
 const world={...createWorld(),shotBoxes:()=>[{x:2,z:0,width:.2,depth:12,yMin:0,yMax:5}]},a=actor('owner'),b=actor('enemy',3),ally={...actor('ally',1),team:0},protectedActor={...actor('shield',1),protection:1};
 const ps:Projectile[]=[{id:1,owner:a.id,team:0,kind:'grenade',x:0,y:.2,z:0,vx:0,vy:0,vz:0,remaining:.1}],hits:string[]=[];
 const hurt=(p:GearActor,n:number)=>{p.health-=n;hits.push(p.id);};advanceEquipment([a,b,ally,protectedActor],ps,.05,world,{},hurt,()=>2);assert.equal(hits.length,0);advanceEquipment([a,b,ally,protectedActor],ps,.05,world,{},hurt,()=>3);assert.equal(ps.length,0);assert.deepEqual(hits,['owner']);assert.ok(a.health<10);assert.equal(b.health,100);
});
test('flash is blocked by walls, attenuates when looking away and throwing uses jump height',()=>{
 const world={...createWorld(),shotBoxes:()=>[{x:2,z:0,width:.2,depth:12,yMin:0,yMax:5}]},front=actor('front'),back={...actor('back'),yaw:0},blocked=actor('blocked',3);
 const ps:Projectile[]=[{id:1,owner:'thrower',kind:'flash',x:0,y:1.8,z:-1,vx:0,vy:0,vz:0,remaining:.01}];advanceEquipment([front,back,blocked],ps,.01,world,{},()=>{},()=>2);assert.ok(front.flash>back.flash);assert.equal(blocked.flash,0);front.jump={height:2};front.gear.grenade=1;assert.ok(useEquipment(front,'grenade',ps,4));assert.equal(ps[0]!.y,3.7);
});
test('twenty actors finish FFA at ten and team at thirty, producing twenty official records once',()=>{
 for(const mode of ['ffa','team'] as const){const g=createNetworkGame(undefined,'harbor',{mode});for(let i=0;i<20;i++)g.join('p'+i);const [a,b]=g.state.players;for(const p of g.state.players){p.protection=0;p.x=50;p.z=30;}a.x=0;a.z=-8;b.x=0;b.z=8;b.health=25;a.kills=mode==='ffa'?9:29;a.totalKills=a.kills;if(mode==='team')g.state.teamScores![0]=29;g.input(a.id,command(1,{shot:true}));g.step();assert.ok(g.state.winner);assert.ok(wonOnline(g.state,a.id));assert.equal(wonOnline(g.state,b.id),false);const accounts=Object.fromEntries(g.state.players.map(p=>[p.id,'subject-'+p.id]));const event=captureOfficialResult('match',g.state,accounts,1000)!;assert.equal(event.rows.length,20);assert.equal(event.rows.filter(r=>r.outcome==='win').length,mode==='team'?10:1);assert.equal(event.mode,mode);const health=b.health;g.step();assert.equal(b.health,health);}
});
test('equipment pickup limits, healing cancellation by firing and damage, death and reconnect preserve rules',()=>{
 const g=createNetworkGame(undefined,'harbor',{mode:'ffa',randomPickups:true});const a=g.join('a'),b=g.join('b');a.protection=0;b.protection=0;
 const c=g.state.pickups.find(p=>p.equipmentId==='medkit')!;Object.assign(a,{x:c.x,y:c.y,z:c.z,health:40});g.input('a',command(1,{pickup:c.id}));g.step();assert.equal(a.gear.medkit,1);assert.ok(c.remaining>19);g.input('a',command(2,{equipment:'medkit'}));g.step();assert.ok(a.healing>0);g.input('a',command(3,{shot:true}));g.step();assert.equal(a.healing,0);assert.equal(a.gear.medkit,1);
 a.x=0;a.z=-8;a.y=0;b.x=0;b.z=8;b.y=0;a.health=25;a.healing=1;a.gear.grenade=2;g.input('b',command(1,{yaw:Math.PI,shot:true}));g.step();assert.equal(a.health,0);assert.equal(a.deaths,1);assert.deepEqual(a.gear,createGear());for(let i=0;i<61;i++)g.step();assert.equal(a.health,100);assert.ok(a.protection>0);g.disconnect('b');assert.equal(onlinePlaying(g.state),false);g.join('c');assert.equal(onlinePlaying(g.state),true);g.join('b');assert.equal(g.state.players.length,3);assert.equal(g.state.pickups.find(p=>p.id===c.id)!.x,c.x);
});
