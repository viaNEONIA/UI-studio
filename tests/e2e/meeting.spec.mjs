import {test,expect} from '@playwright/test';
import {jsPDF} from 'jspdf';
import JSZip from 'jszip';
import {readFile,writeFile} from 'node:fs/promises';
function samplePDF(){const pdf=new jsPDF({unit:'mm',format:'a4'});pdf.setFillColor(245,220,200);pdf.rect(0,0,210,297,'F');pdf.text('Dummy meeting page 1',20,30);pdf.addPage();pdf.setFillColor(200,230,245);pdf.rect(0,0,210,297,'F');pdf.text('Dummy meeting page 2',20,30);return Buffer.from(pdf.output('arraybuffer'))}
async function download(page,id){const pending=page.waitForEvent('download');await page.locator(id).click();return readFile(await(await pending).path())}
async function saved(page){return JSON.parse((await download(page,'#saveJson')).toString())}
async function importPDF(page){await page.locator('#documentFile').setInputFiles({name:'dummy.pdf',mimeType:'application/pdf',buffer:samplePDF()});await expect(page.locator('#meetingStatus')).toContainText('2ページを取り込みました',{timeout:60000})}
test.beforeEach(async({page})=>{await page.goto('/')});
test('PDF pages become locked bottom backgrounds; edits and full JSON/HTML round trip',async({page})=>{
 await page.locator('#preset').selectOption('794,1123');await importPDF(page);
 const p=await saved(page);expect(p.screens).toHaveLength(2);expect(p.screens[0].background.locked).toBe(true);expect(p.screens[0].background.src).toMatch(/^data:image\/png;base64,/);
 await expect(page.locator('#device > img.document-background')).toHaveCount(1);await expect(page.locator('#layers .background-row')).toHaveCount(1);
 await page.locator('#components button').filter({hasText:'テキスト'}).first().click();await page.locator('#pText').fill('打合せの確認事項');
 const annotated=await saved(page);expect(annotated.screens[0].elements).toHaveLength(1);
 await page.locator('#bgLocked').uncheck();await page.locator('#bgOpacity').fill('60');await page.locator('#bgOpacity').dispatchEvent('change');await expect(page.locator('.document-background')).toHaveCSS('opacity','0.6');
 await page.locator('#bgVisible').uncheck();await expect(page.locator('#device .document-background')).toHaveCount(0);await page.locator('#bgVisible').check();
 const final=await saved(page);await page.locator('#file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(final))});expect(await saved(page)).toEqual(final);
 const html=(await download(page,'#exportHtml')).toString();await page.setContent(html);await expect(page.locator('.screen img.document-background')).toHaveCount(2);await expect(page.locator('.screen.visible')).toContainText('打合せの確認事項');
});
test('PDF and PPTX export all pages at physical A4 size including backgrounds and SVG',async({page},testInfo)=>{
 test.setTimeout(120000);await page.locator('#preset').selectOption('794,1123');await importPDF(page);
 await page.locator('#components button').getByText('矢印',{exact:true}).click();
 const pdf=await download(page,'#exportPdf');expect(pdf.subarray(0,5).toString()).toBe('%PDF-');const text=pdf.toString('latin1');expect((text.match(/\/Type \/Page\b/g)||[])).toHaveLength(2);expect(text).toMatch(/595\.2\d* 841\.8\d*/);
 const pptx=await download(page,'#exportPptx'),zip=await JSZip.loadAsync(pptx);expect(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(2);expect(Object.keys(zip.files).filter(n=>/^ppt\/media\/.*\.png$/.test(n)).length).toBeGreaterThanOrEqual(2);expect(await zip.file('ppt/presentation.xml').async('string')).toContain('cx="7560000" cy="10692000"');
 const slide=await zip.file('ppt/slides/slide1.xml').async('string');expect(slide).toContain('<p:pic>');
 const media=Object.keys(zip.files).find(n=>/^ppt\/media\/.*\.png$/.test(n));const image=await zip.file(media).async('nodebuffer');await writeFile(testInfo.outputPath('meeting-export.png'),image);await writeFile(testInfo.outputPath('meeting.pdf'),pdf);await writeFile(testInfo.outputPath('meeting.pptx'),pptx);
 const pixel=await page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(50,50,1,1).data]},image.toString('base64'));expect(pixel[0]).toBeGreaterThan(235);expect(pixel[1]).toBeLessThan(230);expect(pixel[2]).toBeLessThan(215);
 // An exported PDF can itself be imported again, preserving both pages.
 await page.locator('#documentFile').setInputFiles({name:'exported.pdf',mimeType:'application/pdf',buffer:pdf});await expect(page.locator('#meetingStatus')).toContainText('2ページを取り込みました',{timeout:60000});expect((await saved(page)).screens).toHaveLength(4);
});
test('invalid PDF import is atomic and meeting controls navigate and preserve editing',async({page})=>{
 const before=await saved(page);await page.locator('#documentFile').setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});await expect(page.locator('#meetingStatus')).toContainText('処理失敗');expect(await saved(page)).toEqual(before);
 await importPDF(page);await page.locator('#meetingMode').click();await expect(page.locator('aside.left')).toBeHidden();await page.locator('#nextPage').click();await expect(page.locator('#pageCount')).toHaveText('2 / 2');await page.locator('#previousPage').click();await expect(page.locator('#pageCount')).toHaveText('1 / 2');await page.locator('#meetingMode').click();await expect(page.locator('aside.left')).toBeVisible();
});
test('local recovery preserves embedded backgrounds across reload',async({page})=>{
 await importPDF(page);await expect(page.locator('#recoveryStatus')).toContainText('保存済み',{timeout:15000});const before=await saved(page);await page.reload();await expect(page.locator('#recoveryPrompt')).toBeVisible();await page.locator('#restoreRecovery').click();await expect(page.locator('#meetingStatus')).toContainText('復旧データを読み込みました');expect(await saved(page)).toEqual(before);
});

test('standalone file imports PDF without network and background replacement preserves notes',async({page})=>{
 const {pathToFileURL}=await import('node:url');await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 const outbound=[];page.on('request',r=>{if(/^https?:/.test(r.url()))outbound.push(r.url())});await importPDF(page);
 await page.locator('#components button').getByText('テキスト',{exact:true}).click();await page.locator('#pText').fill('残す注記');
 const before=await saved(page),single=new jsPDF();single.text('Replacement',20,30);await page.locator('#replaceFile').setInputFiles({name:'replacement.pdf',mimeType:'application/pdf',buffer:Buffer.from(single.output('arraybuffer'))});await expect(page.locator('#meetingStatus')).toContainText('取り込みました');
 const after=await saved(page);expect(after.screens).toHaveLength(2);expect(after.screens[0].elements).toEqual(before.screens[0].elements);expect(after.screens[0].background.name).toContain('replacement.pdf');expect(outbound).toEqual([]);
 await page.locator('#bgRemove').click();expect((await saved(page)).screens[0].background).toBeUndefined();await page.locator('#undo').click();expect(await saved(page)).toEqual(after);
});
