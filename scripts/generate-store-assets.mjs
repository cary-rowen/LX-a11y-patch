import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = resolve(root, 'assets/store');
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const launchOptions = existsSync(chromePath) ? { executablePath: chromePath } : {};

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, ...launchOptions });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

async function loadDemo() {
  await page.setContent(demoHtml(), { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ path: resolve(root, 'src/content.css') });
  await page.addStyleTag({ content: demoCss() });
  await page.addScriptTag({ content: await readFile(resolve(root, 'src/content.js'), 'utf8') });
  await page.waitForTimeout(150);
}

await loadDemo();
await page.locator('#name').focus();
await page.screenshot({ path: resolve(outDir, 'screenshot-1-keyboard-focus-1280x800.png') });

await loadDemo();
await page.evaluate(() => {
  const name = document.querySelector('#name');
  name.classList.add('errorInput');
  name.insertAdjacentHTML('afterend', '<span class="errorTip">Please enter your name.</span>');
  document.querySelector('#button').click();
});
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(outDir, 'screenshot-2-errors-1280x800.png') });

await loadDemo();
await page.locator('#agreement-link').click();
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(outDir, 'screenshot-3-dialog-1280x800.png') });

await renderPromo(page, 440, 280, smallPromoHtml(), 'promo-small-440x280.png');
await renderPromo(page, 1400, 560, marqueePromoHtml(), 'promo-marquee-1400x560.png');

await browser.close();

await writeFile(resolve(outDir, 'README.md'), `# Chrome Web Store Assets

Generated with:

\`\`\`powershell
npm run assets:store
\`\`\`

The screenshots use a local synthetic Lingxi-like demo form with the extension content script injected. Do not use private or real submitted Lingxi form pages for store assets or tests.
`);

async function renderPromo(page, width, height, html, fileName) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: resolve(outDir, fileName) });
}

function demoHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Lingxi form accessibility demo</title>
  <script>
    document.addEventListener('focusin', event => {
      if (event.target.id === 'other-entry-text') {
        document.querySelector('#other-entry').checked = true;
      }
    });
  </script>
</head>
<body>
  <main class="page-shell content">
    <section class="hero">
      <div>
        <p class="eyebrow">Unofficial accessibility patch</p>
        <h3 class="h3-head"><span class="title">Lingxi form demo</span></h3>
      </div>
      <p class="status">Extension enabled locally</p>
    </section>
    <form id="lingxi_form" class="form-card">
      <ul class="list_display">
        <li id="form_tip">
          <span>Demo notice. <a id="btn_clear" onclick="window.cleared = true">Clear fields</a></span>
        </li>
        <li>
          <div class="control-group">
            <label class="control-label">Name <span>*</span></label>
            <div class="controls">
              <input id="name" name="name" type="text" require="true" value=""/>
            </div>
          </div>
        </li>
        <li class="choice-group">
          <div class="control-group">
            <label class="control-label">How did you hear about this event? <span>*</span></label>
            <div class="controls">
              <label><input id="newsletter" name="entry" type="radio" data-require="1"> Newsletter</label>
              <label><input id="friend" name="entry" type="radio" data-require="1"> Friend</label>
              <label><input id="other-entry" name="entry" type="radio" data-require="1"> Other <input id="other-entry-text" type="text" name="other_entry" placeholder="Please specify"></label>
            </div>
          </div>
        </li>
        <li>
          <div class="control-group">
            <label class="control-label">Notes</label>
            <div class="controls">
              <textarea id="notes" name="notes" rows="4" placeholder="Optional"></textarea>
            </div>
          </div>
        </li>
        <div class="text-center">
          <input type="checkbox" id="user-agreement-checkbox" name="user-agreement-checkbox">
          <span>I have read and agree to the</span>
          <a id="agreement-link" href="javascript:void(0)" onclick="document.querySelector('#user-agreement-modal').classList.add('open')">user agreement</a>
          <input type="button" id="button" class="submit-btn" value="Submit">
        </div>
      </ul>
    </form>
    <footer class="footer">Synthetic demo page, shown with local accessibility patch behavior.</footer>
  </main>
  <div id="user-agreement-modal">
    <h4>Version information</h4>
    <p>This modal demonstrates dialog semantics and focus handling added locally by the extension.</p>
    <a href="#close-modal" onclick="document.querySelector('#user-agreement-modal').classList.remove('open')">Close</a>
  </div>
