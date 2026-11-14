import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import * as worker from 'pdfjs-dist/build/pdf.worker.mjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import assets from 'pdf-assets';
globalThis.pdfjsWorker=worker;
class EmbeddedBinaryData { async fetch({kind,filename}) { const encoded=assets[kind+'/'+filename];if(!encoded)throw Error('PDFリソースが見つかりません: '+filename);return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)); } }
async function readPDF(file,onProgress){
 if(file.size>50*1024*1024)throw Error('PDFは50MB以内にしてください');
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useWorkerFetch:false,BinaryDataFactory:EmbeddedBinaryData,cMapPacked:true,useWasm:true});
 let rejectPassword;const passwordError=new Promise((resolve,reject)=>rejectPassword=reject);task.onPassword=()=>rejectPassword(Error('パスワード付きPDFには対応していません'));let pdf;
 try {pdf=await Promise.race([task.promise,passwordError]);if(pdf.numPages>50)throw Error('PDFは50ページ以内にしてください');const pages=[];
 for(let i=1;i<=pdf.numPages;i++){onProgress?.(i,pdf.numPages);const page=await pdf.getPage(i),initial=page.getViewport({scale:1}),scale=Math.min(2,2400/Math.max(initial.width,initial.height)),view=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;pages.push({src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height});page.cleanup();canvas.width=canvas.height=0;}return pages;
 }finally{await task.destroy()}
}
async function raster(node,width,height){
 if(node.querySelector('iframe'))throw Error('HTML部品を含むページのPDF・PPTX出力には未対応です。HTMLまたはJSONで保存してください');
 for(const img of node.querySelectorAll('img')){if(!img.src.startsWith('data:'))throw Error('PDF・PPTX出力では外部画像URLを使用できません。背景画像として取り込んでください');await img.decode()}
 for(const svg of [...node.querySelectorAll('svg')]){const image=new Image();image.width=svg.viewBox.baseVal.width;image.height=svg.viewBox.baseVal.height;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));image.style.cssText='width:100%;height:100%;display:block;overflow:visible';svg.replaceWith(image);await image.decode()}
 const canvas=await html2canvas(node,{scale:Math.min(2,3200/Math.max(width,height)),width,height,backgroundColor:'#ffffff',logging:false,allowTaint:false});return canvas.toDataURL('image/png');
}
function paperSize(w,h){const preset={'794,1123':[210,297],'1123,794':[297,210],'1123,1587':[297,420],'1587,1123':[420,297]};return preset[w+','+h]||[w*25.4/96,h*25.4/96]}
async function exportPDF(images,width,height){const [w,h]=paperSize(width,height),orientation=w>h?'landscape':'portrait',pdf=new jsPDF({unit:'mm',format:[w,h],orientation,compress:true});for(let i=0;i<images.length;i++){if(i)pdf.addPage([w,h],orientation);pdf.addImage(images[i],'PNG',0,0,w,h,undefined,'FAST')}return pdf.output('blob')}
async function exportPPTX(images,width,height,names){const [w,h]=paperSize(width,height),pptx=new PptxGenJS();pptx.defineLayout({name:'DOCUMENT',width:w/25.4,height:h/25.4});pptx.layout='DOCUMENT';pptx.author='UI Studio';pptx.subject='会議資料（画像として出力）';for(let i=0;i<images.length;i++){const slide=pptx.addSlide();slide.addImage({data:images[i],x:0,y:0,w:w/25.4,h:h/25.4});slide.addNotes(names[i])}return pptx.write({outputType:'blob'})}
window.MeetingTools={readPDF,raster,exportPDF,exportPPTX,paperSize};
