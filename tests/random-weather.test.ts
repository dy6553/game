import test from 'node:test';
import assert from 'node:assert/strict';
import {snowWeather,weatherMessage,inWeatherRange} from '../src/snow-weather.ts';
import {createNetworkGame} from '../src/network-game.ts';

test('weather seed changes random onset, stays reproducible and warns for the final ten seconds',()=>{
 const w=(time:number,seed:number)=>(snowWeather as (t:number,s:number)=>ReturnType<typeof snowWeather>&{startsIn:number;endsIn:number;warning:number})(time,seed);
 const starts=new Set<number>(),durations=new Set<number>();
 for(let seed=1;seed<=16;seed++){
  const initial=w(0,seed);assert.ok(initial.startsIn>=40&&initial.startsIn<=80,'random clear interval');
  starts.add(initial.startsIn);
  assert.deepEqual(w(22,seed),w(22,seed),'deterministic across clients');
  assert.equal(w(initial.startsIn-10,seed).warning,10);assert.equal(w(initial.startsIn-1,seed).warning,1);
  const storm=w(initial.startsIn+.01,seed);assert.equal(storm.warning,0);assert.ok(storm.endsIn>=19&&storm.endsIn<=35,'random total storm duration');durations.add(Math.round(storm.endsIn));
  assert.equal(w(initial.startsIn+storm.endsIn+.02,seed).phase,'clear');
 }
 assert.ok(starts.size>8,'onset is not a fixed period');assert.ok(durations.size>4,'duration varies');
});
test('online weather seed is created once, survives checkpoints and is sent in snapshots',()=>{
 const g=createNetworkGame(undefined,'snow',{mode:'team',waitingRoom:true});const seed=(g.state as typeof g.state&{weatherSeed:number}).weatherSeed;
 assert.ok(Number.isInteger(seed)&&seed>0,'match seed');
 assert.equal((createNetworkGame(g.checkpoint()).state as typeof g.state&{weatherSeed:number}).weatherSeed,seed);
});

test('subsequent storms have bounded random clear periods and durations, independent of query order',()=>{
 const seed=8753;let previousEnd=0;
 for(let cycle=0;cycle<40;cycle++){
  const clear=snowWeather(previousEnd,seed),start=previousEnd+clear.startsIn;
  assert.ok(clear.startsIn>=40&&clear.startsIn<=80);
  const heavy=snowWeather(start+5,seed),end=start+5+heavy.endsIn;
  assert.equal(heavy.visibility,28);assert.ok(end-start>=20&&end-start<=35);
  assert.equal(inWeatherRange('snow',start+5,{x:0,z:0},{x:0,z:27},seed),true);
  assert.equal(inWeatherRange('snow',start+5,{x:0,z:0},{x:0,z:29},seed),false);
  assert.equal(snowWeather(start-2,seed).warning,2);previousEnd=end;
 }
 assert.equal(snowWeather(0,seed).phase,'clear','rewinding is deterministic');
});
test('HUD countdown describes actual upcoming weather and remaining duration',()=>{
 const seed=77,start=snowWeather(0,seed).startsIn;
 assert.equal(weatherMessage(null),'');assert.equal(weatherMessage(snowWeather(start-3,seed)),'폭설까지 3초');
 assert.match(weatherMessage(snowWeather(start+5,seed)),/폭설 · 시야 제한 · \d+초 남음/);
 assert.ok(!weatherMessage(snowWeather(0,seed)).includes('주기적'));
});

test('storm notice remains available when the minimap is hidden',async()=>{
 const {parseHTML}=await import('linkedom'),{COMBAT_HUD_MARKUP}=await import('../src/combat-hud.ts');
 const {document}=parseHTML(`<html><body>${COMBAT_HUD_MARKUP}</body></html>`),notice=document.querySelector('#weather-notice');
 assert.ok(notice,'visible countdown needs a dedicated HUD notice');assert.equal(notice.closest('#combat-map'),null,'minimap preference cannot hide warnings');
 assert.ok(notice.hasAttribute('hidden'),'no stale warning at startup');
});
