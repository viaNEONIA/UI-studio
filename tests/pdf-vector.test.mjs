import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName,rgb,degrees} from 'pdf-lib';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {composeVectorPDF,backgroundPlacement} from '../src/pdf-vector-core.mjs';
const base={version:1,width:794,height:1123,screens:[{id:'s',name:'test',elements:[]}]};
const fontBytes=gunzipSync(readFileSync(new URL('../assets/KaigiNoteSansJP.ttf.gz',import.meta.url)));
test('background placements handle all PDF quarter rotations and contain fit',()=>{
 const b={x:20,y:30,w:200,h:400,opacity:.4},crop={x:10,y:20,width:100,height:200};
 for(const rotation of [0,90,180,270]){const meta=rotation%180?{pageWidth:200,pageHeight:100}:{pageWidth:100,pageHeight:200};const p=backgroundPlacement(b,meta,crop,rotation,800);assert.equal(p.opacity,.4);assert.equal(p.rotate.angle,-rotation);assert.ok(p.x>=20&&p.y>=370);assert.equal(p.xScale,p.yScale)}
 assert.throws(()=>backgroundPlacement(b,{pageWidth:100,pageHeight:200},crop,45,800));
});
test('vector-only document contains paths and embedded searchable Japanese font without page bitmap',async()=>{
 const prepared=[{elements:[{x:30,y:40,w:200,h:80,paths:[{d:'M 0 0 L 200 80',fill:[0,0,0,0],stroke:[255,0,0,1],width:2,strokeOpacity:.5}],textRuns:[{text:'会議ノート ABC',x:40,baseline:80,size:20,color:[0,0,0,1]}]}]}];
 const {bytes}=await composeVectorPDF(base,prepared,{fontBytes,paperMM:[210,297]});const doc=await PDFDocument.load(bytes),page=doc.getPage(0);assert.ok(Math.abs(page.getWidth()-595.27559)<.01);const pdf=Buffer.from(bytes).toString('latin1');assert.match(pdf,/\/Subtype \/Type0/);assert.doesNotMatch(pdf,/\/Subtype \/Image/);mkdirSync('/tmp/kaigi-vector-qa',{recursive:true});writeFileSync('/tmp/kaigi-vector-qa/japanese.pdf',bytes);
});
test('embedded original pages retain vector content and rotated crop boxes',async()=>{
 const src=await PDFDocument.create(),p=src.addPage([500,600]);p.setCropBox(20,30,300,400);p.setRotation(degrees(90));p.drawRectangle({x:20,y:30,width:100,height:150,color:rgb(1,0,0)});p.drawLine({start:{x:100,y:150},end:{x:300,y:300},thickness:.2});const data=Buffer.from(await src.save()).toString('base64'),project=structuredClone(base);project.pdfSources={a:data};project.screens[0].background={src:'',x:0,y:0,w:794,h:595.5,opacity:.5,visible:true,pdf:{sourceId:'a',pageNumber:1,pageWidth:400,pageHeight:300}};
 const {bytes}=await composeVectorPDF(project,[{elements:[]}],{paperMM:[210,297]});assert.doesNotMatch(Buffer.from(bytes).toString('latin1'),/\/Subtype \/Image/);const out=await PDFDocument.load(bytes);assert.equal(out.getPageCount(),1);writeFileSync('/tmp/kaigi-vector-qa/rotated.pdf',bytes);
});
test('unsupported font glyphs fail instead of silently becoming missing boxes',async()=>{
 await assert.rejects(composeVectorPDF(base,[{elements:[{x:0,y:0,w:100,h:100,textRuns:[{text:'😀',x:0,baseline:20,size:16,color:[0,0,0,1]}]}]}],{fontBytes}),/glyph unavailable/);
});
test('source annotations are detected before producing an incomplete vector document',async()=>{
 const src=await PDFDocument.create(),page=src.addPage();page.node.set(PDFName.of('Annots'),src.context.obj([src.context.obj({Type:'Annot',Subtype:'Text',Rect:[0,0,10,10]})]));const project=structuredClone(base);project.pdfSources={a:Buffer.from(await src.save()).toString('base64')};project.screens[0].background={x:0,y:0,w:100,h:100,opacity:1,visible:true,pdf:{sourceId:'a',pageNumber:1,pageWidth:100,pageHeight:100}};await assert.rejects(composeVectorPDF(project,[{elements:[]}]),/注釈/);
});

