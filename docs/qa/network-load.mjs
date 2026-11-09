// Real WebSockets. Synthetic guest names, no account creation or stored official records.
import {createRequire} from 'node:module';import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=process.env.ONLINE_BASE??'http://127.0.0.1:8791',publicTest=base.startsWith('https:');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox'],...(publicTest?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
let report;
try{const context=await browser.newContext({permissions:publicTest?[]:['local-network-access']});const page=await context.newPage();page.on('requestfailed',r=>console.log('request failed',r.url(),r.failure()?.errorText));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});const origin=publicTest?'https://project-3uu6s.vercel.app':'http://127.0.0.1:5173';await page.route(origin+'/qa-network',r=>r.fulfill({contentType:'text/html',body:'Network regression'}));await page.goto(origin+'/qa-network');
report=await page.evaluate(async({base})=>{
 const wait=async(fn,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,15));}throw Error('State timeout');};
 const request=async body=>{const r=await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Session '+r.status);return r.json();};
 const command=(seq,extra={})=>({seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...extra});
 const results=[];
 for(const mode of ['ffa','team']){const host=await request({action:'create',mode,nickname:'검사방장'}),clients=[];
 try{for(let i=0;i<20;i++){const s=i?await request({action:'join',code:host.code,mode,nickname:'검사대원'+i}):host,protocol=i===19?1:2,ws=new WebSocket(base.replace('https:','wss:').replace('http:','ws:')+'/room/'+host.code),c={ws,s,state:null,lastPacket:null};
 ws.onopen=()=>ws.send(JSON.stringify({type:'hello',token:s.token,protocol}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.state){if(m.type==='state')c.lastPacket=m;c.state=m.state;const own=m.state.players.find(p=>p.id===s.id);if(m.ownInventory&&own)own.inventory=m.ownInventory;if(m.ownState&&own)Object.assign(own,m.ownState);}};clients.push(c);
 await wait(()=>c.state?.players.find(p=>p.id===s.id)?.connected);
 if(i===0){c.ws.send(JSON.stringify({type:'start'}));await wait(()=>c.state?.phase==='playing'&&c.state.players.find(p=>p.id===s.id)?.playing===true);}
 else await wait(()=>c.state?.players.find(p=>p.id===s.id)?.playing===true);
 }
 await wait(()=>clients.every(c=>c.state?.players.length===20&&c.state.players.every(p=>p.connected)));await wait(()=>clients.every(c=>c.state?.phase==='playing'&&c.lastPacket));
 const a=clients[0],me=()=>a.state.players.find(p=>p.id===a.s.id);
 if(!me().inventory?.slots.length||a.state.players[1].inventory)throw Error('Compact private inventory');
 if(!clients[19].state.players[0].inventory)throw Error('Legacy packet compatibility');
 let sends=0;const begin=Date.now(),tick=a.state.tick,seq0=me().seq;
 const samples=[];
 for(let i=1;i<=12;i++){const at=performance.now();a.ws.send(JSON.stringify({type:'input',command:command(i,{x:i%2?.5:-.5})}));sends++;await wait(()=>me().seq===i);samples.push(performance.now()-at);}
 const before=me().seq;a.ws.send(JSON.stringify({type:'input',command:command(100,{x:99})}));await new Promise(r=>setTimeout(r,150));if(me().seq!==before)throw Error('Invalid input accepted');
 // Five input packets per second still run on server ticks; no per-packet movement credit.
 for(let i=13;i<=17;i++){a.ws.send(JSON.stringify({type:'input',command:command(i,{x:.5})}));await new Promise(r=>setTimeout(r,200));}
 await wait(()=>me().seq===17);const elapsed=Date.now()-begin,advanced=a.state.tick-tick;
 if(Math.abs(advanced-elapsed/50)>4)throw Error('Server tick drift');
 clients[19].ws.send(JSON.stringify({type:'leave'}));await wait(()=>a.state.players[19].abandoned);
 samples.sort((a,b)=>a-b);results.push({mode,players:20,mixedProtocols:true,startedAlone:true,lateJoinWithoutDeploy:true,ownInventory:true,invalidInputRejected:true,slowSenderAck:true,tickRate:Math.round(advanced/(elapsed/1000)*10)/10,ackMedianMs:Math.round(samples[6]),compactBytes:JSON.stringify(a.lastPacket).length,legacyBytes:JSON.stringify(clients[19].lastPacket).length});
 }finally{for(const c of clients){if(c.ws.readyState===1)c.ws.send(JSON.stringify({type:'leave'}));c.ws.close();}}
 }
 return {pass:true,results};
},{base});assert(report.pass);}
catch(e){report={pass:false,failure:e.stack};process.exitCode=1;}
finally{await browser.close();await writeFile(process.env.HARBOR_NETWORK_REPORT??'/workspace/qa/low-end-network-local.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
