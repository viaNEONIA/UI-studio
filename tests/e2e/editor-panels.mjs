// Existing editor regressions enter a blank workspace; startup flow is tested separately.
export async function enterEditor(page){
 if(!await page.locator('#startupDialog').count())return;
 await page.waitForFunction(()=>document.querySelector('#startupDialog').dataset.stage!=='loading');
 if(!await page.locator('#startupDialog').evaluate(n=>n.open))return;
 if(await page.locator('#startupDialog').getAttribute('data-stage')==='choice')await page.locator('#startupNew').click();
 await page.locator('#startupBegin').click();await page.locator('#startupDialog').waitFor({state:'hidden'});await page.locator('#zoom').evaluate(n=>{n.value='0.65';n.dispatchEvent(new Event('change',{bubbles:true}))});
}
export async function expandEditorPanels(page){await enterEditor(page);await page.locator('aside details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true))}
