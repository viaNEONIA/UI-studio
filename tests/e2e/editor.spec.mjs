import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const element = (id, x=20) => ({ id, type:'button', name:'ダミー', x, y:40, w:100, h:48, text:'テスト', bg:'#2563eb', color:'#ffffff', font:16, radius:9, css:'', link:'' });
const project = (elements=[element('a')]) => ({version:1,width:412,height:915,screens:[{id:'s1',name:'ホーム',elements}]});
async function load(page, data) { await page.locator('#file').setInputFiles({name:'dummy.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data))}); }
async function download(page, id) { const pending=page.waitForEvent('download'); await page.locator(id).click(); return readFile(await (await pending).path(), 'utf8'); }
async function saved(page) {return JSON.parse(await download(page,'#saveJson'));}
async function move(page, locator, dx, dy) {const r=await locator.boundingBox();await page.mouse.move(r.x+5,r.y+5);await page.mouse.down();await page.mouse.move(r.x+5+dx*.65,r.y+5+dy*.65,{steps:5});await page.mouse.up();}
test.beforeEach(async ({page}, testInfo) => {if(process.env.BASELINE && /group at edge|invalid import|export escapes/.test(testInfo.title))test.fail(true,'Original v0.6 regression reproduction');await page.goto('/');});
test('all 23 components add; undo, redo, delete',async({page})=>{
  const buttons=page.locator('#components button');for(let i=0;i<await buttons.count();i++)await buttons.nth(i).click();
  await expect(page.locator('.element')).toHaveCount(23);
  await page.locator('#undo').click();await expect(page.locator('.element')).toHaveCount(22);
  await page.locator('#redo').click();await expect(page.locator('.element')).toHaveCount(23);
  await page.locator('#layers button').first().click();await page.keyboard.press('Delete');await expect(page.locator('.element')).toHaveCount(22);
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
 await load(page,project());const before=await saved(page);const bad=project();bad.screens[0].elements[0].text=null;
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
