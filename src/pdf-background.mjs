import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import * as worker from 'pdfjs-dist/build/pdf.worker.mjs';
import assets from 'pdf-assets';
export {planPDFRegion} from './pdf-render-plan.mjs';
globalThis.pdfjsWorker=worker;
class EmbeddedBinaryData { async fetch({kind,filename}) { const encoded=assets[kind+'/'+filename];if(!encoded)throw Error('PDFリソースが見つかりません: '+filename);return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)); } }
function openPDF(data){const task=pdfjs.getDocument({data,isEvalSupported:false,useWorkerFetch:false,BinaryDataFactory:EmbeddedBinaryData,cMapPacked:true,useWasm:true});let passwordReject;const passwordError=new Promise((_,reject)=>passwordReject=reject);task.onPassword=()=>passwordReject(Error('パスワード付きPDFには対応していません'));return {task,document:Promise.race([task.promise,passwordError])}}
function encode(bytes){const pieces=[];for(let i=0;i<bytes.length;i+=32768)pieces.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(pieces.join(''))}
export async function readPDF(file,onProgress){
 if(file.size>50*1024*1024)throw Error('PDFは50MB以内にしてください');
 const bytes=new Uint8Array(await file.arrayBuffer()),source=encode(bytes),opened=openPDF(bytes);let pdf;
 try {pdf=await opened.document;if(pdf.numPages>50)throw Error('PDFは50ページ以内にしてください');const pages=[];
 for(let i=1;i<=pdf.numPages;i++){
  onProgress?.(i,pdf.numPages);const page=await pdf.getPage(i),initial=page.getViewport({scale:1}),scale=Math.min(2,2400/Math.max(initial.width,initial.height)),view=page.getViewport({scale}),canvas=document.createElement('canvas');
  try{canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;pages.push({src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,pageNumber:i,pageWidth:initial.width,pageHeight:initial.height})}finally{page.cleanup();canvas.width=canvas.height=0}
 }
 return {pages,source};
 }finally{await opened.task.destroy()}
}
// One decoded PDF and one render at a time. Do not store rendered tiles in the project.
let cached=null,queue=Promise.resolve();
function serialize(fn){const next=queue.then(fn,fn);queue=next.catch(()=>{});return next}
async function closePDF(){if(cached){const old=cached;cached=null;await old.task.destroy()}}
export function releasePDF(){return serialize(closePDF)}
export function renderPDFRegion(source,pageNumber,plan,canvas,signal){return serialize(async()=>{
 if(signal?.aborted)return false;
 if(cached?.source!==source){await closePDF();if(signal?.aborted)return false;const opened=openPDF(Uint8Array.from(atob(source),c=>c.charCodeAt(0)));cached={source,...opened}}
 let page,renderTask;
 try{
  const pdf=await cached.document;if(signal?.aborted)return false;page=await pdf.getPage(pageNumber);if(signal?.aborted)return false;
  canvas.width=plan.pixelWidth;canvas.height=plan.pixelHeight;
  renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:plan.scale}),transform:[1,0,0,1,-plan.cropX*plan.pixelRatio,-plan.cropY*plan.pixelRatio]});
  const cancel=()=>renderTask.cancel();signal?.addEventListener('abort',cancel,{once:true});
  try{await renderTask.promise}finally{signal?.removeEventListener('abort',cancel)}
  if(signal?.aborted){canvas.width=canvas.height=0;return false}return true;
 }catch(error){canvas.width=canvas.height=0;if(signal?.aborted)return false;await closePDF();throw error}
 finally{page?.cleanup()}
})}
