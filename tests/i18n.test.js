import { test, assert, assertEqual } from './harness.js';
import { dictionaries, t, setLanguage, getLanguage, applyTranslations } from '../js/i18n/index.js';
import { STEPS } from '../js/lab/steps.js';
import { STEPS as MI_STEPS } from '../js/michelson/steps.js';

test('i18n: zh-TW and en have the same keys and no empty strings', () => {
  const zh = Object.keys(dictionaries['zh-TW']).sort();
  const en = Object.keys(dictionaries.en).sort();
  assertEqual(zh.join('|'), en.join('|'), 'key sets differ');
  for (const lang of ['zh-TW', 'en']) {
    for (const [key, value] of Object.entries(dictionaries[lang])) assert(value.trim().length > 0, `${lang} ${key} is empty`);
  }
});

test('i18n: every key the steps and warnings use exists', () => {
  const missing = [];
  const need = (k) => {
    if (!(k in dictionaries['zh-TW'])) missing.push(k);
  };
  for (const step of STEPS) {
    need(`step.${step.id}.title`);
    need(`step.${step.id}.body`);
    step.checks.forEach((c) => need(`step.${step.id}.check.${c.id}`));
    for (let i = 1; i <= step.hints; i++) need(`step.${step.id}.hint.${i}`);
    step.questions.forEach((q) => need(`question.${q}`));
    step.insets.forEach((id) => need(`inset.${id}`));
    need(`ui.camera.${step.camera}`);
  }
  ['m3', 'm4', 'm5'].forEach((m) => need(`warning.${m}`));
  assertEqual(missing.join(', '), '', 'missing keys');
});

test('i18n: every key the Michelson steps, tips and warnings use exists', () => {
  const missing = [];
  const need = (k) => {
    if (!(k in dictionaries['zh-TW'])) missing.push(k);
  };
  for (const step of MI_STEPS) {
    need(`step.${step.id}.title`);
    need(`step.${step.id}.body`);
    step.checks.forEach((c) => need(`step.${step.id}.check.${c.id}`));
    for (let i = 1; i <= step.hints; i++) need(`step.${step.id}.hint.${i}`);
    step.questions.forEach((q) => need(`question.${q}`));
    step.insets.forEach((id) => need(`inset.${id}`));
    need(`ui.camera.${step.camera}`);
  }
  ['tip.mi1.bsOffBeam', 'tip.mi1.reflectedOff', 'tip.mi1.card', 'tip.mi2.mirrorOff', 'tip.mi2.arms', 'tip.mi2.spotOffH',
    'tip.mi2.spotOffV', 'tip.mi3.fine', 'tip.mi3.parallel', 'tip.mi3.contrast', 'tip.mi4.lensFar', 'tip.mi4.same',
    'warning.miBs', 'warning.miStage', 'warning.m5'].forEach(need);
  ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2', 'source'].forEach((id) => need(`part.${id}`));
  assertEqual(missing.join(', '), '', 'missing keys');
});

test('i18n: t() switches language, fills parameters and fills [data-i18n]', () => {
  const before = getLanguage();
  setLanguage('en');
  assertEqual(t('warning.m5', { step: '4' }), 'This part is used in step 4.');
  const el = document.createElement('div');
  el.innerHTML = '<span data-i18n="ui.next"></span>';
  applyTranslations(el);
  assertEqual(el.querySelector('span').textContent, 'Next');
  setLanguage('zh-TW');
  assertEqual(t('warning.m5', { step: '4' }), '這個元件在步驟 4 才會用到。');
  assertEqual(t('no.such.key'), 'no.such.key');
  setLanguage(before);
});
