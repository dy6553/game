import {weatherRandom} from './snow-weather.ts';
import {expansionLayouts} from './expansion-layouts.ts';
import type {Point,Rect,Stairway} from './world.ts';

export const MOON_LAYOUT_REVISION='moon-v11';
const original=expansionLayouts.moon;
export const MOON_SECOND_FLOOR=4.6;
const upperRoof=8,upperDoorZ=4.15,upperDoorWidth=3.2,upperDoorHeight=2.85;
const mainRooms=original.rooms.map(room=>({...room,height:upperRoof}));
const wall=(id:string,x:number,z:number,width:number,depth:number,yMin:number,yMax:number):Rect=>({id,x,z,width,depth,yMin,yMax});

const corridorAirlocks=[-1,1].map(side=>wall(`moon-airlock-${side}`,side*20.4,11,.28,4.2,0,3.18));
export const moonCorridor={halfWidth:22,crossingHalfWidth:3.2,z:11,halfDepth:2.1,height:3.4};
export const moonCorridorSections=[-1,1].map(side=>({
 x:side*(moonCorridor.halfWidth+moonCorridor.crossingHalfWidth)/2,
 width:moonCorridor.halfWidth-moonCorridor.crossingHalfWidth,
}));
export const moonCrater={x:0,z:-22,radius:8.5};
export const moonStairs:Stairway[]=original.rooms.map(room=>({
 building:room.id,width:2.8,start:{x:room.x+Math.sign(room.x)*5.4,z:-9,y:0},
 end:{x:room.x+Math.sign(room.x)*5.4,z:2.2,y:MOON_SECOND_FLOOR},
}));
export const moonUpperFloors=original.rooms.map(room=>wall(room.id+'-floor-observation',room.x,8.45,17.5,12.5,MOON_SECOND_FLOOR-.18,MOON_SECOND_FLOOR));

const facingWalls=original.solids.filter(s=>(s.x===22||s.x===-22)&&s.z===9&&s.yMin===0&&s.yMax===6);
const apertures=facingWalls.flatMap(s=>[
 wall(s.id+'-lower south',s.x,6,.5,6,0,MOON_SECOND_FLOOR),
 wall(s.id+'-lower north',s.x,14,.5,2,0,MOON_SECOND_FLOOR),
 wall(s.id+'-upper jamb south',s.x,3.5,.5,1,MOON_SECOND_FLOOR,upperRoof),
 wall(s.id+'-upper jamb north',s.x,11.5,.5,7,MOON_SECOND_FLOOR,upperRoof),
 wall(s.id+'-observation sill',s.x,6,.5,4,MOON_SECOND_FLOOR,MOON_SECOND_FLOOR+.75),
 wall(s.id+'-observation lintel',s.x,6,.5,4,MOON_SECOND_FLOOR+2.4,upperRoof),
]);

export const moonShelters=[-1,1].flatMap(side=>[-35,35].map((z,index)=>({
 id:'moon-shelter-'+side+'-'+index,x:side*53,z,width:8,depth:7,height:3.6,
})));
export const moonExteriorAirlocks=[
 ...original.rooms.flatMap(room=>[-1,1].map(side=>wall(room.id+' exterior hatch '+side,room.x,side*room.depth/2,6,.28,0,4.4))),
 ...moonShelters.map(room=>wall(room.id+' exterior hatch',room.x,room.z-Math.sign(room.z)*3.4,2.8,.24,0,2.95)),
];
export const moonObservationAirlocks=original.rooms.map(room=>
 wall(room.id+' observation hatch',Math.sign(room.x)*22,6,.27,4,MOON_SECOND_FLOOR+.75,MOON_SECOND_FLOOR+2.4));
const upperEntrances=moonStairs.map(stair=>
 wall(stair.building+' upper entrance',stair.end.x,upperDoorZ,upperDoorWidth,.28,MOON_SECOND_FLOOR,MOON_SECOND_FLOOR+upperDoorHeight));
