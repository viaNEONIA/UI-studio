import {planPDFPreview,containsPDFRegion,PDFPreviewCache} from './pdf-preview-cache.mjs';
import {readPDF,renderPDFRegion,releasePDF,planPDFRegion} from './pdf-background.mjs';
import html2canvas from 'html2canvas';
import {exportVectorPDF} from './pdf-vector-export.mjs';
import PptxGenJS from 'pptxgenjs';
async function raster(node,width,height,options={}){
 if(node.querySelector('iframe'))throw Error('HTML部品を含むページのPNG・PDF・PPTX出力には未対応です。HTMLまたはJSONで保存してください');
 for(const img of node.querySelectorAll('img')){if(!img.src.startsWith('data:'))throw Error('PNG・PDF・PPTX出力では外部画像URLを使用できません。背景画像として取り込んでください');await img.decode()}
 for(const svg of [...node.querySelectorAll('svg')]){
 const box=svg.viewBox.baseVal,group=svg.querySelector('g'),width=Number(group?.getAttribute('stroke-width')??3),pad=Math.max(24,width*2),surface=document.createElement('canvas');surface.width=Math.ceil((box.width+2*pad)*2);surface.height=Math.ceil((box.height+2*pad)*2);const ctx=surface.getContext('2d');ctx.scale(2,2);ctx.translate(pad,pad);ctx.strokeStyle=group?.getAttribute('stroke')||'#172235';ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';for(const path of svg.querySelectorAll('path')){const shape=new Path2D(path.getAttribute('d')),fill=group?.getAttribute('fill')||'none';if(fill!=='none'){ctx.fillStyle=fill;ctx.fill(shape)}if(width>0){ctx.globalAlpha=Number(group?.getAttribute('stroke-opacity')??1);ctx.stroke(shape);ctx.globalAlpha=1}}
 const image=new Image();image.src=surface.toDataURL('image/png');image.style.cssText=`position:absolute;left:${-pad}px;top:${-pad}px;width:${box.width+2*pad}px;height:${box.height+2*pad}px;display:block;`;svg.replaceWith(image);await image.decode();
 }
 const canvas=await html2canvas(node,{scale:Math.min(2,3200/Math.max(width,height)),width,height,backgroundColor:options.transparent?null:'#ffffff',logging:false,allowTaint:false});return canvas.toDataURL('image/png');
}
function paperSize(w,h){const preset={'794,1123':[210,297],'1123,794':[297,210],'1123,1587':[297,420],'1587,1123':[420,297],'1587,2245':[420,594],'2245,1587':[594,420],'2245,3179':[594,841],'3179,2245':[841,594]};return preset[w+','+h]||[w*25.4/96,h*25.4/96]}
async function exportPPTX(images,width,height,names){const [w,h]=paperSize(width,height),pptx=new PptxGenJS();pptx.defineLayout({name:'DOCUMENT',width:w/25.4,height:h/25.4});pptx.layout='DOCUMENT';pptx.author='会議ノート';pptx.subject='会議資料（画像として出力）';for(let i=0;i<images.length;i++){const slide=pptx.addSlide();slide.addImage({data:images[i],x:0,y:0,w:w/25.4,h:h/25.4});slide.addNotes(names[i])}return pptx.write({outputType:'blob'})}
window.MeetingTools={planPDFPreview,containsPDFRegion,PDFPreviewCache,renderPDFRegion,releasePDF,planPDFRegion,readPDF,raster,exportVectorPDF,exportPPTX,paperSize};
