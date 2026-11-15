import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const dir=fileURLToPath(new URL('../art/expansion/',import.meta.url));
const radius=.55; // Existing player radius, for art-layout clearance checks only.
const definitions={
  snow:{size:[160,120],points:[[0,0],[-33,0],[33,0],[-55,0],[55,0],[0,-45],[0,45]]},
  moon:{size:[100,80],points:[[0,0],[-31,0],[31,0],[0,-30],[0,30],[-44,0],[44,0]]},
};

function readGlb(file){
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.readUInt32LE(0),0x46546c67,'GLB signature');
  assert.equal(bytes.readUInt32LE(4),2,'glTF 2');
  assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB byte length');
  return {bytes:bytes.length,doc:JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())};
}

function clear(p,rects,size){
  if(Math.abs(p[0])>size[0]/2-radius || Math.abs(p[1])>size[1]/2-radius)return false;
  return !rects.some(r=>{
    if(r.yMin>=1.8 || r.yMax<=.08)return false;
    const dx=Math.max(0,Math.abs(p[0]-r.x)-r.width/2);
    const dz=Math.max(0,Math.abs(p[1]-r.z)-r.depth/2);
    return dx*dx+dz*dz<radius*radius;
  });
}

function reachable(start,rects,size){
  const key=p=>p.join(',');
  const visited=new Set([key(start)]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const n=[p[0]+dx,p[1]+dz],k=key(n);
      if(!visited.has(k)&&clear(n,rects,size)&&clear([p[0]+dx/2,p[1]+dz/2],rects,size)){
        visited.add(k);queue.push(n);
      }
    }
  }
  return visited;
}

for(const [id,definition] of Object.entries(definitions)){
  let baseline;
  for(const quality of ['low','medium','high']){
    const {doc,bytes}=readGlb(path.join(dir,`${id}-${quality}.glb`));
    assert.equal(doc.scenes.length,1,'one exported map scene');
    assert.ok(!doc.nodes.some(n=>n.name==='Cube'),'exclude untouched default scene');
    const meta=doc.nodes.find(n=>n.extras?.map_id===id)?.extras;
    assert.ok(meta,'map metadata exported');
    assert.deepEqual([meta.width_m,meta.depth_m],definition.size,'approved size');
    const rects=JSON.parse(meta.collision_blockout_json);
    const rooms=JSON.parse(meta.rooms_json);
    assert.ok(rects.every(r=>[r.x,r.z,r.width,r.depth,r.yMin,r.yMax].every(Number.isFinite)&&r.width>0&&r.depth>0));
    if(baseline)assert.deepEqual(rects,baseline,'quality must preserve gameplay geometry');
    baseline=rects;
    for(const r of rooms){
      for(const p of [[r.x-r.width/2,r.z],[r.x+r.width/2,r.z],[r.x,r.z-r.depth/2],[r.x,r.z+r.depth/2]])
        assert.ok(clear(p,rects,definition.size),`${r.id}: clear entrance ${p}`);
    }
    const visited=reachable([0,0],rects,definition.size);
    for(const p of definition.points)assert.ok(visited.has(p.join(',')),`reachable main route ${p}`);
    console.log(`${id}/${quality}: PASS, ${(bytes/1024).toFixed(0)} KiB; ${rects.length} draft colliders, connected rooms/exterior`);
  }
}
console.log('Art-layout validation only. Not gameplay, network or real-device acceptance.');
