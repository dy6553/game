import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.HARBOR_TEST_SERVER??'http://127.0.0.1:8787',origin='http://localhost:5173';
async function request(body){const response=await fetch(base+'/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,...await response.json()};}
function client(session){const socket=new WebSocket(base.replace('http','ws')+'/room/'+session.code,{headers:{Origin:origin}});const messages=[];
 socket.on('open',()=>socket.send(JSON.stringify({type:'hello',token:session.token})));
 socket.on('message',raw=>messages.push(JSON.parse(raw.toString())));
 return {socket,messages,async wait(predicate){const until=Date.now()+8000;while(Date.now()<until){const found=messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,25));}throw new Error('Timed out: '+JSON.stringify(messages.at(-1)));}};
}
const created=await request({action:'create',weapon:'sniper',character:'robot'});assert.equal(created.status,200);
const joined=await request({action:'join',code:created.code,weapon:'pistol',character:'robot-cat'});assert.equal(joined.status,200);
const a=client(created),b=client(joined);
try{
 await a.wait(m=>m.type==='state'&&m.state.players.length===2&&m.state.players.every(p=>p.connected));
 assert.equal((await request({action:'join',code:created.code})).status,409);
 assert.equal((await request({action:'join',code:'00000000'})).status,404);
 const denied=await fetch(base+'/session',{method:'POST',headers:{Origin:'https://not-allowed.example'},body:'{}'});assert.equal(denied.status,403);
 a.socket.send(JSON.stringify({type:'input',command:{seq:1,x:0,y:0,yaw:0,pitch:0,fire:false,shot:true,reload:false,jump:false,sprint:false,scope:false,damage:9999,health:9999}}));
 const hit=await a.wait(m=>m.type==='state'&&m.state.players.find(p=>p.id===created.id)?.kills===1);
 assert.equal(hit.state.players.find(p=>p.id===joined.id).health,0);assert.equal(hit.state.players.find(p=>p.id===created.id).health,100);
 b.socket.close();await a.wait(m=>m.type==='state'&&m.state.players.some(p=>!p.connected));
 const resumed=client(joined);try{const ready=await resumed.wait(m=>m.type==='welcome');assert.equal(ready.id,joined.id);assert.equal(ready.state.players.length,2);}finally{resumed.socket.close();}
 a.socket.send(JSON.stringify({type:'leave'}));await a.wait(m=>m.type==='closed');
 const q1=await request({action:'quick'}),q2=await request({action:'quick'});assert.equal(q1.code,q2.code);assert.notEqual(q1.id,q2.id);
 console.log('PASS: real local Worker + two WebSockets: create/join, authoritative kill, capacity, origin checks, reconnect, leave, matchmaking');
}finally{a.socket.close();b.socket.close();}
