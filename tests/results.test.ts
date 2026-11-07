import test from 'node:test';
import assert from 'node:assert/strict';
import * as results from '../src/results.ts';
const row=(id='game-1',changes={})=>({id,endedAt:1000,mode:'survival',difficulty:'auto',outcome:'win',kills:12,deaths:1,seconds:65.5,wave:20,totalWaves:20,peakStage:7,...changes});
function storage(){let raw=null,writes=0;return {getItem:()=>raw,setItem:(key,value)=>{raw=value;writes++;},get raw(){return raw;},set raw(v){raw=v;},get writes(){return writes;}};}
function journal(s=storage()){assert.equal(typeof results.createResultJournal,'function','result journal must exist');return results.createResultJournal(s);}
test('finished results survive reload and duplicate game IDs never count twice',()=>{
 const s=storage(),j=journal(s);assert.equal(j.add(row()),true);assert.equal(j.add(row()),false);const loaded=journal(s).read();assert.equal(loaded.recent.length,1);assert.equal(loaded.played,1);assert.equal(loaded.wins,1);assert.equal(s.writes,1);assert.equal(journal(s).add(row()),false);
});
test('history is bounded but lifetime wins and separate survival bests remain',()=>{
 const j=journal();j.add(row('best'));for(let i=0;i<25;i++)j.add(row('loss-'+i,{outcome:'loss',wave:1,peakStage:5}));const s=j.read();assert.equal(s.recent.length,20);assert.equal(s.recent[0].id,'loss-24');assert.equal(s.played,26);assert.equal(s.wins,1);assert.equal(s.bestSurvival.auto.wave,20);assert.equal(s.bestSurvival.auto.cleared,true);assert.equal(s.peakStage,7);j.add(row('easy',{difficulty:'easy',wave:2,totalWaves:10,peakStage:null,outcome:'loss'}));assert.equal(j.read().bestSurvival.easy.wave,2);assert.equal(j.read().bestSurvival.auto.wave,20);
});
test('storage exceptions preserve the result in memory and report that persistence failed',()=>{
 const j=journal({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});assert.equal(j.add(row()),true);assert.equal(j.read().recent.length,1);assert.equal(j.persisted,false);assert.equal(j.add(row()),false);
});
test('corrupt or future stored formats and invalid rows cannot crash or inject content',()=>{
 const s=storage();for(const value of ['{','null','[]',JSON.stringify({version:99,recent:[row()]})]){s.raw=value;const j=journal(s);assert.equal(j.read().played,0);}
 const j=journal();for(const invalid of [{kills:-1},{mode:'<img>'},{outcome:'abandoned'},{seconds:NaN},{wave:21},{peakStage:10},{id:''},{mode:'online',difficulty:'auto'}])assert.throws(()=>j.add(row('invalid',invalid)));assert.equal(j.read().played,0);
});
const snapshot=(changes={})=>({mode:'survival',difficulty:'auto',active:true,winner:'',kills:0,deaths:0,wave:1,totalWaves:20,stage:5,...changes});
function tracker(){assert.equal(typeof results.createResultTracker,'function','match result tracker must exist');return results.createResultTracker(()=>1000,()=> 'fixture-id');}
test('tracker freezes completed results, observes peak stages and never records an unfinished game',()=>{
 const t=tracker();t.start();t.observe(snapshot(),3);t.observe(snapshot({stage:7}),2);assert.equal(t.finish(),null);t.observe(snapshot({winner:'win',kills:12,deaths:2,wave:20,stage:6}),1);const r=t.finish();assert.equal(r.seconds,6);assert.equal(r.peakStage,7);assert.equal(r.outcome,'win');assert.equal(r.deaths,2);t.observe(snapshot({stage:9}),100);assert.deepEqual(t.finish(),r);t.start();assert.equal(t.finish(),null);
});
test('non-playing screens, practice and paused frames add no match time or records',()=>{
 const t=tracker();t.start();t.observe(snapshot(),0);t.observe(snapshot(),10,false);t.observe(snapshot({active:false}),10);t.observe(snapshot({mode:'practice',winner:'win'}),10);assert.equal(t.finish(),null);t.observe(snapshot({winner:'loss',wave:3}),2);assert.equal(t.finish().seconds,2);
});
test('online result requires an explicit authoritative winner; opponent kills are the player deaths',()=>{
 const t=tracker();t.start();t.observe(snapshot({mode:'online',difficulty:null,wave:null,totalWaves:null,stage:null}),4);assert.equal(t.finish(),null);t.observe(snapshot({mode:'online',difficulty:null,wave:null,totalWaves:null,stage:null,winner:'loss',kills:6,deaths:10}),1);assert.deepEqual(t.finish(),row('fixture-id',{mode:'online',difficulty:null,wave:null,totalWaves:null,peakStage:null,outcome:'loss',kills:6,deaths:10,seconds:5}));
});
