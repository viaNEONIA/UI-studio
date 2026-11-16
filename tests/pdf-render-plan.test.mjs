import test from 'node:test';
import assert from 'node:assert/strict';
import {planPDFRegion} from '../src/pdf-render-plan.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const meta={pageWidth:600,pageHeight:800},bg={x:100,y:50,w:600,h:800};
test('render plans retain PDF scale and crop to visible page in canvas coordinates',()=>{
 const p=planPDFRegion(meta,bg,{x:200,y:250,width:300,height:400},4);
 assert.deepEqual([p.left,p.top,p.cropX,p.cropY,p.width,p.height,p.pixelWidth,p.pixelHeight,p.scale],[200,250,100,200,300,400,1200,1600,4]);
});
test('render bounds follow contain-fit letterboxing and moved backgrounds',()=>{
 const p=planPDFRegion(meta,{x:-50,y:100,w:800,h:800},{x:0,y:0,width:500,height:500},2);
 assert.deepEqual([p.left,p.top,p.cropX,p.cropY,p.width,p.height],[50,100,0,0,450,400]);
 assert.equal(planPDFRegion(meta,bg,{x:0,y:0,width:50,height:50},2),null);
});
test('large pages and high DPI have bounded canvas memory without rasterizing the full page',()=>{
 for(const ratio of [1,2,4,8,16]){const p=planPDFRegion(meta,{x:0,y:0,w:15000,h:20000},{x:10000,y:12000,width:1200,height:900},ratio);assert.ok(p.pixelWidth<=8192&&p.pixelHeight<=8192);assert.ok(p.pixelWidth*p.pixelHeight<=8388608);assert.equal(p.width,1200);assert.equal(p.height,900)}
});
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function extract(name,next){return html.slice(html.indexOf('function '+name+'('),html.indexOf('function '+next+'('))}
const ctx=vm.createContext({Object,Number,Error,Set,atob});vm.runInContext(extract('validatePDFSources','makeBackground'),ctx);
const data=Buffer.from('%PDF-1.7\nfixture').toString('base64');
test('PDF sources and references validate without requiring PDF rendering tools',()=>{
 ctx.validatePDFSources({pdf1:data});ctx.validatePDFReference({sourceId:'pdf1',pageNumber:2,pageWidth:600,pageHeight:800},{pdf1:data});ctx.validatePDFSources(undefined);
 assert.throws(()=>ctx.validatePDFSources({pdf1:'not-base64'}));assert.throws(()=>ctx.validatePDFReference({sourceId:'missing',pageNumber:1,pageWidth:600,pageHeight:800},{}));assert.throws(()=>ctx.validatePDFReference({sourceId:'pdf1',pageNumber:0,pageWidth:600,pageHeight:800},{pdf1:data}));
});