test('measured glyph placement preserves editor ink bounds without using the embedded font to wrap',async()=>{
 const {textRunPlacement}=await import('../src/pdf-vector-core.mjs');const kit=(await import('@pdf-lib/fontkit')).default,metrics=kit.create(fontBytes),doc=await PDFDocument.create();doc.registerFontkit(kit);const embedded=await doc.embedFont(fontBytes);
 for(const text of ['i','W','国','が']){const run={text,x:20,baseline:40,size:22,width:19,ink:{left:1,right:15,ascent:17,descent:3}},p=textRunPlacement(run,embedded,metrics),b=metrics.layout(text).glyphs[0].bbox,u=run.size/metrics.unitsPerEm;assert.ok(Math.abs(p.x+b.minX*u*p.sx-(run.x-run.ink.left))<1e-8);assert.ok(Math.abs(p.x+b.maxX*u*p.sx-(run.x+run.ink.right))<1e-8);assert.ok(Math.abs(p.y+b.maxY*u*p.sy-(-run.baseline+run.ink.ascent))<1e-8);assert.ok(Math.abs(p.y+b.minY*u*p.sy-(-run.baseline-run.ink.descent))<1e-8)}
});
test('spaces and older prepared text remain finite and keep their original baseline',async()=>{
 const {textRunPlacement}=await import('../src/pdf-vector-core.mjs'),kit=(await import('@pdf-lib/fontkit')).default,metrics=kit.create(fontBytes),doc=await PDFDocument.create();doc.registerFontkit(kit);const embedded=await doc.embedFont(fontBytes);
 assert.deepEqual(textRunPlacement({text:'A',x:12,baseline:30,size:18},embedded,metrics),{sx:1,sy:1,x:12,y:-30});
 const p=textRunPlacement({text:' ',x:12,baseline:30,size:18,width:8,ink:{left:0,right:0,ascent:0,descent:0}},embedded,metrics);assert.equal(p.y,-30);assert.ok(Number.isFinite(p.sx)&&p.sx>0);
});

test('Japanese text embeds only used glyphs and reuses one font across pages',async()=>{
 const text='会議ノート 確認事項 ABC',project={...base,screens:[{id:'a',name:'a',elements:[]},{id:'b',name:'b',elements:[]}]},element={x:10,y:10,w:400,h:200,textRuns:[...text].map((ch,i)=>({text:ch,x:20+i*20,baseline:60,size:18,color:[0,0,0,1]}))};const {bytes}=await composeVectorPDF(project,[{elements:[element]},{elements:[element]}],{fontBytes});assert.ok(bytes.length<50000,'short Japanese text must not embed megabytes of unused glyphs: '+bytes.length);const out=await PDFDocument.load(bytes);const refs=out.getPages().map(p=>p.node.Resources().lookup(PDFName.of('Font')).values().map(r=>r.toString()));assert.deepEqual(refs[0],refs[1]);
});
test('repeated backgrounds and placed copies share the same embedded image data',async()=>{
 // Use the known-good alpha PNG fixture also used by browser import/export tests.
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const p={...base,screens:['a','b'].map(id=>({id,name:id,elements:[],background:{src:png,x:0,y:0,w:100,h:100,visible:true,opacity:1}}))},e={x:120,y:100,w:100,h:100,image:png};const {bytes}=await composeVectorPDF(p,[{elements:[e,e]},{elements:[e]}]);const out=await PDFDocument.load(bytes),refs=out.getPages().flatMap(page=>page.node.Resources().lookup(PDFName.of('XObject')).values().map(r=>r.toString()));assert.equal(new Set(refs).size,1);
});
