export function installFullscreen(button: HTMLButtonElement, status: HTMLElement, doc: Document): void {
  const update=()=>{
    const active=!!doc.fullscreenElement;
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',active?'전체 화면 해제':'전체 화면');
    button.textContent=active?'⤡':'⛶';
  };
  doc.addEventListener('fullscreenchange',()=>{status.textContent='';update();});
  button.addEventListener('click',async()=>{
    status.textContent='';
    try {
      if(doc.fullscreenElement){
        if(typeof doc.exitFullscreen!=='function') throw new Error('unsupported');
        await doc.exitFullscreen();
      } else {
        if(doc.fullscreenEnabled===false||typeof doc.documentElement.requestFullscreen!=='function'){
          status.textContent='이 브라우저에서는 전체 화면을 지원하지 않습니다.';
          return;
        }
        await doc.documentElement.requestFullscreen();
      }
    } catch {
      status.textContent='전체 화면 변경에 실패했습니다. 브라우저 설정을 확인해 주세요.';
      update();
    }
  });
  update();
}
