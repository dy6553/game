import test from 'node:test';import assert from 'node:assert/strict';
import {deleteOwnAccount} from '../server/account-delete.js';
const env={NEON_AUTH_URL:'https://auth.test/auth'};
const request=password=>new Request('https://game/account',{method:'DELETE',headers:{Origin:'https://game.test'},body:JSON.stringify({password,userId:'someone-else'})});
test('only verified own identity and a correct password can delete the account',async()=>{
 let removed;const store={async emailFor(id){assert.equal(id,'me');return 'own@example.invalid';},async remove(id){removed=id;}};
 const fetcher=async(url,options)=>{assert.equal(url,'https://auth.test/auth/sign-in/email');assert.equal(options.headers.Origin,'https://game.test');assert.deepEqual(JSON.parse(options.body),{email:'own@example.invalid',password:'correct-password'});return Response.json({user:{id:'me'}});};
 const r=await deleteOwnAccount(request('correct-password'),env,'me',store,fetcher);assert.equal(r.status,200);assert.equal(removed,'me');
});
test('missing password, wrong password, identity mismatch and service failure never delete',async()=>{
 let removed=0;const store={async emailFor(){return 'own@example.invalid';},async remove(){removed++;}};
 assert.equal((await deleteOwnAccount(request(''),env,'me',store,async()=>{throw Error('must not call');})).status,400);
 assert.equal((await deleteOwnAccount(request('wrong-password'),env,'me',store,async()=>Response.json({error:'wrong'},{status:401}))).status,403);
 assert.equal((await deleteOwnAccount(request('correct-password'),env,'me',store,async()=>Response.json({user:{id:'other'}}))).status,403);
 const r=await deleteOwnAccount(request('correct-password'),env,'me',store,async()=>{throw Error('secret');});assert.equal(r.status,503);assert.equal((await r.text()).includes('secret'),false);assert.equal(removed,0);
});
