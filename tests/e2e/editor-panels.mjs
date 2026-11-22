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
export async function placePendingObject(page,center){
 if(!await page.locator('#device').getAttribute('data-placement'))return;
 const rect=await page.locator('#device').boundingBox(),z=Number(await page.locator('#zoom').inputValue()),size=await page.locator('#device').evaluate(n=>[n.clientWidth,n.clientHeight]),cx=center?.x??size[0]/2,cy=center?.y??size[1]/2;
 await page.mouse.move(rect.x+(cx+2)*z,rect.y+(cy+2)*z);const kind=await page.locator('#device').getAttribute('data-placement-kind'),preview=page.locator('.placement-preview'),dimensions=await preview.evaluate(n=>({w:parseFloat(n.style.width),h:parseFloat(n.style.height)}));
 if(kind==='box'){await page.mouse.click(rect.x+(cx-dimensions.w/2+2)*z,rect.y+(cy-dimensions.h/2+2)*z);await page.mouse.click(rect.x+(cx+dimensions.w/2+2)*z,rect.y+(cy+dimensions.h/2+2)*z)}
 else if(kind==='circle'){await page.mouse.click(rect.x+(cx+2)*z,rect.y+(cy+2)*z);await page.mouse.move(rect.x+(cx+dimensions.w/2+2)*z,rect.y+(cy+2)*z);await page.mouse.click(rect.x+(cx+dimensions.w/2+2)*z,rect.y+(cy+2)*z)}
 else await page.mouse.click(rect.x+(cx+2)*z,rect.y+(cy+2)*z);
 if(await page.locator('#device').getAttribute('data-drawing-type'))await page.keyboard.press('Enter');
}

// Legacy geometry regressions explicitly confirm the two clicks that used to
// commit immediately. Workflow-v2 tests exercise unconfirmed drafts directly.
export async function confirmTwoPointDraft(page){
 const type=await page.locator('#device').getAttribute('data-drawing-type');
 if(['line','arrow','guide'].includes(type)&&await page.locator('#finishDrawing').isEnabled())await page.keyboard.press('Enter');
}
export async function freezePendingPlacement(page){
 const type=await page.locator('#device').getAttribute('data-drawing-type');if(!['placement','axisGuide'].includes(type)||await page.locator('#finishDrawing').isEnabled())return;
 const kind=await page.locator('#device').getAttribute('data-placement-kind'),phase=await page.locator('#device').getAttribute('data-placement-phase');
 if(['box','circle'].includes(kind)&&phase==='origin'){
  if(!await page.locator('.placement-preview').count())return;const b=await page.locator('.placement-preview').boundingBox();if(!b)return;
  if(kind==='box'){await page.mouse.click(b.x,b.y);await page.mouse.click(b.x+b.width,b.y+b.height)}else{await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.mouse.move(b.x+b.width,b.y+b.height/2);await page.mouse.click(b.x+b.width,b.y+b.height/2)}
 }else{await page.mouse.down();await page.mouse.up()}
}

export async function placeDefaultLine(page){
 const type=await page.locator('#device').getAttribute('data-drawing-type');if(!['line','arrow','polyline','curve'].includes(type))return;
 const d=await page.locator('#device').boundingBox(),z=Number(await page.locator('#zoom').inputValue()),size=await page.locator('#device').evaluate(n=>[n.clientWidth,n.clientHeight]),cx=size[0]/2,cy=size[1]/2,curved=['polyline','curve'].includes(type),pts=curved?[[cx-120,cy+60],[cx,cy-60],[cx+120,cy+60]]:[[cx-120,cy-40],[cx+120,cy+40]];
 for(const [x,y]of pts)await page.mouse.click(d.x+(x+2)*z,d.y+(y+2)*z);await page.keyboard.press('Enter');await page.keyboard.press('Escape');
}

// Follow the compact toolbar's visible menu before invoking its existing action.
export async function openToolbarControl(locator){
 const menu=locator.locator('xpath=ancestor::details[@data-toolbar-menu]');
 if(await menu.count()&&!await menu.evaluate(n=>n.open))await menu.locator(':scope > summary').click();
}
export async function clickToolbar(locator,options){await openToolbarControl(locator);await locator.click(options)}
export async function selectToolbar(locator,value){await openToolbarControl(locator);await locator.selectOption(value)}
