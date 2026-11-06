import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetworkGame,type Command} from '../src/network-game.ts';
import {canStand,PROTOTYPE} from '../src/world.ts';
import {createOnlineMotion} from '../src/online-motion.ts';
const command=(seq:number,y=1):Command=>({seq,x:0,y,yaw:0,pitch:0,fire:false,shot:false,reload:false,jump:false,sprint:false,scope:false});
function setup(){const game=createNetworkGame();game.join('a');game.join('b');const motion=createOnlineMotion();motion.receive(structuredClone(game.state),'a');return {game,motion};}
test('local movement responds before a server reply and freezes on disconnect',()=>{
 const {game,motion}=setup(),c=command(0);
 const start=game.state.players[0]!.z;
 assert.ok(motion.advance(1/60,c).z>start,'first frame moves without an acknowledgement');
 assert.deepEqual(motion.advance(.016,c,false),{x:0,z:start});
 assert.equal(game.state.players[0]!.z,start,'presentation cannot change authoritative state');
});
test('20Hz snapshots with 100ms round trip produce continuous rendering and converge after stopping',()=>{
 const {game,motion}=setup();let seq=0;let last=game.state.players[0]!.z,maxStep=0;
 const packets:{at:number;run:()=>void}[]=[];
 for(let frame=0;frame<240;frame++){
  const now=frame/60,moving=frame<120,c=command(seq,moving?1:0);
  for(const p of packets.filter(p=>p.at<=now+1e-8))p.run();
  for(let i=packets.length-1;i>=0;i--)if(packets[i]!.at<=now+1e-8)packets.splice(i,1);
  const position=motion.advance(1/60,c);if(frame>15)maxStep=Math.max(maxStep,Math.abs(position.z-last));last=position.z;
  if(frame%3===0){const sent=command(seq++,moving?1:0);motion.sent(sent.seq,sent);packets.push({at:now+.05,run:()=>game.input('a',sent)});game.step();const snapshot=structuredClone(game.state);packets.push({at:now+.05,run:()=>motion.receive(snapshot,'a')});}
 }
 assert.ok(maxStep<.25,`per-frame distance ${maxStep} should be below raw 20Hz jumps of .35`);
 assert.ok(Math.abs(last-game.state.players[0]!.z)<.05,'idle camera converges to server');
});
test('death, respawn, waiting, long packet loss and teleport discard speculative movement',()=>{
 const {game,motion}=setup(),a=game.state.players[0]!,c=command(0);
 motion.advance(.1,c);a.health=0;motion.receive(structuredClone(game.state),'a');assert.deepEqual(motion.advance(.05,c),{x:a.x,z:a.z});
 a.health=100;a.x=20;a.z=20;motion.receive(structuredClone(game.state),'a');assert.deepEqual(motion.advance(0,c),{x:20,z:20});
 for(let i=0;i<10;i++)motion.advance(.1,c);assert.deepEqual(motion.advance(.1,c),{x:20,z:20});
 game.disconnect('b');motion.receive(structuredClone(game.state),'a');assert.deepEqual(motion.advance(.1,c),{x:20,z:20});
});

test('speculative movement retains the same arena boundary and collision radius as the server',()=>{
 const {game,motion}=setup(),a=game.state.players[0]!;a.x=PROTOTYPE.halfWidth-PROTOTYPE.radius-.1;a.z=0;motion.receive(structuredClone(game.state),'a');
 const pos=motion.advance(.1,{...command(0),x:1,y:0});assert.ok(pos.x<=PROTOTYPE.halfWidth-PROTOTYPE.radius+1e-8);assert.ok(canStand(pos,PROTOTYPE.radius));
});
