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
