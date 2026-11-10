import {type Stance} from './stance.ts';
import { normalized } from './world.ts';
import { createLookMotion } from './view.ts';

export function createInput(canvas: HTMLCanvasElement, options: {requestMouseLock?:()=>boolean;mouseScale?:()=>number;smoothLook?:boolean} = {}) {
  let enabled = true;let stance:Stance='stand';const toggleStance=(next:Stance)=>{if(enabled)stance=stance===next?'stand':next;};
  for(const [id,next] of [['crouch','crouch'],['prone','prone']] as const)document.querySelector('#'+id)?.addEventListener('click',()=>toggleStance(next));
  let touchSensitivity = 1,mouseSensitivity=1;
  const mouseRate=()=>.0025*mouseSensitivity*(options.mouseScale?.()??1);
  const keys = new Set<string>();
  const joystick = document.querySelector<HTMLElement>('#joystick')!;
  const thumb = document.querySelector<HTMLElement>('#joystick-thumb')!;
  const fire = document.querySelector<HTMLButtonElement>('#fire')!;
  const reload = document.querySelector<HTMLButtonElement>('#reload');
  const jump = document.querySelector<HTMLButtonElement>('#jump');
  const sprint=document.querySelector<HTMLButtonElement>('#sprint');
  const dash=document.querySelector<HTMLButtonElement>('#dash');
  let sprintToggle=false;
  let jumpKey:'Space'|'KeyJ'='Space';
  let stickPointer: number | null = null;
  let stick = { x: 0, y: 0 };
  let lookPointer: number | null = null;
  let last = { x: 0, y: 0 };
  const lookMotion=createLookMotion(options.smoothLook??false);let invertY=false;
  const turn=(dx:number,dy:number,sensitivity:number)=>{lookMotion.turn(dx,invertY?-dy:dy,sensitivity);};
  let firePointer:number|null=null,mouseHeld=false;
  let shots = 0;
  let reloads = 0;
  let jumps = 0;let dashes=0;

  let pressedAt = { x: 0, y: 0 };
  let mouseDragged = false;
  let hoverPoint:{x:number;y:number}|null=null;

  const reset = () => {
    lookMotion.discardPending();
    hoverPoint=null;sprintToggle=false;firePointer=null;mouseHeld=false;
    keys.clear(); stickPointer = null; stick = { x: 0, y: 0 };
    thumb.style.transform = 'translate(0, 0)';
    lookPointer = null;
    shots = 0;
    reloads = 0;
    jumps = 0;dashes=0;
  };
  window.addEventListener('keydown', event => {
    if (!enabled) return;
    const tag=(event.target as HTMLElement|null)?.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(tag==='BUTTON'&&event.code==='Space'))return;
    if((event.code==='KeyC'||event.code==='KeyZ')&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(!event.repeat)toggleStance(event.code==='KeyC'?'crouch':'prone');return;}
    if(event.code==='KeyF'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(!event.repeat)dashes++;return;}
    if(event.code==='ShiftLeft'||event.code==='ShiftRight'){event.preventDefault();keys.add(event.code);return;}
    if(jumpKey&&event.code===jumpKey){event.preventDefault();if(!event.repeat)jumps++;return;}
    if(event.code==='KeyR') { event.preventDefault();if(!event.repeat)reloads++;return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault(); keys.add(event.code);
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  window.addEventListener('orientationchange', reset);
  let viewportWidth=window.innerWidth;
  window.addEventListener('resize', () => {
    if(window.innerWidth!==viewportWidth){viewportWidth=window.innerWidth;reset();}
  });
  canvas.addEventListener('pointerdown', event => {
    if (!enabled) return;
    if (lookPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); canvas.focus();
    if (event.pointerType === 'mouse' && document.pointerLockElement === canvas) { mouseHeld=true;shots++; return; }
    if(event.pointerType==='mouse'&&options.requestMouseLock?.())return;
    if(event.pointerType==='mouse'){mouseHeld=true;shots++;hoverPoint={x:event.clientX,y:event.clientY};return;}
    hoverPoint=null;lookPointer = event.pointerId; last = { x: event.clientX, y: event.clientY };
    pressedAt = { ...last }; mouseDragged = false;
    canvas.setPointerCapture(event.pointerId);
  });
  document.addEventListener('mousemove',event=>{
    if(enabled&&document.pointerLockElement===canvas)turn(event.movementX,event.movementY,mouseRate());
  });
  canvas.addEventListener('pointerenter',()=>{hoverPoint=null;});
  canvas.addEventListener('pointerleave',()=>{hoverPoint=null;});
  const moveLook = (event:PointerEvent) => {
    if (!enabled) return;
    if (document.pointerLockElement === canvas && event.pointerType === 'mouse') {
      return; // Pointer Lock uses document mousemove; never apply a second delta.
    } else if(event.pointerType==='mouse'&&lookPointer===null&&event.target===canvas){
      if(hoverPoint)turn(event.clientX-hoverPoint.x,event.clientY-hoverPoint.y,mouseRate());
      hoverPoint={x:event.clientX,y:event.clientY};
    } else if (event.pointerId === lookPointer) {
      if (Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 6) mouseDragged = true;
      turn(event.clientX - last.x,event.clientY - last.y,event.pointerType === 'touch' ? .007*touchSensitivity : mouseRate());
      last = { x: event.clientX, y: event.clientY };
    }
  };
  canvas.addEventListener('pointermove',moveLook);
  window.addEventListener('pointermove',event=>{if(event.target!==canvas)moveLook(event);});
  const releaseLook = (event: PointerEvent) => {
    if(event.pointerType==='mouse')mouseHeld=false;
    if (event.pointerId === lookPointer) {
      if (event.type === 'pointerup' && event.pointerType === 'mouse' && !mouseDragged) shots++;
      lookPointer = null;hoverPoint=event.pointerType==='mouse'?{x:event.clientX,y:event.clientY}:null;
    }
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
    canvas.addEventListener(type, event => releaseLook(event as PointerEvent)));
  document.addEventListener('pointerlockchange', reset);
  fire.addEventListener('pointerdown', event => {if(!enabled)return;event.preventDefault();if(firePointer!==null)return;firePointer=event.pointerId;fire.setPointerCapture(event.pointerId);shots++;});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>fire.addEventListener(type,event=>{if((event as PointerEvent).pointerId===firePointer)firePointer=null;}));

  fire.addEventListener('click', event => { if (enabled && event.detail === 0) shots++; });
  reload?.addEventListener('pointerdown',event=>{if(!enabled)return;event.preventDefault();reloads++;});
  reload?.addEventListener('click',event=>{if(enabled&&event.detail===0)reloads++;});
  sprint?.addEventListener('pointerdown',event=>{if(!enabled)return;event.preventDefault();sprintToggle=!sprintToggle;});
  sprint?.addEventListener('click',event=>{if(enabled&&event.detail===0)sprintToggle=!sprintToggle;});
  jump?.addEventListener('pointerdown',event=>{if(!enabled)return;event.preventDefault();jumps++;});
  jump?.addEventListener('click',event=>{if(enabled&&event.detail===0)jumps++;});
  dash?.addEventListener('pointerdown',event=>{if(!enabled)return;event.preventDefault();dashes++;});
  dash?.addEventListener('click',event=>{if(enabled&&event.detail===0)dashes++;});
  const updateStick = (event: PointerEvent) => {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * 0.33;
    stick = normalized((event.clientX - rect.left - rect.width / 2) / radius,
      -(event.clientY - rect.top - rect.height / 2) / radius);
    if (Math.hypot(stick.x, stick.y) < 0.12) stick = { x: 0, y: 0 };
    thumb.style.transform = `translate(${stick.x * radius}px, ${-stick.y * radius}px)`;
  };
  joystick.addEventListener('pointerdown', event => {
    if (!enabled) return;
    if (stickPointer !== null) return;
    event.preventDefault(); stickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId); updateStick(event);
  });
  joystick.addEventListener('pointermove', event => {
    if (!enabled) return;
    if (event.pointerId === stickPointer) updateStick(event);
  });
  const releaseStick = (event: PointerEvent) => {
    if (event.pointerId === stickPointer) {
      stickPointer = null; stick = { x: 0, y: 0 };
      thumb.style.transform = 'translate(0, 0)';
    }
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
    joystick.addEventListener(type, event => releaseStick(event as PointerEvent)));

  // Capture may be interrupted by overlays or OS gestures; end the matching finger globally.
  for(const type of ['pointerup','pointercancel'] as const)window.addEventListener(type,event=>{releaseLook(event);releaseStick(event);if(event.pointerId===firePointer)firePointer=null;});

  return {
    setEnabled(value: boolean) { if (enabled !== value) { enabled = value; reset(); } },
    setInvertY(value:boolean){invertY=value;},
    setMouseSensitivity(value:number){if(Number.isFinite(value))mouseSensitivity=Math.max(.1,Math.min(3,value));},
    setTouchSensitivity(value: number) { if (Number.isFinite(value)) touchSensitivity = Math.max(.25, Math.min(2, value)); },
    reset,
    get stance(){return stance;},
    get move() {
      return normalized(stick.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        stick.y + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')));
    },
    get look() { return lookMotion.look; },
    advanceLook(dt:number){if(enabled)lookMotion.advance(dt);},
    setLook(yaw:number,pitch:number){lookMotion.set({yaw,pitch});},
    resetLook() { lookMotion.set({yaw:0,pitch:0});reset(); },
    get sprintingRequested(){return stance==='stand'&&(sprintToggle||keys.has('ShiftLeft')||keys.has('ShiftRight'));},
    get firing(){return firePointer!==null||mouseHeld;},
    get actionsPending(){return shots>0||reloads>0||jumps>0||dashes>0;},
    consumeShots() { const count = shots; shots = 0; return count; },
    consumeReloads() { const count=reloads;reloads=0;return count; },
    consumeDashes(){const count=dashes;dashes=0;return stance==='stand'?count:0;},
    consumeJumps() { const count=jumps;jumps=0;return stance==='stand'?count:0; },
    setJumpKey(code:'Space'|'KeyJ') {jumpKey=code;},
  };
}
