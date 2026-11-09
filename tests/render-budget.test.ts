import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderBudget } from '../src/render-budget.ts';
test('adaptive resolution reacts to sustained slow frames and respects bounds',()=>{
 const budget=createRenderBudget(1.5);assert.equal(budget.sample(.2,true),null);
 for(let i=0;i<60;i++)budget.sample(.1,true);assert.ok(budget.density<1.5);
 for(let i=0;i<500;i++)budget.sample(.1,true);assert.equal(budget.density,.5);
 const before=budget.density;for(let i=0;i<120;i++)budget.sample(1/60,true);assert.equal(budget.density,before,'one good window cannot immediately reverse the setting');
 for(let i=0;i<10000;i++)budget.sample(1/60,true);assert.equal(budget.density,1.5);
});
test('paused windows and invalid timings cannot degrade the renderer',()=>{
 const budget=createRenderBudget(1);
 for(let i=0;i<100;i++)budget.sample(1,false);assert.equal(budget.density,1);
 budget.sample(NaN,true);budget.sample(-1,true);assert.equal(budget.density,1);
});
