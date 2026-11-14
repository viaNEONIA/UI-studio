import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const element = (id, x=20) => ({ id, type:'button', name:'ダミー', x, y:40, w:100, h:48, text:'テスト', bg:'#2563eb', color:'#ffffff', font:16, radius:9, css:'', link:'' });
const project = (elements=[element('a')]) => ({version:1,width:412,height:915,screens:[{id:'s1',name:'ホーム',elements}]});
async function load(page, data) { await page.locator('#file').setInputFiles({name:'dummy.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data))}); }
async function download(page, id) { const pending=page.waitForEvent('download'); await page.locator(id).click(); return readFile(await (await pending).path(), 'utf8'); }
async function saved(page) {return JSON.parse(await download(page,'#saveJson'));}
async function move(page, locator, dx, dy) {const r=await locator.boundingBox();await page.mouse.move(r.x+5,r.y+5);await page.mouse.down();await page.mouse.move(r.x+5+dx*.65,r.y+5+dy*.65,{steps:5});await page.mouse.up();}
test.beforeEach(async ({page}, testInfo) => {if(process.env.BASELINE && /group at edge|invalid import|export escapes/.test(testInfo.title))test.fail(true,'Original v0.6 regression reproduction');await page.goto('/');});
test('all components add; undo, redo, delete',async({page})=>{
  const buttons=page.locator('#components button'),count=await buttons.count();for(let i=0;i<await buttons.count();i++)await buttons.nth(i).click();
  await expect(page.locator('.element')).toHaveCount(count);
  await page.locator('#undo').click();await expect(page.locator('.element')).toHaveCount(count-1);
  await page.locator('#redo').click();await expect(page.locator('.element')).toHaveCount(count);
  await page.locator('#layers button').first().click();await page.keyboard.press('Delete');await expect(page.locator('.element')).toHaveCount(count-1);
});
test('drag and resize use canvas coordinates',async({page})=>{
  await load(page,project());await page.locator('#snapOn').uncheck();
  await move(page,page.locator('.element'),30,20);
  let e=(await saved(page)).screens[0].elements[0];expect([e.x,e.y]).toEqual([50,60]);
  const r=await page.locator('.resize').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+26,r.y+r.height/2+13);await page.mouse.up();
  e=(await saved(page)).screens[0].elements[0];expect([e.w,e.h]).toEqual([140,68]);
});
test('group at edge preserves relative positions; ungroup and alignment',async({page})=>{
  await load(page,project([element('a',20),element('b',150)]));await page.locator('#snapOn').uncheck();
  await page.locator('#layers button').nth(0).click();await page.locator('#layers button').nth(1).click({modifiers:['Control']});await page.locator('#group').click();
  await move(page,page.locator('[data-id="a"]'),-100,0);
  const es=(await saved(page)).screens[0].elements;expect(es[1].x-es[0].x).toBe(130);expect(es[0].x).toBe(0);
  await page.locator('#ungroup').click();expect((await saved(page)).screens[0].elements.every(e=>!e.group)).toBe(true);
  await page.locator('#alignLeft').click();expect((await saved(page)).screens[0].elements.map(e=>e.x)).toEqual([0,0]);
});
test('legacy JSON without anchors round trips including extension metadata',async({page})=>{
 const p=project();p.extension={dummy:true};await load(page,p);expect(await saved(page)).toEqual(p);
 await page.locator('#layers button').click();await page.locator('#pAnchorX').selectOption('right');await page.locator('#pAnchorY').selectOption('bottom');
 await page.locator('#preset').selectOption('768,1024');let e=(await saved(page)).screens[0].elements[0];expect([e.x,e.y]).toEqual([376,149]);
 await page.locator('#undo').click();expect((await saved(page)).width).toBe(412);
});
test('invalid import leaves current project intact',async({page})=>{
 await load(page,project());const before=await saved(page);const bad=project();bad.screens[0].elements[0].text=null;bad.screens[0].elements[0].type='image';
 const dialog=page.waitForEvent('dialog');await load(page,bad);await (await dialog).accept();expect(await saved(page)).toEqual(before);
});
test('screen editing, copy/paste, order and links in exported HTML',async({page})=>{
 await load(page,project());await page.locator('#duplicateScreen').click();await expect(page.locator('#screens .screenrow')).toHaveCount(2);
 await page.locator('#layers button').click();await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');await expect(page.locator('.element')).toHaveCount(2);
 await page.locator('#layerDown').click();await page.locator('#pLink').selectOption('s1');
 const html=await download(page,'#exportHtml');await page.setContent(html);await page.locator('nav button').nth(1).click();await expect(page.locator('.screen.visible')).toHaveCount(1);await page.locator('.screen.visible .item[data-link]').click({position:{x:95,y:30}});await expect(page.locator('#s1')).toHaveClass('screen visible');
});
test('export escapes arbitrary screen IDs and sandboxes HTML',async({page})=>{
 const p=project();p.screens[0].id="x'\"><img src=x onerror=window.injected=1>";p.screens[0].elements[0].type='html';p.screens[0].elements[0].text='<script>parent.injected=1</script>';
 await load(page,p);const html=await download(page,'#exportHtml');await page.setContent(html);await page.locator('nav button').click();await expect(page.locator('.screen.visible')).toHaveCount(1);expect(await page.evaluate(()=>window.injected)).toBeUndefined();await expect(page.locator('iframe')).toHaveAttribute('sandbox','');
});
test('grid, zoom, overflow audit, stretch constraints and screenshot',async({page},testInfo)=>{
 await load(page,project());await page.locator('#gridOn').check();await expect(page.locator('#device')).toHaveCSS('background-size','8px 8px');
 await page.locator('#layers button').click();await page.locator('#pAnchorX').selectOption('stretch');await page.locator('#pAnchorY').selectOption('center');await page.locator('#preset').selectOption('768,1024');
 const e=(await saved(page)).screens[0].elements[0];expect([e.w,e.y]).toEqual([456,95]);
 await page.locator('#pX').fill('-10');await expect(page.locator('#layoutAudit')).toContainText('画面外の部品 1 件');await page.locator('#fitZoom').click();
 await page.screenshot({path:testInfo.outputPath('editor.png'),fullPage:true});
});
test('invalid dimensions do not corrupt data; click-only selection keeps undo history',async({page})=>{
 await load(page,project());await page.locator('[data-id="a"]').click();await page.locator('#pW').fill('0');expect((await saved(page)).screens[0].elements[0].w).toBe(100);
 await page.locator('#undo').click();await expect(page.locator('.element')).toHaveCount(0);
});
test('screen deletion clears incoming links and undo restores them',async({page})=>{
 const p=project();p.screens.push({id:'s2',name:'別画面',elements:[]});p.screens[0].elements[0].link='s2';await load(page,p);
 await page.locator('#screens .screenrow').nth(1).getByTitle('画面を削除').click();expect((await saved(page)).screens[0].elements[0].link).toBe('');await page.locator('#undo').click();expect(await saved(page)).toEqual(p);
});
test('fit includes large canvas below 50 percent',async({page})=>{
 const p=project();p.width=1600;p.height=2400;await load(page,p);await page.locator('#fitZoom').click();
 const d=await page.locator('#deviceWrap').boundingBox(),w=await page.locator('#workspace').boundingBox();expect(d.width).toBeLessThan(w.width);expect(d.height).toBeLessThan(w.height);
});
test('ungrouped multiple selection drags together and undoes once',async({page})=>{
 await load(page,project([element('a',20),element('b',150)]));await page.locator('#snapOn').uncheck();
 await page.locator('#layers button').nth(0).click();await page.locator('#layers button').nth(1).click({modifiers:['Control']});
 await move(page,page.locator('[data-id="a"]'),30,25);expect((await saved(page)).screens[0].elements.map(e=>[e.x,e.y])).toEqual([[50,65],[180,65]]);
 await page.locator('#undo').click();expect((await saved(page)).screens[0].elements.map(e=>[e.x,e.y])).toEqual([[20,40],[150,40]]);
});
test('smart guides snap within six pixels and clear on release',async({page})=>{
 await load(page,project());await move(page,page.locator('.element'),-16,30);expect((await saved(page)).screens[0].elements[0].x).toBe(0);await expect(page.locator('.guide')).toHaveCount(0);
});
test('all constraint modes across screens; disabling constraints preserves geometry',async({page})=>{
 const p=project(['left','center','right','stretch'].map((a,i)=>({...element('e'+i,20),anchorX:a,anchorY:['top','center','bottom','stretch'][i]})));
 p.screens.push({id:'s2',name:'ダミー2',elements:[{...element('other'),anchorX:'right',anchorY:'bottom'}]});await load(page,p);
 await page.locator('#preset').selectOption('430,932');const result=await saved(page);
 expect(result.screens[0].elements.map(e=>[e.x,e.y,e.w,e.h])).toEqual([[20,40,100,48],[29,49,100,48],[38,57,100,48],[20,40,118,65]]);
 expect(result.screens[1].elements[0].x).toBe(38);
 await page.locator('#autoLayoutOn').uncheck();await page.locator('#preset').selectOption('768,1024');expect((await saved(page)).screens).toEqual(result.screens);
});
test('screen add rename switch and last-screen deletion guard',async({page})=>{
 await page.locator('#newScreen').click();await expect(page.locator('#screens .screenrow')).toHaveCount(2);
 page.once('dialog',dialog=>dialog.accept('変更した画面'));await page.locator('#screens .screenrow').nth(1).locator('button').first().dblclick();
 await expect(page.locator('#screens')).toContainText('変更した画面');await page.locator('#screens .screenrow').nth(0).getByTitle('画面を削除').click();
 let message='';page.once('dialog',async dialog=>{message=dialog.message();await dialog.accept()});await page.locator('#screens').getByTitle('画面を削除').click();expect(message).toContain('最後の画面');expect((await saved(page)).screens).toHaveLength(1);
});
test('local file launch supports import edit and JSON download',async({page})=>{
 const { pathToFileURL }=await import('node:url');await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await load(page,project());await page.locator('#layers button').click();await page.locator('#pText').fill('ローカル動作確認');expect((await saved(page)).screens[0].elements[0].text).toBe('ローカル動作確認');
});
for(const [label,w,h] of [['A4 縦',794,1123],['A4 横',1123,794],['A3 縦',1123,1587],['A3 横',1587,1123]]){
 test(`${label} canvas fits, round trips and exports correct dimensions`,async({page})=>{
  await load(page,project());await page.locator('#autoLayoutOn').uncheck();await page.locator('#preset').selectOption(`${w},${h}`);
  const p=await saved(page);expect([p.width,p.height,p.version]).toEqual([w,h,1]);expect(p.screens[0].elements).toEqual(project().screens[0].elements);
  const wrap=await page.locator('#deviceWrap').boundingBox(),work=await page.locator('#workspace').boundingBox();expect(wrap.width).toBeLessThan(work.width);expect(wrap.height).toBeLessThan(work.height);
  await page.locator('#applySize').click();expect((await saved(page)).width).toBe(w);
  await load(page,p);await expect(page.locator('#preset')).toHaveValue(`${w},${h}`);expect(await saved(page)).toEqual(p);
  const html=await download(page,'#exportHtml');await page.setContent(html);await expect(page.locator('.screen')).toHaveCSS('height',`${h}px`);
  expect(await page.locator('.screen').evaluate(n=>n.style.width)).toBe(`${w}px`);
 });
}

test('draw polyline and curve, adjust stroke palette and export SVG',async({page})=>{
 const r=await page.locator('#device').boundingBox();const click=async(x,y)=>page.mouse.click(r.x+(x+2)*.65,r.y+(y+2)*.65);
 await page.locator('#drawPolyline').click();await click(30,50);await click(180,80);await click(100,200);await page.locator('#finishDrawing').click();
 let p=await saved(page);expect(p.screens[0].elements[0].type).toBe('polyline');expect(p.screens[0].elements[0].points).toHaveLength(3);
 await page.locator('#pStrokeWidth').fill('12');await page.locator('#strokePalette button[data-color="#ef4444"]').click();
 p=await saved(page);expect(p.screens[0].elements[0].strokeWidth).toBe(12);expect(p.screens[0].elements[0].stroke).toBe('#ef4444');
 await load(page,p);expect(await saved(page)).toEqual(p);
 await page.locator('#drawCurve').click();await click(40,300);await click(150,400);await click(280,300);await page.locator('#finishDrawing').click();
 await expect(page.locator('.element svg path').last()).toHaveAttribute('d',/Q/);
 const html=await download(page,'#exportHtml');await page.setContent(html);await expect(page.locator('svg')).toHaveCount(2);await expect(page.locator('svg g').first()).toHaveAttribute('stroke','#ef4444');
});
test('straight line and arrow finish at two points, undo and cancellation',async({page})=>{
 const r=await page.locator('#device').boundingBox();for(const [id,y]of [['drawLine',80],['drawArrow',200]]){await page.locator('#'+id).click();await page.mouse.click(r.x+30,r.y+y);await page.mouse.click(r.x+180,r.y+y+30)}
 await expect(page.locator('.element')).toHaveCount(2);await expect(page.locator('.element').last().locator('path')).toHaveCount(2);
 await page.locator('#undo').click();await expect(page.locator('.element')).toHaveCount(1);await page.locator('#redo').click();await expect(page.locator('.element')).toHaveCount(2);
 await page.locator('#drawPolyline').click();await page.mouse.click(r.x+30,r.y+300);await page.locator('#cancelDrawing').click();await expect(page.locator('.drawing-preview')).toHaveCount(0);await expect(page.locator('.element')).toHaveCount(2);
});
for(const type of ['line','arrow','polyline','curve']){
 test(`${type} vertex drag preserves other points, undo and JSON/export`,async({page})=>{
  const points=['line','arrow'].includes(type)?[[0,0],[1,1]]:[[0,0],[.5,1],[1,0]];
  const p=project([{...element('v',80),type,y:100,w:160,h:100,points,stroke:'#2563eb',strokeWidth:5}]);
  await load(page,p);await page.locator('#layers button').click();await expect(page.locator('.vertex')).toHaveCount(points.length);
  const world=e=>e.points.map(([x,y])=>[e.x+x*e.w,e.y+y*e.h]);const before=world(p.screens[0].elements[0]);
  const handle=page.locator('.vertex').first(),r=await handle.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2-26,r.y+r.height/2+13,{steps:4});await page.mouse.up();
  const after=await saved(page),positions=world(after.screens[0].elements[0]);expect(positions[0][0]).toBeCloseTo(before[0][0]-40);expect(positions[0][1]).toBeCloseTo(before[0][1]+20);expect(positions.slice(1)).toEqual(before.slice(1));
  await page.locator('#undo').click();expect(await saved(page)).toEqual(p);await page.locator('#redo').click();expect(await saved(page)).toEqual(after);
  await load(page,after);expect(await saved(page)).toEqual(after);const html=await download(page,'#exportHtml');await page.setContent(html);await expect(page.locator('svg')).toHaveCount(1);await expect(page.locator('.vertex')).toHaveCount(0);
 });
}
test('background transparency preserves text, color, history and exports',async({page})=>{
 await load(page,project([{...element('a'),type:'text',bg:'#2563eb'}]));await page.locator('#layers button').click();
 await expect(page.locator('#pBgTransparency')).toHaveValue('0');await setTransparency(page,60);
 await expect(page.locator('.element')).toHaveCSS('background-color','rgba(37, 99, 235, 0.4)');
 await expect(page.locator('.element')).toHaveCSS('color','rgb(255, 255, 255)');await expect(page.locator('.element')).toHaveCSS('opacity','1');
 await page.locator('#pBgTransparent').check();await expect(page.locator('.element')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await page.locator('#pBgTransparent').uncheck();await expect(page.locator('#pBgTransparency')).toHaveValue('60');
 const data=await saved(page);await load(page,data);await page.locator('#layers button').click();await expect(page.locator('#pBgTransparency')).toHaveValue('60');
 await setTransparency(page,100);await expect(page.locator('.element')).toHaveCSS('background-color','rgba(37, 99, 235, 0)');
 await page.locator('#undo').click();await expect(page.locator('.element')).toHaveCSS('background-color','rgba(37, 99, 235, 0.4)');
 const html=await download(page,'#exportHtml');await page.setContent(html);await expect(page.locator('.item')).toHaveCSS('background-color','rgba(37, 99, 235, 0.4)');
});
test('legacy transparent backgrounds remain transparent and can be recolored',async({page})=>{
 await load(page,project([{...element('a'),type:'box',bg:'transparent'}]));await page.locator('#layers button').click();
 await expect(page.locator('#pBgTransparent')).toBeChecked();await page.locator('#pBgTransparent').uncheck();await expect(page.locator('.element')).toHaveCSS('background-color','rgb(255, 255, 255)');
 await setTransparency(page,50);await page.locator('#pBg').evaluate(n=>{n.value='#ff0000';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))});await expect(page.locator('.element')).toHaveCSS('background-color','rgba(255, 0, 0, 0.5)');
});

async function setTransparency(page,value){await page.locator('#pBgTransparency').evaluate((n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},String(value));}
