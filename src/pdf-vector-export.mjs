import {composeVectorPDF} from './pdf-vector-core.mjs';
import fontData from 'pdf-vector-font';
let fontBytes,fontReady;
async function bytes(){return fontBytes??=(async()=>{const compressed=Uint8Array.from(atob(fontData),c=>c.charCodeAt(0));return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())})()}
async function font(){if(!fontReady){fontReady=(async()=>{const face=new FontFace('KaigiNotePDF',await bytes());await face.load();document.fonts.add(face)})();fontReady.catch(()=>{fontReady=null})}await fontReady}
function rgba(value){if(!value||value==='none'||value==='transparent')return [0,0,0,0];const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const p=[...ctx.getImageData(0,0,1,1).data];p[3]/=255;return p}
export async function exportVectorPDF(project,{makeNode,raster,paperMM,onProgress}){
 for(const sc of project.screens)for(const e of sc.elements){if(e.type==='html')throw Error('HTML部品を含むページのPDF出力には未対応です。HTMLまたはJSONで保存してください');if(e.css?.trim())throw Error('追加CSSがある部品はベクターPDFに対応していません: '+(e.name||e.type));if(e.type==='image'&&/^https?:/i.test(e.text))throw Error('PDF出力では外部画像URLを使用できません。背景画像として取り込んでください')}
 const hasText=project.screens.some(sc=>sc.elements.some(e=>['text','box','circle','triangle'].includes(e.type)&&e.text));if(hasText)await font();await document.fonts.ready;
 const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;z-index:-100;pointer-events:none;font-family:KaigiNotePDF;line-height:normal;font-kerning:none;font-variant-ligatures:none;';host.className='export-page';host.style.width=project.width+'px';host.style.height=project.height+'px';document.body.append(host);
 const prepared=[];
 try{
  for(const sc of project.screens){const elements=[];for(const e of sc.elements){const node=makeNode(e);host.append(node);const out={x:e.x,y:e.y,w:e.w,h:e.h};try{
   if(['text','box','circle','triangle','line','arrow','polyline','curve'].includes(e.type)){
    out.paths=[...node.querySelectorAll('svg path')].map(path=>{const g=path.closest('g');return {d:path.getAttribute('d'),fill:rgba(g?.getAttribute('fill')),stroke:rgba(g?.getAttribute('stroke')),width:Number(g?.getAttribute('stroke-width')??0),strokeOpacity:Number(g?.getAttribute('stroke-opacity')??1)}});
    if(e.type==='text'){const fill=rgba(getComputedStyle(node).backgroundColor),r=Math.max(0,Math.min(e.radius,e.w/2,e.h/2));if(fill[3])out.paths.unshift({d:`M ${r} 0 H ${e.w-r} Q ${e.w} 0 ${e.w} ${r} V ${e.h-r} Q ${e.w} ${e.h} ${e.w-r} ${e.h} H ${r} Q 0 ${e.h} 0 ${e.h-r} V ${r} Q 0 0 ${r} 0 Z`,fill,stroke:[0,0,0,0],width:0,strokeOpacity:1})}
    if(e.text&&['text','box','circle','triangle'].includes(e.type)){
     const textNode=node.querySelector(':scope > div > div')?.firstChild;if(textNode?.nodeType===Node.TEXT_NODE){
      const range=document.createRange(),rect=host.getBoundingClientRect(),ctx=document.createElement('canvas').getContext('2d');ctx.font=e.font+'px KaigiNotePDF';const metrics=ctx.measureText('国Ag'),ascent=metrics.fontBoundingBoxAscent??e.font*.88;out.textRuns=[];
      for(const segment of new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(textNode.textContent)){
       if(/[\r\n\t]/.test(segment.segment))continue;range.setStart(textNode,segment.index);range.setEnd(textNode,segment.index+segment.segment.length);const r=range.getBoundingClientRect();out.textRuns.push({text:segment.segment,x:r.left-rect.left,baseline:r.top-rect.top+ascent,size:e.font,color:rgba(e.color)})
      }
     }
    }
   }else if(e.type==='image'&&/^data:image\/(png|jpeg|jpg);/i.test(e.text)){out.image=e.text;out.cover=true}
   else{
    const tile=document.createElement('div');tile.style.cssText=`position:fixed;left:0;top:0;width:${e.w}px;height:${e.h}px;background:transparent;font-family:system-ui;z-index:-100;`;node.style.left=node.style.top='0px';node.remove();tile.append(node);document.body.append(tile);try{out.image=await raster(tile,e.w,e.h,{transparent:true});out.rasterized=true}finally{tile.remove()}
   }
   elements.push(out);
  }finally{node.remove()}}
  prepared.push({elements})}
  const result=await composeVectorPDF(project,prepared,{fontBytes:hasText?await bytes():undefined,paperMM,onProgress});return {blob:new Blob([result.bytes],{type:'application/pdf'}),rasterized:result.rasterized};
 }catch(error){if(/cannot encode|glyph|font|subset/i.test(error.message))throw Error('PDF用フォントに含まれない文字・記号があるか、フォント処理に失敗しました。文字を変更してください: '+error.message);throw error}
 finally{host.remove()}
}
