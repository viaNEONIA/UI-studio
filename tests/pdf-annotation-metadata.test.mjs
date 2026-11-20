import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PDFDocument,PDFName,PDFDict,PDFString,PDFHexString} from 'pdf-lib';
import {composeVectorPDF} from '../src/pdf-vector-core.mjs';
const N=PDFName.of,fontBytes=gunzipSync(readFileSync(new URL('../assets/KaigiNoteSansJP.ttf.gz',import.meta.url))),createdAt='2026-11-17T01:02:03Z',updatedAt='2026-11-18T04:05:06Z',exportedAt=new Date('2026-11-18T07:08:09Z');
const object={id:'a',type:'text',name:'指示',x:20,y:30,w:300,h:180,text:'会議',font:18,bg:'#ffffff',color:'#000000',radius:0,pdfComment:'確認',createdAt,updatedAt,strokeWidth:2,callout:{box:[.4,0,.6,.4],points:[[0,1],[.3,.2],[.4,.2]]}};
const prepared=e=>[{elements:[{...e,paths:[{d:'M 0 180 L 90 36 L 120 36',stroke:[255,0,0,1],fill:[255,255,255,1],width:2,strokeOpacity:1}],textRuns:[{text:e.text,x:150,baseline:70,size:18,color:[0,0,0,1]}]}]}];
const project=e=>({width:400,height:500,pdfOptions:{author:'施工担当 山田'},screens:[{elements:[e]}]});
for(const mode of ['normal','editable'])test(mode+' PDF document and added annotations record author and valid dates',async()=>{
 const result=await composeVectorPDF(project(object),prepared(object),{fontBytes,mode,exportedAt}),doc=await PDFDocument.load(result.bytes,{updateMetadata:false});assert.equal(doc.getAuthor(),'施工担当 山田');assert.equal(doc.getModificationDate().toISOString(),exportedAt.toISOString());
 const annotations=doc.getPage(0).node.Annots()?.asArray()||[];assert.equal(annotations.length,mode==='editable'?2:0);
 for(const ref of annotations){const a=doc.context.lookup(ref,PDFDict);assert.equal(a.lookup(N('T')).decodeText(),'施工担当 山田');assert.equal(a.lookup(N('CreationDate')).decodeText(),PDFString.fromDate(new Date(createdAt)).decodeText());assert.equal(a.lookup(N('M')).decodeText(),PDFString.fromDate(new Date(updatedAt)).decodeText())}
 if(mode==='editable'){const a=doc.context.lookup(annotations[0],PDFDict);assert.equal(a.lookup(N('IT')).decodeText(),'FreeTextCallout');assert.equal(a.lookup(N('CL')).size(),6);assert.equal(a.lookup(N('RD')).size(),4);assert.equal(a.lookup(N('LE')).decodeText(),'OpenArrow');assert.ok(a.lookup(N('RD')).asArray().every(v=>v.asNumber()>=0));assert.deepEqual(a.lookup(N('C')).asArray().map(v=>v.asNumber()),[1,1,1]);assert.ok(a.lookup(N('DA')).decodeText().includes('1 0 0 rg'));assert.match(a.lookup(N('DS')).decodeText(),/color:#000000/);assert.match(a.lookup(N('RC')).decodeText(),/会議/)}
});
test('legacy annotation dates fall back to export time and blank author is retained',async()=>{
 const e={...object,createdAt:undefined,updatedAt:'invalid'},result=await composeVectorPDF(project(e),prepared(e),{fontBytes,mode:'editable',exportedAt,author:''}),doc=await PDFDocument.load(result.bytes,{updateMetadata:false});assert.equal(doc.getAuthor(),'');for(const ref of doc.getPage(0).node.Annots().asArray()){const a=doc.context.lookup(ref,PDFDict);assert.equal(a.lookup(N('T')).decodeText(),'');assert.equal(a.lookup(N('M')).decodeText(),PDFString.fromDate(exportedAt).decodeText())}
});
test('source PDF authors and timestamps survive when the output author is changed',async()=>{
 const source=await PDFDocument.create(),p=source.addPage([400,500]);p.node.set(N('Annots'),source.context.obj([source.context.register(source.context.obj({Type:'Annot',Subtype:'Text',Rect:[20,30,40,50],T:PDFHexString.fromText('元の担当者'),M:PDFString.fromDate(new Date(createdAt)),Contents:PDFHexString.fromText('元のコメント')}))]));const note={width:400,height:500,pdfOptions:{author:'新しい担当者'},pdfSources:{a:Buffer.from(await source.save()).toString('base64')},screens:[{elements:[],background:{visible:true,x:0,y:0,w:400,h:500,opacity:1,pdf:{sourceId:'a',pageNumber:1,pageWidth:400,pageHeight:500}}}]};const result=await composeVectorPDF(note,[{elements:[]}],{exportedAt}),doc=await PDFDocument.load(result.bytes,{updateMetadata:false}),a=doc.context.lookup(doc.getPage(0).node.Annots().get(0),PDFDict);assert.equal(a.lookup(N('T')).decodeText(),'元の担当者');assert.equal(a.lookup(N('M')).decodeText(),PDFString.fromDate(new Date(createdAt)).decodeText());
});
