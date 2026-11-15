import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../art/expansion/',import.meta.url);
for(const id of ['snow','moon'])for(const [quality,size,maxPrimitives] of [['low',256,70],['medium',512,95],['high',1024,120]]){
 const b=fs.readFileSync(new URL(`${id}-${quality}.glb`,dir));
 const length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length).toString());
 const binStart=20+length+8;
 const meta=doc.nodes.find(n=>n.extras?.map_id===id)?.extras;
 assert.equal(meta?.concept_revision,3,'approved feasible concept revision');
 const landmarks=id==='snow'?['arctic_observatory']:['lunar_habitat_dome','lunar_dish'];
 for(const kind of landmarks)assert.ok(doc.nodes.some(n=>n.extras?.landmark_kind===kind&&n.children?.length),'identity landmark remains visible at every profile: '+kind);
 const textured=doc.materials.filter(m=>m.extras?.surface_kind&&m.pbrMetallicRoughness?.baseColorTexture);
 assert.ok(textured.length>=3,`${id}/${quality}: authored ground, wall and floor textures required`);
 for(const m of textured){
  const image=doc.images[doc.textures[m.pbrMetallicRoughness.baseColorTexture.index].source];
  const view=doc.bufferViews[image.bufferView],offset=binStart+(view.byteOffset??0);
  assert.equal(b.readUInt32BE(offset+16),size,`${id}/${quality}: profile-specific texture width`);
 }
 const primitives=doc.nodes.reduce((total,n)=>total+(n.mesh===undefined?0:doc.meshes[n.mesh].primitives.length),0);
 assert.ok(primitives<=maxPrimitives,`${id}/${quality}: ${primitives} primitives exceeds ${maxPrimitives}`);
 if(quality==='high')assert.ok(doc.materials.some(m=>m.normalTexture),'high includes surface normals');
 else assert.ok(!doc.materials.some(m=>m.normalTexture),'lower profiles avoid normal-map sampling');
 console.log(`${id}/${quality}: ${textured.length} textured materials at ${size}px; ${primitives} primitives; ${(b.length/1024/1024).toFixed(2)} MiB`);
}
