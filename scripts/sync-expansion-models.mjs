import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const layouts={};
for(const id of ['snow','moon']){
 const bytes=fs.readFileSync(new URL(`art/expansion/${id}-medium.glb`,root));
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const e=doc.nodes.find(n=>n.extras?.map_id===id).extras;
 // glTF's standard right-to-left-handed conversion reflects X in this game.
 const mirrorX=r=>({...r,x:-r.x});
 layouts[id]={width:e.width_m,depth:e.depth_m,rooms:JSON.parse(e.rooms_json).map(mirrorX),solids:JSON.parse(e.collision_blockout_json).map(mirrorX)};
 for(const quality of ['low','medium','high'])fs.copyFileSync(new URL(`art/expansion/${id}-${quality}.glb`,root),new URL(`public/maps/${id}-${quality}.glb`,root));
}
fs.writeFileSync(new URL('src/expansion-layouts.ts',root),`// Generated from the Blender GLB extras by scripts/sync-expansion-models.mjs.\nexport const expansionLayouts = ${JSON.stringify(layouts,null,2)};\n`);
console.log('Synchronized six Blender models and shared map geometry.');
