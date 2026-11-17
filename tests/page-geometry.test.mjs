import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageBox} from '../src/page-geometry.mjs';
test('export bounds retain complete native PDF page including contain-fit letterbox and movement',()=>{
 const box=pageBox({width:100,height:100},{background:{x:-100,y:40,w:1200,h:1200,pdf:{pageWidth:600,pageHeight:800}}});
 assert.deepEqual(box,{x:50,y:40,width:900,height:1200,points:[600,800]});
});
test('mixed pages retain independent canvas sizes and image backgrounds use their full placed bounds',()=>{
 assert.deepEqual(pageBox({width:100,height:100},{canvasWidth:800,canvasHeight:400}),{x:0,y:0,width:800,height:400});
 assert.deepEqual(pageBox({width:100,height:100},{background:{x:15,y:-10,w:640,h:480}}),{x:15,y:-10,width:640,height:480,points:[480,360]});
});
