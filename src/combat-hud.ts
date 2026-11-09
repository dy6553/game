import {stanceStats} from './stance.ts';
import {unobstructed} from './combat-geometry.ts';import type {Point,World,Doors} from './world.ts';
export type Contact=Point&{id:string;name:string;health:number;ally?:boolean;active?:boolean;revealed?:boolean;jump?:{height:number}};
export function combatContacts(world:World,doors:Doors,me:Point,yaw:number,pitch:number,actors:Contact[]){
 const eye={x:me.x,y:(me.y??0)+stanceStats(me.stance).eye,z:me.z};
 const seen=actors.filter(a=>a.active!==false&&a.health>0).map(a=>{const target={x:a.x,y:(a.y??0)+(a.jump?.height??0)+stanceStats(a.stance).eye*.8,z:a.z},dx=a.x-me.x,dz=a.z-me.z,distance=Math.hypot(dx,dz),angle=Math.atan2(Math.sin(Math.atan2(dx,dz)-yaw),Math.cos(Math.atan2(dx,dz)-yaw)),vertical=Math.atan2(eye.y-target.y,distance)-pitch;
 return {...a,distance,angle,vertical,visible:distance<=60&&Math.abs(angle)<.75&&unobstructed(world,doors,eye,target)};});
 return {radar:seen.filter(a=>a.ally||a.visible||a.revealed),target:seen.filter(a=>!a.ally&&a.visible&&Math.abs(a.angle)<.14&&Math.abs(a.vertical)<.2).sort((a,b)=>Math.abs(a.angle)-Math.abs(b.angle)||a.distance-b.distance)[0]};
}
export function mapPoint(world:World,p:Point){const b=world.PROTOTYPE;return {x:Math.max(0,Math.min(1,(p.x+b.halfWidth)/(b.halfWidth*2))),y:Math.max(0,Math.min(1,(b.maxZ-p.z)/(b.halfDepth+b.maxZ)))};}
export const COMBAT_HUD_MARKUP=`<section id="combat-vitals" aria-label="내 체력"><span>내 체력</span><strong><b id="combat-hp">100</b><small> / 100</small></strong><progress id="combat-hp-bar" max="100" value="100" aria-label="남은 체력"></progress><small id="combat-life"></small></section><section id="target-vitals" hidden aria-label="조준한 적 체력"><span id="target-name">적</span><strong><b id="target-hp">100</b> / 100</strong><progress id="target-hp-bar" max="100" value="100" aria-label="적 남은 체력"></progress></section><figure id="combat-map" aria-label="미니맵"><canvas id="minimap" width="256" height="192" aria-label="내 위치·아군·보이는 적·건물 지도"></canvas><figcaption><span>▲ 나</span><span>● 아군</span><span>● 적</span><b>N ↑</b></figcaption></figure>`;
export function drawCombatMap(canvas:HTMLCanvasElement,world:World,me:Point,yaw:number,contacts:Contact[]){
 const c=canvas.getContext?.('2d');if(!c)return;const w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.fillStyle='#0a1b25';c.fillRect(0,0,w,h);c.strokeStyle='#31505a';c.lineWidth=1;for(let x=0;x<w;x+=w/8){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=h/6){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 for(const b of world.BUILDINGS){const p=mapPoint(world,{x:b.x-b.width/2,z:b.z+b.depth/2}),bw=b.width/(world.PROTOTYPE.halfWidth*2)*w,bh=b.depth/(world.PROTOTYPE.halfDepth+world.PROTOTYPE.maxZ)*h;c.fillStyle=b.enterable?'#315b4f':'#33434e';c.fillRect(p.x*w,p.y*h,bw,bh);if(b.enterable){c.strokeStyle='#75bb91';c.strokeRect(p.x*w,p.y*h,bw,bh);}}
 for(const a of contacts){const p=mapPoint(world,a);c.fillStyle=a.ally?'#70d4f4':'#ff8777';c.beginPath();c.arc(p.x*w,p.y*h,3.5,0,Math.PI*2);c.fill();}
 const p=mapPoint(world,me);c.save();c.translate(p.x*w,p.y*h);c.rotate(yaw);c.fillStyle='#fff4b8';c.strokeStyle='#09131b';c.lineWidth=2;c.beginPath();c.moveTo(0,-8);c.lineTo(6,6);c.lineTo(0,3);c.lineTo(-6,6);c.closePath();c.fill();c.stroke();c.restore();
}
