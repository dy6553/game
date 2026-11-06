import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import assert from 'node:assert/strict';

const html = await readFile(new URL('../standalone/harbor-robots.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 2, 'small diagnostic bootstrap followed by embedded game');
for(const [index, script] of scripts.entries()) {
  assert.doesNotMatch(script[1], /\bsrc\s*=|\btype\s*=\s*["']module/i);
  assert.doesNotMatch(script[2], /\bimport\s*\(/, 'no dynamic module fetches');
  new Script(script[2], { filename: `harbor-embedded-${index}.js` });
}
assert.doesNotMatch(html, /<link\b[^>]*\bhref\s*=/i, 'no external stylesheets or module preloads');
assert.ok(Buffer.byteLength(html,'utf8')<2_000_000,'keep standalone below 2MB; do not embed the multi-megabyte reference image in startup code');
assert.doesNotMatch(html,/data:image\/png;base64,/,'reference is optional and loaded after startup');
assert.match(html, /<style>[\s\S]+<\/style>/);
assert.match(html, /<noscript>/);
// Run library initialization until the first game UI write. No GPU or browser is simulated.
const boundary=new Error('game-ui-boundary');
const elements=new Map([['boot-status',{textContent:'',appendChild(element){elements.set(element.id,element);}}]]);
const events={};
const context=createContext({
  console,performance,URL,TextDecoder,TextEncoder,
  navigator:{userAgent:'compatibility-check'},
  setTimeout(){},clearTimeout(){},
  addEventListener(type,handler){events[type]=handler;},
  document:{
    getElementById(id){return elements.get(id)||null;},
    createElement(){return {style:{},getContext(){return null;}};},
    querySelector(selector){return selector==='#app'?{
      set innerHTML(value){assert.match(value,/id="game"/);throw boundary;},
    }:null;},
  },
});
context.window=context;context.self=context;
new Script(scripts[0][2]).runInContext(context);
assert.match(elements.get('boot-status').textContent,/JavaScript/);
events.error({message:'test startup failure'});
assert.match(elements.get('boot-error').textContent,/test startup failure/);
assert.throws(()=>new Script(scripts[1][2]).runInContext(context),error=>error===boundary);
console.log('Standalone structure verified: inline CSS + classic JS; no external module files. Browser runtime remains unverified.');
console.log('Startup diagnostics and game UI entry verified under a DOM stub.');
