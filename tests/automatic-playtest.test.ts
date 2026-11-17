import {LEGAL_VERSION} from '../src/legal.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {savePlaytest} from '../server/playtest.js';
import {createPlaytestWindow} from '../src/playtest-metrics.ts';
import {createPlaytest} from '../src/playtest.ts';

test('normal visits and diagnostic URLs never transmit performance data without an explicit choice',async t=>{
 class Element extends EventTarget {hidden=false;disabled=false;textContent='';append(){} setAttribute(){}}
 const nodes:Element[]=[],window=Object.assign(new EventTarget(),{location:{search:'?diagnostics=1'}});
 const document=Object.assign(new EventTarget(),{hidden:false,querySelector:()=>new Element(),createTextNode:()=>new Element(),createElement:()=>{const e=new Element();nodes.push(e);return e;}});
 let posted=0;const globals={window,document,fetch:async()=>{posted++;return new Response(null,{status:201});}};
 for(const [key,value] of Object.entries(globals)){const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});t.after(()=>descriptor?Object.defineProperty(globalThis,key,descriptor):Reflect.deleteProperty(globalThis,key));}
 const collector=createPlaytest('https://game.example');
 for(let i=0;i<1300;i++)collector.frame(.05,'bot',true,null);
 document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));await new Promise(r=>setImmediate(r));
 assert.equal(posted,0,'URL parameters and page exit must not imply diagnostic upload consent');
 assert.ok(nodes.some(e=>e.textContent.includes('전송 시작')),'diagnostic upload requires an affirmative button');
});

test('automatic playtest stores only aggregate metrics with a 48-hour expiration',async()=>{
 const writes:unknown[][]=[];
 const kv={async put(...args:unknown[]){writes.push(args);}};
 const metrics=createPlaytestWindow();
 for(let i=0;i<360;i++)metrics.frame(1/60);
 const request=new Request('https://game.example/playtest',{method:'POST',body:JSON.stringify({
  v:1,diagnosticConsent:LEGAL_VERSION,diagnosticAge14:true,mode:'bot',...metrics.read(),token:'discard',userAgent:'discard',report:'discard',
 })});
 assert.equal((await savePlaytest(request,kv)).status,201);
 assert.equal(writes.length,1);
 assert.deepEqual(writes[0]![2],{expirationTtl:172800});
 const stored=JSON.parse(String(writes[0]![1]));
 assert.equal(stored.frames,360);assert.equal(stored.consentVersion,LEGAL_VERSION);
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
 assert.equal((await savePlaytest(request({v:1,diagnosticConsent:LEGAL_VERSION,diagnosticAge14:true,mode:'practice',...metrics.read()}),kv)).status,503);
});

test('diagnostic storage rejects older uploads without an explicit current diagnostic choice',async()=>{
 let writes=0;const metrics=createPlaytestWindow();for(let i=0;i<360;i++)metrics.frame(1/60);
 const response=await savePlaytest(new Request('https://game.example/playtest',{method:'POST',body:JSON.stringify({v:1,mode:'bot',...metrics.read()})}),{put:async()=>{writes++;}});
 assert.equal(response.status,400);assert.equal(writes,0);
});
