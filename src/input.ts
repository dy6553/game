import { normalized } from './world.ts';
import { turnView } from './view.ts';

export function createInput(canvas: HTMLCanvasElement) {
  const keys = new Set<string>();
  const joystick = document.querySelector<HTMLElement>('#joystick')!;
  const thumb = document.querySelector<HTMLElement>('#joystick-thumb')!;
  const fire = document.querySelector<HTMLButtonElement>('#fire')!;
  const reload = document.querySelector<HTMLButtonElement>('#reload');
  const jump = document.querySelector<HTMLButtonElement>('#jump');
  const sprint=document.querySelector<HTMLButtonElement>('#sprint');
  let sprintToggle=false;
  let jumpKey:'Space'|'KeyJ'='Space';
  let stickPointer: number | null = null;
  let stick = { x: 0, y: 0 };
  let lookPointer: number | null = null;
  let last = { x: 0, y: 0 };
  let look = { yaw: 0, pitch: 0 };
  let firePointer:number|null=null,mouseHeld=false;
  let shots = 0;
  let reloads = 0;
  let jumps = 0;
  let pressedAt = { x: 0, y: 0 };
  let mouseDragged = false;

  const reset = () => {
    sprintToggle=false;firePointer=null;mouseHeld=false;
    keys.clear(); stickPointer = null; stick = { x: 0, y: 0 };
    thumb.style.transform = 'translate(0, 0)';
    lookPointer = null;
    shots = 0;
    reloads = 0;
    jumps = 0;
  };
  window.addEventListener('keydown', event => {
    const tag=(event.target as HTMLElement|null)?.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(tag==='BUTTON'&&event.code==='Space'))return;
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
  window.addEventListener('resize', reset);
  canvas.addEventListener('pointerdown', event => {
    if (lookPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); canvas.focus();
    if (event.pointerType === 'mouse' && document.pointerLockElement === canvas) { mouseHeld=true;shots++; return; }
    lookPointer = event.pointerId; last = { x: event.clientX, y: event.clientY };
    pressedAt = { ...last }; mouseDragged = false;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (document.pointerLockElement === canvas && event.pointerType === 'mouse') {
      look = turnView(look, event.movementX, event.movementY, 0.0025);
    } else if (event.pointerId === lookPointer) {
      if (Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 6) mouseDragged = true;
      look = turnView(look, event.clientX - last.x, event.clientY - last.y);
      last = { x: event.clientX, y: event.clientY };
    }
  });
  const releaseLook = (event: PointerEvent) => {
    if(event.pointerType==='mouse')mouseHeld=false;
    if (event.pointerId === lookPointer) {
      if (event.type === 'pointerup' && event.pointerType === 'mouse' && !mouseDragged) shots++;
      lookPointer = null;
    }
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
    canvas.addEventListener(type, event => releaseLook(event as PointerEvent)));
  document.addEventListener('pointerlockchange', reset);
  fire.addEventListener('pointerdown', event => {event.preventDefault();if(firePointer!==null)return;firePointer=event.pointerId;fire.setPointerCapture(event.pointerId);shots++;});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>fire.addEventListener(type,event=>{if((event as PointerEvent).pointerId===firePointer)firePointer=null;}));
  window.addEventListener('pointerup',()=>{mouseHeld=false;});
  window.addEventListener('pointercancel',()=>{mouseHeld=false;});
  fire.addEventListener('click', event => { if (event.detail === 0) shots++; });
  reload?.addEventListener('pointerdown',event=>{event.preventDefault();reloads++;});
  reload?.addEventListener('click',event=>{if(event.detail===0)reloads++;});
  sprint?.addEventListener('pointerdown',event=>{event.preventDefault();sprintToggle=!sprintToggle;});
  sprint?.addEventListener('click',event=>{if(event.detail===0)sprintToggle=!sprintToggle;});
  jump?.addEventListener('pointerdown',event=>{event.preventDefault();jumps++;});
  jump?.addEventListener('click',event=>{if(event.detail===0)jumps++;});
  canvas.addEventListener('dblclick', () => {
    if (matchMedia('(pointer: fine)').matches && canvas.requestPointerLock) {
      try { const result = canvas.requestPointerLock(); result?.catch(() => {}); } catch { /* Drag remains available. */ }
    }
  });
  const updateStick = (event: PointerEvent) => {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * 0.33;
    stick = normalized((event.clientX - rect.left - rect.width / 2) / radius,
      -(event.clientY - rect.top - rect.height / 2) / radius);
    if (Math.hypot(stick.x, stick.y) < 0.12) stick = { x: 0, y: 0 };
    thumb.style.transform = `translate(${stick.x * radius}px, ${-stick.y * radius}px)`;
  };
  joystick.addEventListener('pointerdown', event => {
    if (stickPointer !== null) return;
    event.preventDefault(); stickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId); updateStick(event);
  });
  joystick.addEventListener('pointermove', event => {
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

  return {
    reset,
    get move() {
      return normalized(stick.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        stick.y + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')));
    },
    get look() { return look; },
    resetLook() { look = { yaw: 0, pitch: 0 }; reset(); },
    get sprintingRequested(){return sprintToggle||keys.has('ShiftLeft')||keys.has('ShiftRight');},
    get firing(){return firePointer!==null||mouseHeld;},
    consumeShots() { const count = shots; shots = 0; return count; },
    consumeReloads() { const count=reloads;reloads=0;return count; },
    consumeJumps() { const count=jumps;jumps=0;return count; },
    setJumpKey(code:'Space'|'KeyJ') {jumpKey=code;},
  };
}
