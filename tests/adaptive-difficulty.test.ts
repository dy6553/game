import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../src/duel.ts';
// Explicit test fixtures; application defaults await the user's rule selection.
const policy={initial:'normal',healthyThreshold:50,clearsToRaise:2};
function controller(){assert.equal(typeof rules.createAdaptiveDifficulty,'function','adaptive controller must exist');return rules.createAdaptiveDifficulty(policy);}
test('healthy consecutive clears raise only at a completed wave boundary and cap at hard',()=>{
 const c=controller();assert.equal(c.state().difficulty,'normal');c.completeWave(50);assert.equal(c.state().difficulty,'normal');assert.equal(c.state().streak,1);c.completeWave(100);assert.equal(c.state().difficulty,'hard');assert.equal(c.state().streak,0);for(let i=0;i<6;i++)c.completeWave(100);assert.equal(c.state().difficulty,'hard');
});
test('a low-health clear breaks the streak and a death lowers one tier to the easy floor',()=>{
 const c=controller();c.completeWave(100);c.completeWave(49);assert.equal(c.state().streak,0);c.completeWave(100);assert.equal(c.state().difficulty,'normal');c.retryAfterDeath();assert.equal(c.state().difficulty,'easy');assert.equal(c.state().streak,0);c.retryAfterDeath();assert.equal(c.state().difficulty,'easy');c.completeWave(100);c.completeWave(100);assert.equal(c.state().difficulty,'normal');assert.equal(controller().state().difficulty,'normal','new games reset adaptation');
});
test('invalid policy and health inputs fail without corrupting adaptation',()=>{
 const c=controller();c.completeWave(100);for(const health of [NaN,Infinity,-1,101])assert.throws(()=>c.completeWave(health));assert.deepEqual(c.state(),{difficulty:'normal',streak:1,stage:2});for(const invalid of [{...policy,clearsToRaise:0},{...policy,healthyThreshold:101},{...policy,initial:'auto'}])assert.throws(()=>rules.createAdaptiveDifficulty(invalid));
});
const tick=m=>m.update(5,{x:0,z:-8},()=>false,()=>false);
function clear(m){let guard=0;while(m.state().phase==='combat'&&guard++<30){for(const b of m.state().bots)if(b.health>0)m.hurt(b.id,100);if(m.state().phase==='combat')tick(m);}assert.ok(guard<30);}
test('automatic survival uses twenty waves and applies healthy streak changes only to new waves',()=>{
 const m=rules.createSurvivalMatch('auto');assert.equal(m.state().automatic,true);assert.equal(m.state().difficulty,'normal');assert.equal(m.state().totalWaves,20);tick(m);clear(m);tick(m);m.hurtPlayer('bot-1',50);clear(m);assert.equal(m.state().adaptiveStage,6);assert.equal(m.state().wave,3);assert.equal(m.state().totalWaves,20);tick(m);assert.equal(m.state().adaptiveStage,6);
});
test('automatic survival lowers on retry, never on initial death or after final defeat',()=>{
 const m=rules.createSurvivalMatch('auto');tick(m);m.hurtPlayer('bot-1',100);assert.equal(m.state().difficulty,'normal');m.update(2,{x:0,z:-8},()=>false,()=>false);assert.equal(m.state().difficulty,'normal');m.update(1,{x:0,z:-8},()=>false,()=>false);assert.equal(m.state().adaptiveStage,4);assert.equal(m.state().wave,1);assert.equal(m.state().lives,2);m.hurtPlayer('bot-1',100);tick(m);m.hurtPlayer('bot-1',100);tick(m);assert.equal(m.state().phase,'lost');assert.equal(m.state().adaptiveStage,3);
});

import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../src/scene.ts';
test('real scene selects automatic survival, pauses and resets, and rejects auto in other modes',()=>{
 const engine=new NullEngine();try{const w=createHarborScene(engine);w.setMode('survival','auto');assert.equal(w.duelState().automatic,true);assert.equal(w.duelState().totalWaves,20);w.update({x:0,z:-8},5,undefined,true);assert.equal(w.duelState().phase,'preparing');w.resetPractice();assert.equal(w.duelState().automatic,true);w.setMode('duel');assert.equal(w.duelState().difficulty,'normal');w.setMode('ffa','auto');assert.equal(w.duelState().difficulty,'normal');w.scene.dispose();}finally{engine.dispose();}
});

test('nine-stage profiles interpolate timing and movement smoothly at every step',()=>{
 assert.equal(typeof rules.adaptiveBotProfile,'function');
 const profiles=Array.from({length:9},(_,i)=>rules.adaptiveBotProfile(i+1));
 for(const [index,key] of [[0,'easy'],[4,'normal'],[8,'hard']]){for(const k of ['speed','aimSeconds','warningSeconds'])assert.equal(profiles[index][k],rules.BOT_DIFFICULTIES[key][k]);}
 for(let i=1;i<9;i++){assert.ok(profiles[i].speed>profiles[i-1].speed);assert.ok(profiles[i].speed-profiles[i-1].speed<=.25);assert.ok(profiles[i-1].aimSeconds-profiles[i].aimSeconds<=.076);assert.ok(profiles[i].strafeSpeed>=profiles[i-1].strafeSpeed);assert.ok(profiles[i].strafeSpeed-profiles[i-1].strafeSpeed<=1.2);}
 assert.equal(profiles[0].strafeSpeed,0);assert.equal(profiles[4].strafeSpeed,4);for(const n of [0,10,1.5,NaN])assert.throws(()=>rules.adaptiveBotProfile(n));
});
test('nine-stage controller moves one step, respects bounds and clears streaks on retry',()=>{
 const c=rules.createAdaptiveDifficulty({...policy,stepsPerTier:4});assert.equal(c.state().stage,5);c.completeWave(100);c.completeWave(50);assert.equal(c.state().stage,6);c.retryAfterDeath();assert.equal(c.state().stage,5);for(let i=0;i<20;i++)c.completeWave(100);assert.equal(c.state().stage,9);for(let i=0;i<20;i++)c.retryAfterDeath();assert.equal(c.state().stage,1);
});
test('actual automatic enemies use the intermediate aim and warning times',()=>{
 const m=rules.createSurvivalMatch('auto');tick(m);clear(m);tick(m);clear(m);tick(m);assert.equal(m.state().adaptiveStage,6);
 for(let i=0;i<12;i++)m.update(.05,{x:0,z:10},()=>true,()=>false);
 assert.equal(m.state().bots[0].locked,null,'stage six must not lock before its 0.6375-second aim');
 m.update(.05,{x:0,z:10},()=>true,()=>false);assert.ok(m.state().bots[0].locked);assert.ok(Math.abs(m.state().bots[0].warning-.3375)<1e-8,'newly spawned agents use the interpolated warning, not a coarse profile');
});
test('automatic stays at twenty waves as stages rise, preserving quotas and the final victory',()=>{
 const m=rules.createSurvivalMatch('auto');for(let wave=1;wave<=20;wave++){tick(m);assert.equal(m.state().wave,wave);assert.equal(m.state().totalWaves,20);assert.equal(m.state().total,Math.min(12,3+Math.floor((wave-1)/2)));clear(m);assert.equal(m.state().winner,wave===20?'player':'');}assert.equal(m.state().adaptiveStage,9);
});
