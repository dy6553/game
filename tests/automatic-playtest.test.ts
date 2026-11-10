import test from 'node:test';
import assert from 'node:assert/strict';
import {savePlaytest} from '../server/playtest.js';
import {createPlaytestWindow} from '../src/playtest-metrics.ts';
import {createPlaytest} from '../src/playtest.ts';

test('a normal visit sends gameplay summaries only and limits upload frequency',async t=>{
 class Element extends EventTarget {append(){} setAttribute(){}}
 const window=Object.assign(new EventTarget(),{location:{search:''}});
 const document=Object.assign(new EventTarget(),{
  hidden:false,querySelector:()=>new Element(),createElement:()=>new Element(),
 });
 let now=0;
 const posted:Record<string,unknown>[]=[];
 const globals={
  window,document,performance:{now:()=>now},
  fetch:async(url:string,options:RequestInit)=>{
   assert.equal(url,'https://game.example/playtest');
   assert.equal(options.credentials,'omit');
   posted.push(JSON.parse(String(options.body)));
   return new Response(null,{status:201});
  },
 };
 for(const [key,value] of Object.entries(globals)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{value,configurable:true});
  t.after(()=>descriptor?Object.defineProperty(globalThis,key,descriptor):Reflect.deleteProperty(globalThis,key));
 }
 const collector=createPlaytest('https://game.example');
 const play=(seconds:number,active:boolean)=>{
  for(let i=0;i<seconds*20;i++){
   now+=50;collector.frame(.05,'bot',active,null);
  }
 };
 play(65,false);
 assert.equal(posted.length,0);
 play(8,true);play(1,false);
 assert.equal(posted.length,1);
 assert.equal(posted[0]!.seconds,8);
 assert.equal(posted[0]!.report,undefined);
 play(8,true);play(1,false);
 assert.equal(posted.length,1);
 play(61,true);
 assert.equal(posted.length,2);
});

test('automatic playtest stores only aggregate metrics with a 48-hour expiration',async()=>{
 const writes:unknown[][]=[];
 const kv={async put(...args:unknown[]){writes.push(args);}};
 const metrics=createPlaytestWindow();
 for(let i=0;i<360;i++)metrics.frame(1/60);
 const request=new Request('https://game.example/playtest',{method:'POST',body:JSON.stringify({
  v:1,mode:'bot',...metrics.read(),token:'discard',userAgent:'discard',report:'discard',
 })});
 assert.equal((await savePlaytest(request,kv)).status,201);
 assert.equal(writes.length,1);
 assert.deepEqual(writes[0]![2],{expirationTtl:172800});
 const stored=JSON.parse(String(writes[0]![1]));
 assert.equal(stored.frames,360);
 assert.equal(stored.mode,'bot');
 assert.equal(JSON.stringify(stored).includes('discard'),false);
});

test('invalid samples and storage failures are handled independently of the game',async()=>{
 const request=(body:unknown)=>new Request('https://game.example/playtest',{method:'POST',body:JSON.stringify(body)});
 const kv={async put(){throw new Error('unavailable');}};
 assert.equal((await savePlaytest(request({v:1,mode:'bot'}),kv)).status,400);
 assert.equal((await savePlaytest(request({extra:'x'.repeat(5000)}),kv)).status,413);
 const metrics=createPlaytestWindow();
 for(let i=0;i<360;i++)metrics.frame(1/60);
 assert.equal((await savePlaytest(request({v:1,mode:'practice',...metrics.read()}),kv)).status,503);
});
