import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=process.cwd(),lock=JSON.parse(readFileSync('package-lock.json','utf8')),paths=Object.entries(lock.packages).filter(([path,pkg])=>path&&!pkg.dev&&existsSync(join(root,path,'package.json'))).map(([path])=>join(root,path)),sections=[],inventory=[];
for(const path of [...new Set(paths)].sort()){
 const pkg=JSON.parse(readFileSync(join(path,'package.json'),'utf8'));
 const files=readdirSync(path).filter(f=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(f)&&!f.endsWith('.json'));
 inventory.push({name:pkg.name,version:pkg.version,license:pkg.license??'SEE LICENSE',notices:files.map(f=>relative(root,join(path,f)))});
 let text=`${pkg.name} ${pkg.version}\nDeclared license: ${pkg.license??'See upstream notices'}\n`;
 for(const file of files){const full=join(path,file);if(existsSync(full)){try{text+=`\n--- ${file} ---\n`+readFileSync(full,'utf8')+'\n';}catch{}}}
 sections.push(text);
}
writeFileSync('public/THIRD_PARTY_PACKAGE_LICENSES.txt','Production dependency license notices; original notices are preserved below.\n\n'+sections.join('\n'+'='.repeat(72)+'\n\n'));
writeFileSync('docs/runtime-license-inventory.json',JSON.stringify(inventory,null,2)+'\n');
console.log(`Generated notices for ${inventory.length} production packages.`);
