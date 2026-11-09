// Local CPU comparison only; NullEngine does not measure GPU cost or device FPS.
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {createHarborScene} from '../../src/scene.ts';
import {createNetworkGame} from '../../src/network-game.ts';
const engine=new NullEngine(),world=createHarborScene(engine,{randomSpawns:false});
try{
 const game=createNetworkGame(undefined,'harbor',{mode:'ffa'});
 for(let i=0;i<20;i++)game.join('p'+i);
 world.setMode('practice');world.setQuality(false);world.setPerformanceLow(true);
 world.renderOnline(game.state,'p0',{yaw:0,pitch:0},1/60);
 let writes=0;
 for(const mesh of world.scene.meshes.filter(m=>m.name.startsWith('atmosphere-')||m.name==='lantern-atmospheric-glow')){
  const original=mesh.setEnabled.bind(mesh);mesh.setEnabled=value=>{writes++;return original(value);};
 }
 const times=[];
 for(let i=0;i<330;i++){
  const start=performance.now();world.setPerformanceLow(true);world.renderOnline(game.state,'p0',{yaw:i*.001,pitch:0},1/60);
  if(i>=30)times.push(performance.now()-start);
 }
 times.sort((a,b)=>a-b);
 console.log(JSON.stringify({players:20,frames:330,measuredFrames:300,medianMs:times[150],p95Ms:times[285],decorationWrites:writes,meshes:world.scene.meshes.length,lights:world.scene.lights.length}));
}finally{world.scene.dispose();engine.dispose();}
