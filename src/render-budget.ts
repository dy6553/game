// Resolution changes use sustained frame timings, not one slow loading frame.
export function createRenderBudget(cap:number){
 let density=cap,time=0,frames=0,stable=0;
 return {get density(){return density;},sample(dt:number,active:boolean){
  if(!active){time=0;frames=0;stable=0;return null;}
  if(!Number.isFinite(dt)||dt<=0)return null;
  time+=Math.min(dt,.25);frames++;
  if(time<2)return null;
  const fps=frames/time;time=0;frames=0;
  let next=density;
  if(fps<28){next=Math.max(Math.min(.75,cap),density-.15);stable=0;}
  else if(fps>50){stable++;if(stable>=3){next=Math.min(cap,density+.05);stable=0;}}
  else stable=0;
  if(Math.abs(next-density)<.001)return null;
  density=Math.round(next*100)/100;return density;
 }};
}
