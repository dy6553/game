import test from 'node:test';
import assert from 'node:assert/strict';
import {findRoute,verticalRoute,navigationStats} from '../src/duel.ts';
import {shotBoxes,createDoors,toggleDoor,doorRect,BUILDINGS,stairways,canStand,PROTOTYPE,createWorld} from '../src/world.ts';

test('open-map collision checks skip distant geometry after warm-up',()=>{
 const world=createWorld('harbor'),solids=world.worldSolids(),radius=world.PROTOTYPE.radius;
 const distant=solids.find(rect=>Math.abs(rect.x)>30)!;
 const x=distant.x;let accesses=0;
 Object.defineProperty(distant,'x',{get:()=>{accesses++;return x;}});
 assert.equal(world.canStand(world.PROTOTYPE.spawn,radius,solids),true);
 accesses=0;
 for(let i=0;i<20;i++)assert.equal(world.canStand({x:i/20,z:-8},radius,solids),true);
 assert.equal(accesses,0,'distant collision boxes should never be considered for these positions');
});

test('indexed collision agrees with a full scan across both maps and floor heights',()=>{
 for(const map of ['harbor','factory'] as const){
  const world=createWorld(map),solids=world.worldSolids(),fullScan=[...solids];
  for(let x=-63.5;x<=63.5;x+=2.25)for(let z=-59.5;z<=34;z+=2.25){
   for(const y of [0,3.4,7,10])for(const stance of ['stand','crouch','prone'] as const){
    const point={x,y,z,stance},radius=world.PROTOTYPE.radius;
    assert.equal(world.canStand(point,radius,solids),world.canStand(point,radius,fullScan),JSON.stringify({map,point}));
   }
  }
 }
});
test('warm navigation reuses static collision work without changing owned waypoints',()=>{
 const a={x:-40,z:-32},b={x:0,z:10};const expected=findRoute(a,b);assert.ok(expected.length);const before=navigationStats().collisionSamples;
 for(let i=0;i<10;i++)assert.deepEqual(findRoute(a,b),expected);
 assert.ok(navigationStats().collisionSamples-before<100,'ten identical routes must not resample thousands of static collision points');
 const changed=findRoute(a,b);changed[0]!.x=999;assert.deepEqual(findRoute(a,b),expected,'returned paths do not expose cached data');
});
test('shot geometry reuses the same door configuration and invalidates immediately on toggle',()=>{
 const doors=createDoors(),house=BUILDINGS.find(b=>b.enterable)!,door=doorRect(house),actor={x:door.x,z:door.z+(house.z<0?1:-1)};
 const closed=shotBoxes(doors);assert.strictEqual(shotBoxes(doors),closed,'repeated shots reuse fixed geometry');assert.ok(closed.some(r=>r.id===house.id+'-door'));
 assert.equal(toggleDoor(doors,house.id,actor,[]),true);const open=shotBoxes(doors);assert.notStrictEqual(open,closed);assert.ok(!open.some(r=>r.id===house.id+'-door'));assert.strictEqual(shotBoxes(doors),open);
 assert.equal(toggleDoor(doors,house.id,actor,[]),true);assert.strictEqual(shotBoxes(doors),closed);
});
test('cached rooftop navigation still traverses every building and never exposes mutable static edges',()=>{
 for(const house of BUILDINGS.filter(b=>b.enterable)){
  const start={x:0,z:-8},goal=stairways(house)[1]!.end,path=verticalRoute(start,goal);assert.ok(path.length,house.id);
  const next=verticalRoute({...start},{...goal});assert.deepEqual(next,path);for(const point of next)assert.ok(canStand(point,PROTOTYPE.radius));
  path[0]!.x=999;assert.deepEqual(verticalRoute({...start},{...goal}),next);
 }
});

test('stair and landing lookups reuse immutable geometry rather than allocate every movement step',async()=>{
 const {floorPanels,SECOND_FLOOR}=await import('../src/world.ts');const house=BUILDINGS.find(b=>b.enterable)!;
 assert.strictEqual(stairways(house),stairways(house));assert.ok(Object.isFrozen(stairways(house)[0]!.start));
 assert.strictEqual(floorPanels(house,SECOND_FLOOR),floorPanels(house,SECOND_FLOOR));assert.notStrictEqual(floorPanels(house,SECOND_FLOOR),floorPanels(house,house.height));
});

test('road geometry keeps its footprint and baked colors without square subdivisions on narrow roads',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine.js');const {Scene}=await import('@babylonjs/core/scene.js');const {StandardMaterial}=await import('@babylonjs/core/Materials/standardMaterial.js');const {createNightGround,sampleNightGround}=await import('../src/night-lighting.ts');const engine=new NullEngine();try{
  const scene=new Scene(engine),source=new StandardMaterial('asphalt',scene),mesh=createNightGround(scene,source,'road',0,0,128,10,0);
  assert.ok(mesh.getTotalVertices()<1000,'narrow road must not use a 64 by 64 grid');const positions=mesh.getVerticesData('position')!,colors=mesh.getVerticesData('color')!,uv=mesh.getVerticesData('uv')!;
  const lighting=sampleNightGround(positions[0]!,positions[2]!);assert.ok(Math.abs(colors[0]!-lighting.r*.72)<1e-6);assert.ok(Math.abs(uv[0]!-positions[0]!/2)<1e-6);
  const bounds=mesh.getBoundingInfo().boundingBox;assert.equal(bounds.maximum.x-bounds.minimum.x,128);assert.equal(bounds.maximum.z-bounds.minimum.z,10);scene.dispose();
 }finally{engine.dispose();}
});
test('cargo cover does not receive the planter tree and bench decoration workload',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine.js');const {createHarborScene}=await import('../src/scene.ts');const engine=new NullEngine();try{
  const world=createHarborScene(engine,{randomSpawns:false}),canopy=world.scene.meshes.filter(m=>m.material?.name==='tree-canopy');assert.ok(canopy.reduce((n,m)=>n+m.getTotalIndices(),0)<100000,'tree decoration belongs to the original planters, not six cargo covers');world.scene.dispose();
 }finally{engine.dispose();}
});
