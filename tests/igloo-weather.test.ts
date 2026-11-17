import {snowWeather} from '../src/snow-weather.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';import {createWorld} from '../src/world.ts';
import {createNetworkGame} from '../src/network-game.ts';import {combatContacts} from '../src/combat-hud.ts';

test('snow hub has a curved footprint, real curved walls and connected entrances',()=>{
 const w=createWorld('snow');assert.equal(w.indoorAt({x:17,z:13}),undefined,'old rectangle corner must be outdoors');
 assert.equal(w.canStand({x:18/Math.sqrt(2),z:15/Math.sqrt(2)},.55),false,'curved shell blocks movement');
 for(const p of [{x:0,z:0},{x:0,z:-15},{x:0,z:-20},{x:22,z:0},{x:33,z:0}])assert.ok(w.canStand(p,.55),JSON.stringify(p)+' must remain walkable');
 assert.ok(w.worldSolids().some(r=>r.id.startsWith('igloo-workbench')),'interior has authoritative cover');
});
for(const q of ['low','medium','high'] as const)test(`snow ${q}: blizzard limits vision even when cosmetic snow is disabled and pauses correctly`,()=>{
 const e=new NullEngine(),w=createHarborScene(e,{map:'snow',randomSpawns:false,weatherSeed:123});try{
  assert.equal(typeof w.weatherState,'function');w.setQuality(q==='high');w.setPerformanceLow(q==='low');w.setPreview(false);w.setSnowfall(false);
  assert.equal(w.weatherState()?.intensity,0);w.update({x:70,z:-20},snowWeather(0,123).startsIn+5,{yaw:0,pitch:0});const heavy=w.weatherState();assert.equal(heavy?.phase,'blizzard');assert.equal(heavy?.visibility,28);assert.equal(w.scene.fogEnd,28);assert.equal(w.scene.fogStart,14,'nearby 14m stays clear');assert.notEqual(w.scene.fogMode,0);
  w.update({x:70,z:-20},10,{yaw:0,pitch:0},true);assert.deepEqual(w.weatherState(),heavy);
  w.update({x:70,z:-20},heavy!.endsIn+.01,{yaw:0,pitch:0});assert.equal(w.weatherState()?.intensity,0);
 }finally{w.scene.dispose();e.dispose();}
});
test('server weather starts with the match, advances authoritatively and survives checkpoints',()=>{
 const g=createNetworkGame(undefined,'snow',{mode:'team',waitingRoom:true});g.join('a');g.join('b');for(let i=0;i<40;i++)g.step();assert.equal(g.state.weatherTime,0);g.startMatch('a');for(let i=0;i<20;i++)g.step();assert.ok(Math.abs((g.state.weatherTime??0)-1)<1e-8);assert.equal(createNetworkGame(g.checkpoint()).state.weatherTime,g.state.weatherTime);
});
test('storm visibility also constrains enemy map contacts',()=>{
 const w=createWorld('snow'),a={x:70,z:20,id:'foe',name:'적',health:100};assert.equal(combatContacts(w,{}, {x:70,z:-20},0,0,[a]).radar.length,1);assert.equal(combatContacts(w,{}, {x:70,z:-20},0,0,[a],28).radar.length,0);
});
test('bots cannot acquire or fire on a player outside the blizzard envelope',async()=>{
 const {createBotRules}=await import('../src/duel.ts'),{inWeatherRange}=await import('../src/snow-weather.ts');const world=createWorld('snow');
 for(const storm of [false,true]){const bot=createBotRules(world).createDuel('easy',{x:70,z:0},undefined,{doors:{},randomSpawns:false,canDetect:(from,to)=>inWeatherRange('snow',storm?snowWeather(0).startsIn+5:0,from,to)});let shots=0;
  for(let i=0;i<40;i++)bot.update(.05,{x:70,z:40},p=>inWeatherRange('snow',storm?snowWeather(0).startsIn+5:0,p,{x:70,z:40}),()=>{shots++;});
  if(storm){assert.equal(shots,0);const p=bot.state().position;assert.deepEqual({x:p.x,z:p.z},{x:70,z:0},'a hidden player must not be tracked through the blizzard');}else assert.ok(shots>0);
 }
});
test('curved shell server rays agree with visible inner ceiling triangles',async()=>{
 const {firstShotBox}=await import('../src/combat-geometry.ts'),{Ray}=await import('@babylonjs/core/Culling/ray.js'),{Vector3}=await import('@babylonjs/core/Maths/math.vector.js');
 const e=new NullEngine(),w=createHarborScene(e,{map:'snow'});try{const a={x:.2,y:1.8,z:.2},b={x:.2,y:15,z:.2};const visual=w.scene.pickWithRay(new Ray(new Vector3(a.x,a.y,a.z),new Vector3(0,1,0),13.2),m=>m.metadata?.proceduralMap==='snow');const physics=firstShotBox(w.geometry,{},a,b);assert.ok(visual?.hit&&physics);assert.ok(Math.abs(visual!.distance-physics!.t*13.2)<.04,'ceiling impacts must land on the visible curve');}finally{w.scene.dispose();e.dispose();}
});
test('main aisles connect the observation igloo to both labs and the outside',()=>{
 const w=createWorld('snow');for(let x=0;x<=33;x+=.5)assert.ok(w.canStand({x,z:0},.55),`link aisle x=${x}`);for(let z=0;z>=-38;z-=.5)assert.ok(w.canStand({x:0,z},.55),`front airlock z=${z}`);
});
