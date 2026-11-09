import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineEvents} from '../src/online-events.ts';

test('empty snapshots retain pending shots, repeats never replay them, and drain is one-shot',()=>{
 const queue=createOnlineEvents<{id:number;hit:boolean}>();
 queue.receive([{id:1,hit:true}]);queue.receive([]);queue.receive([{id:1,hit:true},{id:2,hit:false}]);
 assert.deepEqual(queue.drain(),[{id:1,hit:true},{id:2,hit:false}]);
 queue.receive([{id:1,hit:true},{id:2,hit:false}]);assert.deepEqual(queue.drain(),[]);
});
test('stalls have bounded storage and a new session accepts restarted event IDs',()=>{
 const queue=createOnlineEvents(512);
 queue.receive(Array.from({length:1000},(_,id)=>({id})));
 const pending=queue.drain();assert.equal(pending.length,512);assert.equal(pending[0]!.id,488);
 queue.receive([{id:1000}]);queue.reset();queue.receive([{id:0}]);assert.deepEqual(queue.drain(),[{id:0}]);
});
