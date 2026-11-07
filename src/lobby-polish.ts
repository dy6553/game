export function createLobbyPolish(actions:{rotate(delta:number):void;reset():void;enabled():boolean;reduced():boolean;now?:()=>number}){
 const stage=document.querySelector<HTMLElement>('#lobby-model-stage')!,transition=document.querySelector<HTMLElement>('#lobby-deploy-transition')!;
 const clock=actions.now??(()=>performance.now());let pointer:number|null=null,lastX=0,deadline=0;
 function cancelDrag(){if(pointer!==null){try{stage.releasePointerCapture(pointer);}catch{}}pointer=null;stage.classList.remove('dragging');}
 stage.addEventListener('pointerdown',event=>{if(!actions.enabled()||pointer!==null||event.button!==0||(event.target as HTMLElement).closest('button'))return;event.preventDefault();event.stopPropagation();pointer=event.pointerId;lastX=event.clientX;try{stage.setPointerCapture(pointer);}catch{}stage.classList.add('dragging');});
 stage.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;if(!actions.enabled()){cancelDrag();return;}event.preventDefault();const delta=event.clientX-lastX;lastX=event.clientX;actions.rotate(delta*.009);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,event=>{if((event as PointerEvent).pointerId===pointer)cancelDrag();});
 window.addEventListener('blur',cancelDrag);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDrag();});
 stage.addEventListener('keydown',event=>{if(!actions.enabled())return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();actions.rotate((event.key==='ArrowLeft'?-1:1)*Math.PI/12);}else if(event.key==='Home'){event.preventDefault();actions.reset();}});
 document.querySelector('#lobby-rotation-reset')!.addEventListener('click',()=>{if(actions.enabled())actions.reset();});
 function cancelDeploy(){deadline=0;transition.hidden=true;document.body.classList.remove('lobby-deploying');}
 return {cancelDrag,cancelDeploy,get deploying(){return deadline>0;},deploy(){cancelDrag();cancelDeploy();if(actions.reduced())return;deadline=clock()+280;transition.hidden=false;document.body.classList.add('lobby-deploying');},update(){if(deadline&&clock()>=deadline)cancelDeploy();}};
}
