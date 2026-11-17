import test from 'node:test';import assert from 'node:assert/strict';
import * as weather from '../src/snow-weather.ts';import {createWorld} from '../src/world.ts';
test('snow research hub has shared central cover and room to pass around it',()=>{
 const w=createWorld('snow');assert.ok(w.worldSolids().some(r=>r.id==='igloo-central-pillar'),'central column must block shots and movement');assert.equal(w.canStand({x:0,z:0},.55),false);for(const x of [-3,3])for(let z=-12;z<=12;z+=.5)assert.ok(w.canStand({x,z},.55),`passage ${x},${z}`);
});
test('day/night changes deterministically with short randomized durations and smooth transitions',()=>{
 const fn=(weather as any).snowDaylight;assert.equal(typeof fn,'function');const a=Array.from({length:16},(_,i)=>fn(0,i+1));assert.ok(new Set(a.map(s=>s.nextChange)).size>4);for(const s of a)assert.ok(s.nextChange>=40&&s.nextChange<=80);const start=a[0].nextChange;assert.deepEqual(fn(start+3,1),fn(start+3,1));assert.ok(fn(start+3,1).night>0&&fn(start+3,1).night<1);assert.equal(fn(start+8,1).night,1);
});
test('central column blocks server shots at the visible surface',async()=>{
 const {firstShotBox}=await import('../src/combat-geometry.ts'),w=createWorld('snow');const hit=firstShotBox(w,{}, {x:-3,y:1.8,z:0},{x:3,y:1.8,z:0});assert.ok(hit);assert.ok(Math.abs(hit.t-.3)<.001);
});
test('practice spawn retains an unobstructed view of the default center target',async()=>{
 const {firstShotBox}=await import('../src/combat-geometry.ts'),w=createWorld('snow'),p=w.PROTOTYPE.spawn;
 assert.ok(w.canStand(p,.55));assert.equal(firstShotBox(w,{}, {...p,y:1.8},{x:0,y:1.9,z:32}),null);
});
test('online clients use the same night lighting at all graphics levels',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine.js'),{createHarborScene}=await import('../src/scene.ts'),{createNetworkGame}=await import('../src/network-game.ts');
 const e1=new NullEngine(),e2=new NullEngine(),a=createHarborScene(e1,{map:'snow'}),b=createHarborScene(e2,{map:'snow'});try{
  const g=createNetworkGame(undefined,'snow');g.join('a');g.join('b');g.state.weatherSeed=123;g.state.weatherTime=(weather as any).snowDaylight(0,123).nextChange+8;
  a.setQuality(true);b.setQuality(false);b.setPerformanceLow(true);a.setPreview(false);b.setPreview(false);a.renderOnline(g.state,'a',{yaw:0,pitch:0},0);b.renderOnline(g.state,'b',{yaw:0,pitch:0},0);
  assert.equal(a.scene.getLightByName('sky')!.intensity,b.scene.getLightByName('sky')!.intensity);
  const colors=(w:typeof a)=>Array.from(w.scene.getMeshByName('night-sky')!.getVerticesData('color')!);assert.deepEqual(colors(a),colors(b));
 }finally{a.scene.dispose();b.scene.dispose();e1.dispose();e2.dispose();}
});
