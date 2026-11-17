import {annotationParts,annotationTransform,annotationBounds,addEditableAnnotation} from './pdf-editable.mjs';
import {flattenSourceForms,preserveAnnotations,inversePageRotation} from './pdf-annotations.mjs';
import {pageBox} from './page-geometry.mjs';
import {PDFDocument,PDFName,PDFObjectCopier,PDFRawStream,rgb,degrees,LineCapStyle,LineJoinStyle,pushGraphicsState,popGraphicsState,concatTransformationMatrix,rectangle,clip,endPath,setLineJoin} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {alignedFontkit} from './pdf-fontkit.mjs';
export function backgroundPlacement(b,meta,crop,rotation,pageHeight){
 const angle=((rotation%360)+360)%360;if(![0,90,180,270].includes(angle))throw Error('元PDFの回転角度に対応していません');
 const fit=Math.min(b.w/meta.pageWidth,b.h/meta.pageHeight),w=meta.pageWidth*fit,h=meta.pageHeight*fit,left=b.x+(b.w-w)/2,bottom=pageHeight-b.y-(b.h-h)/2-h;
 const x=left+([180,270].includes(angle)?w:0),y=bottom+([90,180].includes(angle)?h:0);
 return {x,y,xScale:(angle%180?h:w)/crop.width,yScale:(angle%180?w:h)/crop.height,rotate:degrees(-angle),opacity:b.opacity};
}
function clipBox(page,x,y,w,h){page.pushOperators(pushGraphicsState(),rectangle(x,y,w,h),clip(),endPath())}
const color=c=>c?rgb(c[0]/255,c[1]/255,c[2]/255):undefined;
// Match each embedded glyph's ink to the editor's measured glyph, without rewrapping text.
export function textRunPlacement(run,font,metrics){
 let sx=1,sy=1,x=run.x,y=-run.baseline;
 if(Number.isFinite(run.width)&&run.width>=0){const advance=font.widthOfTextAtSize(run.text,run.size);if(advance>0)sx=run.width/advance}
 const ink=run.ink;
 if(ink&&Object.values(ink).every(Number.isFinite)&&ink.left+ink.right>0&&ink.ascent+ink.descent>0){
  const glyphs=metrics.layout(run.text).glyphs,unit=run.size/metrics.unitsPerEm;let pen=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const glyph of glyphs){const b=glyph.bbox;if([b.minX,b.maxX,b.minY,b.maxY].every(Number.isFinite)){minX=Math.min(minX,pen+b.minX);maxX=Math.max(maxX,pen+b.maxX);minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY)}pen+=glyph.advanceWidth}
  if(maxX>minX&&maxY>minY){sx=(ink.left+ink.right)/((maxX-minX)*unit);sy=(ink.ascent+ink.descent)/((maxY-minY)*unit);x=run.x-ink.left-minX*unit*sx;y=-run.baseline-ink.descent-minY*unit*sy}
 }
 return {sx,sy,x,y};
}
export async function composeVectorPDF(project,prepared,{fontBytes,paperMM,onProgress,sourceFontBytes,renderBackground,mode='normal'}={}){
 if(!['normal','editable'].includes(mode))throw Error('PDF出力方式が正しくありません');
 const doc=await PDFDocument.create();doc.setTitle('会議ノート');doc.setCreator('会議ノート');doc.setProducer('会議ノート — ベクター合成');doc.registerFontkit(alignedFontkit);
 let font,metrics;const needText=prepared.some(p=>p.elements.some(e=>e.textRuns?.length));if(needText){if(!fontBytes)throw Error('PDF用フォントを読み込めません');font=await doc.embedFont(fontBytes,{subset:true});metrics=fontkit.create(fontBytes);const available=new Set(font.getCharacterSet());for(const p of prepared)for(const e of p.elements)for(const run of e.textRuns||[])for(const ch of run.text)if(!available.has(ch.codePointAt(0)))throw Error('font glyph unavailable: '+ch+' (U+'+ch.codePointAt(0).toString(16).toUpperCase()+')')}
 const images=new Map(),imageFor=src=>{if(!images.has(src))images.set(src,embedImage(doc,src));return images.get(src)};
 const embedded=new Map();let flattenedForms=0,backgroundFallbacks=0,preservedAnnotations=0,omittedLinks=0;
 for(const sourceId of new Set(project.screens.filter(s=>s.background?.visible&&s.background.pdf).map(s=>s.background.pdf.sourceId))){
  const source=project.pdfSources?.[sourceId];if(!source)throw Error('元PDFがありません');const input=await PDFDocument.load(Uint8Array.from(atob(source),c=>c.charCodeAt(0)),{updateMetadata:false});
  const indexes=[...new Set(project.screens.filter(s=>s.background?.visible&&s.background.pdf?.sourceId===sourceId).map(s=>s.background.pdf.pageNumber-1))],pages=indexes.map(i=>{if(i<0||i>=input.getPageCount())throw Error('元PDFのページ番号が正しくありません');return input.getPage(i)});
  const flattened=await flattenSourceForms(input,pages,{fontBytes:sourceFontBytes,fontkit:alignedFontkit});flattenedForms+=flattened.fields;
  for(const p of pages)p.node.delete(PDFName.of('Annots'));
  for(const p of pages)if(!p.node.Contents())p.pushOperators(pushGraphicsState(),popGraphicsState());
  const nativeIndexes=pages.map((_,i)=>i).filter(i=>!flattened.fallback.has(i)),nativePages=nativeIndexes.map(i=>pages[i]),boxes=nativePages.map(p=>{const b=p.getCropBox();return {left:b.x,bottom:b.y,right:b.x+b.width,top:b.y+b.height}}),forms=await doc.embedPages(nativePages,boxes),copier=PDFObjectCopier.for(input.context,doc.context),formByIndex=new Map(nativeIndexes.map((index,j)=>[index,forms[j]]));
  for(let i=0;i<pages.length;i++){const form=formByIndex.get(i);if(form){await form.embed();const stream=doc.context.lookup(form.ref,PDFRawStream),group=pages[i].node.get(PDFName.of('Group'));stream.dict.set(PDFName.of('Group'),group?copier.copy(group):doc.context.obj({S:'Transparency',I:true,CS:'DeviceRGB'}))}embedded.set(sourceId+':'+(indexes[i]+1),{form,crop:pages[i].getCropBox(),rotation:pages[i].getRotation().angle,annotationCopier:copier,input,sourceId,pageNumber:indexes[i]+1,annotations:flattened.annotations[i],fallback:flattened.fallback.has(i)})}
 }
 const [mmW,mmH]=paperMM||[project.width*25.4/96,project.height*25.4/96],pw=mmW*72/25.4,ph=mmH*72/25.4;
 let rasterized=0,editableAnnotations=0,flattenedObjects=0;const annotationJobs=[],targets=new Map();
 for(let i=0;i<prepared.length;i++){
  onProgress?.(i+1,prepared.length);const sc=project.screens[i],box=pageBox(project,sc),[pageW,pageH]=box.points||((sc.canvasWidth&&[sc.canvasWidth,sc.canvasHeight].some((v,j)=>v!==[project.width,project.height][j]))?[box.width*.75,box.height*.75]:[pw,ph]),sourceItem=sc.background?.visible&&sc.background.pdf?embedded.get(sc.background.pdf.sourceId+':'+sc.background.pdf.pageNumber):null,angle=sourceItem?((sourceItem.rotation%360)+360)%360:0,mediaW=angle%180?pageH:pageW,mediaH=angle%180?pageW:pageH,page=doc.addPage([mediaW,mediaH]);if(angle)page.setRotation(degrees(angle));if(sourceItem){const key=sourceItem.sourceId+':'+sourceItem.pageNumber;if(!targets.has(key))targets.set(key,{page,crop:sourceItem.crop});if(sourceItem.annotations.length)annotationJobs.push({...sourceItem,items:sourceItem.fallback?sourceItem.annotations.filter(a=>a.dict.get(PDFName.of('Subtype'))?.toString()==='/Link'):sourceItem.annotations,page})}page.drawRectangle({x:0,y:0,width:mediaW,height:mediaH,color:rgb(1,1,1)});page.pushOperators(pushGraphicsState(),concatTransformationMatrix(...inversePageRotation(angle,mediaW,mediaH)),concatTransformationMatrix(pageW/box.width,0,0,pageH/box.height,-box.x*pageW/box.width,box.y*pageH/box.height));clipBox(page,box.x,-box.y,box.width,box.height);
  const bg=sc.background;if(bg?.visible){if(bg.pdf){const item=embedded.get(bg.pdf.sourceId+':'+bg.pdf.pageNumber);if(item.fallback){if(!renderBackground)throw Error('フォームの表示固定処理を使用できません');const image=await imageFor(await renderBackground(project.pdfSources[bg.pdf.sourceId],bg.pdf.pageNumber,bg.pdf));const fit=Math.min(bg.w/bg.pdf.pageWidth,bg.h/bg.pdf.pageHeight),w=bg.pdf.pageWidth*fit,h=bg.pdf.pageHeight*fit;page.drawImage(image,{x:bg.x+(bg.w-w)/2,y:box.height-bg.y-(bg.h-h)/2-h,width:w,height:h,opacity:bg.opacity});backgroundFallbacks++}else page.drawPage(item.form,backgroundPlacement(bg,bg.pdf,item.crop,item.rotation,box.height))}else{const image=await imageFor(bg.src);const fit=Math.min(bg.w/image.width,bg.h/image.height),w=image.width*fit,h=image.height*fit;page.drawImage(image,{x:bg.x+(bg.w-w)/2,y:box.height-bg.y-(bg.h-h)/2-h,width:w,height:h,opacity:bg.opacity})}}
  for(let j=0;j<prepared[i].elements.length;j++){
   const e=prepared[i].elements[j],original=sc.elements[j],parts=mode==='editable'&&original?annotationParts(original,e):[];
   if(!parts.length){await drawElement(page,e,box);if(mode==='editable')flattenedObjects++;continue}
   const transform=annotationTransform(box,pageW,pageH,angle);
   for(const part of parts){const rect=annotationBounds(part.original,transform,mediaW,mediaH);if(!rect)continue;
    const temp=doc.addPage([mediaW,mediaH]);temp.pushOperators(pushGraphicsState(),concatTransformationMatrix(...inversePageRotation(angle,mediaW,mediaH)),concatTransformationMatrix(pageW/box.width,0,0,pageH/box.height,-box.x*pageW/box.width,box.y*pageH/box.height));clipBox(temp,box.x,-box.y,box.width,box.height);await drawElement(temp,part.prepared,box);temp.pushOperators(popGraphicsState(),popGraphicsState());
    const appearance=await doc.embedPage(temp,{left:rect[0],bottom:rect[1],right:rect[2],top:rect[3]});await appearance.embed();doc.removePage(doc.getPageCount()-1);doc.context.delete(temp.ref);addEditableAnnotation({doc,page,...part,transform,rect,appearance,index:++editableAnnotations,font});
   }
  }
  page.pushOperators(popGraphicsState(),popGraphicsState());
 }
 async function drawElement(page,e,box){
   const bottom=box.height-e.y-e.h;
   if(e.paths){page.pushOperators(pushGraphicsState(),setLineJoin(LineJoinStyle.Round));for(const path of e.paths){const fill=path.fill?.[3]>0?color(path.fill):undefined,stroke=path.stroke?.[3]>0&&path.width>0?color(path.stroke):undefined;if(fill||stroke)page.drawSvgPath(path.d,{x:e.x,y:box.height-e.y,scale:1,color:fill,borderColor:stroke,borderWidth:stroke?path.width:0,opacity:path.fill?.[3]??1,borderOpacity:(path.stroke?.[3]??1)*path.strokeOpacity,borderLineCap:LineCapStyle.Round})}page.pushOperators(popGraphicsState())}
   if(e.image){clipBox(page,e.x,bottom,e.w,e.h);const image=await imageFor(e.image),fit=e.cover?Math.max(e.w/image.width,e.h/image.height):1,w=e.cover?image.width*fit:e.w,h=e.cover?image.height*fit:e.h;page.drawImage(image,{x:e.x+(e.w-w)/2,y:bottom+(e.h-h)/2,width:w,height:h});page.pushOperators(popGraphicsState());if(e.rasterized)rasterized++}
   if(e.textRuns?.length){clipBox(page,e.x,bottom,e.w,e.h);for(const run of e.textRuns){const p=textRunPlacement(run,font,metrics);page.pushOperators(pushGraphicsState(),concatTransformationMatrix(p.sx,0,0,p.sy,p.x,box.height+p.y));page.drawText(run.text,{x:0,y:0,font,size:run.size,color:color(run.color),opacity:run.color[3]});page.pushOperators(popGraphicsState())}page.pushOperators(popGraphicsState())}
 }
 for(const job of annotationJobs){const result=preserveAnnotations(job,targets);preservedAnnotations+=result.count;omittedLinks+=result.omittedLinks}
 return {bytes:await doc.save({useObjectStreams:false}),rasterized,flattenedForms,backgroundFallbacks,preservedAnnotations,omittedLinks,editableAnnotations,flattenedObjects};
}
async function embedImage(doc,src){if(/^data:image\/jpe?g;/i.test(src))return doc.embedJpg(src);return doc.embedPng(src)}
