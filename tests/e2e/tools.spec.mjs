import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function saved(page){const promise=page.waitForEvent('download');await page.locator('#saveJson').click();return JSON.parse(await readFile(await(await promise).path(),'utf8'))}
async function setInput(page,id,value){await page.locator(id).evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},String(value))}
test.beforeEach(async({page})=>{await page.goto('/')});
test('Material panel collapses while shapes stay available; shape fill and outline round trip',async({page})=>{
 await page.locator('#materialTools summary').click();await expect(page.locator('#components')).toBeHidden();
 await page.locator('#addCircle').click();await setInput(page,'#pBg','#ff0000');await setInput(page,'#pBgTransparency',40);await setInput(page,'#pOutlineColor','#0000ff');await setInput(page,'#pOutlineWidth',6);await setInput(page,'#pOutlineTransparency',75);
 const g=page.locator('.element svg g');await expect(g).toHaveAttribute('fill','rgba(255,0,0,0.6)');await expect(g).toHaveAttribute('stroke','#0000ff');await expect(g).toHaveAttribute('stroke-opacity','0.25');await expect(g).toHaveAttribute('stroke-width','6');
 await page.locator('#addTriangle').click();const p=await saved(page);expect(p.screens[0].elements.map(e=>e.type)).toEqual(['circle','triangle']);
 await page.locator('#file').setInputFiles({name:'round.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});expect(await saved(page)).toEqual(p);
 const pending=page.waitForEvent('download');await page.locator('#exportHtml').click();const html=await readFile(await(await pending).path(),'utf8');await page.setContent(html);await expect(page.locator('.item svg')).toHaveCount(2);await expect(page.locator('.item svg g').first()).toHaveAttribute('stroke-opacity','0.25');
});
test('locked layers resist drag, text edit, deletion and group movement; unlock restores editing',async({page})=>{
 await page.locator('#addBox').click();await page.locator('#pLocked').check();await expect(page.locator('#pText')).toBeDisabled();const before=await saved(page),b=await page.locator('.element').boundingBox();
 await page.mouse.move(b.x+20,b.y+20);await page.mouse.down();await page.mouse.move(b.x+70,b.y+40);await page.mouse.up();await page.keyboard.press('Delete');expect(await saved(page)).toEqual(before);
 await page.locator('#components button').getByText('テキスト',{exact:true}).click();await page.locator('#layers .layer').nth(1).click({modifiers:['Control']});await page.locator('#alignLeft').click();expect((await saved(page)).screens[0].elements[0]).toEqual(before.screens[0].elements[0]);
 await page.locator('#layers .layer').nth(1).click();await page.locator('#pLocked').uncheck();await expect(page.locator('#pText')).toBeEnabled();await page.locator('#pText').fill('編集可');expect((await saved(page)).screens[0].elements[0].text).toBe('編集可');
});
test('stamp image can be placed repeatedly and saved with its palette',async({page})=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await page.locator('#stampFile').setInputFiles({name:'stamp.png',mimeType:'image/png',buffer:png});await expect(page.locator('#stampPalette button')).toHaveCount(1);await page.locator('#stampPalette button').click();await page.locator('#stampPalette button').click();let p=await saved(page);expect(p.stamps).toHaveLength(1);expect(p.screens[0].elements).toHaveLength(2);expect(p.screens[0].elements[0].text).toMatch(/^data:image\/png;base64,/);
 await page.locator('#file').setInputFiles({name:'stamp-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.locator('#stampPalette button')).toHaveCount(1);expect(await saved(page)).toEqual(p);
});
test('text aligns horizontally and vertically without changing the outer position',async({page})=>{
 await page.locator('#components button').getByText('テキスト',{exact:true}).click();const before=(await saved(page)).screens[0].elements[0];await page.locator('#pTextAlign').selectOption('center');await page.locator('#pTextVertical').selectOption('bottom');
 await expect(page.locator('.element > div').first()).toHaveCSS('text-align','center');await expect(page.locator('.element > div').first()).toHaveCSS('justify-content','flex-end');const after=(await saved(page)).screens[0].elements[0];expect([after.x,after.y,after.w,after.h]).toEqual([before.x,before.y,before.w,before.h]);
});
test('Ctrl wheel zoom, middle drag and arrow pan work in editing and viewing',async({page})=>{
 await page.locator('#preset').selectOption('1587,1123');await page.locator('#zoom').selectOption('1.5');const work=page.locator('#workspace'),r=await work.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);const before=Number(await page.locator('#zoom').inputValue());await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');await expect.poll(async()=>Number(await page.locator('#zoom').inputValue())).toBeGreaterThan(before);
 await page.locator('#viewMode').click();await page.mouse.move(r.x+150,r.y+150);await page.mouse.down({button:'middle'});await page.mouse.move(r.x+50,r.y+50);await page.mouse.up({button:'middle'});const start=await work.evaluate(n=>({x:n.scrollLeft,y:n.scrollTop}));expect(start.y).toBeGreaterThan(0);await page.locator('#viewMode').blur();await page.keyboard.press('ArrowDown');expect(await work.evaluate(n=>n.scrollTop)).toBeGreaterThan(start.y);
 const count=await page.locator('.element').count();await page.locator('#addCircle').click();await expect(page.locator('.element')).toHaveCount(count);
 const old=Number(await page.locator('#zoom').inputValue());await page.keyboard.down('Control');await page.mouse.wheel(0,100);await page.keyboard.up('Control');await expect.poll(async()=>Number(await page.locator('#zoom').inputValue())).toBeLessThan(old);
});
test('Shift constrains successive drawing segments to horizontal or vertical',async({page})=>{
 await page.locator('#drawPolyline').click();const r=await page.locator('#device').boundingBox();await page.mouse.click(r.x+30,r.y+50);await page.keyboard.down('Shift');await page.mouse.click(r.x+150,r.y+80);await page.mouse.click(r.x+180,r.y+190);await page.keyboard.up('Shift');await page.locator('#finishDrawing').click();const e=(await saved(page)).screens[0].elements[0];expect(e.points[0][1]).toBe(e.points[1][1]);expect(e.points[1][0]).toBe(e.points[2][0]);
});
test('laser works in meeting and editing without modifying or exporting project data',async({page})=>{
 const before=await saved(page);await page.locator('#laserTool').click();const r=await page.locator('#workspace').boundingBox();await page.mouse.move(r.x+90,r.y+90);await expect(page.locator('.laser-dot')).toBeVisible();await page.mouse.click(r.x+90,r.y+90);expect(await saved(page)).toEqual(before);
 await page.locator('#meetingMode').click();await page.mouse.move(r.x+120,r.y+120);await expect(page.locator('.laser-dot')).toBeVisible();expect(await saved(page)).toEqual(before);await page.keyboard.press('Escape');await expect(page.locator('.laser-dot')).toBeHidden();
});
test('shape fill and independent outline alpha survive raster export',async({page})=>{
 await page.locator('#addBox').click();await page.locator('#pX').fill('20');await page.locator('#pY').fill('20');await page.locator('#pRadius').fill('0');await setInput(page,'#pBg','#ff0000');await setInput(page,'#pBgTransparency',50);await setInput(page,'#pOutlineColor','#0000ff');await setInput(page,'#pOutlineWidth',10);await setInput(page,'#pOutlineTransparency',0);
 const pixels=await page.evaluate(async()=>{const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:240px;height:180px;background:white;';const element=document.querySelector('.element').cloneNode(true);element.className='';element.style.position='absolute';host.append(element);document.body.append(host);try{const src=await window.MeetingTools.raster(host,240,180),img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [[...ctx.getImageData(100*2,70*2,1,1).data],[...ctx.getImageData(25*2,70*2,1,1).data]]}finally{host.remove()}});expect(pixels[0][0]).toBeGreaterThan(245);expect(pixels[0][1]).toBeGreaterThan(110);expect(pixels[0][1]).toBeLessThan(145);expect(pixels[1][2]).toBeGreaterThan(245);expect(pixels[1][0]).toBeLessThan(20);
});
