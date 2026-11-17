import {planPDFRegion} from './pdf-render-plan.mjs';

export function containsPDFRegion(outer,inner,minRatio=inner?.pixelRatio??0){
 if(!outer||!inner)return false;
 const epsilon=.01;
 return outer.left<=inner.left+epsilon&&outer.top<=inner.top+epsilon&&outer.left+outer.width>=inner.left+inner.width-epsilon&&outer.top+outer.height>=inner.top+inner.height-epsilon&&outer.pixelRatio>=minRatio*.999;
}

// Keep a screen-sized margin, but do not trade visible resolution for overscan.
export function planPDFPreview(meta,background,bounds,ratio,zoom=1){
 const visible=planPDFRegion(meta,background,bounds,ratio);if(!visible)return null;
 const pad=192/Math.max(.001,zoom),expanded={x:bounds.x-pad,y:bounds.y-pad,width:bounds.width+2*pad,height:bounds.height+2*pad};
 const buffered=planPDFRegion(meta,background,expanded,ratio);
 return {visible,render:buffered&&buffered.pixelRatio>=visible.pixelRatio*.999?buffered:visible};
}

export class PDFPreviewCache{
 constructor({maxPixels=8388608,maxEntries=2}={}){this.maxPixels=maxPixels;this.maxEntries=maxEntries;this.entries=[]}
 compatible(context){return this.entries.filter(e=>e.key===context.key&&e.source===context.source)}
 touch(entry){this.entries=this.entries.filter(e=>e!==entry);this.entries.unshift(entry);return entry}
 put(entry){this.touch(entry);while(this.entries.length>this.maxEntries||this.pixels>this.maxPixels)this.dispose(this.entries.at(-1));return entry}
 get pixels(){return this.entries.reduce((n,e)=>n+e.canvas.width*e.canvas.height,0)}
 retain(predicate){for(const e of [...this.entries])if(!predicate(e))this.dispose(e)}
 dispose(entry){if(!entry)return;this.entries=this.entries.filter(e=>e!==entry);entry.canvas.remove();entry.canvas.width=entry.canvas.height=0}
 clear(){this.retain(()=>false)}
}