</body>
</html>`;
}

function demoCss() {
  return `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #eef3f8;
      color: #17212b;
      font-family: Arial, Helvetica, sans-serif;
    }
    .page-shell {
      width: 100%;
      max-width: 980px;
      margin: 0 auto;
      padding: 42px 32px 30px;
    }
    .hero {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 22px;
    }
    .eyebrow {
      margin: 0 0 8px;
      color: #40566d;
      font-size: 16px;
      font-weight: 700;
    }
    .h3-head {
      margin: 0;
      font-size: 38px;
      line-height: 1.12;
    }
    .status {
      margin: 0;
      padding: 8px 12px;
      border: 1px solid #b9c7d8;
      border-radius: 6px;
      color: #20384f;
      background: #fff;
      font-size: 15px;
      font-weight: 700;
    }
    .form-card {
      background: #fff;
      border: 1px solid #c7d2df;
      border-radius: 8px;
      box-shadow: 0 14px 36px rgba(27, 47, 69, 0.12);
      padding: 24px 28px 28px;
    }
    .list_display {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .list_display > li,
    .lx-a11y-generated-list-item {
      margin: 0 0 22px;
    }
    #form_tip {
      padding: 12px 14px;
      background: #f4f8fb;
      border: 1px solid #d6e1eb;
      border-radius: 6px;
    }
    .control-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 700;
      font-size: 17px;
    }
    input[type="text"],
    textarea {
      width: 100%;
      border: 1px solid #8393a6;
      border-radius: 6px;
      padding: 10px 12px;
      font: inherit;
      background: #fff;
    }
    .controls > label {
      display: block;
      margin: 8px 0;
      line-height: 1.6;
    }
    .controls > label input[type="text"] {
      width: 280px;
      margin-left: 10px;
    }
    .text-center {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
    }
    .submit-btn {
      margin-left: auto;
      min-width: 120px;
      border: 0;
      border-radius: 6px;
      padding: 11px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .errorInput {
      border-color: #b00020 !important;
    }
    .errorTip {
      display: block;
      margin-top: 7px;
      color: #b00020;
      font-weight: 700;
    }
    .footer {
      margin-top: 18px;
      color: #53687e;
      font-size: 14px;
    }
    #user-agreement-modal {
      display: none;
      position: fixed;
      inset: 120px auto auto 50%;
      transform: translateX(-50%);
      width: 520px;
      padding: 28px;
      background: #fff;
      border: 1px solid #7c8da1;
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(20, 35, 50, 0.28);
      z-index: 10;
    }
    #user-agreement-modal.open {
      display: block;
    }
    #user-agreement-modal h4 {
      margin: 0 0 12px;
      font-size: 24px;
    }
    #user-agreement-modal p {
      margin: 0 0 18px;
      line-height: 1.5;
    }
  `;
}

function promoBase(width, height, content) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
      color: #14212f;
      background: #f3f7fb;
    }
    .asset {
      width: ${width}px;
      height: ${height}px;
      display: grid;
      background: linear-gradient(135deg, #f7fbff 0%, #dce8f5 100%);
      position: relative;
    }
    .mark {
      display: inline-grid;
      place-items: center;
      width: 68px;
      height: 68px;
      border-radius: 16px;
      background: #006fd6;
      box-shadow: 0 12px 28px rgba(0, 74, 150, 0.24);
    }
    .mark::before {
      content: "";
      width: 34px;
      height: 19px;
      border-left: 7px solid #fff;
      border-bottom: 7px solid #fff;
      transform: rotate(-45deg) translate(2px, -2px);
    }
    .panel {
      border: 1px solid rgba(88, 107, 128, 0.28);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 18px 44px rgba(38, 59, 83, 0.18);
    }
    ${content.css}
  </style>
</head>
<body>
  <div class="asset">${content.body}</div>
</body>
</html>`;
}

function smallPromoHtml() {
  return promoBase(440, 280, {
    css: `
      .asset { padding: 30px; align-content: center; }
      h1 { margin: 18px 0 8px; font-size: 32px; line-height: 1.08; letter-spacing: 0; }
      p { margin: 0; font-size: 16px; line-height: 1.35; color: #33495f; }
    `,
    body: `
      <div>
        <div class="mark"></div>
        <h1>Accessible Lingxi forms</h1>
        <p>Screen reader and keyboard fixes for generated form pages.</p>
      </div>
    `
  });
}

function marqueePromoHtml() {
  return promoBase(1400, 560, {
    css: `
      .asset {
        grid-template-columns: 0.9fr 1.1fr;
        gap: 48px;
        align-items: center;
        padding: 64px 84px;
      }
      h1 { margin: 22px 0 16px; font-size: 62px; line-height: 1.02; letter-spacing: 0; max-width: 560px; }
      p { margin: 0; font-size: 24px; line-height: 1.35; color: #33495f; max-width: 540px; }
      .panel { padding: 28px; }
      .question { margin-bottom: 18px; }
      .label { font-size: 22px; font-weight: 700; margin-bottom: 10px; }
      .input { height: 48px; border: 3px solid #0a66c2; border-radius: 6px; background: #fff; }
      .option { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 20px; }
      .radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #4a6076; background: #fff; }
      .meta { margin-top: 22px; padding-top: 18px; border-top: 1px solid #d1dce8; color: #40566d; font-size: 18px; }
    `,
    body: `
      <section>
        <div class="mark"></div>
        <h1>Lingxi form accessibility patch</h1>
        <p>Unofficial local fixes for labels, focus, errors, groups, and dialog behavior.</p>
      </section>
      <section class="panel">
        <div class="question">
          <div class="label">Name</div>
          <div class="input"></div>
        </div>
        <div class="question">
          <div class="label">How did you hear about this?</div>
          <div class="option"><span class="radio"></span><span>Newsletter</span></div>
          <div class="option"><span class="radio"></span><span>Other, with safe keyboard flow</span></div>
        </div>
        <div class="meta">Runs locally. No data collection.</div>
      </section>
    `
  });
}
