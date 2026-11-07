import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame} from '../src/network-game.ts';
// Server-only module: the browser cannot submit a finished match.
import {captureOfficialResult,createResultOutbox,publicProfile} from '../server/official-records.js';
test('only a server-confirmed ten-kill online match produces official rows',()=>{
 const g=createNetworkGame();g.join('a');g.join('b');const identities={a:'user-a'};
 assert.equal(captureOfficialResult('match',g.state,identities,100),null);
 g.state.winner='a';g.state.players[0].kills=9;assert.equal(captureOfficialResult('match',g.state,identities,100),null);
 g.state.players[0].kills=10;g.state.players[1].kills=3;
 const r=captureOfficialResult('match',g.state,identities,100);
 assert.deepEqual(r,{matchId:'match',endedAt:100,rows:[{subject:'user-a',outcome:'win',kills:10,deaths:3}]});
 assert.equal(JSON.stringify(r).includes('user-b'),false);
 assert.equal(captureOfficialResult('match',g.state,{a:'same',b:'same'},100),null,'one account cannot farm itself');
});
test('durable outbox persists before send, retries after restoration and deduplicates completion',async()=>{
 const values=new Map();const storage={async get(k){return structuredClone(values.get(k));},async put(k,v){values.set(k,structuredClone(v));},async delete(k){values.delete(k);}};
 const event={matchId:'m',endedAt:5,rows:[{subject:'u',outcome:'win',kills:10,deaths:0}]};
 let attempts=0;const failing=async()=>{attempts++;assert.ok(values.has('official-outbox'));throw Error('database asleep');};
 const q=createResultOutbox(storage,failing);await q.enqueue(event);await q.enqueue(event);await q.flush();assert.equal(attempts,1);assert.equal((await storage.get('official-outbox')).length,1);
 const written=[];const restored=createResultOutbox(storage,async e=>{written.push(e);});await restored.flush();assert.equal(written.length,1);assert.equal(await restored.pending(),false);
});
test('public profiles omit email, auth subject, match receipts and session data',()=>{
 const result=publicProfile({id:'public-id',played:4,wins:3,subject:'private',email:'hidden@example.com',recent:[{match_id:'private-match',ended_at:5,outcome:'win',kills:10,deaths:2,token:'secret'}]});
 assert.deepEqual(result,{id:'public-id',played:4,wins:3,recent:[{endedAt:5,outcome:'win',kills:10,deaths:2}]});
 assert.equal(/private|email|secret/.test(JSON.stringify(result)),false);
});
test('concurrent completions and delivery never lose a second durable result',async()=>{
 const values=new Map();const storage={async get(k){await new Promise(r=>setImmediate(r));return structuredClone(values.get(k));},async put(k,v){await new Promise(r=>setImmediate(r));values.set(k,structuredClone(v));}};
 const a=createResultOutbox(storage,async()=>{}),b=createResultOutbox(storage,async()=>{});
 await Promise.all([a.enqueue({matchId:'one'}),b.enqueue({matchId:'two'})]);assert.equal((await storage.get('official-outbox')).length,2);
});
