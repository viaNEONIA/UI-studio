import {clickToolbar} from './editor-panels.mjs';
import {confirmTwoPointDraft,freezePendingPlacement} from './editor-panels.mjs';
import {placePendingObject} from './editor-panels.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {expandEditorPanels} from './editor-panels.mjs';
const line=(type='line',extra={})=>({id:'line',type,name:'線',x:50,y:50,w:240,h:240,text:'',bg:'transparent',color:'#172235',font:16,radius:0,stroke:'#172235',strokeWidth:3,points:[[0,0],[1,1]],...extra});
const box={id:'box',type:'box',name:'背後の図形',x:180,y:60,w:90,h:80,text:'注記',bg:'#dbeafe',color:'#172235',font:16,radius:0};
async function load(page,elements){await page.locator('#file').setInputFiles({name:'hit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,width:412,height:650,screens:[{id:'s',name:'試験',elements}]}))})}
async function saved(page){const wait=page.waitForEvent('download');await clickToolbar(page.locator('#saveJson'));return JSON.parse(await readFile(await(await wait).path(),'utf8'))}
async function at(page,x,y){const r=await page.locator('#device').boundingBox(),z=Number(await page.locator('#zoom').inputValue());return{x:r.x+(x+2)*z,y:r.y+(y+2)*z}}
async function click(page,x,y){const p=await at(page,x,y);await page.mouse.click(p.x,p.y);await confirmTwoPointDraft(page)}
async function drag(page,x,y,dx,dy){const p=await at(page,x,y),z=Number(await page.locator('#zoom').inputValue());await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx*z,p.y+dy*z,{steps:5});await page.mouse.up()}
test.beforeEach(async({page})=>{await page.goto('/');await expandEditorPanels(page)});
for(const type of ['line','arrow','polyline','curve'])test(type+' empty bounds pass clicks and drags through before and after line selection',async({page},info)=>{
 await load(page,[box,line(type)]);await page.locator('#snapOn').uncheck();await click(page,220,100);await expect(page.locator('[data-id="box"]')).toHaveClass(/selected/);
 await click(page,170,170);await expect(page.locator('[data-id="line"]')).toHaveClass(/selected/);await expect(page.locator('[data-id="line"]')).toHaveCSS('outline-style','none');await expect(page.locator('[data-id="line"] .resize')).toBeHidden();await expect(page.locator('[data-id="line"] .vertex')).toHaveCount(2);
 if(type==='line')await page.screenshot({path:info.outputPath('diagonal-line-selected.png')});
 await drag(page,220,100,20,30);const p=await saved(page);expect([p.screens[0].elements[0].x,p.screens[0].elements[0].y]).toEqual([200,90]);expect(p.screens[0].elements[1]).toEqual(line(type));
 await click(page,170,170);await drag(page,170,170,20,0);const moved=(await saved(page)).screens[0].elements[1];expect([moved.x,moved.y]).toEqual([70,50]);await page.locator('#undo').click();expect((await saved(page)).screens[0].elements[1]).toEqual(line(type));
});
for(const z of ['0.5','1','1.5'])test('thin horizontal line has a screen sized hit tolerance at zoom '+z,async({page})=>{
 await load(page,[line('line',{h:20,points:[[0,0],[1,0]],strokeWidth:1})]);await page.locator('#zoom').selectOption(z);const p=await at(page,170,50);await page.mouse.click(p.x,p.y+4);await confirmTwoPointDraft(page);await expect(page.locator('[data-id="line"]')).toHaveClass(/selected/);await page.mouse.click(p.x,p.y+16);await confirmTwoPointDraft(page);await expect(page.locator('.element.selected')).toHaveCount(0);
});
test('polyline gaps and curve control polygon are not selectable; actual segments and curve remain selectable',async({page})=>{
 await load(page,[line('polyline',{points:[[0,0],[.5,1],[1,0]]})]);await click(page,170,100);await expect(page.locator('.element.selected')).toHaveCount(0);await click(page,110,170);await expect(page.locator('[data-id="line"]')).toHaveClass(/selected/);
 await load(page,[line('curve',{points:[[0,0],[.5,1],[1,0]]})]);await click(page,110,170);await expect(page.locator('.element.selected')).toHaveCount(0);const p=await page.locator('[data-id="line"] svg g path').evaluate(n=>{const p=n.getPointAtLength(n.getTotalLength()/2);return{x:p.x,y:p.y}});await click(page,50+p.x,50+p.y);await expect(page.locator('[data-id="line"]')).toHaveClass(/selected/);
});
test('vertices still deform lines and locked line permits selecting underlying object',async({page})=>{
 await load(page,[box,line()]);await page.locator('#snapOn').uncheck();await click(page,170,170);await drag(page,290,290,20,-30);let e=(await saved(page)).screens[0].elements[1];expect(e.points.map(([x,y])=>[e.x+x*e.w,e.y+y*e.h])).toEqual([[50,50],[310,260]]);
 await load(page,[{...box,x:100,y:100,w:140,h:140},line('line',{locked:true})]);const before=await saved(page);await click(page,170,170);await expect(page.locator('[data-id="box"]')).toHaveClass(/selected/);expect(await saved(page)).toEqual(before);
});
test('HTML output contains no selection highlight or interactive hit areas',async({page})=>{
 await load(page,[line('arrow',{endCap:'circle'})]);await click(page,170,170);const wait=page.waitForEvent('download');await clickToolbar(page.locator('#exportHtml'));const html=await readFile(await(await wait).path(),'utf8');await page.setContent(html);await expect(page.locator('.line-hit,.vertex,.resize')).toHaveCount(0);await expect(page.locator('[data-cap-end]')).toHaveAttribute('data-cap-end','circle');
});
test('contextual buttons accurately show availability and lock action names',async({page})=>{
 for(const id of ['group','ungroup','alignLeft','alignTop','undo','redo','layerUp','layerDown','quickClearGuides','finishDrawing','cancelDrawing'])await expect(page.locator('#'+id)).toBeDisabled();
 await expect(page.locator('#undo')).toHaveCSS('opacity','0.45');await page.locator('#quickBox').click();await placePendingObject(page);await expect(page.locator('#undo')).toBeEnabled();await expect(page.locator('#undo')).toHaveCSS('opacity','1');await expect(page.locator('#group')).toBeDisabled();await page.locator('#quickText').click();await placePendingObject(page);await page.locator('#layers .layer').last().click({modifiers:['Control']});await expect(page.locator('#group')).toBeEnabled();await page.locator('#group').click();await expect(page.locator('#ungroup')).toBeEnabled();await page.locator('#ungroup').click();await expect(page.locator('#ungroup')).toBeDisabled();
 const locks=page.locator('#layers .layer-lock');await expect(locks.first()).toHaveAttribute('aria-label',/^レイヤーをロック:/);await locks.first().click();await expect(locks.first()).toHaveAttribute('aria-label',/^レイヤーのロックを解除:/);await page.locator('#viewMode').click();for(const n of await locks.all())await expect(n).toBeDisabled();
});
test('visible toolbar buttons have action names and do not overlap; guides and drawing controls respond',async({page},info)=>{
 const unnamed=await page.locator('button:visible').evaluateAll(ns=>ns.filter(n=>!(n.getAttribute('aria-label')||n.title||n.textContent.trim())).map(n=>n.id));expect(unnamed).toEqual([]);
 const rects=await page.locator('.top button:visible').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return{id:n.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];expect(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1,a.id+' overlaps '+b.id).toBe(false)}
 await page.locator('#quickGuideV').click();const guidePoint=await at(page,120,150);await page.mouse.move(guidePoint.x,guidePoint.y);await freezePendingPlacement(page);await page.keyboard.press('Enter');await expect(page.locator('#quickClearGuides')).toBeEnabled();await page.locator('#quickClearGuides').click();await expect(page.locator('#quickClearGuides')).toBeDisabled();await page.locator('#quickPolyline').click();await expect(page.locator('#cancelDrawing')).toBeEnabled();await click(page,60,60);await click(page,150,120);await expect(page.locator('#finishDrawing')).toBeEnabled();await page.locator('#finishDrawing').click();await expect(page.locator('#finishDrawing')).toBeDisabled();await expect(page.locator('#cancelDrawing')).toBeEnabled();await page.keyboard.press('Escape');await expect(page.locator('#cancelDrawing')).toBeDisabled();await page.screenshot({path:info.outputPath('toolbar-audit.png')});
});
