/** Keep browser gestures separate from multi-pointer game controls and editable fields. */
export function installMobileBrowser(onResize:()=>void=()=>{}) {
  const app=document.querySelector<HTMLElement>('#app')!;
  const root=document.documentElement;
  const editable=(target:EventTarget|null)=>{
    const element=target as HTMLElement|null;
    const field=element?.closest?.('input,textarea,[contenteditable]');
    if(!field)return false;
    if(field.tagName==='INPUT')return !['button','submit','reset','checkbox','radio','range','file','color','image','hidden'].includes((field.getAttribute('type')??'text').toLowerCase());
    return field.tagName==='TEXTAREA'||field.getAttribute('contenteditable')!=='false';
  };
  const block=(event:Event)=>{if(!editable(event.target)&&event.cancelable)event.preventDefault();};
  for(const type of ['contextmenu','selectstart','dragstart','dblclick','gesturestart','gesturechange','gestureend'])app.addEventListener(type,block,{passive:false});
  app.addEventListener('touchmove',event=>{if(event.touches.length>1)block(event);},{passive:false});
  let lastTap:EventTarget|null=null,lastTime=0;
  app.addEventListener('touchend',event=>{
    if(event.touches.length||editable(event.target)){lastTap=null;return;}
    const now=Date.now();
    if(lastTap===event.target&&now-lastTime<300)block(event);
    lastTap=event.target;lastTime=now;
  },{passive:false});
  // Screen dimensions survive Safari's toolbar/keyboard transitions, unlike innerHeight.
  const screen=window.screen;
  const shortEdge=screen?.width&&screen?.height?Math.min(screen.width,screen.height):Math.min(window.innerWidth,window.innerHeight);
  root.classList.toggle('tablet-device',!!window.matchMedia?.('(any-pointer:coarse)').matches&&shortEdge>=600);
  const refresh=()=>{
    const viewport=window.visualViewport;
    // A browser that permits accessibility zoom must not resize the game's UI around the pinch.
    if(viewport&&Math.abs(viewport.scale-1)>.01)return;
    const width=viewport?.width??window.innerWidth,height=viewport?.height??window.innerHeight;
    if(width>0&&height>0){root.style.setProperty('--app-width',`${width}px`);root.style.setProperty('--app-height',`${height}px`);root.style.setProperty('--app-top',`${viewport?.offsetTop??0}px`);root.style.setProperty('--app-left',`${viewport?.offsetLeft??0}px`);}
    onResize();
  };
  window.addEventListener('resize',refresh);
  window.visualViewport?.addEventListener('resize',refresh);
  window.visualViewport?.addEventListener('scroll',refresh);
  refresh();
  return {refresh};
}
