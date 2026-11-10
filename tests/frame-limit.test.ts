import test from 'node:test';import assert from 'node:assert/strict';import {createFrameLimit,type FrameTarget} from '../src/frame-limit.ts';
test('frame targets cap draw calls at 30/60/90/120 without inventing display refresh frames',()=>{for(const refresh of [60,90,120,144])for(const target of [30,60,90,120,0] as FrameTarget[]){const limiter=createFrameLimit(target);let draws=0;for(let n=0;n<refresh;n++)if(limiter.shouldRender(n*1000/refresh))draws++;const expected=target?Math.min(target,refresh):refresh;assert.ok(Math.abs(draws-expected)<=1,`${refresh}Hz / target ${target}: ${draws} draws`);}});
test('target changes and background gaps render once without catchup bursts',()=>{const f=createFrameLimit(30);assert.ok(f.shouldRender(0));assert.equal(f.shouldRender(10),false);assert.ok(f.shouldRender(10000));assert.equal(f.shouldRender(10001),false);f.setTarget(120);assert.ok(f.shouldRender(10002));assert.equal(f.shouldRender(10003),false);f.reset();assert.ok(f.shouldRender(10004));});

test('automatic cap drops after sustained load and retries 60 after stable play',()=>{
 const limiter=createFrameLimit('auto');
 assert.equal(limiter.target,60);
 for(let i=0;i<80;i++)limiter.sample(1/40,true);
 assert.equal(limiter.target,60,'one slow interval is not enough');
 for(let i=0;i<84;i++)limiter.sample(1/40,true);
 assert.equal(limiter.target,30);
 for(let i=0;i<600;i++)limiter.sample(1/30,false);
 assert.equal(limiter.target,30,'paused play cannot promote the cap');
 for(let i=0;i<660;i++)limiter.sample(1/30,true);
 assert.equal(limiter.target,60);
});

test('fixed choices never adapt and a tab gap is not a slow play sample',()=>{
 const limiter=createFrameLimit(90);
 for(let i=0;i<200;i++)limiter.sample(1/20,true);
 assert.equal(limiter.target,90);
 limiter.setTarget('auto');
 for(let i=0;i<20;i++)limiter.sample(3,true);
 assert.equal(limiter.target,60);
});
