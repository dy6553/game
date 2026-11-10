import {stanceStats,type Stance} from './stance.ts';
export type Point = { x: number; z: number; y?:number;fallSpeed?:number;stance?:Stance };
export type Rect = { id: string; x: number; z: number; width: number; depth: number; height?:number; yMin?:number;yMax?:number;slope?:{start:Point&{y:number};end:Point&{y:number}} };
export type Building = Rect & { height: number; palette: number; enterable?:boolean };
export type Doors=Record<string,boolean>;
export type Stairway={building:string;start:Point&{y:number};end:Point&{y:number};width:number};
export type MapId='harbor'|'factory';
export function createWorld(map:MapId='harbor'){

// Exploration values only; these are not final combat balance or map dimensions.
const PROTOTYPE = {
  halfWidth: 64, halfDepth: 60, maxZ:34, radius: 0.55, speed: 7,
  spawn: { x: 0, z: -8 },
};

const BUILDINGS: Building[] = [-19, 19].flatMap((z, row) =>
  [-33, -17, 17, 33].map((x, column) => ({
    id: `building-${row}-${column}`, x, z,
    width: column === 0 || column === 3 ? 11 : 12,
    depth: 13, height: 7 + ((row + column) % 3) * 1.5,
    palette: (row + column) % 3,enterable:Math.abs(x)===17,
  })),
);
BUILDINGS.push(...[-45,-17,17,45].map((x,i)=>({id:`south-${i}`,x,z:-45,width:12,depth:12,height:8+i%2*2,palette:i%3,enterable:Math.abs(x)===17})),
 ...[-53,53].flatMap((x,i)=>[-19,19].map((z,j)=>({id:`outer-${i}-${j}`,x,z,width:10,depth:13,height:8+j*2,palette:(i+j)%3}))));
if(map==='factory')BUILDINGS.splice(0,BUILDINGS.length,
 ...[-22,22].flatMap((z,row)=>[-24,24].map((x,col)=>({id:`factory-hall-${row}-${col}`,x,z,width:18,depth:18,height:9,palette:(row+col)%3,enterable:true}))),
 ...[-49,49].flatMap((x,col)=>[-43,20].map((z,row)=>({id:`factory-store-${row}-${col}`,x,z,width:13,depth:17,height:11,palette:2,enterable:false}))));
const ENTERABLE_BUILDINGS=BUILDINGS.filter(b=>b.enterable);
const DOOR_WIDTH=3.2;
function buildingWalls(b:Building):Rect[]{
 const front=b.z<0?1:-1,t=.4,segment=(b.width-DOOR_WIDTH)/2;
 return [
 {id:b.id+'-west',x:b.x-b.width/2+t/2,z:b.z,width:t,depth:b.depth},
 {id:b.id+'-east',x:b.x+b.width/2-t/2,z:b.z,width:t,depth:b.depth},
 {id:b.id+'-back',x:b.x,z:b.z-front*(b.depth/2-t/2),width:b.width,depth:t},
 ...[-1,1].map(side=>({id:b.id+'-front-'+side,x:b.x+side*(DOOR_WIDTH/2+segment/2),z:b.z+front*(b.depth/2-t/2),width:segment,depth:t}))];
}
function interiorFurniture(b:Building):Rect[]{return [
 {id:b.id+'-counter',x:b.x+b.width/2-1.3,z:b.z,width:1.4,depth:4},
 {id:b.id+'-table',x:b.x-1.5,z:b.z+(b.z<0?1:-1)*2,width:1.5,depth:1.5}];}
function indoorAt(p:Point){return BUILDINGS.find(b=>b.enterable&&Math.abs(p.x-b.x)<b.width/2-.4&&Math.abs(p.z-b.z)<b.depth/2-.4);}


const COVERS: Rect[] = [
 {id:'combat-container-west',x:-38,z:3,width:4,depth:2.6,height:2.6},
 {id:'combat-container-east',x:38,z:-3,width:4,depth:2.6,height:2.6},
 {id:'combat-utility-south',x:-5,z:-29,width:3,depth:1.6,height:2.2},
 {id:'combat-utility-north',x:5,z:26,width:3,depth:1.6,height:2.2},
 {id:'combat-monument',x:0,z:-40,width:2.8,depth:2.8,height:2.5},
 {id:'combat-cargo-southwest',x:-34,z:-29,width:3,depth:2,height:2.3},
  { id: 'planter-west', x: -7.8, z: -5, width: 3.8, depth: 1.8 },
  { id: 'planter-east', x: 7.8, z: 5, width: 3.8, depth: 1.8 },
  { id: 'planter-north', x: -7.8, z: 7.5, width: 3.8, depth: 1.8 },
  { id: 'van', x: 6.8, z: -7, width: 2.6, depth: 5 },
];
if(map==='factory')COVERS.splice(0,COVERS.length,
 ...[-1,1].flatMap(side=>[
 {id:`factory-press-${side}`,x:side*10,z:-12,width:4,depth:3,height:2.6},
 {id:`factory-cargo-${side}`,x:side*9,z:9,width:4,depth:2.6,height:2.3},
 {id:`factory-generator-${side}`,x:side*37,z:0,width:3.5,depth:5,height:2.4},
 {id:`factory-boiler-${side}`,x:side*14,z:-42,width:4,depth:4,height:3},
 ]));
const SOLIDS: Rect[] = [...BUILDINGS.flatMap(b=>b.enterable?[...buildingWalls(b),...interiorFurniture(b)]:[b]), ...COVERS];
const collisionCellSize=8;
const emptyCollisionCell:readonly Rect[]=[];
let openSolids:readonly Rect[]|undefined;
let openCollisionCells:Map<string,Rect[]>|undefined;

function collisionCellKey(x:number,z:number){
  return Math.floor(x/collisionCellSize)+','+Math.floor(z/collisionCellSize);
}

function nearbyOpenSolids(p:Point,solids:readonly Rect[]):readonly Rect[]{
  if(!openCollisionCells){
    const cells=new Map<string,Rect[]>();
    // Pad each rectangle so circles near a cell boundary still see it.
    for(const rect of solids){
      const padX=rect.width/2+PROTOTYPE.radius,padZ=rect.depth/2+PROTOTYPE.radius;
      const left=Math.floor((rect.x-padX)/collisionCellSize),right=Math.floor((rect.x+padX)/collisionCellSize);
      const back=Math.floor((rect.z-padZ)/collisionCellSize),front=Math.floor((rect.z+padZ)/collisionCellSize);
      for(let x=left;x<=right;x++)for(let z=back;z<=front;z++){
        const key=x+','+z,cell=cells.get(key);
        if(cell)cell.push(rect);else cells.set(key,[rect]);
      }
    }
    openCollisionCells=cells;
  }
  return openCollisionCells.get(collisionCellKey(p.x,p.z))??emptyCollisionCell;
}

function circleOverlapsRect(p: Point, radius: number, rect: Rect): boolean {
  const nx = Math.max(rect.x - rect.width / 2, Math.min(p.x, rect.x + rect.width / 2));
  const nz = Math.max(rect.z - rect.depth / 2, Math.min(p.z, rect.z + rect.depth / 2));
  return (p.x - nx) ** 2 + (p.z - nz) ** 2 < radius ** 2 - 1e-8;
}

function canStand(p: Point, radius: number, solids: readonly Rect[] = SOLIDS): boolean {
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||
     !(Math.abs(p.x)<=PROTOTYPE.halfWidth-radius&&p.z>=-PROTOTYPE.halfDepth+radius&&p.z<=PROTOTYPE.maxZ-radius))return false;
  const feet=p.y??0,top=feet+stanceStats(p.stance).height;
  const candidates=solids===openSolids&&Math.abs(radius)<=PROTOTYPE.radius?nearbyOpenSolids(p,solids):solids;
  return !candidates.some(rect => top>(rect.yMin??0)+.02&&feet<(rect.yMax??Infinity)-.02&&circleOverlapsRect(p, radius, rect)&&(!rect.slope||feet<rect.slope.start.y+Math.max(0,Math.min(1,(p.z-rect.slope.start.z)/(rect.slope.end.z-rect.slope.start.z)))*(rect.slope.end.y-rect.slope.start.y)-.05))
    && (upperFloorContains(p,radius)||BUILDINGS.every(b=>!b.enterable||Math.abs(p.x-b.x)>b.width/2-.4-radius||Math.abs(p.z-b.z)>b.depth/2-.4-radius));
}