const upperPartitions=mainRooms.flatMap((room,i)=>{
 const door=upperEntrances[i]!;
 const left=room.x-room.width/2,a=door.x-door.width/2;
 const right=room.x+room.width/2,b=door.x+door.width/2;
 return [
  wall(room.id+' upper left wall',(left+a)/2,door.z,a-left,.34,MOON_SECOND_FLOOR,upperRoof),
  wall(room.id+' upper right wall',(b+right)/2,door.z,right-b,.34,MOON_SECOND_FLOOR,upperRoof),
  wall(room.id+' upper lintel',door.x,door.z,door.width,.34,door.yMax!,upperRoof),
 ];
});
export const moonAirlocks=[
 ...corridorAirlocks,...moonExteriorAirlocks,...moonObservationAirlocks,...upperEntrances,
 ...[-1,1].map(side=>wall('moon-crossing-airlock-'+side,side*(moonCorridor.crossingHalfWidth+.25),11,.28,4.2,0,3.18)),
];
const shelterWalls=moonShelters.flatMap(b=>{
 const entrance=b.z<0?1:-1,z=b.z+entrance*3.4;
 return [
  wall(b.id+' side wall left',b.x-3.9,b.z,.2,7,0,b.height),
  wall(b.id+' side wall right',b.x+3.9,b.z,.2,7,0,b.height),
  wall(b.id+' rear wall',b.x,b.z-entrance*3.4,8,.2,0,b.height),
  wall(b.id+' entrance wall left',b.x-2.7,z,2.6,.2,0,b.height),
  wall(b.id+' entrance wall right',b.x+2.7,z,2.6,.2,0,b.height),
  wall(b.id+' entrance lintel',b.x,z,2.8,.2,2.95,b.height),
  wall(b.id+' oxygen console',b.x,b.z-entrance*2.6,2,.65,0,1.15),
 ];
});
export const moonLayout={...original,width:140,depth:112,rooms:[...mainRooms,...moonShelters],solids:[
 ...shelterWalls,
 ...upperPartitions,
 ...original.rooms.flatMap(room=>{
  const side=Math.sign(room.x);
  return [
   wall(room.id+' observation console',room.x-side*1.4,10,3.2,1.05,MOON_SECOND_FLOOR,MOON_SECOND_FLOOR+1.05),
   wall(room.id+' mezzanine rail',room.x-side*2.4,2.36,12.25,.14,MOON_SECOND_FLOOR,MOON_SECOND_FLOOR+.88),
  ];
 }),
 ...mainRooms.map(room=>wall(room.id+' sealed outer wall',room.x+Math.sign(room.x)*room.width/2,room.z,.5,6,0,room.height)),
 ...original.solids.filter(s=>!facingWalls.includes(s)&&!(Math.abs(s.x)===19&&s.z===11))
  .map(s=>s.yMax===6&&original.rooms.some(room=>s.id.startsWith(room.id))?{...s,yMax:upperRoof}:s),
 ...apertures,
 ...moonCorridorSections.flatMap(({x,width},i)=>[
  wall(`moon-link-${i} south wall`,x,8.75,width,.3,0,3.4),
  wall(`moon-link-${i} north wall`,x,13.25,width,.3,0,3.4),
  wall(`moon-link-${i} roof`,x,11,width,4.8,3.18,3.4),
 ]),
 ...[-1,1].flatMap(side=>[
  wall(`moon-crater-rim-${side}`,side*7.3,-22,2.8,7,0,1.45),
  wall(`moon-crater-shoulder-${side}`,side*4.6,-26.8,3.8,2.2,0,1.18),
  wall(`moon-crater-north-${side}`,side*5.2,-16.2,3.4,2.1,0,1.15),
 ]),
]};

export function moonCovered(p:Point){
 return Math.abs(p.x)>moonCorridor.crossingHalfWidth+.25&&Math.abs(p.x)<moonCorridor.halfWidth&&Math.abs(p.z-moonCorridor.z)<moonCorridor.halfDepth&&(p.y??0)<moonCorridor.height;
}

export function moonMaskRacks(seed:number){
 return moonLayout.rooms.flatMap((room,index)=>{
  const main=room.depth>10;
  const candidates=main
   ? [-11,-8,-5,5,8,11].map(offset=>({side:Math.sign(room.x),offset}))
   : [-1,1].map(side=>({side,offset:[-1.5,0,1.5][Math.floor(weatherRandom(seed,index*8+side+2)*3)]!}));
  if(main)candidates.sort((a,b)=>weatherRandom(seed,index*30+a.offset+12)-weatherRandom(seed,index*30+b.offset+12));
  return candidates.slice(0,main?3:2).map(({side,offset})=>({
   room,side,x:room.x+side*(room.width/2-.6),z:room.z+offset,
  }));
 });
}
export function nearbyMoonMaskRack(point:Point,seed:number){
 if((point.y??0)>=.8)return;
 return moonMaskRacks(seed).find(rack=>
  Math.abs(point.x-rack.room.x)<rack.room.width/2-.4
  &&Math.abs(point.z-rack.room.z)<rack.room.depth/2-.4
  &&Math.hypot(point.x-rack.x,point.z-rack.z)<2.2);
}
