import test from 'node:test';
import assert from 'node:assert/strict';
import * as weapons from '../src/weapons.ts';
import {createWeapon} from '../src/combat.ts';
import {createNetworkGame} from '../src/network-game.ts';
import {createDuel,createSurvivalMatch} from '../src/duel.ts';
test('approved seven weapons expose different roles and exact capacities',()=>{
 assert.equal(weapons.WEAPON_IDS.length,7);const w:any=weapons.WEAPONS;
 assert.deepEqual([w.smg.damage,w.smg.magazineSize,w.smg.reloadSeconds,w.smg.interval],[7,40,1.8,1/12]);assert.ok(w.smg.spread>0);
 assert.deepEqual([w.burst.damage,w.burst.magazineSize,w.burst.reloadSeconds,w.burst.burstCount,w.burst.burstInterval],[18,24,2,3,.08]);
 assert.deepEqual([w.dmr.damage,w.dmr.magazineSize,w.dmr.interval,w.dmr.reloadSeconds],[50,10,.5,2.2]);
});
test('one burst press consumes three actual bullets over time and does not auto-repeat',()=>{
 const w:any=weapons.WEAPONS;assert.ok(w.burst,'burst rifle exists');const g=createNetworkGame(),a=g.join('a','burst');g.join('b');a.yaw=Math.PI;
 g.input('a',{seq:1,x:0,y:0,yaw:Math.PI,pitch:0,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false});g.step();assert.equal(a.weapon.ammo,23);
 for(let i=0;i<5;i++)g.step();assert.equal(a.weapon.ammo,21,'scheduled bullets fire after the finger is released');for(let i=0;i<20;i++)g.step();assert.equal(a.weapon.ammo,21,'one tap never repeats a second burst');
});
test('burst scheduling respects its internal interval, remaining ammo and reload cancellation',()=>{
 const api:any=weapons;assert.equal(typeof api.startBurst,'function');let state:any=api.startBurst({...createWeapon(api.WEAPONS.burst),ammo:2},api.WEAPONS.burst);
 let step=api.advanceBurst(state,.05);assert.equal(step.due,0);step=api.advanceBurst(step.state,.03);assert.equal(step.due,1);step=api.advanceBurst({...step.state,ammo:0},.1);assert.equal(step.due,0);assert.equal(step.state.burstRemaining??0,0);
 state=api.startBurst(createWeapon(api.WEAPONS.burst),api.WEAPONS.burst);step=api.advanceBurst({...state,reloadRemaining:1},.2);assert.equal(step.due,0);assert.equal(step.state.burstRemaining??0,0);
});
test('bots and survival reinforcements return sooner while player respawn stays three seconds',()=>{
 const duel=createDuel();duel.hurt('bot',100);duel.update(1.49,{x:0,z:-8},()=>false,()=>false);assert.equal(duel.state().botHealth,0);duel.update(.01,{x:0,z:-8},()=>false,()=>false);assert.equal(duel.state().botHealth,100);
 const player=createDuel();player.hurt('player',100);player.update(1.5,{x:0,z:-8},()=>false,()=>false);assert.equal(player.state().playerHealth,0);
 const match=createSurvivalMatch();match.update(5,{x:0,z:-8},()=>false,()=>false);assert.equal(match.state().total,4);assert.equal(match.state().bots.length,3);match.hurt('bot-1',100);match.update(1.5,{x:0,z:-8},()=>false,()=>false);assert.equal(match.state().spawned,4);assert.equal(match.state().bots[0]!.health,100);
});

test('server new weapons enforce cadence, damage, ammo and cancellation when a burst is stowed',()=>{
 const g=createNetworkGame(),a=g.join('a','dmr'),b=g.join('b');a.z=10;
 const input=(seq:number,patch:Record<string,unknown>={})=>g.input('a',{seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...patch});
 input(1,{shot:true});g.step();assert.equal(b.health,50);input(2,{shot:true});g.step();assert.equal(a.weapon.ammo,9);for(let i=0;i<9;i++)g.step();input(3,{shot:true});g.step();assert.equal(b.health,0);assert.equal(a.kills,1);
 const burst=createNetworkGame(),c=burst.join('c','burst');burst.join('d');c.inventory.slots.push({id:'pistol',weapon:createWeapon(weapons.WEAPONS.pistol),cooldown:0});
 const cmd=(seq:number,patch:Record<string,unknown>)=>burst.input('c',{seq,x:0,y:0,yaw:Math.PI,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...patch});cmd(1,{shot:true});burst.step();cmd(2,{slot:1});burst.step();for(let i=0;i<10;i++)burst.step();assert.equal(c.inventory.slots[0]!.weapon.ammo,23,'stowing cancels remaining two bullets');
 const automatic=createNetworkGame(),smg=automatic.join('smg','smg');automatic.join('target');for(let i=0;i<20;i++){automatic.input('smg',{seq:i,x:0,y:0,yaw:Math.PI,pitch:0,fire:true,shot:false,reload:false,jump:false,sprint:false,scope:false});automatic.step();}assert.equal(smg.weapon.ammo,28,'held SMG averages twelve rounds in one second');
});
test('actual scene burst continues on release, respects pause/reload, and every new weapon has a lobby model',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine.js');const {createHarborScene}=await import('../src/scene.ts');const engine=new NullEngine();try{
 const world=createHarborScene(engine,{randomSpawns:false}),p={x:0,z:-8};world.setMode('practice');world.selectWeapon('burst');world.update(p,0);assert.equal(world.shoot().fired,true);assert.equal(world.practiceState().ammo,23);
 world.update(p,.2,undefined,true);assert.equal(world.practiceState().ammo,23,'menu pause never advances a burst');world.update(p,.08);assert.equal(world.practiceState().ammo,22);world.update(p,.08);assert.equal(world.practiceState().ammo,21);assert.equal(world.consumeAutoShots().length,2);
 world.resetPractice();world.shoot();world.reload();world.update(p,.2);assert.equal(world.practiceState().ammo,23,'reload stops queued bullets');
 for(const id of ['smg','burst','dmr'] as const){world.selectWeapon(id);world.setPreview(true,true);world.setLobbyWeapon(id);world.update(p,0,undefined,true);assert.ok(world.scene.meshes.some(m=>m.metadata?.lobbyWeapon===id&&m.isEnabled()),id+' model exists');world.setPreview(false);assert.equal(world.toggleScope(),false);}
 world.scene.dispose();}finally{engine.dispose();}
});
