import {cp,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url);
const output=fileURLToPath(new URL('dist/',root));
const partials=fileURLToPath(new URL('unbound/partials/',root));
await rm(output,{recursive:true,force:true});
await cp(new URL('unbound/',root),output,{recursive:true,filter:source=>!resolve(source).startsWith(resolve(partials))});

// The real-time 3D devices: three.js and the models, tree-shaken into one module that story.js
// imports on demand. story.js names it once; the build stamps that name with a content hash.
const devices3d=join(output,'assets/devices-3d.js');
await build({entryPoints:[fileURLToPath(new URL('devices-3d/devices-3d.js',root))],bundle:true,format:'esm',minify:true,target:['es2020','safari15'],legalComments:'eof',outfile:devices3d,logLevel:'warning'});
const story=join(output,'assets/story.js');
const devicesHash=createHash('sha256').update(await readFile(devices3d)).digest('hex').slice(0,10);
await writeFile(story,(await readFile(story,'utf8')).replace("'devices-3d.js'",`'devices-3d.js?v=${devicesHash}'`));

// Pages share markup through <!-- include:name --> markers; {{root}} is the page's relative path to the site root.
async function* pages(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory()) yield* pages(path);
    else if(entry.name.endsWith('.html')) yield path;
  }
}
const hashes=new Map();
async function version(file){
  if(!hashes.has(file)) hashes.set(file,createHash('sha256').update(await readFile(file)).digest('hex').slice(0,10));
  return hashes.get(file);
}
for await(const page of pages(output)){
  const siteRoot=relative(dirname(page),output).split(sep).filter(Boolean).map(()=>'../').join('');
  let html=await readFile(page,'utf8');
  for(const [marker,name] of [...html.matchAll(/<!-- include:([\w-]+) -->/g)]){
    html=html.replace(marker,(await readFile(join(partials,`${name}.html`),'utf8')).trimEnd().replaceAll('{{root}}',siteRoot));
  }
  // Cache busting: every local asset URL carries a hash of the file it points to.
  const asset=/(src|href)="((?:\.\.\/)*assets\/[^"?#]+)(?:\?v=[^"]*)?"/g;
  const tags=new Map();
  for(const [,,path] of html.matchAll(asset)) tags.set(path,await version(join(dirname(page),path)));
  await writeFile(page,html.replace(asset,(_,attribute,path)=>`${attribute}="${path}?v=${tags.get(path)}"`));
}
console.log('Built unbound-web: dist/ (public mount /unbound/).');
