import test from 'node:test';import assert from 'node:assert/strict';import {createOnlineClient} from '../src/online.ts';
test('online reservations use a fresh auth header without exposing identity in the body or URL',async()=>{
 const previous=globalThis.fetch,Socket=globalThis.WebSocket;const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({code:'1234ABCD',id:'p',token:'room-secret'});};
 globalThis.WebSocket=class{static OPEN=1;readyState=0;send(){}constructor(url){assert.equal(String(url).includes('room-secret'),false);}close(){}};
 try{const client=createOnlineClient('https://game',()=>{},()=>{},()=>{},async()=>'signed.jwt');await client.enter('create','','pistol','robot');assert.equal(calls[0].options.headers.Authorization,'Bearer signed.jwt');assert.equal(JSON.parse(calls[0].options.body).userId,undefined);client.leave();
 const failed=createOnlineClient('https://game',()=>{},()=>{},()=>{},async()=>{throw Error('expired');});await assert.rejects(failed.enter('quick','','pistol','robot'));assert.equal(calls.length,1,'failed auth must not silently create a guest reservation');
 }finally{globalThis.fetch=previous;globalThis.WebSocket=Socket;}
});
