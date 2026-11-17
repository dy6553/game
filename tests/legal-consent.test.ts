import test from 'node:test';import assert from 'node:assert/strict';
import {createAccount} from '../src/account.ts';import {createRecordStore} from '../server/record-store.js';

const sdk=()=>({getSession:async()=>({data:{user:{id:'u'},session:{token:'signed.jwt.value'}}}),signIn:{email:async()=>({})},signUp:{email:async()=>({})},signOut:async()=>({})});
test('signup blocks missing age and privacy choices before contacting managed auth',async()=>{
 let registrations=0;const auth=sdk();auth.signUp.email=async()=>{registrations++;return {};};const a=createAccount(auth,async()=>Response.json({id:'p',played:0,wins:0,recent:[]}),'https://game');
 await assert.rejects(a.signUp('test@example.com','password','대원'),/동의|확인/);assert.equal(registrations,0);
});
test('previously public profiles become inaccessible without a new explicit public choice',async()=>{
 const sql=Object.assign(async()=>[{id:'00000000-0000-4000-8000-000000000001',played:3,wins:1,nickname:'대원',recent:[]}],{transaction:async()=>[],query:()=>[]});
 const store=createRecordStore({},sql);assert.equal(await store.profile('00000000-0000-4000-8000-000000000001'),null,'no implicit grandfathered public consent');
});

test('required choices are individually enforced while declining public visibility is accepted',async()=>{
 const {LEGAL_VERSION,validLegalChoice}=await import('../src/legal.ts');const choice={version:LEGAL_VERSION,age14:true,privacy:true,terms:true,overseas:true,publicProfile:false};
 assert.equal(validLegalChoice(choice),true);for(const key of ['age14','privacy','terms','overseas'])assert.equal(validLegalChoice({...choice,[key]:false}),false,key);
 assert.equal(validLegalChoice({...choice,version:'old'}),false);
 const store=createRecordStore({},Object.assign(async()=>[],{transaction:async()=>[],query:()=>[]}));await assert.rejects(store.saveConsent('u',{...choice,age14:false}),/동의/);
});
test('public reads need both current policy and explicit public choice; owner reads keep private receipts',async()=>{
 const {LEGAL_VERSION}=await import('../src/legal.ts');let row={id:'p',played:3,wins:1,recent:[],version:LEGAL_VERSION,accepted_at:100,public_changed_at:101,public_profile:false};
 const sql=Object.assign(async()=>[row],{transaction:async()=>[],query:()=>[]}),store=createRecordStore({},sql);
 assert.equal(await store.profile('p'),null);const own=await store.profile('p',true);assert.equal(own?.played,3);assert.equal(own?.consent.publicProfile,false);
 row={...row,public_profile:true};assert.equal((await store.profile('p'))?.played,3);assert.equal((await store.profile('p'))?.consent,undefined,'receipt stays private');row={...row,version:'old'};assert.equal(await store.profile('p'),null);
});
test('client saves the exact separate choices to the authenticated server without reusing another account response',async()=>{
 const {LEGAL_VERSION}=await import('../src/legal.ts');const choice={version:LEGAL_VERSION,age14:true,privacy:true,terms:true,overseas:true,publicProfile:false};const calls:any[]=[];
 const a=createAccount(sdk(),async(url,options)=>{calls.push([url,options]);return Response.json({id:'p',played:0,wins:0,recent:[],consent:{version:LEGAL_VERSION,current:true,publicProfile:false,acceptedAt:1,publicChangedAt:1}});},'https://game');
 await a.acceptConsent(choice);assert.equal(calls[0][0],'https://game/account/consent');assert.equal(calls[0][1].headers.Authorization,'Bearer signed.jwt.value');assert.deepEqual(JSON.parse(calls[0][1].body),choice);assert.equal(a.profile?.consent?.current,true);
 await a.acceptConsent({publicProfile:false});assert.deepEqual(JSON.parse(calls[1][1].body),{publicProfile:false});
});

test('consent receipts use server time and ignore client-supplied timestamps; revocation needs no renewed acceptance',async t=>{
 const {LEGAL_VERSION}=await import('../src/legal.ts');const writes:any[]=[];t.mock.method(Date,'now',()=>123456);
 const sql=Object.assign(async(strings:any,...values:any[])=>{writes.push({text:strings.join('?'),values});return [{profile_id:'p'}];},{transaction:async()=>[],query:()=>[]}),store=createRecordStore({},sql);store.account=async()=>({id:'p'});
 await store.saveConsent('me',{version:LEGAL_VERSION,age14:true,privacy:true,terms:true,overseas:true,publicProfile:false,acceptedAt:999});
 const write=writes.find(x=>x.text.includes('INSERT INTO harbor.legal_choices'));assert.ok(write);assert.ok(write.values.includes(123456));assert.equal(write.values.includes(999),false);
 await store.saveConsent('me',{publicProfile:false});assert.ok(writes.at(-1).text.includes('UPDATE harbor.legal_choices'));
});
test('account gameplay is gated by current consent while owner records remain readable',async()=>{
 const sql=Object.assign(async()=>[],{transaction:async()=>[],query:()=>[]}),store=createRecordStore({},sql);
 store.account=async()=>({id:'p',consent:null});await assert.rejects(store.requireConsent('me'),{status:428});store.account=async()=>({id:'p',consent:{current:true,publicProfile:false}});assert.equal((await store.requireConsent('me')).id,'p');
});
