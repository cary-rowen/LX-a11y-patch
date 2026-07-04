import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
const activeElementId = () => page.evaluate(() => document.activeElement && document.activeElement.id);
const cdp = await page.context().newCDPSession(page);
const axName = async selector => {
  const rootNode = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: rootNode.root.nodeId, selector });
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const ax = await cdp.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false });
  return ax.nodes[0].name.value;
};
const axProperty = async (selector, propertyName) => {
  const rootNode = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: rootNode.root.nodeId, selector });
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const ax = await cdp.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false });
  return ax.nodes[0].properties.find(property => property.name === propertyName)?.value.value;
};
const axDescription = async selector => {
  const rootNode = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: rootNode.root.nodeId, selector });
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const ax = await cdp.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false });
  return ax.nodes[0].description?.value || '';
};

await page.goto(pathToFileURL(resolve(root, 'tests/smoke.html')).href);
await page.addStyleTag({ path: resolve(root, 'src/content.css') });
await page.addScriptTag({ content: await readFile(resolve(root, 'src/content.js'), 'utf8') });
await page.waitForTimeout(100);

assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
assert.equal(await page.locator('label[for="name"]').count(), 1);
assert.equal(await page.locator('.controls[role="radiogroup"]').count(), 1);
assert.equal(await page.locator('.controls[role="radiogroup"]').getAttribute('aria-required'), 'true');
assert.match(await page.locator('.controls[role="radiogroup"]').getAttribute('aria-describedby'), /group-help/);
assert.equal(await page.locator('#checkbox-controls').getAttribute('role'), 'group');
assert.equal(await page.locator('#checkbox-controls').getAttribute('aria-required'), null);
assert.match(await page.locator('#checkbox-controls').getAttribute('aria-describedby'), /required/);
await page.locator('#check-a').evaluate(element => {
  element.insertAdjacentHTML('afterend', '<span class="errorTip">请选择一项</span>');
  document.querySelector('#button').click();
});
await page.waitForTimeout(400);
assert.equal(await page.locator('#checkbox-controls').getAttribute('aria-invalid'), 'true');
await page.locator('#check-b').check();
await page.waitForTimeout(100);
assert.equal(await page.locator('#checkbox-controls').getAttribute('aria-invalid'), null);
assert.equal(await page.locator('#checkbox-controls').evaluate(element => element.closest('.control-group').querySelector(':scope > .lx-a11y-error') === null), true);
await page.locator('#app').check();
await page.waitForTimeout(100);
assert.equal(await page.locator('#app').getAttribute('aria-required'), null);
assert.equal(await page.locator('.control-label span').first().getAttribute('aria-hidden'), 'true');
assert.equal(await page.locator('#other-entry-text').getAttribute('tabindex'), '-1');
assert.equal(await page.locator('#other-entry-text').getAttribute('aria-required'), null);
assert.equal(await page.locator('#other-entry-text').getAttribute('placeholder'), '请补充说明');
assert.equal(await page.locator('#after-other').getAttribute('placeholder'), null);
assert.doesNotMatch(await page.locator('#other-entry-text').getAttribute('aria-describedby') || '', /group-help/);
assert.equal(await axName('#other-entry'), '其他');
assert.equal(await axName('#other-entry-text'), '其他');
assert.equal(await axProperty('#other-entry-text', 'required'), true);
assert.equal(await axDescription('#other-entry-text'), '请补充说明');

await page.locator('#other-entry-text').evaluate(element => element.classList.add('errorInput'));
await page.locator('#button').click();
await page.waitForTimeout(400);
assert.equal(await axProperty('#other-entry-text', 'invalid'), 'true');
assert.equal(await axDescription('#other-entry-text'), '请补充说明');
await page.locator('#other-entry-text').evaluate(element => element.classList.remove('errorInput'));
await page.waitForTimeout(100);
assert.equal(await page.locator('#lx-a11y-live-errors').textContent(), '');

await page.locator('#app').focus();
await page.keyboard.press('Tab');
assert.equal(await activeElementId(), 'after-other');
assert.equal(await page.locator('#other-entry').isChecked(), false);

await page.locator('#app').evaluate(element => element.classList.add('errorInput'));
await page.locator('#other-entry').check();
await page.waitForTimeout(100);
assert.equal(await page.locator('#app').getAttribute('aria-invalid'), null);
assert.equal(await page.locator('.controls[role="radiogroup"]').getAttribute('aria-invalid'), null);
await page.locator('#app').check();
await page.waitForTimeout(100);
assert.equal(await axProperty('#app', 'invalid'), 'false');

await page.locator('#after-other').focus();
await page.keyboard.press('Shift+Tab');
assert.match(await activeElementId(), /^(app|other-entry)$/);
assert.equal(await page.locator('#other-entry').isChecked(), false);

await page.locator('#other-entry').check();
await page.waitForTimeout(100);
assert.equal(await page.locator('#other-entry-text').getAttribute('tabindex'), null);
await page.locator('#other-entry').focus();
await page.keyboard.press('Tab');
assert.equal(await activeElementId(), 'other-entry-text');
assert.equal(await page.locator('#other-entry').isChecked(), true);

await page.locator('#app').check();
await page.waitForTimeout(100);
assert.equal(await page.locator('#other-entry-text').getAttribute('tabindex'), '-1');
await page.locator('#app').focus();
await page.keyboard.press('Tab');
assert.equal(await activeElementId(), 'after-other');
assert.equal(await page.locator('#other-entry').isChecked(), false);

assert.equal(await page.locator('#user-agreement-checkbox').getAttribute('aria-labelledby'), 'lx-a11y-user-agreement-label');

await page.evaluate(() => {
  const name = document.querySelector('#name');
  name.classList.add('errorInput');
  name.insertAdjacentHTML('afterend', '<span class="errorTip">required message</span>');
  document.querySelector('#button').click();
});
await page.waitForTimeout(400);

assert.equal(await page.locator('#name').getAttribute('aria-invalid'), 'true');
assert.match(await page.locator('#name').getAttribute('aria-describedby'), /error/);
assert.match(await page.locator('#lx-a11y-live-errors').textContent(), /1/);

await page.locator('a[href^="javascript"]').click();
await page.waitForTimeout(100);
assert.equal(await page.locator('#user-agreement-modal').getAttribute('role'), 'dialog');
assert.equal(await page.locator('#user-agreement-modal').getAttribute('aria-modal'), 'true');
await page.keyboard.press('Shift+Tab');
assert.equal(await page.locator('#user-agreement-modal').evaluate(dialog => dialog.contains(document.activeElement)), true);

await browser.close();