function moveWithCollisions(
  position: Point, delta: Point, solids: readonly Rect[] = SOLIDS,
  radius = PROTOTYPE.radius,
): Point {
  if (![delta.x, delta.z, position.x, position.z].every(Number.isFinite)) return { ...position };
  // Substeps prevent tunneling on slow frames; axes separated to slide along walls.
  const distance = Math.hypot(delta.x, delta.z);
  const safeDistance = Math.min(distance, 5);
  const scale = distance > 0 ? safeDistance / distance : 0;
  const steps = Math.max(1, Math.ceil(safeDistance / (radius * 0.45)));
  const dx = delta.x * scale / steps, dz = delta.z * scale / steps;
  let p:Point = {...position};
  for (let i = 0; i < steps; i++) {
    const nextX = elevatedStep(p,{ ...p,x: p.x + dx });
    if (canStand(nextX, radius, solids)) p = nextX;
    const nextZ = elevatedStep(p,{ ...p,z: p.z + dz });
    if (canStand(nextZ, radius, solids)) p = nextZ;
  }
  return p;
}

function normalized(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

const SECOND_FLOOR=3.4;
function balcony(b:Building,y:number):Rect{return {id:b.id+'-balcony',x:b.x,z:b.z+(b.z<0?1:-1)*(b.depth/2+1),width:DOOR_WIDTH,depth:3,yMin:y-.12,yMax:y};}
function advanceFall(p:Point,dt:number):Point{
 if((p.y??0)<=0||dt<=0)return p;
 const panels=ENTERABLE_BUILDINGS.flatMap(b=>[...floorPanels(b,SECOND_FLOOR),...floorPanels(b,b.height)]);
 let floor=0;for(const f of panels)if(Math.abs(p.x-f.x)<=f.width/2&&Math.abs(p.z-f.z)<=f.depth/2&&(f.yMax??0)<=(p.y??0)+.05)floor=Math.max(floor,f.yMax??0);
 if(Math.abs((p.y??0)-floor)<.05)return {...p,y:floor,fallSpeed:0};
 // Stair ramps support the actor at their continuous elevation.
 for(const b of ENTERABLE_BUILDINGS)for(const ramp of stairways(b)){const t=(p.z-ramp.start.z)/(ramp.end.z-ramp.start.z);if(t>=0&&t<=1&&Math.abs(p.x-ramp.start.x)<ramp.width/2&&Math.abs((p.y??0)-(ramp.start.y+t*(ramp.end.y-ramp.start.y)))<.2)return {...p,fallSpeed:0};}
 const speed=(p.fallSpeed??0)+18*dt,next=(p.y??0)-speed*dt;
 return {...p,y:Math.max(floor,next),fallSpeed:next<=floor?0:speed};
}
function doorRect(b:Building):Rect{return {id:b.id+'-door',x:b.x,z:b.z+(b.z<0?1:-1)*(b.depth/2-.2),width:DOOR_WIDTH,depth:.4,yMin:0,yMax:3.2};}
function createDoors():Doors{return Object.fromEntries(ENTERABLE_BUILDINGS.map(b=>[b.id,false]));}
const solidCache=new Map<string,Rect[]>();
function worldSolids(doors?:Doors):Rect[]{
 const key=doors?ENTERABLE_BUILDINGS.map(b=>doors[b.id]?'1':'0').join(''):'open';const cached=solidCache.get(key);if(cached)return cached;
 const result=[...SOLIDS.map(r=>{const b=BUILDINGS.find(b=>r.id===b.id||r.id.startsWith(b.id+'-'));return {...r,yMin:0,yMax:r.id.endsWith('-counter')?1.4:r.id.endsWith('-table')?1:b?.height??r.height??(r.id==='van'?2.15:1.05)};}),
 ...BUILDINGS.filter(b=>b.enterable&&doors&&doors[b.id]!==true).map(doorRect),
 ...ENTERABLE_BUILDINGS.flatMap(b=>stairways(b).map(s=>({id:b.id+'-stair-volume',x:s.start.x,z:(s.start.z+s.end.z)/2,width:s.width,depth:Math.abs(s.end.z-s.start.z),yMin:s.start.y,yMax:s.end.y,slope:s}))),
 ...ENTERABLE_BUILDINGS.flatMap(b=>[-1,1].flatMap(side=>[
 {id:b.id+'-roof-rail-x',x:b.x+side*(b.width/2-.2),z:b.z,width:.15,depth:b.depth,yMin:b.height,yMax:b.height+1.2},
 ...[-1,1].map(half=>({id:b.id+'-roof-rail-z',x:b.x+half*(DOOR_WIDTH/2+(b.width-DOOR_WIDTH)/4),z:b.z+side*(b.depth/2-.2),width:(b.width-DOOR_WIDTH)/2,depth:.15,yMin:b.height,yMax:b.height+1.2}))
 ]))];solidCache.set(key,result);if(!doors)openSolids=result;return result;
}
function nearbyDoor(p:Point,doors:Doors){return BUILDINGS.filter(b=>b.enterable&&Object.hasOwn(doors,b.id)).map(b=>({b,d:Math.hypot(p.x-doorRect(b).x,p.z-doorRect(b).z)})).filter(v=>v.d<=2.5&&(p.y??0)<.5).sort((a,b)=>a.d-b.d)[0]?.b;}
function toggleDoor(doors:Doors,id:string,p:Point,actors:readonly Point[]):boolean{
 const b=BUILDINGS.find(b=>b.id===id&&b.enterable);if(!b||nearbyDoor(p,{[id]:doors[id]??false})?.id!==id)return false;
 if(doors[id]&&actors.some(a=>(a.y??0)<3.2&&circleOverlapsRect(a,PROTOTYPE.radius+.1,doorRect(b))))return false;
 doors[id]=!doors[id];return true;
}
const stairCache=new WeakMap<Building,readonly Stairway[]>();
function stairways(b:Building):readonly Stairway[]{const cached=stairCache.get(b);if(cached)return cached;const f=b.z<0?1:-1,z0=b.z+f*(b.depth/2-2.2),z1=b.z-f*(b.depth/2-2.2);const result:Stairway[]=[
 {building:b.id,width:1.8,start:{x:b.x-b.width/2+1.5,z:z0,y:0},end:{x:b.x-b.width/2+1.5,z:z1,y:SECOND_FLOOR}},
 {building:b.id,width:1.8,start:{x:b.x+b.width/2-1.5,z:z1,y:SECOND_FLOOR},end:{x:b.x+b.width/2-1.5,z:z0,y:b.height}},
 ];for(const stair of result){Object.freeze(stair.start);Object.freeze(stair.end);Object.freeze(stair);}Object.freeze(result);stairCache.set(b,result);return result;}
function upperFloorContains(p:Point,r:number){
 if((p.y??0)<.05)return true;
 return BUILDINGS.some(b=>{const ledge=balcony(b,p.y??0);if(b.enterable&&[SECOND_FLOOR,b.height].some(y=>Math.abs((p.y??0)-y)<.05)&&Math.abs(p.x-ledge.x)<=ledge.width/2-r&&Math.abs(p.z-ledge.z)<=ledge.depth/2)return true;if(!b.enterable||Math.abs(p.x-b.x)>b.width/2-.4-r||Math.abs(p.z-b.z)>b.depth/2-.4-r)return false;
  for(const s of stairways(b)){const t=(p.z-s.start.z)/(s.end.z-s.start.z);if(t>=0&&t<=1&&Math.abs(p.x-s.start.x)<s.width/2-.05&&Math.abs((p.y??0)-(s.start.y+t*(s.end.y-s.start.y)))<.12)return true;}
  return [SECOND_FLOOR,b.height].some(y=>Math.abs((p.y??0)-y)<.05&&floorPanels(b,y).some(f=>Math.abs(p.x-f.x)<=f.width/2+.05&&Math.abs(p.z-f.z)<=f.depth/2+.05));
 });
}
function elevatedStep(from:Point,to:Point):Point{
 const y=from.y??0;let next=y;
 for(const b of ENTERABLE_BUILDINGS){if(Math.abs(to.x-b.x)>b.width/2||Math.abs(to.z-b.z)>b.depth/2+.5)continue;for(const s of stairways(b)){
  if(Math.abs(to.x-s.start.x)>s.width/2-.05)continue;
  const t=(to.z-s.start.z)/(s.end.z-s.start.z),before=(from.z-s.start.z)/(s.end.z-s.start.z);
  const oldHeight=s.start.y+Math.max(0,Math.min(1,before))*(s.end.y-s.start.y);
  if(t>=-.04&&t<=1.04&&Math.abs(y-oldHeight)<.2){next=s.start.y+Math.max(0,Math.min(1,t))*(s.end.y-s.start.y);break;}
 }}
 // A landing is reachable only by its stair; lateral entry cannot teleport upward.
 return from.y!==undefined||next>0?{...to,y:next}:to;
}
const floorCache=new WeakMap<Building,Map<number,readonly Rect[]>>();
function floorPanels(b:Building,y:number):readonly Rect[]{
 let levels=floorCache.get(b);if(!levels){levels=new Map();floorCache.set(b,levels);}const cached=levels.get(y);if(cached)return cached;
 const [a,c]=stairways(b),w=a!.width+.1,filled=y===SECOND_FLOOR?c!:a!;const result:Rect[]=[balcony(b,y),
 {id:b.id+'-floor-side',x:filled.start.x,z:b.z,width:w,depth:b.depth-.8,yMin:y-.12,yMax:y},
 {id:b.id+'-floor-center',x:b.x,z:b.z,width:b.width-2*(1.5+w/2),depth:b.depth-.8,yMin:y-.12,yMax:y},
 ...[y===SECOND_FLOOR?a!:c!].flatMap(s=>[-1,1].map(side=>({id:b.id+'-floor-landing',x:s.start.x,z:b.z+side*(b.depth/2-1.3),width:w,depth:1.8,yMin:y-.12,yMax:y}))),
 ];for(const panel of result)Object.freeze(panel);Object.freeze(result);levels.set(y,result);return result;
}
let outdoorCandidates:Point[]|undefined;
function randomOutdoorSpawn(others:readonly Point[],random:()=>number=Math.random):Point{
 const candidates:Point[]=outdoorCandidates??[];
 if(!outdoorCandidates)for(let x=-60;x<=60;x+=4)for(let z=-56;z<=30;z+=4){const p={x,z};if(canStand(p,PROTOTYPE.radius)&&!BUILDINGS.some(b=>Math.abs(x-b.x)<b.width/2+1&&Math.abs(z-b.z)<b.depth/2+1))candidates.push(p);}
 outdoorCandidates=candidates;
 const distance=(p:Point)=>others.length?Math.min(...others.map(o=>Math.hypot(p.x-o.x,p.z-o.z))):100;
 const safe=candidates.filter(p=>distance(p)>=12);const pool=safe.length?safe:candidates.sort((a,b)=>distance(b)-distance(a)).slice(0,10);
 return {...pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))]!,y:0};
}

