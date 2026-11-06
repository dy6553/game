import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaytestWindow} from '../src/playtest-metrics.ts';
import handler from '../api/playtest.js';
const origin='https://project-3uu6s.vercel.app';
const request=(body:unknown,headers:Record<string,string>={})=>new Request(origin+'/api/playtest',{method:'POST',headers:{Origin:origin,...headers},body:JSON.stringify(body)});
test('playtest summary distinguishes high network latency from smooth rendering',()=>{
 const w=createPlaytestWindow();for(let i=0;i<900;i++)w.frame(1/60);for(let i=0;i<60;i++)w.network(800);for(let i=0;i<300;i++)w.gap(50);w.correction(.3);
 const s=w.read();assert.equal(s.fps,60);assert.equal(s.rttP95Ms,800);assert.equal(s.gapP95Ms,50);assert.equal(s.stalls,0);assert.equal(s.correctionP95M,.3);
 const slow=createPlaytestWindow();for(let i=0;i<30;i++)slow.frame(.1);slow.network(80);assert.equal(slow.read().fps,10);assert.equal(slow.read().stalls,30);assert.equal(slow.read().rttP95Ms,80);
});
test('summary ignores malformed samples and caps memory',()=>{
 const w=createPlaytestWindow();w.frame(NaN);w.network(Infinity);w.gap(-1);w.correction(999);for(let i=0;i<20000;i++)w.frame(1/60);assert.equal(w.read().frames,8192);assert.equal(w.read().rttSamples,0);assert.equal(w.read().corrections,0);
});
test('playtest endpoint logs only allowlisted aggregate metrics and rejects invalid payloads',async()=>{
 const logs:string[]=[];const previous=console.log;console.log=(...args:unknown[])=>{logs.push(args.join(' '));};
 try{
  const w=createPlaytestWindow();w.frame(.016);w.network(120);
  const body={v:1,source:'synthetic',report:'C0DE0001',window:1,mode:'online',...w.read(),token:'DO_NOT_LOG',userAgent:'DO_NOT_LOG'};
  assert.equal((await handler.fetch(request(body))).status,200);assert.equal(logs.length,1);assert.ok(logs[0]!.includes('harbor_playtest'));assert.equal(logs[0]!.includes('DO_NOT_LOG'),false);
  assert.equal((await handler.fetch(request({...body,rttP95Ms:-1}))).status,400);
  assert.equal((await handler.fetch(request({...body,report:'secret-token'}))).status,400);
  assert.equal((await handler.fetch(request(body,{Origin:'https://invalid.example'}))).status,403);
  assert.equal((await handler.fetch(request({...body,extra:'x'.repeat(5000)}))).status,413);assert.equal(logs.length,1);
 }finally{console.log=previous;}
});
