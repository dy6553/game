import assert from 'node:assert/strict';
const {parseHTML}=await import(process.env.HARBOR_DOM_MODULE??'linkedom');
const {window,document}=parseHTML('<html><body><div id="app"></div></body></html>');
window.location={search:'?diagnostics=1'};let now=0;const posted=[];
for(const [key,value] of Object.entries({window,document,performance:{now:()=>now},fetch:async(url,options)=>{assert.equal(url,'/api/playtest');posted.push(JSON.parse(options.body));return new Response(null,{status:200});}}))Object.defineProperty(globalThis,key,{value,configurable:true});
const {createPlaytest}=await import('../../src/playtest.ts');
const collector=createPlaytest();
assert.ok(document.querySelector('.playtest-toggle'),'diagnostics must use a compact expandable control');assert.equal(document.querySelector('.playtest-actions').hidden,true);document.querySelector('.playtest-toggle').click();assert.equal(document.querySelector('.playtest-actions').hidden,false);document.querySelector('.playtest-toggle').click();assert.equal(document.querySelector('.playtest-actions').hidden,true);
for(let i=0;i<960;i++){now+=1000/60;collector.frame(1/60,'online',true,120);if(i%3===0)collector.packet();collector.correction(.1);}
await new Promise(r=>setImmediate(r));
assert.equal(posted.length,1);assert.equal(posted[0].mode,'online');assert.equal(posted[0].rttP95Ms,120);assert.ok(posted[0].frames>=899&&posted[0].frames<=901);assert.ok(document.querySelector('.playtest-panel').textContent.includes('1회 전송'));
document.querySelector('.playtest-stop').click();await new Promise(r=>setImmediate(r));const count=posted.length;
for(let i=0;i<1000;i++)collector.frame(1/60,'online',true,200);assert.equal(posted.length,count,'stop prevents further collection');
window.location.search='';const ordinary=createPlaytest();for(let i=0;i<1000;i++)ordinary.frame(1/60,'bot',true,null);assert.equal(posted.length,count,'ordinary visits never upload');
console.log('PASS: diagnostic opt-in -> 15-second aggregate upload -> visible success -> stop; ordinary visits never upload');
