# Lingxi form accessibility patch

Chrome MV3 extension that patches accessibility issues on Lingxi-generated form pages.

## Purpose

This is an unofficial accessibility patch for real screen reader and keyboard problems found in Lingxi-generated forms. It is a temporary mitigation, not a replacement for platform-level fixes. Lingxi should fix these accessibility issues in its own form templates so all users benefit without installing an extension.

## Install locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this repository folder.

## What it fixes

- Adds missing page language, main/contentinfo landmarks, and mobile zoom support.
- Associates visible question text with text inputs and textareas.
- Gives radio and checkbox groups a programmatic group label.
- Exposes required state with `aria-required` without changing the site's custom validation flow.
- Prevents Tab and Shift+Tab navigation from accidentally selecting "Other" options that contain supplemental text fields.
- Converts the mouse-only clear link into a keyboard-reachable button-like control.
- Adds error relationships with `aria-invalid`, `aria-describedby`, and a live error summary after submit.
- Adds dialog semantics and focus management to the user agreement modal.
- Improves obvious contrast and focus indication issues.

## Test

```powershell
npm install
npm run validate
npm test
```

The test is a small Playwright smoke check against `tests/smoke.html`.
Set `CHROME_PATH` before `npm test` if Chrome is not installed at the default Windows path.

## Package for Chrome Web Store

```powershell
npm run validate
npm test
npm run assets:store
npm run package:chrome
```

The upload zip is written to `dist/`. Store listing copy is in `STORE_LISTING.md`, and the privacy policy text is in `PRIVACY.md`.
Chrome Web Store screenshots and promotional images are generated from a local synthetic demo form, not from any real Lingxi form submission page.

## License

MIT
