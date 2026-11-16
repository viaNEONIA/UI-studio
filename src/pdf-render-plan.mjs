// All dimensions are canvas CSS pixels except PDF pageWidth/pageHeight (PDF points).
export function planPDFRegion(meta, background, bounds, pixelRatio=1, limits={}) {
 const {pageWidth:pw,pageHeight:ph}=meta, b=background;
 if([pw,ph,b.w,b.h,bounds.width,bounds.height,pixelRatio].some(n=>!Number.isFinite(n)||n<=0))return null;
 const fit=Math.min(b.w/pw,b.h/ph),fullWidth=pw*fit,fullHeight=ph*fit;
 const pageX=b.x+(b.w-fullWidth)/2,pageY=b.y+(b.h-fullHeight)/2;
 const left=Math.max(pageX,bounds.x),top=Math.max(pageY,bounds.y),right=Math.min(pageX+fullWidth,bounds.x+bounds.width),bottom=Math.min(pageY+fullHeight,bounds.y+bounds.height);
 if(right<=left||bottom<=top)return null;
 const width=right-left,height=bottom-top,maxEdge=limits.maxEdge??8192,maxPixels=limits.maxPixels??8388608;
 let ratio=Math.min(pixelRatio,maxEdge/width,maxEdge/height,Math.sqrt(maxPixels/(width*height)));
 let pixelWidth=Math.max(1,Math.ceil(width*ratio)),pixelHeight=Math.max(1,Math.ceil(height*ratio));
 if(pixelWidth*pixelHeight>maxPixels){ratio*=Math.sqrt(maxPixels/(pixelWidth*pixelHeight))*.9999;pixelWidth=Math.max(1,Math.ceil(width*ratio));pixelHeight=Math.max(1,Math.ceil(height*ratio))}
 return {left,top,width,height,fullWidth,fullHeight,cropX:left-pageX,cropY:top-pageY,pixelRatio:ratio,pixelWidth,pixelHeight,scale:fit*ratio,limited:ratio<pixelRatio*.999};
}
