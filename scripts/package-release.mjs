import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import JSZip from 'jszip';

export async function packageRelease(input='dist',output='release'){
  const names=['index.html','THIRD_PARTY_NOTICES.txt'];
  const contents=await Promise.all(names.map(name=>readFile(resolve(input,name))));
  if(contents.some(data=>!data.length))throw Error('配布HTMLまたはライセンス表記が空です');
  const zip=new JSZip();
  for(let i=0;i<names.length;i++)zip.file(names[i],contents[i],{date:new Date('1980-01-01T00:00:00Z')});
  await mkdir(output,{recursive:true});
  for(let i=0;i<names.length;i++)await writeFile(resolve(output,names[i]),contents[i]);
  await writeFile(resolve(output,'kaigi-note.zip'),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}}));
  return [...names,'kaigi-note.zip'];
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  await packageRelease();
  console.log('Packaged tested HTML and notices into release/kaigi-note.zip');
}
