import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialSound,createGameAudio } from '../src/audio.ts';
test('spatial sound follows player yaw and falls off with distance',()=>{
 assert.ok(spatialSound(10,0,0).pan>.99);assert.ok(spatialSound(-10,0,0).pan<-.99);
 assert.ok(Math.abs(spatialSound(10,0,Math.PI/2).pan)<1e-8);
 assert.ok(spatialSound(0,20,0).gain<spatialSound(0,2,0).gain);
});
test('audio unlock, voice cap, mute and pause work without breaking gameplay',async()=>{
 let started=0,stopped=0;
 class Node{gain={value:0,setTargetAtTime(){}};pan={value:0};threshold={value:0};ratio={value:0};playbackRate={value:1};buffer:unknown;loop=false;onended:(()=>void)|null=null;connect(){}disconnect(){}start(){started++;}stop(){stopped++;this.onended?.();}}
 class Context{sampleRate=8000;currentTime=0;state='running';destination=new Node();createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createBufferSource(){return new Node();}createStereoPanner(){return new Node();}createBuffer(_n:number,length:number){const data=new Float32Array(length);return {getChannelData(){return data;}};}async resume(){this.state='running';}async close(){this.state='closed';}}
 const globals={AudioContext:Context,localStorage:{getItem(){return null;},setItem(){}},location:{protocol:'file:'}};
 const previous=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries(globals)){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});}
 try{
  const audio=createGameAudio();audio.play('pistol');assert.equal(started,0);await audio.unlock();assert.equal(started,1,'one environment loop');
  audio.pause(false);for(let i=0;i<40;i++)audio.play('pistol');assert.equal(started,25,'at most 24 effect voices');
  audio.pause(true);assert.equal(stopped,24);audio.play('hit');assert.equal(started,25);
  audio.pause(false);audio.configure({muted:true});audio.play('hit');assert.equal(started,25);
  audio.configure({muted:false,master:10});assert.equal(audio.settings.master,1);audio.play('hit');assert.equal(started,26);
  audio.dispose();
 }finally{for(const [key,desc] of previous){if(desc)Object.defineProperty(globalThis,key,desc);else Reflect.deleteProperty(globalThis,key);}}
});
test('menu cues play while gameplay is paused, respect mute, stop on focus loss and cap voices',async()=>{
 let starts=0,stops=0;
 class N{gain={setTargetAtTime(){}};pan={value:0};threshold={value:0};ratio={value:0};playbackRate={value:1};onended;connect(){}disconnect(){}start(){starts++;}stop(){stops++;this.onended?.();}}
 class C{sampleRate=8000;currentTime=0;state='running';destination=new N();createGain(){return new N();}createDynamicsCompressor(){return new N();}createBufferSource(){return new N();}createStereoPanner(){return new N();}createBuffer(n,length){return {getChannelData:()=>new Float32Array(length)};}async resume(){}async close(){}}
 const previous=new Map();for(const [key,value] of Object.entries({AudioContext:C,localStorage:{getItem:()=>null,setItem(){}},location:{protocol:'file:'}})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});}
 try{const a=createGameAudio();assert.equal(typeof a.playInterface,'function','menu audio must work independently of paused gameplay');await a.unlock();a.playInterface('ui');assert.equal(starts,2);a.pause(true);assert.equal(stops,0);a.setInterfaceActive(false);assert.equal(stops,1);a.playInterface('ui');assert.equal(starts,2);a.setInterfaceActive(true);a.configure({muted:true});a.playInterface('ui');assert.equal(starts,2);a.configure({muted:false});for(let i=0;i<12;i++)a.playInterface('deploy');assert.equal(starts,6,'at most four simultaneous interface cues');a.dispose();}finally{for(const [key,desc] of previous){if(desc)Object.defineProperty(globalThis,key,desc);else Reflect.deleteProperty(globalThis,key);}}
});
test('interrupted mobile audio resumes and critical feedback survives a saturated effects pool',async()=>{
 const sources:any[]=[];let context:any,resumes=0;
 class N{gain={value:0,setTargetAtTime(){}};pan={value:0};threshold={value:0};ratio={value:0};playbackRate={value:1};onended;buffer;stopped=false;connect(){}disconnect(){}start(){}stop(){this.stopped=true;this.onended?.();}}
 class C{sampleRate=8000;currentTime=0;state='running';destination=new N();constructor(){context=this;}createGain(){return new N();}createDynamicsCompressor(){return new N();}createBufferSource(){const n=new N();sources.push(n);return n;}createStereoPanner(){return new N();}createBuffer(n,length){return {getChannelData:()=>new Float32Array(length)};}async resume(){resumes++;this.state='running';}async close(){this.state='closed';}}
 const previous=new Map();for(const [key,value] of Object.entries({AudioContext:C,localStorage:{getItem:()=>null,setItem(){}},location:{protocol:'file:'}})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});}
 try{const a=createGameAudio();await a.unlock();context.state='interrupted';await a.unlock();assert.equal(resumes,1,'a new touch can recover interrupted mobile audio');a.pause(false);for(let i=0;i<24;i++)a.play('step');a.play('kill');assert.equal(sources.length,26,'critical cue replaces a low priority step at the 24 voice cap');assert.ok(sources[1].stopped);a.configure({muted:true});assert.ok(sources.slice(1).every(s=>s.stopped),'muting discards old voices so unmute cannot replay them');a.dispose();const count=sources.length;await a.unlock();assert.equal(sources.length,count,'disposed audio cannot be restarted by late gesture promises');}finally{for(const [key,desc] of previous){if(desc)Object.defineProperty(globalThis,key,desc);else Reflect.deleteProperty(globalThis,key);}}
});
