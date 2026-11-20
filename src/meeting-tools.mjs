import {importHTMLSlides} from './html-slides.mjs';
import * as htmlInstructions from './html-instructions.mjs';
import {captureBounds,captureStamp} from './stamp-capture.mjs';
import {replacementReport} from './pdf-text-fallback.mjs';
import * as shapeGestures from './shape-gestures.mjs';
import JSZip from 'jszip';
import {pageBox} from './page-geometry.mjs';
import {planPDFPreview,containsPDFRegion,PDFPreviewCache} from './pdf-preview-cache.mjs';
import {readPDF,renderPDFRegion,releasePDF,planPDFRegion} from './pdf-background.mjs';
import html2canvas from 'html2canvas';
import {font as ensurePDFTypography,exportVectorPDF} from './pdf-vector-export.mjs';
import PptxGenJS from 'pptxgenjs';
async function raster(node,width,height,options={}){
 if(node.querySelector('iframe'))throw Error('HTML部品を含むページのPNG・PDF・PPTX出力には未対応です。HTMLまたはJSONで保存してください');
 for(const img of node.querySelectorAll('img')){if(!img.src.startsWith('data:'))throw Error('PNG・PDF・PPTX出力では外部画像URLを使用できません。背景画像として取り込んでください');await img.decode()}
 for(const svg of [...node.querySelectorAll('svg')]){
 const box=svg.viewBox.baseVal,group=svg.querySelector('g'),width=Number(group?.getAttribute('stroke-width')??3),pad=Math.max(24,width*2),surface=document.createElement('canvas');const pixelScale=Math.min(options.scale??2,4096/Math.max(box.width+2*pad,box.height+2*pad));surface.width=Math.max(1,Math.ceil((box.width+2*pad)*pixelScale));surface.height=Math.max(1,Math.ceil((box.height+2*pad)*pixelScale));const ctx=surface.getContext('2d');ctx.scale(pixelScale,pixelScale);ctx.translate(pad,pad);ctx.strokeStyle=group?.getAttribute('stroke')||'#172235';ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';for(const path of svg.querySelectorAll('path')){const g=path.closest('g'),shape=new Path2D(path.getAttribute('d')),fill=g?.getAttribute('fill')||'none',stroke=g?.getAttribute('stroke')||'none',lineWidth=Number(g?.getAttribute('stroke-width')??0);if(fill!=='none'){ctx.globalAlpha=Number(g?.getAttribute('fill-opacity')??1);ctx.fillStyle=fill;ctx.fill(shape)}if(lineWidth>0&&stroke!=='none'){ctx.globalAlpha=Number(g?.getAttribute('stroke-opacity')??1);ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke(shape)}ctx.globalAlpha=1}
 const image=new Image();image.src=surface.toDataURL('image/png');image.style.cssText=`position:absolute;left:${-pad}px;top:${-pad}px;width:${box.width+2*pad}px;height:${box.height+2*pad}px;display:block;`;svg.replaceWith(image);await image.decode();
 }
 const canvas=await html2canvas(node,{scale:options.scale??Math.min(2,3200/Math.max(width,height)),width,height,backgroundColor:options.transparent?null:'#ffffff',logging:false,allowTaint:false});return canvas.toDataURL('image/png');
}
function paperSize(w,h){const preset={'794,1123':[210,297],'1123,794':[297,210],'1123,1587':[297,420],'1587,1123':[420,297],'1587,2245':[420,594],'2245,1587':[594,420],'2245,3179':[594,841],'3179,2245':[841,594]};return preset[w+','+h]||[w*25.4/96,h*25.4/96]}
async function exportPPTX(images,width,height,names,sizes){const [w,h]=paperSize(width,height),pptx=new PptxGenJS();pptx.defineLayout({name:'DOCUMENT',width:w/25.4,height:h/25.4});pptx.layout='DOCUMENT';pptx.author='会議ノート';pptx.subject='会議資料（画像として出力）';for(let i=0;i<images.length;i++){const slide=pptx.addSlide();const size=sizes?.[i]||{width,height},scale=Math.min(w/25.4/size.width,h/25.4/size.height),iw=size.width*scale,ih=size.height*scale;slide.addImage({data:images[i],x:(w/25.4-iw)/2,y:(h/25.4-ih)/2,w:iw,h:ih});slide.addNotes(names[i])}return pptx.write({outputType:'blob'})}
window.MeetingTools={importHTMLSlides,...htmlInstructions,captureBounds,captureStamp,replacementReport,ensurePDFTypography,shapeGestures,pageBox,async packageBackup(data,settings,editorHTML){const zip=new JSZip();zip.file('note.json',data);if(settings)zip.file('property-settings.json',settings);if(editorHTML)zip.file('meeting-note.html',editorHTML);zip.file('README.txt','note.json は新規作成／既存ノートを開くから読み込めます。meeting-note.html がある場合はそれを開いて編集できます。ZIPもそのまま読み込みできます。\n');return zip.generateAsync({type:'blob',compression:'DEFLATE'})},async unpackBackup(file){if(file.size>170*1024*1024)throw Error('ZIPは170MB以内で読み込んでください');const zip=await JSZip.loadAsync(await file.arrayBuffer()),entry=zip.file('note.json'),settings=zip.file('property-settings.json');if(settings?._data.uncompressedSize>1024*1024)throw Error('プロパティ設定が大きすぎます');if(!entry||entry._data.uncompressedSize>170*1024*1024)throw Error('バックアップのnote.jsonがないか大きすぎます');return {note:await entry.async('string'),settings:settings?await settings.async('string'):null}},planPDFPreview,containsPDFRegion,PDFPreviewCache,renderPDFRegion,releasePDF,planPDFRegion,readPDF,raster,exportVectorPDF,exportPPTX,paperSize};
