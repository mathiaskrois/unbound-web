import {cp,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const output=new URL('dist/',root);
await rm(output,{recursive:true,force:true});
await cp(new URL('unbound/',root),output,{recursive:true});
console.log('Built unbound-web: dist/ (public mount /unbound/).');
