// Existing editor regressions enter a blank workspace; startup flow is tested separately.
export async function enterEditor(page){
 if(!await page.locator('#startupDialog').count())return;
 await page.waitForFunction(()=>document.querySelector('#startupDialog').dataset.stage!=='loading');
 if(!await page.locator('#startupDialog').evaluate(n=>n.open))return;
 if(await page.locator('#startupDialog').getAttribute('data-stage')==='choice')await page.locator('#startupNew').click();
 await page.locator('#startupBegin').click();await page.locator('#startupDialog').waitFor({state:'hidden'});await page.locator('#zoom').evaluate(n=>{n.value='0.65';n.dispatchEvent(new Event('change',{bubbles:true}))});
}
export async function expandEditorPanels(page){await enterEditor(page);await page.locator('aside details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true))}

// Confirm the new shape placement flow in existing editing regressions.
export async function placePendingObject(page){
 if(!await page.locator('#device').getAttribute('data-placement'))return;
 const rect=await page.locator('#device').boundingBox(),z=Number(await page.locator('#zoom').inputValue());
 const size=await page.locator('#device').evaluate(n=>[n.clientWidth,n.clientHeight]);
 await page.mouse.click(rect.x+(size[0]/2+2)*z,rect.y+(size[1]/2+2)*z);await page.keyboard.press('Enter');
}

// Legacy geometry regressions explicitly confirm the two clicks that used to
// commit immediately. Workflow-v2 tests exercise unconfirmed drafts directly.
export async function confirmTwoPointDraft(page){
 const type=await page.locator('#device').getAttribute('data-drawing-type');
 if(['line','arrow','guide'].includes(type)&&await page.locator('#finishDrawing').isEnabled())await page.keyboard.press('Enter');
}
export async function freezePendingPlacement(page){
 const type=await page.locator('#device').getAttribute('data-drawing-type');
 if(['placement','axisGuide'].includes(type)&&!await page.locator('#finishDrawing').isEnabled()){await page.mouse.down();await page.mouse.up()}
}
export async function placeDefaultLine(page){
 const type=await page.locator('#device').getAttribute('data-drawing-type');if(!['line','arrow','polyline','curve'].includes(type))return;
 const d=await page.locator('#device').boundingBox(),z=Number(await page.locator('#zoom').inputValue()),size=await page.locator('#device').evaluate(n=>[n.clientWidth,n.clientHeight]),cx=size[0]/2,cy=size[1]/2,curved=['polyline','curve'].includes(type),pts=curved?[[cx-120,cy+60],[cx,cy-60],[cx+120,cy+60]]:[[cx-120,cy-40],[cx+120,cy+40]];
 for(const [x,y]of pts)await page.mouse.click(d.x+(x+2)*z,d.y+(y+2)*z);await page.keyboard.press('Enter');await page.keyboard.press('Escape');
}
