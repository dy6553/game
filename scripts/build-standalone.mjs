import { build } from 'vite';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'standalone');
await build({
  root, configFile: false,
  build: {
    target: 'es2019',
    outDir, emptyOutDir: true, cssCodeSplit: false,
    lib: { entry: path.join(root, 'src/main.ts'), name: 'HarborGame', formats: ['iife'], fileName: () => 'harbor.js' },
  },
});
const files = await readdir(outDir);
const js = await readFile(path.join(outDir, 'harbor.js'), 'utf8');
const css = (await Promise.all(files.filter(name => name.endsWith('.css')).map(name => readFile(path.join(outDir, name), 'utf8')))).join('\n');
const licenses = await readFile(path.join(root, 'THIRD_PARTY_RUNTIME_LICENSES.txt'), 'utf8');
const bootstrap = `(function(){
  function report(message){
    var node=document.getElementById('boot-status')||document.getElementById('loading');
    if(!node)return;node.hidden=false;
    var detail=document.getElementById('boot-error');
    if(!detail){detail=document.createElement('p');detail.id='boot-error';node.appendChild(detail);}
    detail.textContent=String(message).slice(0,700);
  }
  window.addEventListener('error',function(event){report('시작 오류: '+(event.message||'스크립트를 불러오지 못했습니다.'));});
  window.addEventListener('unhandledrejection',function(event){report('시작 오류: '+String(event.reason&&event.reason.message||event.reason||'알 수 없는 오류'));});
  var status=document.getElementById('boot-status');if(status)status.textContent='JavaScript 실행 확인. 게임을 시작합니다.';
  setTimeout(function(){if(!document.getElementById('game'))report('게임 코드가 시작되지 않았습니다. 파일이 끝까지 내려받아졌는지 확인해 주세요. 이 안내 아래에 오류가 표시되면 해당 내용을 알려주세요.');},12000);
})();`;
const html = `<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><title>항구의 밤 — 봇 1대1 / 표적 연습</title>
<style>${css.replaceAll('</style', '<\\/style')}</style></head><body>
<div id="app"><div style="padding:30px;max-width:600px;margin:auto;line-height:1.9;font-family:system-ui;color:#e3edf7">
<h1>항구의 밤</h1><p id="boot-status">3D 화면을 준비하고 있습니다.</p><p>HTML 호환 수정 버전 R4 · 실행이 멈추면 아래 오류 내용을 확인해 주세요.</p>
<noscript>현재 뷰어에서는 JavaScript가 꺼져 있습니다. 이 게임은 JavaScript와 WebGL이 필요합니다.</noscript></div></div>
<script>${bootstrap}</script>
<script>${js.replaceAll(/<\/script/gi, '<\\/script')}</script>
<!-- ${licenses.replaceAll('--', '—')} -->
</body></html>`;
await writeFile(path.join(outDir, 'harbor-robots.html'), html);
console.log('Standalone HTML created: standalone/harbor-robots.html');
