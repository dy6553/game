import test from 'node:test';import assert from 'node:assert/strict';
import {createAccount} from '../src/account.ts';
test('auth restores actual session, clears stale account and never stores passwords or JWTs',async()=>{
 let logged=false;const calls=[];
 const sdk={getSession:async()=>({data:logged?{user:{id:'u'},session:{token:'signed.jwt.value'}}:null}),signIn:{email:async body=>{calls.push(body);logged=true;return {}; }},signUp:{email:async()=>({})},signOut:async()=>{logged=false;return {};},deleteUser:async()=>{logged=false;return {};}};
 const a=createAccount(sdk,async(_url,options)=>{assert.equal(options.headers.Authorization,'Bearer signed.jwt.value');return Response.json({id:'public',played:0,wins:0,recent:[]});},'https://game');
 assert.equal(await a.token(),null);await a.signIn('a@example.com','test-password');assert.equal(a.profile?.id,'public');assert.equal(await a.token(),'signed.jwt.value');assert.equal(calls.length,1);
 await a.signOut();assert.equal(a.profile,null);assert.equal(await a.token(),null);
});
test('failed or blocked auth cannot report success or turn into an anonymous official match',async()=>{
 const sdk={getSession:async()=>({error:{message:'blocked cookie'}}),signIn:{email:async()=>({error:{message:'invalid'}})},signUp:{email:async()=>({})},signOut:async()=>({}),deleteUser:async()=>({})};
 const a=createAccount(sdk,async()=>{throw Error('must not request profile');},'https://game');
 await assert.rejects(a.signIn('bad','bad'));await assert.rejects(a.token());assert.equal(a.profile,null);
});
