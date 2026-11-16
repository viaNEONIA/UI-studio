import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name){const start=html.indexOf('function '+name+'('),end=html.indexOf('\n',start);return html.slice(start,end)}
const context=vm.createContext({project:{width:500,height:400},Math,Error,Set,Number});
for(const name of ['onGuide','guideIntersection','clippedGuide','validateGuidelines'])vm.runInContext(fn(name),context);
const segment={id:'s',x:100,y:120,dx:160,dy:80,segment:true};
test('finite guide clips at its endpoints and infinite legacy guide reaches canvas edges',()=>{
 assert.deepEqual(Array.from(context.clippedGuide(segment)),[100,120,260,200]);
 assert.deepEqual(Array.from(context.clippedGuide({...segment,segment:undefined})),[0,70,500,320]);
});
test('finite guide intersections reject extensions in both input orders',()=>{
 const inside={x:180,y:0,dx:0,dy:1},outside={x:300,y:0,dx:0,dy:1};
 assert.deepEqual(Array.from(context.guideIntersection(segment,inside)),[180,160]);
 assert.equal(context.guideIntersection(segment,outside),null);
 assert.equal(context.guideIntersection(outside,segment),null);
 assert.equal(context.onGuide(segment,[300,220]),false);
});
test('finite guide clips to canvas while preserving its segment limit',()=>{
 assert.deepEqual(Array.from(context.clippedGuide({x:-50,y:100,dx:200,dy:0,segment:true})),[0,100,150,100]);
 assert.equal(context.clippedGuide({x:600,y:100,dx:200,dy:0,segment:true}),null);
});
test('guide validation accepts legacy and segment data and rejects invalid segment flags',()=>{
 context.validateGuidelines({guidelines:[segment,{id:'old',x:0,y:60,dx:1,dy:0}]});
 assert.throws(()=>context.validateGuidelines({guidelines:[{...segment,segment:'true'}]}));
});
function editorContext(){
 const project={width:500,height:400,screens:[{elements:[],guidelines:[]}]};let counter=0;
 const ctx=vm.createContext({project,screenId:'s',drawing:null,viewOnly:false,Math,Number,Set,Error,uid:()=>String(++counter),screen:()=>project.screens[0],snapshot(){},render(){},showDrawing(){},tell(){},applyDefaultProperties(){},multi:new Set()});
 const t=html.indexOf('const types='),te=html.indexOf(';let drawing',t);vm.runInContext(html.slice(t,te)+';',ctx);
 const d=html.indexOf('const defaults='),de=html.indexOf(';function makeObject',d);vm.runInContext(html.slice(d,de)+';',ctx);
 for(const name of ['isLine','isShape','makeObject','positionPlacement','finishDrawing'])vm.runInContext(fn(name),ctx);
 return ctx;
}
test('all line and shape factories use red 2px and shapes start with transparent fills',()=>{
 const ctx=editorContext();for(const type of ['line','arrow','polyline','curve','box','circle','triangle']){const e=ctx.makeObject(type);assert.equal(e.stroke,'#ff0000');assert.equal(e.strokeWidth,2);if(['box','circle','triangle'].includes(type))assert.equal(e.bgTransparent,true)}
});
test('line completion starts an independent next object and empty Enter does not duplicate it',()=>{
 const ctx=editorContext();for(const type of ['line','arrow','polyline','curve']){ctx.drawing={type,screenId:'s',points:[[30,40],[140,180]]};ctx.finishDrawing();assert.equal(ctx.drawing.type,type);assert.equal(ctx.drawing.points.length,0);const count=ctx.project.screens[0].elements.length;ctx.finishDrawing();assert.equal(ctx.project.screens[0].elements.length,count)}
});
test('placement commits around cursor center and does not commit without a canvas position',()=>{
 const ctx=editorContext(),object=ctx.makeObject('box');ctx.drawing={type:'placement',object,screenId:'s',cursor:null,points:[]};ctx.finishDrawing();assert.equal(ctx.project.screens[0].elements.length,0);ctx.drawing.cursor=[220,250];ctx.finishDrawing();assert.equal(object.x+object.w/2,220);assert.equal(object.y+object.h/2,250);assert.equal(ctx.project.screens[0].elements.length,1);assert.equal(ctx.drawing,null);
});
vm.runInContext(fn('satisfiesAngleConstraint'),context);
vm.runInContext(fn('segmentSnapPoint'),context);
test('segment snapping projects onto the actual segment and clamps to endpoints',()=>{
 assert.deepEqual(Array.from(context.segmentSnapPoint([50,100],[350,400],[122,180])),[126,176]);
 assert.deepEqual(Array.from(context.segmentSnapPoint([50,100],[350,400],[10,10])),[50,100]);
 assert.equal(context.segmentSnapPoint([1,1],[1,1],[2,2]),null);
});
test('constrained segment snapping uses actual intersections without extending segments',()=>{
 assert.deepEqual(Array.from(context.segmentSnapPoint([50,100],[350,400],[122,180],{axis:1,value:180})),[130,180]);
 assert.equal(context.segmentSnapPoint([50,100],[350,400],[122,180],{axis:1,value:500}),null);
 assert.deepEqual(Array.from(context.segmentSnapPoint([50,100],[350,100],[122,110],{axis:1,value:100})),[122,100]);
});
