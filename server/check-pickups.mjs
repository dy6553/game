import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.HARBOR_TEST_SERVER??'http://127.0.0.1:8787',origin=process.env.HARBOR_TEST_ORIGIN??'http://localhost:5173';
async function reserve(body){const r=await fetch(base+'/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
function client(s){const socket=new WebSocket(base.replace('http','ws')+'/room/'+s.code,{headers:{Origin:origin}}),messages=[];socket.on('open',()=>socket.send(JSON.stringify({type:'hello',token:s.token})));socket.on('message',raw=>messages.push(JSON.parse(raw.toString())));return {socket,send(seq,patch={}){socket.send(JSON.stringify({type:'input',command:{seq,x:0,y:0,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false,...patch}}));},async wait(predicate){const end=Date.now()+8000;while(Date.now()<end){const m=messages.find(predicate);if(m)return m;await new Promise(r=>setTimeout(r,25));}throw new Error('Pickup test timed out');}};}
const created=await reserve({action:'create',weapon:'pistol'}),joined=await reserve({action:'join',code:created.code,weapon:'pistol'}),a=client(created),b=client(joined);
const own=m=>m.state?.players.find(p=>p.id===created.id);
try{
 await a.wait(m=>m.type==='state'&&m.state.players.length===2&&m.state.players.every(p=>p.connected));
 a.send(0,{y:1});await a.wait(m=>m.type==='state'&&own(m)?.z>=-6.4);
 a.send(1,{pickup:'crate-machinegun'});const picked=await a.wait(m=>m.type==='state'&&own(m)?.weaponId==='machinegun');assert.equal(own(picked).inventory.slots.length,2);assert.ok(picked.state.pickups.find(p=>p.id==='crate-machinegun').remaining>0);
 a.send(2,{shot:true});await a.wait(m=>m.type==='state'&&own(m)?.weapon.ammo===29);
 a.send(3,{slot:0});await a.wait(m=>m.type==='state'&&own(m)?.seq>=3&&own(m)?.weaponId==='pistol');
 a.send(4,{slot:1});const back=await a.wait(m=>m.type==='state'&&own(m)?.seq>=4&&own(m)?.weaponId==='machinegun');assert.equal(own(back).weapon.ammo,29);assert.equal(own(back).kills,0);
 console.log('PASS: Worker movement -> nearby supply pickup -> fire -> slot switch -> preserved ammo and scores');
 a.socket.send(JSON.stringify({type:'leave'}));await b.wait(m=>m.type==='closed');
}finally{a.socket.close();b.socket.close();}
