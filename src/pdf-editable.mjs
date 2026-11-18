import {PDFName,PDFHexString,PDFString} from 'pdf-lib';
import {polygonPoints} from './shape-gestures.mjs';
const N=PDFName.of;
export const editableTypes=new Set(['text','box','circle','triangle','line','arrow','polyline','curve']);
export function annotationParts(original,prepared){
 if(!editableTypes.has(original.type))return [];
 if(['box','circle','triangle'].includes(original.type))return [{original,prepared:{...prepared,textRuns:undefined}},...(prepared.textRuns?.length?[{original:{...original,type:'text',pdfComment:''},prepared:{...prepared,paths:[]}}]:[])];
 return [{original,prepared}];
}
export function annotationTransform(box,pageW,pageH,rotation){
 const sx=pageW/box.width,sy=pageH/box.height;
 return {scale:Math.sqrt(sx*sy),point(x,y){const a=(x-box.x)*sx,b=(box.height-y+box.y)*sy;return rotation===90?[pageH-b,a]:rotation===180?[pageW-a,pageH-b]:rotation===270?[b,pageW-a]:[a,b]}};
}
export function annotationBounds(e,transform,mediaW,mediaH){
 const pad=['line','arrow','polyline','curve'].includes(e.type)?Math.max(24,(e.strokeWidth||3)*2):1;
 const points=[[e.x-pad,e.y-pad],[e.x+e.w+pad,e.y-pad],[e.x+e.w+pad,e.y+e.h+pad],[e.x-pad,e.y+e.h+pad]].map(p=>transform.point(...p)),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const rect=[Math.max(0,Math.min(...xs)),Math.max(0,Math.min(...ys)),Math.min(mediaW,Math.max(...xs)),Math.min(mediaH,Math.max(...ys))];return rect[2]>rect[0]&&rect[3]>rect[1]?rect:null;
}
function curvePoints(points){if(points.length<3)return points;const result=[points[0]];let start=points[0];for(let i=1;i<points.length-1;i++){const c=points[i],end=[(c[0]+points[i+1][0])/2,(c[1]+points[i+1][1])/2];for(let j=1;j<=12;j++){const t=j/12,u=1-t;result.push([u*u*start[0]+2*u*t*c[0]+t*t*end[0],u*u*start[1]+2*u*t*c[1]+t*t*end[1]])}start=end}result.push(points.at(-1));return result}
const cap=kind=>kind==='arrow'?'OpenArrow':kind==='circle'?'Circle':'None';
export function addEditableAnnotation({doc,page,original:e,prepared,transform,rect,appearance,index,font,author='会議ノート',exportedAt=new Date()}){
 const context=doc.context,points=(e.points||[[0,0],[1,1]]).map(([x,y])=>[e.x+x*e.w,e.y+y*e.h]),flat=pts=>pts.flatMap(p=>transform.point(...p)),stroke=prepared.paths?.find(p=>p.stroke?.[3]>0)?.stroke||[0,0,0],fill=prepared.paths?.find(p=>p.fill?.[3]>0)?.fill;
 let subtype=e.type==='text'?'FreeText':e.type==='circle'?'Circle':['line','arrow'].includes(e.type)?'Line':e.type==='polyline'&&!e.inkTool?'PolyLine':['polyline','curve'].includes(e.type)?'Ink':e.type==='box'&&!e.corners?'Square':'Polygon';
 const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d:exportedAt},metadata={T:PDFHexString.fromText(author),CreationDate:PDFString.fromDate(date(e.createdAt)),M:PDFString.fromDate(date(e.updatedAt||e.createdAt))};
 const dict=context.obj({...metadata,Type:'Annot',Subtype:subtype,Rect:rect,P:page.ref,F:4,NM:PDFString.of('kaigi-'+index),Subj:PDFHexString.fromText(e.name||e.type),Contents:PDFHexString.fromText(subtype==='FreeText'?e.text:(e.pdfComment||'')),AP:{N:appearance.ref},C:stroke.slice(0,3).map(v=>v/255),CA:1-(e.strokeTransparency||0)/100,BS:{W:(e.strokeWidth??0)*transform.scale,S:'S'},Border:[0,0,(e.strokeWidth??0)*transform.scale]});
 if(fill&&subtype!=='FreeText')dict.set(N('IC'),context.obj(fill.slice(0,3).map(v=>v/255)));
 if(subtype==='Line'){dict.set(N('L'),context.obj(flat([points[0],points.at(-1)])));dict.set(N('LE'),context.obj([N(cap(e.startCap)),N(cap(e.endCap??(e.type==='arrow'?'arrow':'none')))]))}
 if(subtype==='PolyLine')dict.set(N('Vertices'),context.obj(flat(points)));
 if(subtype==='Polygon')dict.set(N('Vertices'),context.obj(flat(polygonPoints(e))));
 if(subtype==='Ink')dict.set(N('InkList'),context.obj([flat(e.type==='curve'?curvePoints(points):points)]));
 if(subtype==='FreeText'){
  if(fill)dict.set(N('C'),context.obj(fill.slice(0,3).map(v=>v/255)));else dict.delete(N('C'));
  const color=prepared.textRuns?.[0]?.color||[0,0,0],fontSize=(e.font||16)*transform.scale,da='/KaigiNote '+fontSize+' Tf '+color.slice(0,3).map(v=>v/255).join(' ')+' rg';dict.set(N('DA'),PDFString.of(da));dict.set(N('Q'),context.obj({left:0,center:1,right:2}[e.textAlign||'left']));dict.set(N('BS'),context.obj({W:0,S:'S'}));dict.set(N('Border'),context.obj([0,0,0]));dict.set(N('Rotate'),context.obj(((page.getRotation().angle||0)%360+360)%360));const fontRef=font?.ref||context.register(context.obj({Type:'Font',Subtype:'Type1',BaseFont:'Helvetica',Encoding:'WinAnsiEncoding'}));dict.set(N('DR'),context.obj({Font:{KaigiNote:fontRef}}));page.node.setFontDictionary(N('KaigiNote'),fontRef)
 }
 if(subtype==='FreeText'&&e.callout){const [x,y,w,h]=e.callout.box,corners=[[x,y],[x+w,y+h],[x+w,y],[x,y+h]].map(([a,b])=>transform.point(e.x+a*e.w,e.y+b*e.h)),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);dict.set(N('IT'),N('FreeTextCallout'));dict.set(N('CL'),context.obj(flat(e.callout.points.map(([a,b])=>[e.x+a*e.w,e.y+b*e.h]))));dict.set(N('RD'),context.obj([Math.max(0,Math.min(...xs)-rect[0]),Math.max(0,Math.min(...ys)-rect[1]),Math.max(0,rect[2]-Math.max(...xs)),Math.max(0,rect[3]-Math.max(...ys))]));dict.set(N('LE'),N('OpenArrow'));dict.set(N('BS'),context.obj({W:(e.strokeWidth??2)*transform.scale,S:'S'}));dict.set(N('Border'),context.obj([0,0,(e.strokeWidth??2)*transform.scale]));if(fill)dict.set(N('C'),context.obj(fill.slice(0,3).map(v=>v/255)));else dict.delete(N('C'));dict.set(N('DA'),PDFString.of(dict.lookup(N('DA')).decodeText()+' '+stroke.slice(0,3).map(v=>v/255).join(' ')+' RG'));}
 const ref=context.register(dict);page.node.addAnnot(ref);
 if(subtype==='FreeText'&&e.pdfComment){const empty=context.register(context.flateStream(new Uint8Array(),{Type:'XObject',Subtype:'Form',BBox:[0,0,16,16],Resources:{}})),reply=context.obj({...metadata,Type:'Annot',Subtype:'Text',P:page.ref,Rect:[rect[0],rect[1],rect[0]+16,rect[1]+16],F:4,AP:{N:empty},IRT:ref,RT:'R',Contents:PDFHexString.fromText(e.pdfComment),NM:PDFString.of('kaigi-'+index+'-comment'),Open:false});page.node.addAnnot(context.register(reply))}
 return ref;
}
