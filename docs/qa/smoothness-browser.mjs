// Browser checks use local synthetic state, without production accounts or rooms.
const {chromium}=await import(process.env.HARBOR_PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={errors:[],checks:{},deviceFpsMeasured:false};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();let body=await response.text();
  body=body.replace('const input = createInput(', 'window.__smoothQA={engine,get world(){return world}}; const input = createInput(');
  assert.ok(body.includes('__smoothQA'));await route.fulfill({response,body});
 });
 await page.goto('http://127.0.0.1:5185');
 await page.locator('#home-settings').click();await page.locator('#settings-tab-controls').click();
 const mouse=page.locator('#mouse-sensitivity');assert.equal(await mouse.getAttribute('min'),'10');assert.equal(await mouse.getAttribute('step'),'1');
 await mouse.fill('37');await mouse.dispatchEvent('input');assert.equal(await page.locator('#mouse-sensitivity-value').textContent(),'0.37배');
 await page.reload();await page.locator('#home-settings').click();await page.locator('#settings-tab-controls').click();assert.equal(await mouse.inputValue(),'37');
 report.checks.fineMouseSaved=true;
 await page.locator('#environment-close').click();await page.locator('#home-practice').click();await page.locator('#home-start').click();
 await page.locator('#lobby-deploy-transition').waitFor({state:'hidden'});
 report.scene=await page.evaluate(async()=>{
  const {engine,world}=window.__smoothQA;engine.stopRenderLoop();
  const {createNetworkGame}=await import('/src/network-game.ts');
  const g=createNetworkGame(undefined,'harbor',{mode:'ffa'});for(let i=0;i<20;i++)g.join('p'+i);
  g.state.players[0].x=0;g.state.players[0].z=-8;
  for(let i=1;i<20;i++){g.state.players[i].x=(i%5-2)*2;g.state.players[i].z=4+Math.floor(i/5)*3;}
  world.renderOnline(g.state,'p0',{yaw:0,pitch:0},.05);
  let draws=0;for(const name of ['drawElementsType','drawArraysType']){const original=engine[name].bind(engine);engine[name]=(...args)=>{draws++;return original(...args);};}
  const stages={};for(const low of [false,true]){world.setQuality(false);world.setPerformanceLow(low);world.scene.render();draws=0;world.scene.render();stages[low?'low':'balanced']={draws,shadows:world.scene.shadowsEnabled};}
  world.setPerformanceLow(false);world.update({x:60,z:0},0,{yaw:-Math.PI/2,pitch:0},true);world.scene.render();
  const gl=engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {stages,remoteActors:world.scene.transformNodes.filter(n=>n.name.startsWith('online-player-')).length,lights:world.scene.lights.length,sky:world.scene.getLightByName('sky').intensity,ambient:world.scene.ambientColor.asArray(),width:engine.getRenderWidth(),height:engine.getRenderHeight(),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
 });
 assert.equal(report.scene.remoteActors,19);assert.ok(report.scene.sky>=.6);assert.ok(report.scene.stages.low.draws<report.scene.stages.balanced.draws);
 await page.screenshot({path:'/workspace/qa/tdd-2026-11-09/outer-brighter.png'});
 await page.evaluate(()=>{const w=window.__smoothQA.world,b=w.geometry.BUILDINGS.find(b=>b.enterable);w.update({x:b.x,z:b.z,y:0},0,{yaw:0,pitch:0},true);w.scene.render();});
 await page.screenshot({path:'/workspace/qa/tdd-2026-11-09/interior-brighter.png'});
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile('/workspace/qa/tdd-2026-11-09/smoothness-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
