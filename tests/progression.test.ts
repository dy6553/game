import test from 'node:test';
import assert from 'node:assert/strict';
import {growth,reward} from '../src/progression.ts';
test('200XP levels unlock tiers at 2/4/6; factory at 3',()=>{
 assert.deepEqual(growth(450),{xp:450,level:3,tier:1,within:50});
 assert.equal(growth(600).tier,2);assert.equal(growth(1000).tier,3);assert.equal(growth(999999).tier,3);
});
test('completed results pay win/loss, bounded kill bonus and completed waves only',()=>{
 assert.equal(reward({mode:'duel',outcome:'win',kills:10}),200);
 assert.equal(reward({mode:'ffa',outcome:'loss',kills:4}),90);
 assert.equal(reward({mode:'survival',outcome:'loss',kills:80,wave:5,totalWaves:10}),230);
 assert.equal(reward({mode:'survival',outcome:'win',kills:80,wave:10,totalWaves:10}),400);
 assert.equal(reward({mode:'practice',outcome:'win',kills:10}),0);
 assert.equal(reward({mode:'duel',outcome:'quit',kills:10}),0);
});
