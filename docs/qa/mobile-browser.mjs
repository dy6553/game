// Browser-level UI regression, without GPU performance or real iPhone claims.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),pw=require('playwright');
const kind=process.env.HARBOR_BROWSER??'chromium';
const browser=await pw[kind].launch(kind==='chromium'?{executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}:{headless:true});
const base=process.env.HARBOR_UI_URL??'http://127.0.0.1:5184';
const report={engine:kind,cases:[],errors:[]};
const main=await readFile(new URL('../../src/main.ts',import.meta.url),'utf8');
const touch=main.slice(main.indexOf('  <div class="touch-controls">'),main.indexOf('  ${COMBAT_HUD_MARKUP}'));
try{
 for(const spec of [{name:'phone',width:844,height:390},{name:'wide-phone',width:915,height:412},{name:'tablet',width:1024,height:768}]){
 const ctx=await browser.newContext({viewport:{width:spec.width,height:spec.height},screen:{width:spec.width,height:spec.height},isMobile:true,hasTouch:true}),page=await ctx.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/qa-mobile',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/ui-theme.css"></head><body><div id="app"><canvas id="game"></canvas>${touch}<section id="form" style="position:absolute;top:10px;left:300px;z-index:200"><input id="name" type="text" placeholder="닉네임"></section><div id="scroll" style="position:absolute;left:300px;top:65px;width:130px;height:90px;overflow:auto"><div style="height:700px">메뉴<br>아래로 스크롤</div></div></div><script type="module">import {installMobileBrowser} from '/src/mobile-browser.ts';import {createInput} from '/src/input.ts';window.mobile=installMobileBrowser();window.input=createInput(document.querySelector('#game'));window.ready=true;</script></body></html>`}));
 await page.goto(base+'/qa-mobile');await page.waitForFunction(()=>window.ready);
 const initial=await page.locator('#joystick').boundingBox();assert(initial);assert.equal(initial.width>=150,spec.name==='tablet');
 const metrics=await page.evaluate(()=>({font:parseFloat(getComputedStyle(document.querySelector('#name')).fontSize),select:(getComputedStyle(document.querySelector('#fire')).userSelect??getComputedStyle(document.querySelector('#fire')).webkitUserSelect),edit:(getComputedStyle(document.querySelector('#name')).userSelect??getComputedStyle(document.querySelector('#name')).webkitUserSelect),scale:visualViewport.scale}));assert(metrics.font>=16);assert.equal(metrics.select,'none');assert.equal(metrics.edit,'text');assert.equal(metrics.scale,1);
 for(const type of ['contextmenu','selectstart','dragstart','dblclick','gesturestart']){
   const prevented=await page.evaluate(type=>{const e=new Event(type,{bubbles:true,cancelable:true});document.querySelector('#fire').dispatchEvent(e);const text=new Event(type,{bubbles:true,cancelable:true});document.querySelector('#name').dispatchEvent(text);return [e.defaultPrevented,text.defaultPrevented];},type);assert.deepEqual(prevented,[true,false],type);
 }
 await page.locator('#name').fill('테스트 닉네임');assert.equal(await page.locator('#name').inputValue(),'테스트 닉네임');assert.equal(await page.evaluate(()=>visualViewport.scale),1,'focusing input never zooms');await page.locator('#name').blur();
 const held=await page.evaluate(()=>{
   const stick=document.querySelector('#joystick'),b=stick.getBoundingClientRect();stick.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:b.x+b.width/2,clientY:b.y+10,bubbles:true,cancelable:true}));
   const before=window.input.move.y;Object.defineProperty(window,'innerHeight',{value:Math.max(300,innerHeight-110),configurable:true});window.dispatchEvent(new Event('resize'));return {before,after:window.input.move.y};
 });assert(held.before>0);assert.equal(held.after,held.before);assert.equal((await page.locator('#joystick').boundingBox()).width,initial.width);
 // A single finger may still scroll menus; two-finger movement cannot start browser zoom.
 const touchGuards=await page.evaluate(()=>{const app=document.querySelector('#app');return [1,2].map(count=>{const e=new Event('touchmove',{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:Array(count).fill({})});app.dispatchEvent(e);return e.defaultPrevented;});});assert.deepEqual(touchGuards,[false,true]);
 if(kind==='chromium'){
  const session=await ctx.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:3,x:350,y:140}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:3,x:350,y:90}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);assert(await page.locator('#scroll').evaluate(n=>n.scrollTop)>0,'native one-finger menu scrolling');
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:4,x:500,y:180},{id:5,x:600,y:180}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:4,x:450,y:180},{id:5,x:650,y:180}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>visualViewport.scale),1);
 }
 await page.screenshot({path:`/workspace/qa/ios-${kind}-${spec.name}.png`});report.cases.push({name:spec.name,pass:true,metrics});await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack;}finally{await browser.close();await writeFile(`/workspace/qa/ios-${kind}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
