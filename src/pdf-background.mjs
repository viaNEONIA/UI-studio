import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerSource from 'pdf-worker-code';
import assets from 'pdf-assets';
export {planPDFRegion} from './pdf-render-plan.mjs';
// Classic Blob workers work from standalone file:// pages in Chromium, unlike
// module workers with opaque origins. The fallback module exports the handler.
const workerURL=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
pdfjs.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([workerSource,'\nexport const WorkerMessageHandler=globalThis.pdfjsWorker.WorkerMessageHandler;'],{type:'text/javascript'}));
async function startPDFWorker(){
 const port=new Worker(workerURL);
 try{
  await new Promise((resolve,reject)=>{
   const finish=error=>{clearTimeout(timer);port.removeEventListener('message',ready);port.removeEventListener('error',failed);error?reject(error):resolve()};
   const ready=event=>{if(event.data?.sourceName==='worker'&&event.data?.action==='ready')finish()};
   const failed=()=>finish(Error('PDF workerを起動できませんでした'));
   const timer=setTimeout(failed,10000);port.addEventListener('message',ready);port.addEventListener('error',failed);
  });
  return {worker:new pdfjs.PDFWorker({port}),port};
 }catch(error){port.terminate();throw error}
}
class EmbeddedBinaryData { async fetch({kind,filename}) { const encoded=assets[kind+'/'+filename];if(!encoded)throw Error('PDFリソースが見つかりません: '+filename);return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)); } }
async function openPDF(data){
 let native;try{native=await startPDFWorker()}catch{/* PDF.js loads the embedded fake-worker fallback when Worker is blocked. */}
 let task;
 try{task=pdfjs.getDocument({data,worker:native?.worker,isEvalSupported:false,useWorkerFetch:false,BinaryDataFactory:EmbeddedBinaryData,cMapPacked:true,useWasm:true})}catch(error){native?.worker.destroy();native?.port.terminate();throw error}
 let passwordReject;const passwordError=new Promise((_,reject)=>passwordReject=reject);task.onPassword=()=>passwordReject(Error('パスワード付きPDFには対応していません'));
 return {document:Promise.race([task.promise,passwordError]),task:{async destroy(){try{await task.destroy()}finally{native?.worker.destroy();native?.port.terminate()}}}};
}
function encode(bytes){const pieces=[];for(let i=0;i<bytes.length;i+=32768)pieces.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(pieces.join(''))}
export async function readPDF(file,onProgress){
 if(file.size>50*1024*1024)throw Error('PDFは50MB以内にしてください');
 const bytes=new Uint8Array(await file.arrayBuffer()),source=encode(bytes),opened=await openPDF(bytes);let pdf;
 try {pdf=await opened.document;if(pdf.numPages>50)throw Error('PDFは50ページ以内にしてください');const pages=[];
 for(let i=1;i<=pdf.numPages;i++){
  onProgress?.(i,pdf.numPages);const page=await pdf.getPage(i),initial=page.getViewport({scale:1}),scale=Math.min(2,2400/Math.max(initial.width,initial.height)),view=page.getViewport({scale}),canvas=document.createElement('canvas');
  try{canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;pages.push({src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,pageNumber:i,pageWidth:initial.width,pageHeight:initial.height})}finally{page.cleanup();canvas.width=canvas.height=0}
 }
 return {pages,source};
 }finally{await opened.task.destroy()}
}
// One decoded PDF and one render at a time. Keep at most two page operator lists.
// Rendered preview tiles are owned separately by the bounded viewport cache.
let cached=null,queue=Promise.resolve();
function serialize(fn){const next=queue.then(fn,fn);queue=next.catch(()=>{});return next}
async function closePDF(){if(cached){const old=cached;cached=null;await old.task.destroy()}}
export function releasePDF(){return serialize(closePDF)}
export function renderPDFRegion(source,pageNumber,plan,canvas,signal){return serialize(async()=>{
 if(signal?.aborted)return false;
 if(cached?.source!==source){await closePDF();if(signal?.aborted)return false;const opened=await openPDF(Uint8Array.from(atob(source),c=>c.charCodeAt(0)));cached={source,...opened,pages:new Map()}}
 let page,renderTask;
 try{
  const pdf=await cached.document;if(signal?.aborted)return false;page=cached.pages.get(pageNumber)||await pdf.getPage(pageNumber);cached.pages.delete(pageNumber);cached.pages.set(pageNumber,page);while(cached.pages.size>2){const [number,old]=cached.pages.entries().next().value;cached.pages.delete(number);old.cleanup()}if(signal?.aborted)return false;
  canvas.width=plan.pixelWidth;canvas.height=plan.pixelHeight;
  renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:plan.scale}),transform:[1,0,0,1,-plan.cropX*plan.pixelRatio,-plan.cropY*plan.pixelRatio]});
  let continuation;const cancel=()=>{clearTimeout(continuation);renderTask.cancel()};if(signal)renderTask.onContinue=resume=>{continuation=setTimeout(()=>{if(signal.aborted)renderTask.cancel();else resume()},0)};signal?.addEventListener('abort',cancel,{once:true});
  try{await renderTask.promise}finally{clearTimeout(continuation);signal?.removeEventListener('abort',cancel)}
  if(signal?.aborted){canvas.width=canvas.height=0;return false}return true;
 }catch(error){canvas.width=canvas.height=0;if(signal?.aborted)return false;await closePDF();throw error}
})}
