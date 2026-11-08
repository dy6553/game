import test from 'node:test';import assert from 'node:assert/strict';
import {parseLevelEdit,validAdminEmail} from '../server/admin-levels.js';
const body={id:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002',level:6,expectedXP:240,reason:'지원 요청'};
test('admin level edit converts selected level to XP and preserves a receipt for safe retries',()=>{
 assert.deepEqual(parseLevelEdit(body),{...body,xp:1000});
 assert.equal(parseLevelEdit({...body,level:1})?.xp,0);
});
test('malformed account selectors, unsafe levels, stale-value shapes and long reasons are rejected',()=>{
 for(const edit of [{...body,id:'bad'},{...body,level:0},{...body,level:1.5},{...body,level:Infinity},{...body,level:Number.MAX_SAFE_INTEGER},{...body,expectedXP:-1},{...body,requestId:'x'},{...body,reason:'x'.repeat(201)}])assert.equal(parseLevelEdit(edit),null);
 assert.equal(validAdminEmail('target@example.com'),true);assert.equal(validAdminEmail('bad'),false);assert.equal(validAdminEmail('x'.repeat(255)+'@example.com'),false);
});
