import {expansionLayouts} from './expansion-layouts.ts';
import type {Point,Rect,Stairway} from './world.ts';

export const MOON_LAYOUT_REVISION='moon-v3';
const original=expansionLayouts.moon;
const wall=(id:string,x:number,z:number,width:number,depth:number,yMin:number,yMax:number):Rect=>({id,x,z,width,depth,yMin,yMax});

export const moonAirlocks=[-1,1].map(side=>wall(`moon-airlock-${side}`,side*20.4,11,.28,4.2,0,3.18));
export const moonCorridor={halfWidth:22,z:11,halfDepth:2.1,height:3.4};
export const moonCrater={x:0,z:-22,radius:8.5};
export const moonStairs:Stairway[]=original.rooms.map(room=>({
 building:room.id,width:2.8,start:{x:room.x+Math.sign(room.x)*5.4,z:-9,y:0},
 end:{x:room.x+Math.sign(room.x)*5.4,z:2.2,y:3.4},
}));
export const moonUpperFloors=original.rooms.map(room=>wall(room.id+'-floor-observation',room.x,8.45,17.5,12.5,3.22,3.4));

const facingWalls=original.solids.filter(s=>(s.x===22||s.x===-22)&&s.z===9&&s.yMin===0&&s.yMax===6);
const apertures=facingWalls.flatMap(s=>[
 wall(s.id+'-lower south',s.x,6,.5,6,0,3.4),
 wall(s.id+'-lower north',s.x,14,.5,2,0,3.4),
 wall(s.id+'-upper jamb south',s.x,3.5,.5,1,3.4,6),
 wall(s.id+'-upper jamb north',s.x,11.5,.5,7,3.4,6),
 wall(s.id+'-observation sill',s.x,6,.5,4,3.4,4.15),
 wall(s.id+'-observation lintel',s.x,6,.5,4,5.8,6),
]);

export const moonLayout={...original,solids:[
 ...original.solids.filter(s=>!facingWalls.includes(s)&&!(Math.abs(s.x)===19&&s.z===11)),
 ...apertures,
 wall('moon-link-south wall',0,8.75,44,.3,0,3.4),
 wall('moon-link-north wall',0,13.25,44,.3,0,3.4),
 wall('moon-link roof',0,11,44,4.8,3.18,3.4),
 ...[-1,1].flatMap(side=>[
  wall(`moon-crater-rim-${side}`,side*7.3,-22,2.8,7,0,1.45),
  wall(`moon-crater-shoulder-${side}`,side*4.6,-26.8,3.8,2.2,0,1.18),
  wall(`moon-crater-north-${side}`,side*5.2,-16.2,3.4,2.1,0,1.15),
 ]),
]};

export function moonCovered(p:Point){
 return Math.abs(p.x)<moonCorridor.halfWidth&&Math.abs(p.z-moonCorridor.z)<moonCorridor.halfDepth&&(p.y??0)<moonCorridor.height;
}
