import {createPickups,type Pickup} from './inventory.ts';import {EQUIPMENT_IDS} from './equipment.ts';import type {Point,World} from './world.ts';
export function createMatchPickups(world:World,random:()=>number=Math.random):Pickup[]{
 const outside:Point[]=[],inside:Point[]=[],upper:Point[]=[];
 const valid=(p:Point)=>world.canStand(p,1,world.worldSolids());
 for(let x=-60;x<=60;x+=3)for(let z=-55;z<=30;z+=3){const p={x,z,y:0};if(valid(p)&&Math.hypot(x,z+8)>5){if(world.indoorAt(p))inside.push(p);else outside.push(p);}}
 for(const b of world.BUILDINGS.filter(b=>b.enterable))for(let x=b.x-b.width/2+2;x<b.x+b.width/2-1;x+=2)for(let z=b.z-b.depth/2+2;z<b.z+b.depth/2-1;z+=2){const p={x,z,y:world.SECOND_FLOOR};if(valid(p))upper.push(p);}
 const crates:Pickup[]=[...createPickups(),...EQUIPMENT_IDS.map(id=>({id:'crate-'+id,weaponId:'pistol' as const,equipmentId:id,x:0,z:0,remaining:0}))];
 for(let i=crates.length-1;i>0;i--){const j=Math.max(0,Math.min(i,Math.floor(random()*(i+1))));[crates[i],crates[j]]=[crates[j]!,crates[i]!];}
 const placed:Point[]=[];return crates.map((c,i)=>{const source=i===0?inside:i===1?upper:i===2?[...inside,...upper]:outside,pool=source.filter(p=>placed.every(q=>Math.hypot(p.x-q.x,p.z-q.z,(p.y??0)-(q.y??0))>=4));if(!pool.length)throw Error('No safe pickup positions');const p=pool[Math.max(0,Math.min(pool.length-1,Math.floor(random()*pool.length)))]!;placed.push(p);return {...c,...p};});
}