let fixedShotGeometry:Rect[]|undefined;
const shotCache=new WeakMap<Rect[],Rect[]>();
function shotBoxes(doors?:Doors):Rect[]{
 const solids=worldSolids(doors),cached=shotCache.get(solids);if(cached)return cached;
 fixedShotGeometry??=ENTERABLE_BUILDINGS.flatMap(b=>[
  ...floorPanels(b,SECOND_FLOOR),...floorPanels(b,b.height),
  ...stairways(b).flatMap(s=>Array.from({length:32},(_,i)=>{const t=(i+.5)/32;return {id:b.id+'-stair-step',x:s.start.x,z:s.start.z+(s.end.z-s.start.z)*t,width:s.width,depth:Math.abs(s.end.z-s.start.z)/32+.01,yMin:s.start.y,yMax:s.start.y+(s.end.y-s.start.y)*(i+1)/32};})),
 ]);
 const result=[...solids.filter(r=>!r.slope),...fixedShotGeometry];shotCache.set(solids,result);return result;
}

return {advanceFall,balcony,PROTOTYPE,BUILDINGS,DOOR_WIDTH,buildingWalls,interiorFurniture,indoorAt,COVERS,SOLIDS,circleOverlapsRect,canStand,moveWithCollisions,normalized,SECOND_FLOOR,doorRect,createDoors,worldSolids,nearbyDoor,toggleDoor,stairways,floorPanels,randomOutdoorSpawn,shotBoxes};
}
export const harborWorld=createWorld();
export const {PROTOTYPE,BUILDINGS,DOOR_WIDTH,buildingWalls,interiorFurniture,indoorAt,COVERS,SOLIDS,circleOverlapsRect,canStand,moveWithCollisions,normalized,SECOND_FLOOR,doorRect,createDoors,worldSolids,nearbyDoor,toggleDoor,stairways,floorPanels,randomOutdoorSpawn,shotBoxes}=harborWorld;
export type World=ReturnType<typeof createWorld>;
