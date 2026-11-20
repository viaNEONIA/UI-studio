import {renderPDFRegion,planPDFRegion} from './pdf-background.mjs';
export {captureBounds} from './stamp-region.mjs';
export async function captureStamp(project,sc,region,{makeNode,backgroundHTML,raster}){
 const {x,y,w,h}=region,scale=Math.min(2,1024/w,1024/h),host=document.createElement('div');host.className='export-page';host.style.cssText=`position:fixed;left:0;top:0;z-index:-100;pointer-events:none;overflow:hidden;width:${w}px;height:${h}px;background:transparent;color:#172235;`;
 const typography=getComputedStyle(document.getElementById('device'));for(const key of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing'])host.style[key]=typography[key];
 const layer=document.createElement('div');layer.style.cssText=`position:absolute;left:${-x}px;top:${-y}px;width:${sc.canvasWidth||project.width}px;height:${sc.canvasHeight||project.height}px`;host.append(layer);document.body.append(host);
 try{
  await document.fonts.ready;
  // Only model objects are rendered: no selection, guides, handles or cursor UI.
  for(const e of sc.elements)layer.append(makeNode(e));
  const foreground=await raster(host,w,h,{transparent:true,scale});
  const bg=document.createElement('div');bg.innerHTML=backgroundHTML(sc);layer.prepend(bg);
  const b=sc.background;
  if(b?.visible&&b.pdf){const plan=planPDFRegion(b.pdf,b,{x,y,width:w,height:h},scale);if(plan){const canvas=document.createElement('canvas');await renderPDFRegion(project.pdfSources[b.pdf.sourceId],b.pdf.pageNumber,plan,canvas);const img=bg.querySelector('img');img.src=canvas.toDataURL('image/png');Object.assign(img.style,{left:plan.left+'px',top:plan.top+'px',width:plan.width+'px',height:plan.height+'px'});canvas.width=canvas.height=0}}
  const withBackground=await raster(host,w,h,{scale});return {foreground,withBackground,w:Math.max(1,Math.round(w*scale)),h:Math.max(1,Math.round(h*scale))};
 }finally{host.remove()}
}
