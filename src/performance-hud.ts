import type { Engine } from '@babylonjs/core/Engines/engine.js';

// Remove this module and its two calls in main.ts to remove the temporary display.
export function createPerformanceHud(engine:Engine){
 const label=document.createElement('div');
 label.setAttribute('aria-label','게임 성능');
 Object.assign(label.style,{position:'absolute',top:'8px',left:'50%',transform:'translateX(-50%)',zIndex:'7',pointerEvents:'none',padding:'4px 8px',borderRadius:'6px',background:'rgba(4,14,24,.75)',color:'#d5f9ed',font:'11px/1.2 monospace',whiteSpace:'nowrap'});
 document.querySelector('#app')!.appendChild(label);
 let elapsed=1;
 return {update(dt:number){elapsed+=dt;if(elapsed<1)return;elapsed=0;const fps=engine.getFps();label.textContent=`${Number.isFinite(fps)?Math.round(fps):0} FPS · ${engine.getRenderWidth()}×${engine.getRenderHeight()}`;}};
}
