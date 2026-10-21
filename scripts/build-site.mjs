import {cp,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative,resolve,sep} from 'node:path';
const root=new URL('../',import.meta.url);
const output=fileURLToPath(new URL('dist/',root));
const partials=fileURLToPath(new URL('unbound/partials/',root));
await rm(output,{recursive:true,force:true});
await cp(new URL('unbound/',root),output,{recursive:true,filter:source=>!resolve(source).startsWith(resolve(partials))});

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
