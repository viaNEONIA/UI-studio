import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import kit from '@pdf-lib/fontkit';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {composeVectorPDF} from '../src/pdf-vector-core.mjs';
import {substituteText,substituteProject,replacementReport} from '../src/pdf-text-fallback.mjs';
import {captureBounds} from '../src/stamp-region.mjs';
const fontBytes=gunzipSync(readFileSync(new URL('../assets/KaigiNoteSansJP.ttf.gz',import.meta.url))),available=new Set(kit.create(fontBytes).characterSet);
test('fallback is embedded and entire emoji sequences are replaced once, preserving whitespace and source',()=>{
 const text='照明😀 家族👨‍👩‍👧‍👦\nA\tB',items=[];const result=substituteText(text,available,r=>items.push(r));assert.equal(result,'照明〓 家族〓\nA\tB');assert.equal(items.length,2);assert.match(items[1].unicode,/U\+200D/);assert.ok(available.has(0x3013));
 const p={screens:[{name:'照明',elements:[{id:'1',type:'text',text}]}]},before=structuredClone(p),out=substituteProject(p,available);assert.deepEqual(p,before);assert.equal(out.replacements[0].pageName,'照明');assert.match(replacementReport(out.replacements,'照明.pdf'),/対象PDF：照明.pdf/);
});
for(const mode of ['normal','editable'])test(mode+' substitutes before font embedding and keeps annotation contents searchable and consistent',async()=>{
 const e={id:'a',type:'text',name:'注記',text:'照明😀😀',x:10,y:10,w:240,h:90,font:20},project={width:400,height:400,screens:[{name:'設備',elements:[e]}]},prepared=[{elements:[{...e,textRuns:[{text:e.text,x:10,baseline:40,size:20,color:[0,0,0,1]}]}]}],before=structuredClone({project,prepared});
 const result=await composeVectorPDF(project,prepared,{fontBytes,mode});assert.equal(result.replacements.length,2);assert.deepEqual({project,prepared},before);const doc=await PDFDocument.load(result.bytes);if(mode==='editable'){const annot=doc.context.lookup(doc.getPage(0).node.Annots().get(0),PDFDict);assert.equal(annot.lookup(PDFName.of('Contents')).decodeText(),'照明〓〓')}
});
test('crop clamps to canvas, supports reverse drag, rejects empty and nonfinite regions',()=>{assert.deepEqual(captureBounds([120,140],[-20,10],100,100),{x:0,y:10,w:100,h:90});assert.throws(()=>captureBounds([1,1],[1,10],100,100));assert.throws(()=>captureBounds([NaN,1],[10,10],100,100))});
test('font processing errors do not become replacement reports',()=>{assert.throws(()=>substituteText('😀',new Set([65])),/代替記号/)});
