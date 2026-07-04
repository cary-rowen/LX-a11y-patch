(() => {
  'use strict';

  const FORM_SELECTOR = '#lingxi_form, form.js-app-formfill-form, form.form_content[action*="/Formfill/submit"]';
  const SUBMIT_SELECTOR = [
    '#button',
    '.submit-btn',
    'input[type="submit"]',
    'button[type="submit"]',
    'input[type="button"][onclick*="check_form_submit"]',
    'button[onclick*="check_form_submit"]'
  ].join(',');
  const CLEAR_SELECTOR = '#btn_clear, [onclick*="clearInput"]';
  const AGREEMENT_OPENER_SELECTOR = 'a[href^="javascript:showAgreement"], [onclick*="showAgreement"]';
  const AGREEMENT_DIALOG_SELECTOR = '#user-agreement-modal, [id$="agreement-modal"], .modal[id*="agreement"]';
  const TEXT_CONTROL_SELECTOR = [
    'input:not([type])',
    'input[type="text"]',
    'input[type="number"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="url"]',
    'input[type="search"]',
    'textarea',
    'select'
  ].join(',');
  const OPTION_SELECTOR = 'input[type="radio"], input[type="checkbox"]';
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  let idCounter = 0;
  let submitAttempted = false;
  let observerQueued = false;
  let lastDialogTrigger = null;
  let pendingDialogFocus = false;
  let dialogWasVisible = false;

  function init() {
    if (!document.querySelector(FORM_SELECTOR)) return;

    runFixes();
    bindEvents();

    const observer = new MutationObserver(queueRun);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = eventTargetElement(event.target);
      const form = document.querySelector(FORM_SELECTOR);
      const submit = target && target.closest(SUBMIT_SELECTOR);
      if (form && submit && form.contains(submit)) {
        submitAttempted = true;
        setTimeout(syncErrors, 50);
        setTimeout(syncErrors, 300);
      }

      const opener = target && target.closest(AGREEMENT_OPENER_SELECTOR);
      if (opener) {
        lastDialogTrigger = opener;
        pendingDialogFocus = true;
        scheduleDialogSync();
      }
    }, true);

    document.addEventListener('keydown', trapDialogFocus, true);

    document.addEventListener('change', event => {
      const target = eventTargetElement(event.target);
      if (!target || !target.matches(OPTION_SELECTOR)) return;
      const form = document.querySelector(FORM_SELECTOR);
      if (form && form.contains(target)) {
        fixNestedOptionTextTabStops(form);
        syncErrors();
      }
    }, true);
  }

  function queueRun() {
    if (observerQueued) return;
    observerQueued = true;
    requestAnimationFrame(() => {
      observerQueued = false;
      runFixes();
    });
  }

  function runFixes() {
    const form = document.querySelector(FORM_SELECTOR);
    if (!form) return;

    fixDocument();
    fixLandmarks();
    fixListStructure(form);
    fixTextControlLabels(form);
    fixChoiceGroups(form);
    fixRequiredState(form);
    fixNestedOptionTextTabStops(form);
    fixClearControl(form);
    fixAgreementCheckbox(form);
    syncErrors();
    syncDialog();
  }

  function fixDocument() {
    if (!document.documentElement.getAttribute('lang')) {
      document.documentElement.setAttribute('lang', inferPageLanguage());
    }

    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;

    const parts = viewport.content
      .split(',')
      .map(part => part.trim())
      .filter(part => !/^maximum-scale\s*=/.test(part) && !/^user-scalable\s*=\s*no$/i.test(part));

    viewport.content = parts.join(', ');
  }

  function fixLandmarks() {
    const content = document.querySelector('.content');
    const title = document.querySelector('.h3-head .title, .h3-head');
    if (content) {
      content.setAttribute('role', 'main');
      if (title) content.setAttribute('aria-labelledby', ensureId(title, 'page-title'));
    }

    const heading = document.querySelector('.h3-head');
    if (heading) {
      heading.setAttribute('role', 'heading');
      heading.setAttribute('aria-level', '1');
    }

    document.querySelectorAll('.footer[role="contentinfo"]').forEach(footer => {
      footer.removeAttribute('role');
    });
  }

  function fixListStructure(form) {
    form.querySelectorAll('ul.list_display').forEach(list => {
      Array.from(list.children).forEach(child => {
        if (['LI', 'SCRIPT', 'TEMPLATE'].includes(child.tagName)) return;
        const item = document.createElement('li');
        item.className = 'lx-a11y-generated-list-item';
        child.before(item);
        item.append(child);
      });
    });
  }

  function fixTextControlLabels(form) {
    form.querySelectorAll('.control-group').forEach(group => {
      const question = group.querySelector('.control-label');
      const textControls = Array.from(group.querySelectorAll(TEXT_CONTROL_SELECTOR))
        .filter(control => control.type !== 'hidden');
      const options = group.querySelectorAll(OPTION_SELECTOR);

      textControls.forEach(normalizePlaceholder);

      if (question && textControls.length === 1 && options.length === 0) {
        const control = textControls[0];
        ensureId(control, 'control');

        if (question.tagName === 'LABEL' && !question.contains(control)) {
          question.setAttribute('for', control.id);
        } else {
          addIdRef(control, 'aria-labelledby', ensureId(question, 'label'));
        }
      }

      textControls.forEach(control => {
        if (labelNestedOptionTextControl(control)) return;
        if (hasAccessibleName(control)) return;
        const optionLabel = control.closest('label');
        const optionText = cleanText(optionLabel && optionLabel.textContent).replace(cleanText(control.value), '');
        const placeholder = normalizePlaceholder(control);
        const name = [optionText, placeholder].filter(Boolean).join(' ').trim();
        if (name) control.setAttribute('aria-label', name);
      });

      const help = group.querySelector('.muted');
      if (isExposedText(help)) {
        textControls
          .filter(control => !isNestedOptionTextControl(control))
          .forEach(control => addIdRef(control, 'aria-describedby', ensureId(help, 'help')));
      }
    });
  }

  function labelNestedOptionTextControl(control) {
    const optionLabel = nestedOptionLabel(control);
    const option = optionLabel && optionLabel.querySelector(OPTION_SELECTOR);
    if (!option) return false;

    const optionText = optionLabelText(optionLabel, control);
    const placeholder = normalizePlaceholder(control);
    const name = optionText || placeholder;
    if (optionText && !option.getAttribute('aria-label') && !option.getAttribute('aria-labelledby')) {
      option.setAttribute('aria-label', optionText);
    }
    if (name) control.setAttribute('aria-label', name);
    addUsefulPlaceholderDescription(control);
    return Boolean(name);
  }

  function isNestedOptionTextControl(control) {
    return Boolean(nestedOptionLabel(control));
  }

  function nestedOptionLabel(control) {
    const optionLabel = control.closest('label');
    return optionLabel && optionLabel.querySelector(OPTION_SELECTOR) ? optionLabel : null;
  }

  function optionLabelText(label, excludedControl) {
    const parts = [];
    label.childNodes.forEach(node => collectLabelText(node, excludedControl, parts));
    return stripRequiredMarkers(parts.join(' '));
  }

  function collectLabelText(node, excludedControl, parts) {
    if (node === excludedControl) return;

    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (
      node.matches('input, textarea, select, button, .errorTip, .lx-a11y-error') ||
      node.matches('.lx-a11y-sr-only') ||
      node.getAttribute('aria-hidden') === 'true' ||
      isRequiredMarkerText(node.textContent)
    ) {
      return;
    }

    node.childNodes.forEach(child => collectLabelText(child, excludedControl, parts));
  }

  function fixChoiceGroups(form) {
    form.querySelectorAll('.control-group').forEach(group => {
      const options = Array.from(group.querySelectorAll(OPTION_SELECTOR));
      if (!options.length) return;

      const question = group.querySelector('.control-label');
      const controls = group.querySelector('.controls') || group;
      const hasRadio = options.some(option => option.type === 'radio');

      controls.setAttribute('role', hasRadio ? 'radiogroup' : 'group');
      if (question) addIdRef(controls, 'aria-labelledby', ensureId(question, 'group-label'));

      const help = group.querySelector('.muted');
      if (isExposedText(help)) {
        addIdRef(controls, 'aria-describedby', ensureId(help, 'group-help'));
      }
    });
  }

  function fixRequiredState(form) {
    hideDecorativeRequiredMarkers(form);

    // ponytail: native required can break this third-party form's hidden conditional fields; expose state to AT without changing submission behavior.
    form.querySelectorAll(TEXT_CONTROL_SELECTOR).forEach(control => {
      if (control.required) {
        control.removeAttribute('aria-required');
      } else if (isRequired(control)) {
        control.setAttribute('aria-required', 'true');
      }
    });

    form.querySelectorAll(OPTION_SELECTOR).forEach(option => {
      if (!option.hasAttribute('required')) option.removeAttribute('aria-required');
    });

    form.querySelectorAll('.control-group').forEach(group => {
      const controls = group.querySelector('.controls');
      if (!controls) return;

      if (!Array.from(group.querySelectorAll(OPTION_SELECTOR)).some(isRequired)) {
        controls.removeAttribute('aria-required');
        removeIdRefsByPrefix(controls, 'aria-describedby', 'lx-a11y-required-');
      } else if (controls.getAttribute('role') === 'radiogroup') {
        controls.setAttribute('aria-required', 'true');
        removeIdRefsByPrefix(controls, 'aria-describedby', 'lx-a11y-required-');
      } else {
        controls.removeAttribute('aria-required');
        addIdRef(controls, 'aria-describedby', ensureGroupRequiredHint(group).id);
      }
    });
  }

  function hideDecorativeRequiredMarkers(form) {
    form.querySelectorAll('.control-label span, label span').forEach(span => {
      if (isRequiredMarkerText(span.textContent)) {
        span.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function fixNestedOptionTextTabStops(form) {
    form.querySelectorAll('label').forEach(label => {
      const option = label.querySelector(OPTION_SELECTOR);
      if (!option) return;

      label.querySelectorAll(TEXT_CONTROL_SELECTOR).forEach(control => {
        if (control.dataset.lxA11yOriginalTabindex === undefined) {
          control.dataset.lxA11yOriginalTabindex = control.getAttribute('tabindex') || '';
        }

        if (option.checked) {
          const original = control.dataset.lxA11yOriginalTabindex;
          if (original) control.setAttribute('tabindex', original);
          else control.removeAttribute('tabindex');
        } else {
          control.setAttribute('tabindex', '-1');
        }
      });
    });
  }

  function fixClearControl(form) {
    const clear = form.querySelector(CLEAR_SELECTOR);
    if (!clear || clear.dataset.lxA11yClearFixed) return;

    if (clear.tagName === 'A' && !clear.getAttribute('href')) clear.setAttribute('href', '#');
    clear.setAttribute('role', 'button');
    clear.setAttribute('aria-label', '\u6e05\u9664\u5df2\u586b\u5199\u5185\u5bb9');
    clear.dataset.lxA11yClearFixed = 'true';

    clear.addEventListener('click', event => {
      event.preventDefault();
    });

    clear.addEventListener('keydown', event => {
      if (event.key !== ' ') return;
      event.preventDefault();
      clear.click();
    });
  }

  function fixAgreementCheckbox(form) {
    const checkbox = findAgreementCheckbox(form);
    if (!checkbox || hasAccessibleName(checkbox)) return;

    const label = document.createElement('span');
    label.className = 'lx-a11y-sr-only';
    label.id = 'lx-a11y-user-agreement-label';
    label.textContent = '\u6211\u5df2\u9605\u8bfb\u5e76\u540c\u610f\u7528\u6237\u534f\u8bae';
    checkbox.after(label);
    checkbox.setAttribute('aria-labelledby', label.id);
  }

  function syncErrors() {
    const form = document.querySelector(FORM_SELECTOR);
    if (!form) return;

    const live = ensureLiveRegion(form);
    const invalidItems = new Set();

    form.querySelectorAll(TEXT_CONTROL_SELECTOR).forEach(control => {
      const invalid = control.classList.contains('errorInput') || control.classList.contains('border-error');
      removeIdRefsByPrefix(control, 'aria-describedby', 'lx-a11y-error-');
      if (!invalid) {
        control.removeAttribute('aria-invalid');
        removeControlDescription(control, 'error');
        restoreControlErrorTip(control);
        return;
      }

      const group = control.closest('.control-group');
      const tip = findControlErrorTip(control);
      const errorText = stripRequiredMarkers(tip && tip.textContent);
      if (errorText) {
        if (tip && errorText === cleanText(tip.textContent)) {
          removeControlDescription(control, 'error');
          addIdRef(control, 'aria-describedby', ensureId(tip, 'error'));
        } else {
          ensureControlDescription(control, 'error', errorText);
        }
      } else {
        removeControlDescription(control, 'error');
      }
      if (tip) hideControlErrorTip(control, tip);
      control.setAttribute('aria-invalid', 'true');
      invalidItems.add(group || control);
    });

    form.querySelectorAll('.control-group').forEach(group => {
      const options = Array.from(group.querySelectorAll(OPTION_SELECTOR));
      const controls = group.querySelector('.controls');
      if (!options.length) {
        if (controls) {
          controls.removeAttribute('aria-invalid');
          removeIdRefsByPrefix(controls, 'aria-describedby', 'lx-a11y-group-error-');
        }
        removeGeneratedGroupError(group);
        restoreGroupLabelErrorTips(group);
        return;
      }

      const invalidOptions = options
        .filter(option => option.classList.contains('errorInput') || option.classList.contains('border-error'));
      const groupErrorText = visibleGroupErrorText(group);
      options.forEach(option => {
        option.removeAttribute('aria-invalid');
        removeIdRefsByPrefix(option, 'aria-describedby', 'lx-a11y-group-error-');
      });
      if ((!invalidOptions.length && !groupErrorText) || !controls || hasChoiceSelection(options)) {
        if (controls) {
          controls.removeAttribute('aria-invalid');
          removeIdRefsByPrefix(controls, 'aria-describedby', 'lx-a11y-group-error-');
        }
        removeGeneratedGroupError(group);
        restoreGroupLabelErrorTips(group);
        return;
      }

      const error = ensureGroupError(group, groupErrorText);
      addIdRef(controls, 'aria-describedby', error.id);
      controls.setAttribute('aria-invalid', 'true');

      hideGroupLabelErrorTips(group);

      invalidItems.add(group);
    });

    if (submitAttempted && invalidItems.size) {
      live.textContent = `\u8868\u5355\u6709 ${invalidItems.size} \u5904\u9700\u8981\u4fee\u6b63\u3002\u8bf7\u68c0\u67e5\u5f53\u524d\u5b57\u6bb5\u6216\u9898\u7ec4\u7684\u9519\u8bef\u63d0\u793a\u3002`;
    } else if (submitAttempted) {
      live.textContent = '';
    }
  }

  function syncDialog() {
    const dialog = findAgreementDialog();
    if (!dialog) return;

    prepareDialog(dialog);

    const visible = isVisible(dialog);
    if (visible && (pendingDialogFocus || !dialogWasVisible)) {
      focusDialog(dialog);
      pendingDialogFocus = false;
    }
    if (!visible && dialogWasVisible && lastDialogTrigger && document.contains(lastDialogTrigger)) {
      lastDialogTrigger.focus();
    }

    dialogWasVisible = visible;
  }

  function scheduleDialogSync() {
    [50, 200, 600].forEach(delay => setTimeout(syncDialog, delay));
  }

  function prepareDialog(dialog) {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('tabindex', '-1');

    const title = getDialogTitle(dialog);
    dialog.setAttribute('aria-labelledby', ensureId(title, 'dialog-title'));
  }

  function getDialogTitle(dialog) {
    const existing = dialog.querySelector('.modal-title, h1, h2, h3');
    if (existing) return existing;

    let title = dialog.querySelector('#lx-a11y-dialog-title');
    if (!title) {
      title = document.createElement('h2');
      title.id = 'lx-a11y-dialog-title';
      title.className = 'lx-a11y-sr-only';
      title.textContent = '\u7528\u6237\u534f\u8bae';
      dialog.prepend(title);
    }
    return title;
  }

  function focusDialog(dialog) {
    const title = getDialogTitle(dialog);
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  }

  function trapDialogFocus(event) {
    const dialog = findAgreementDialog();
    if (!dialog || !isVisible(dialog)) return;

    if (event.key === 'Escape') {
      const close = dialog.querySelector('a[href="#close-modal"], button, [role="button"]');
      if (close) {
        event.preventDefault();
        close.click();
        setTimeout(syncDialog, 50);
      }
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(element => isVisible(element) && element.tabIndex >= 0);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!focusable.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function ensureGroupError(group, text) {
    let error = group.querySelector(':scope > .lx-a11y-error');
    if (error) {
      if (text) error.textContent = text;
      return error;
    }

    error = document.createElement('span');
    error.className = 'lx-a11y-error';
    error.id = uniqueId('group-error');
    error.textContent = text || cleanText(group.querySelector('.errorTip') && group.querySelector('.errorTip').textContent) || '\u6b64\u9898\u9700\u8981\u586b\u5199';

    const question = group.querySelector('.control-label');
    if (question) question.after(error);
    else group.prepend(error);
    return error;
  }

  function removeGeneratedGroupError(group) {
    const error = group.querySelector(':scope > .lx-a11y-error');
    if (error) error.remove();
  }

  function visibleGroupErrorText(group) {
    const tip = Array.from(group.querySelectorAll('.errorTip')).find(isVisible);
    return stripRequiredMarkers(tip && tip.textContent);
  }

  function hideGroupLabelErrorTips(group) {
    group.querySelectorAll('label .errorTip').forEach(tip => {
      tip.dataset.lxA11yGroupHidden = 'true';
      tip.setAttribute('aria-hidden', 'true');
    });
  }

  function restoreGroupLabelErrorTips(group) {
    group.querySelectorAll('label .errorTip[data-lx-a11y-group-hidden="true"]').forEach(tip => {
      tip.removeAttribute('aria-hidden');
      delete tip.dataset.lxA11yGroupHidden;
    });
  }

  function ensureGroupRequiredHint(group) {
    let hint = group.querySelector(':scope > .lx-a11y-required');
    if (hint) return hint;

    hint = document.createElement('span');
    hint.className = 'lx-a11y-sr-only lx-a11y-required';
    hint.id = uniqueId('required');
    hint.textContent = '\u5fc5\u586b';

    const question = group.querySelector('.control-label');
    if (question) question.after(hint);
    else group.prepend(hint);
    return hint;
  }

  function findControlErrorTip(control) {
    const label = control.closest('label');
    let sibling = control.nextElementSibling;
    while (sibling && (!label || label.contains(sibling))) {
      if (sibling.matches('.errorTip') && isVisible(sibling)) return sibling;
      if (sibling.matches(TEXT_CONTROL_SELECTOR)) break;
      sibling = sibling.nextElementSibling;
    }

    if (label) {
      const tips = Array.from(label.querySelectorAll('.errorTip')).filter(isVisible);
      if (tips.length === 1) return tips[0];
    }

    const group = control.closest('.control-group');
    const tips = group ? Array.from(group.querySelectorAll('.errorTip')).filter(isVisible) : [];
    return tips.length === 1 ? tips[0] : null;
  }

  function hideControlErrorTip(control, tip) {
    tip.dataset.lxA11yControlHiddenFor = ensureId(control, 'control');
    tip.setAttribute('aria-hidden', 'true');
  }

  function restoreControlErrorTip(control) {
    if (!control.id) return;
    const group = control.closest('.control-group');
    const scope = group || control.parentElement || document;
    scope.querySelectorAll(`.errorTip[data-lx-a11y-control-hidden-for="${CSS.escape(control.id)}"]`).forEach(tip => {
      delete tip.dataset.lxA11yControlHiddenFor;
      if (!tip.dataset.lxA11yGroupHidden) tip.removeAttribute('aria-hidden');
    });
  }

  function removeControlDescription(control, prefix) {
    const dataKey = `lxA11y${prefix[0].toUpperCase()}${prefix.slice(1)}Id`;
    const description = control.dataset[dataKey] && document.getElementById(control.dataset[dataKey]);
    if (description) description.remove();
    delete control.dataset[dataKey];
  }

  function hasChoiceSelection(options) {
    return options.some(option => option.checked);
  }

  function addUsefulPlaceholderDescription(control) {
    const text = normalizePlaceholder(control);
    if (text) ensureControlDescription(control, 'hint', text);
  }

  function ensureControlDescription(control, prefix, text) {
    const dataKey = `lxA11y${prefix[0].toUpperCase()}${prefix.slice(1)}Id`;
    let description = control.dataset[dataKey] && document.getElementById(control.dataset[dataKey]);
    if (!description) {
      description = document.createElement('span');
      description.className = 'lx-a11y-sr-only';
      description.id = uniqueId(prefix);
      const optionLabel = control.closest('label');
      if (optionLabel && optionLabel.querySelector(OPTION_SELECTOR)) optionLabel.after(description);
      else control.after(description);
      control.dataset[dataKey] = description.id;
    }
    description.textContent = text;
    addIdRef(control, 'aria-describedby', description.id);
    return description;
  }

  function ensureLiveRegion(form) {
    let live = document.querySelector('#lx-a11y-live-errors');
    if (live) return live;

    live = document.createElement('div');
    live.id = 'lx-a11y-live-errors';
    live.className = 'lx-a11y-sr-only';
    live.setAttribute('role', 'alert');
    live.setAttribute('aria-live', 'assertive');
    form.prepend(live);
    return live;
  }

  function isRequired(control) {
    const own = [
      control.getAttribute('required'),
      control.getAttribute('aria-required'),
      control.getAttribute('require'),
      control.getAttribute('data-require')
    ].join(' ');

    return /\b(true|1)\b/.test(own) || control.required === true;
  }

  function findAgreementCheckbox(form) {
    const byId = form.querySelector('#user-agreement-checkbox');
    if (byId) return byId;

    return Array.from(form.querySelectorAll('input[type="checkbox"]')).find(checkbox => {
      const identity = `${checkbox.id} ${checkbox.name}`.toLowerCase();
      if (identity.includes('agreement') || identity.includes('privacy')) return true;

      const nearby = checkbox.closest('label') || checkbox.parentElement;
      return /\u7528\u6237\u534f\u8bae|\u9690\u79c1|\u540c\u610f/.test(cleanText(nearby && nearby.textContent));
    }) || null;
  }

  function findAgreementDialog() {
    const dialogs = Array.from(document.querySelectorAll(AGREEMENT_DIALOG_SELECTOR));
    return dialogs.find(isVisible) || dialogs[0] || null;
  }

  function inferPageLanguage() {
    const sample = cleanText(`${document.title} ${document.body && document.body.innerText}`).slice(0, 5000);
    if (/[\u4e00-\u9fff]/.test(sample)) return 'zh-CN';
    return navigator.language || 'en';
  }

  function hasAccessibleName(control) {
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return true;
    if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return true;
    return Array.from(control.labels || []).some(label => label.contains(control));
  }

  function addIdRef(element, attribute, id) {
    if (!element || !id) return;
    const ids = new Set((element.getAttribute(attribute) || '').split(/\s+/).filter(Boolean));
    ids.add(id);
    element.setAttribute(attribute, Array.from(ids).join(' '));
  }

  function removeIdRefsByPrefix(element, attribute, prefix) {
    if (!element) return;
    const ids = (element.getAttribute(attribute) || '').split(/\s+/).filter(Boolean);
    const kept = ids.filter(id => !id.startsWith(prefix));
    if (kept.length) element.setAttribute(attribute, kept.join(' '));
    else element.removeAttribute(attribute);
  }

  function ensureId(element, prefix) {
    if (element.id) return element.id;
    element.id = uniqueId(prefix);
    return element.id;
  }

  function uniqueId(prefix) {
    let id;
    do {
      id = `lx-a11y-${prefix}-${++idCounter}`;
    } while (document.getElementById(id));
    return id;
  }

  function cleanText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function stripRequiredMarkers(value) {
    return cleanText(value)
      .replace(/(^|\s+)[*\uFF0A]+(?=\s+|$)/g, ' ')
      .replace(/(^|\s+)\u5fc5\u586b(?=\s+|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizePlaceholder(control) {
    const placeholder = control.getAttribute('placeholder');
    if (!placeholder) return '';

    const cleaned = stripRequiredMarkers(placeholder);
    if (cleaned === cleanText(placeholder)) return cleaned;

    if (control.dataset.lxA11yOriginalPlaceholder === undefined) {
      control.dataset.lxA11yOriginalPlaceholder = placeholder;
    }

    if (cleaned) control.setAttribute('placeholder', cleaned);
    else control.removeAttribute('placeholder');
    return cleaned;
  }

  function isRequiredMarkerText(value) {
    const text = cleanText(value);
    return /^[*\uFF0A]+$/.test(text) || text === '\u5fc5\u586b';
  }

  function isVisible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function isExposedText(element) {
    if (!element || !cleanText(element.innerText || element.textContent)) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getAttribute('aria-hidden') !== 'true';
  }

  function eventTargetElement(target) {
    if (!target) return null;
    return target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
