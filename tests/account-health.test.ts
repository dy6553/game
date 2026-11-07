import test from 'node:test';import assert from 'node:assert/strict';
import {checkAccountHealth} from '../server/account-health.js';
test('a stored database secret can be checked without returning it or enabling accounts',async()=>{
 const env={DATABASE_URL:'postgresql://private:secret@example.test/neondb',NEON_AUTH_URL:'https://auth.test/auth'};
 let checked=false;const status=await checkAccountHealth(env,async sql=>{checked=true;assert.match(sql,/^SELECT/i);return [{auth:true,profiles:false,receipts:false,recent:false,purge:false}];});
 assert.equal(checked,true);assert.equal(status.databaseConfigured,true);assert.equal(status.database,'schema_missing');assert.equal(status.authConfigured,true);assert.equal(status.enabled,false);assert.equal(status.ready,false);assert.equal(JSON.stringify(status).includes('secret'),false);
});
test('missing secret, unreachable database, incomplete schema and ready schema stay distinct',async()=>{
 assert.equal((await checkAccountHealth({})).database,'missing');
 const env={DATABASE_URL:'postgresql://secret@db.test/neondb',NEON_AUTH_URL:'https://auth.test/auth',ACCOUNTS_ENABLED:'true'};
 const failed=await checkAccountHealth(env,async()=>{throw Error(env.DATABASE_URL);});assert.equal(failed.database,'unavailable');assert.equal(failed.ready,false);assert.equal(JSON.stringify(failed).includes('secret'),false);
 const complete=async()=>[{auth:true,profiles:true,receipts:true,recent:true,purge:true}];assert.equal((await checkAccountHealth(env,complete)).ready,true);
 assert.equal((await checkAccountHealth({...env,ACCOUNTS_ENABLED:'false'},complete)).ready,false);
});
