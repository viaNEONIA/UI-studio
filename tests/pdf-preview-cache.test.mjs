import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planPDFPreview,containsPDFRegion,PDFPreviewCache} from '../src/pdf-preview-cache.mjs';
const meta={pageWidth:600,pageHeight:800},background={x:0,y:0,w:600,h:800};
test('preview covers nearby pans with a 192 screen pixel buffer',()=>{
 const p=planPDFPreview(meta,background,{x:200,y:300,width:100,height:100},4,4);
 assert.equal(p.render.left,152);assert.equal(p.render.top,252);assert.equal(p.render.width,196);
 assert(containsPDFRegion(p.render,planPDFPreview(meta,background,{x:240,y:340,width:100,height:100},4,4).visible));
 assert(!containsPDFRegion(p.render,{...p.visible,pixelRatio:8}));
 assert(!containsPDFRegion(p.render,{...p.visible,left:300}));
});
test('overscan never lowers visible resolution at the bitmap limit',()=>{
 const p=planPDFPreview(meta,background,{x:200,y:200,width:200,height:400},20,20);
 assert.equal(p.render,p.visible);assert(p.render.pixelWidth*p.render.pixelHeight<=8388608);
 assert.equal(planPDFPreview(meta,background,{x:1000,y:1000,width:100,height:100},1),null);
});
function entry(key,pixels=100){return {key,source:'pdf',canvas:{width:pixels,height:1,remove(){this.removed=true}}}}
test('cache retains compatible tiles in LRU order and releases evicted bitmap memory',()=>{
 const cache=new PDFPreviewCache({maxPixels:250,maxEntries:2}),a=entry('a'),b=entry('b'),c=entry('c');
 cache.put(a);cache.put(b);cache.touch(a);cache.put(c);
 assert.deepEqual(cache.entries,[c,a]);assert.equal(b.canvas.width,0);assert(b.canvas.removed);assert.equal(cache.pixels,200);
 assert.deepEqual(cache.compatible({key:'a',source:'other'}),[]);assert.deepEqual(cache.compatible({key:'a',source:'pdf'}),[a]);
 cache.retain(e=>e.key==='a');assert.equal(c.canvas.width,0);cache.clear();assert.equal(a.canvas.width,0);assert.equal(cache.pixels,0);
});
test('cache also enforces total pixels and disposes an oversized entry',()=>{
 const cache=new PDFPreviewCache({maxPixels:150,maxEntries:2}),a=entry('a'),b=entry('b');cache.put(a);cache.put(b);assert.deepEqual(cache.entries,[b]);assert.equal(a.canvas.width,0);
 const huge=entry('huge',200);cache.put(huge);assert.equal(cache.pixels,0);assert.equal(huge.canvas.width,0);
});
