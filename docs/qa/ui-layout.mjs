import {COMBAT_HUD_MARKUP} from '../../src/combat-hud.ts';
import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.HARBOR_BROWSER_MODULE??'playwright');
const root=new URL('../../',import.meta.url),main=await readFile(new URL('src/main.ts',root),'utf8');
const touch=main.slice(main.indexOf('  <div class="touch-controls">'),main.indexOf('  ${COMBAT_HUD_MARKUP}'))+COMBAT_HUD_MARKUP;
const base=process.env.HARBOR_UI_URL??'http://127.0.0.1:5179',browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const report={cases:[],errors:[]};
try{
 for(const spec of [{name:'phone',w:844,h:390,touch:true},{name:'small-phone',w:740,h:360,touch:true},{name:'short-phone',w:740,h:320,touch:true},{name:'tablet',w:1280,h:800,touch:true},{name:'small-tablet',w:1024,h:600,touch:true},{name:'desktop',w:1440,h:900,touch:false}]){
  const ctx=await browser.newContext({viewport:{width:spec.w,height:spec.h},hasTouch:spec.touch,isMobile:spec.touch}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.route('**/qa-layout',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/ui-theme.css"></head><body class="at-home"><div id="app">${touch}</div><script type="module">import {installMobileBrowser} from '/src/mobile-browser.ts';installMobileBrowser();import {HOME_MARKUP,createHomeScreen} from '/src/home-screen.ts';import {createGameChoices} from '/src/game-choices.ts';document.querySelector('#app').insertAdjacentHTML('afterbegin',HOME_MARKUP);createHomeScreen({selectCharacter(){},selectWeapon(){},start(){document.querySelector('#home-screen').hidden=true;document.body.classList.remove('at-home')}});createGameChoices({opened(){}});document.getElementById('scope').hidden=false;window.ready=true;</script></body></html>`}));
  try{await p.goto(base+'/qa-layout');await p.waitForFunction(()=>window.ready);const start=await p.locator('#home-start').boundingBox();assert(start&&start.y>=0&&start.y+start.height<=spec.h,'home start remains on screen');
   const mapVisible=await p.locator('#home-map-trigger').isVisible();await p.locator('#home-start').click();
   if(spec.touch){const keys=['joystick','fire','reload','jump','scope','sprint','dash'];const boxes={};for(const id of keys){boxes[id]=await p.locator('#'+id).boundingBox();assert(boxes[id],id+' visible');const b=boxes[id];assert(b.x>=0&&b.y>=0&&b.x+b.width<=spec.w&&b.y+b.height<=spec.h,id+' within viewport');}
    if(spec.name.includes('tablet')){assert(boxes.joystick.width>=150,'tablet joystick >=150px');assert(boxes.fire.width>=100,'tablet fire >=100px');for(const id of ['reload','jump','scope'])assert(boxes[id].width>=72,'tablet '+id+' >=72px');assert((await p.locator('[data-slot="0"]').boundingBox()).height>=48,'tablet weapon slot >=48px');}
    else {assert.equal(boxes.joystick.width,104);assert.equal(boxes.fire.width,74);assert.equal(boxes.jump.width,54);}
    for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const a=boxes[keys[i]],b=boxes[keys[j]],overlap=a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;assert.equal(overlap,false,keys[i]+' and '+keys[j]+' do not overlap');}
   }
   const hudBoxes=[];for(const id of ['combat-map','combat-vitals']){const b=await p.locator('#'+id).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=spec.w&&b.y+b.height<=spec.h,id+' on screen');hudBoxes.push(b);}const [m,h]=hudBoxes;assert(!(m.x<h.x+h.width&&m.x+m.width>h.x&&m.y<h.y+h.height&&m.y+m.height>h.y),'minimap and HP do not overlap');
   assert.equal(mapVisible,true,'map choice visible without opening growth details');report.cases.push({name:spec.name,pass:true});
  }catch(e){report.cases.push({name:spec.name,pass:false,failure:e.message});}await ctx.close();
 }
 try{assert.doesNotMatch(main,/createPerformanceHud|performanceHud\.update/,'frame overlay removed from game startup and loop');report.cases.push({name:'no-frame-overlay',pass:true});}catch(e){report.cases.push({name:'no-frame-overlay',pass:false,failure:e.message.split('\n')[0]});}
 report.pass=report.cases.every(c=>c.pass)&&!report.errors.length;
}finally{await browser.close();const output=process.env.HARBOR_UI_REPORT??'/workspace/qa/ui-layout.json';await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
