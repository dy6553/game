import test from 'node:test';
import assert from 'node:assert/strict';
import {installFullscreen} from '../src/fullscreen.ts';

function fixture(supported = true) {
  const button = Object.assign(new EventTarget(), {textContent:'', attrs: new Map<string,string>(), setAttribute(key:string,value:string){this.attrs.set(key,value);}});
  const status = {textContent:''};
  const doc = Object.assign(new EventTarget(), {fullscreenElement:null as object|null, fullscreenEnabled:supported, documentElement:{} as {requestFullscreen?:()=>Promise<void>}, exitFullscreen:async()=>{doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));}});
  if(supported) doc.documentElement.requestFullscreen=async()=>{doc.fullscreenElement=doc.documentElement;doc.dispatchEvent(new Event('fullscreenchange'));};
  installFullscreen(button as unknown as HTMLButtonElement,status as HTMLElement,doc as unknown as Document);
  return {button,status,doc};
}
const click=async (button:EventTarget)=>{button.dispatchEvent(new Event('click'));await new Promise(resolve=>setTimeout(resolve,0));};
test('button enters and exits fullscreen and reflects external exits',async()=>{
  const {button,doc}=fixture();
  assert.equal(button.attrs.get('aria-pressed'),'false');
  await click(button);assert.equal(doc.fullscreenElement,doc.documentElement);assert.equal(button.attrs.get('aria-pressed'),'true');
  await click(button);assert.equal(doc.fullscreenElement,null);assert.equal(button.attrs.get('aria-pressed'),'false');
  await click(button);doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));assert.equal(button.attrs.get('aria-pressed'),'false');
});
test('unsupported and rejected requests show guidance without throwing',async()=>{
  const unsupported=fixture(false);await click(unsupported.button);assert.match(unsupported.status.textContent,/지원/);
  const rejected=fixture();rejected.doc.documentElement.requestFullscreen=async()=>{throw new Error('denied');};await click(rejected.button);assert.match(rejected.status.textContent,/실패/);assert.equal(rejected.button.attrs.get('aria-pressed'),'false');
});
