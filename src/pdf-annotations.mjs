import {PDFName,PDFArray,PDFDict,PDFNumber,PDFRef,PDFString,PDFHexString,PDFObjectCopier} from 'pdf-lib';
const name=s=>PDFName.of(s),subtype=a=>a.lookupMaybe(name('Subtype'),PDFName)?.decodeText();
export function pageAnnotations(page){const list=page.node.Annots();if(!list)return [];return list.asArray().map(ref=>({ref,dict:page.doc.context.lookup(ref)})).filter(item=>item.dict instanceof PDFDict)}
export async function flattenSourceForms(input,pages,{fontBytes,fontkit}={}){
 const original=pages.map(page=>pageAnnotations(page));let fields=0,fallback=new Set();
 const acro=input.catalog.lookupMaybe(name('AcroForm'),PDFDict);
 if(acro){try{if(acro.has(name('XFA')))throw Error('XFA');const form=input.getForm(),all=form.getFields();fields=all.length;
   const needs=acro.lookupMaybe(name('NeedAppearances'))?.toString()==='true';if(needs)all.forEach(field=>form.markFieldAsDirty(field.ref));
   if(all.some(field=>field.needsAppearancesUpdate())){let font;if(fontBytes){input.registerFontkit(fontkit);font=await input.embedFont(await fontBytes(),{subset:true})}form.updateFieldAppearances(font)}
   form.flatten({updateFieldAppearances:false});await input.flush();
  }catch{fallback=new Set(pages.map((_,i)=>i))}
 }
 pages.forEach((page,i)=>{const annots=page.node.Annots();if(annots)for(let j=annots.size()-1;j>=0;j--)if(!(input.context.lookup(annots.get(j)) instanceof PDFDict))annots.remove(j);if(pageAnnotations(page).some(a=>subtype(a.dict)==='Widget'))fallback.add(i)});
 return {fields,fallback,annotations:original.map(items=>items.filter(a=>subtype(a.dict)!=='Widget'))};
}
function numbers(array){return array?.asArray().map(n=>n instanceof PDFNumber?n.asNumber():null)}
function shiftedArray(context,array,dx,dy){const values=numbers(array);if(!values||values.some(n=>n===null)||values.length%2)return null;return context.obj(values.map((n,i)=>n-(i%2?dy:dx)))}
function namedDestination(input,value){const target=value instanceof PDFName?value.decodeText():value instanceof PDFString||value instanceof PDFHexString?value.decodeText():null;if(target===null)return null;
 const dests=input.catalog.lookupMaybe(name('Dests'),PDFDict);let result=dests?.get(name(target));
 const tree=input.catalog.lookupMaybe(name('Names'),PDFDict)?.lookupMaybe(name('Dests'),PDFDict);
 const visit=node=>{const pairs=node.lookupMaybe(name('Names'),PDFArray);if(pairs)for(let i=0;i+1<pairs.size();i+=2){const key=pairs.lookup(i);if((key instanceof PDFString||key instanceof PDFHexString)&&key.decodeText()===target)return pairs.get(i+1)}const kids=node.lookupMaybe(name('Kids'),PDFArray);if(kids)for(const k of kids.asArray()){const hit=visit(input.context.lookup(k,PDFDict));if(hit)return hit}return null};
 result??=tree?visit(tree):null;return result?input.context.lookup(result):null;
}
function remapDestination(input,value,sourceId,targets){
 let dest=input.context.lookup(value);if(!(dest instanceof PDFArray))dest=namedDestination(input,dest);if(dest instanceof PDFDict)dest=dest.lookup(name('D'));if(!(dest instanceof PDFArray)||dest.size()<2)return null;
 const first=dest.get(0),index=first instanceof PDFNumber?first.asNumber():input.getPages().findIndex(p=>p.ref.toString()===first?.toString()),target=targets.get(sourceId+':'+(index+1));if(!target)return null;
 const values=dest.asArray().slice(1).map(v=>v.clone(target.page.doc.context)),kind=dest.lookup(1,PDFName).decodeText();
 if(kind==='XYZ'){if(values[1] instanceof PDFNumber)values[1]=PDFNumber.of(values[1].asNumber()-target.crop.x);if(values[2] instanceof PDFNumber)values[2]=PDFNumber.of(values[2].asNumber()-target.crop.y)}
 else if(kind==='FitR')for(let i=1;i<5;i++)if(values[i] instanceof PDFNumber)values[i]=PDFNumber.of(values[i].asNumber()-(i%2?target.crop.x:target.crop.y));
 else if(['FitH','FitBH'].includes(kind)&&values[1] instanceof PDFNumber)values[1]=PDFNumber.of(values[1].asNumber()-target.crop.y);
 else if(['FitV','FitBV'].includes(kind)&&values[1] instanceof PDFNumber)values[1]=PDFNumber.of(values[1].asNumber()-target.crop.x);
 return target.page.doc.context.obj([target.page.ref,...values]);
}
// Annotation geometry remains in the source's native coordinates. The output page
// retains /Rotate, while the drawing content receives its inverse transform.
export function preserveAnnotations({input,items,sourceId,crop,page,annotationCopier},targets){
 const copier=annotationCopier||PDFObjectCopier.for(input.context,page.doc.context),context=page.doc.context,pairs=[],refs=new Map();let omittedLinks=0;
 for(const {ref,dict}of items){const copied=PDFDict.withContext(context);
  for(const [key,value]of dict.entries()){const k=key.decodeText();if(['P','Parent','Popup','IRT','Dest','A','AA','StructParent'].includes(k))continue;
   if(['Rect','QuadPoints','Vertices','L','CL'].includes(k)&&input.context.lookup(value) instanceof PDFArray){const shifted=shiftedArray(context,input.context.lookup(value,PDFArray),crop.x,crop.y);if(shifted)copied.set(key,shifted);continue}
   if(k==='InkList'){const strokes=input.context.lookup(value,PDFArray);copied.set(key,context.obj(strokes.asArray().map(v=>shiftedArray(context,input.context.lookup(v,PDFArray),crop.x,crop.y))));continue}
   copied.set(key,copier.copy(value));
  }
  copied.set(name('P'),page.ref);
  const dest=dict.get(name('Dest')),action=dict.lookupMaybe(name('A'),PDFDict);
  if(dest){const mapped=remapDestination(input,dest,sourceId,targets);if(mapped)copied.set(name('Dest'),mapped);else omittedLinks++}
  if(action){const type=action.lookupMaybe(name('S'),PDFName)?.decodeText();if(type==='URI'){const uri=action.get(name('URI'));if(uri)copied.set(name('A'),context.obj({S:'URI',URI:copier.copy(uri)}));else omittedLinks++}else if(type==='GoTo'){const mapped=remapDestination(input,action.get(name('D')),sourceId,targets);if(mapped)copied.set(name('A'),context.obj({S:'GoTo',D:mapped}));else omittedLinks++}else omittedLinks++}
  const newRef=context.register(copied);refs.set(ref.toString(),newRef);pairs.push({dict,copied});page.node.addAnnot(newRef);
 }
 for(const {dict,copied}of pairs)for(const key of ['Parent','Popup','IRT']){const original=dict.get(name(key));if(original&&refs.has(original.toString()))copied.set(name(key),refs.get(original.toString()))}
 return {count:pairs.length,omittedLinks};
}
export function inversePageRotation(angle,w,h){return angle===90?[0,1,-1,0,w,0]:angle===180?[-1,0,0,-1,w,h]:angle===270?[0,-1,1,0,0,h]:[1,0,0,1,0,0]}
