# Chrome Web Store Listing Draft

## Summary

Improves screen reader and keyboard support on Lingxi form pages.

## Description

Lingxi Form Accessibility Patch is an unofficial accessibility mitigation for Lingxi-generated forms. It improves labels, group semantics, required-state exposure, error relationships, keyboard focus, modal dialog behavior, and several contrast/focus issues.

This extension does not collect data and does not send network requests. It is a temporary patch for users who need better accessibility today. Lingxi should fix these issues in its own form templates so users do not need an extension.

## Single Purpose

Improve accessibility behavior on Lingxi-generated form pages.

## Permission Justification

No extension permissions are requested.

The extension uses content script match patterns for these Lingxi form URLs only:

- `https://ff.lingxi360.com/f*`
- `https://lxi.me/*`

## Privacy Practice

Data collection: none.

The extension runs locally in the browser, does not use analytics, does not include remote code, and does not make network requests.

## Store Assets To Prepare

- 128x128 PNG icon: included in `icons/icon-128.png`.
- Screenshots and promotional images: use the generated local synthetic demo assets in `assets/store/`.
- Support URL: use the GitHub repository issues page after publishing the repository.
