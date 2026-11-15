import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {enterEditor,expandEditorPanels} from './editor-panels.mjs';
const legacy={version:1,width:320,height:200,screens:[{id:'old',name:'旧データ',elements:[{id:'old-box',type:'box',name:'確認事項',x:20,y:20,w:120,h:80,text:'引継ぎ確認',bg:'#dbeafe',color:'#172235',font:16,radius:0}]}]};
async function download(page,id){const wait=page.waitForEvent('download');await page.locator(id).click();const d=await wait;return{name:d.suggestedFilename(),bytes:await readFile(await d.path())}}
async function load(page,p=legacy){await page.locator('#file').setInputFiles({name:'ui-studio-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))})}
test('editor and HTML preview use the new name and legacy JSON still round trips unchanged',async({page},info)=>{
 await page.goto('/');await expect(page).toHaveTitle('会議ノート v0.6');await enterEditor(page);await expect(page.locator('.brand')).toContainText('会議ノート');await expect(page.locator('.brand')).not.toContainText('UI Studio');await load(page);const json=await download(page,'#saveJson');expect(json.name).toBe('会議ノート.json');expect(JSON.parse(json.bytes.toString())).toEqual(legacy);const html=await download(page,'#exportHtml');expect(html.name).toBe('会議ノート-閲覧用.html');expect(html.bytes.toString()).toContain('<title>会議ノート — 閲覧用</title>');await page.screenshot({path:info.outputPath('kaigi-note-editor.png')});
});
test('old property presets and cursor preference remain usable under the new name',async({page})=>{
 const settings={version:1,presets:[{id:'old-preset',name:'旧版の赤い四角',type:'box',values:{w:150,h:100,bg:'#ef4444',color:'#172235',font:20,radius:4}}],defaults:{box:'old-preset'}};
 await page.addInitScript(settings=>{localStorage.setItem('ui-studio-property-presets-v1',JSON.stringify(settings));localStorage.setItem('ui-studio-crosshair','true')},settings);await page.goto('/');await expandEditorPanels(page);await expect(page.locator('#crosshairCursor')).toBeChecked();await page.locator('#quickBox').click();const json=JSON.parse((await download(page,'#saveJson')).bytes.toString());expect([json.screens[0].elements[0].bg,json.screens[0].elements[0].font]).toEqual(['#ef4444',20]);await page.locator('#propertyPresetPanel summary').evaluate(n=>n.parentElement.open=true);const config=await download(page,'#exportPropertyPresets');expect(config.name).toBe('会議ノート-プロパティ設定.json');expect(JSON.parse(config.bytes.toString())).toEqual(settings);
});
test('old IndexedDB recovery is offered by the renamed startup and restores without migration loss',async({page})=>{
 await page.goto('/');await expect(page.locator('#startupSetup')).toBeVisible();await page.evaluate(async p=>{const db=await new Promise(resolve=>{const r=indexedDB.open('ui-studio-recovery',1);r.onsuccess=()=>resolve(r.result)});await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(JSON.stringify(p),'latest');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()},legacy);await page.reload();await expect(page.locator('#startupChoices')).toBeVisible();await expect(page.locator('#startupTitle')).toHaveText('会議ノートを開始');await page.locator('#startupRestore').click();expect(JSON.parse((await download(page,'#saveJson')).bytes.toString())).toEqual(legacy);
});
test('PNG, PDF and PPTX filenames and presentation author use the new product name',async({page})=>{
 await page.goto('/');await enterEditor(page);await load(page);const png=await download(page,'#exportPng');expect(png.name).toBe('会議ノート-ページ-1.png');expect(png.bytes.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));const pdf=await download(page,'#exportPdf');expect(pdf.name).toBe('会議ノート.pdf');expect(pdf.bytes.subarray(0,4).toString()).toBe('%PDF');const pptx=await download(page,'#exportPptx');expect(pptx.name).toBe('会議ノート.pptx');const zip=await JSZip.loadAsync(pptx.bytes);expect(await zip.file('docProps/core.xml').async('string')).toContain('会議ノート');
});
test('local unbuilt HTML also shows the new name and imports legacy JSON',async({page})=>{
 const{pathToFileURL}=await import('node:url');await page.goto(pathToFileURL(process.cwd()+'/index.html').href);await enterEditor(page);await expect(page).toHaveTitle('会議ノート v0.6');await expect(page.locator('.brand')).toContainText('会議ノート');await load(page);expect(JSON.parse((await download(page,'#saveJson')).bytes.toString())).toEqual(legacy);
});
