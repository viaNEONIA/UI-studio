// Existing editor regression tests explicitly open settings; default layout is tested separately.
export async function expandEditorPanels(page){await page.locator('aside details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true))}
