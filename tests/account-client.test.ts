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
test('account deletion sends password to the verified server route, and failure preserves the account',async()=>{
 let signedIn=true;const calls=[];
 const sdk={async getSession(){return {data:{user:{id:'me'},session:{token:'signed.jwt.value'}}};},signIn:{email:async()=>({})},signUp:{email:async()=>({})},async signOut(){signedIn=false;return {};},async deleteUser(){throw Error('unsupported upstream route must not be used');}};
 let reject=true;const a=createAccount(sdk,async(url,options)=>{calls.push({url,options});if(options.method==='DELETE')return reject?Response.json({error:'비밀번호를 확인하세요.'},{status:403}):Response.json({ok:true});return Response.json({id:'public',played:1,wins:1,recent:[]});},'https://game');
 await a.refresh();await assert.rejects(a.remove('wrong-password'));assert.ok(a.profile);assert.equal(signedIn,true);reject=false;await a.remove('correct-password');assert.equal(a.profile,null);assert.equal(await a.token(),null,'deleted session cannot block guest play even if SDK cache is stale');assert.equal(signedIn,false);
 const removal=calls.find(c=>c.options.method==='DELETE');assert.equal(removal.url,'https://game/account');assert.equal(removal.options.headers.Authorization,'Bearer signed.jwt.value');assert.equal(JSON.parse(removal.options.body).password,'wrong-password');
});
