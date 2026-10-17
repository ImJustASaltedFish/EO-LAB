// UI strings: t(key) in the current language (default zh-TW), with {name} placeholders.
import zh from './zh-TW.js';
import en from './en.js';

const DICTS = { 'zh-TW': zh, en };
const STORAGE_KEY = 'eolab.lang';
const listeners = new Set();

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && DICTS[value] ? value : null;
  } catch {
    return null;
  }
}

let current = readStored() ?? 'zh-TW';

export const LANGUAGES = Object.freeze(Object.keys(DICTS));
export const dictionaries = DICTS;

export function getLanguage() {
  return current;
}

export function setLanguage(lang) {
  if (!DICTS[lang]) throw new Error(`unknown language: ${lang}`);
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage unavailable (private mode, blocked): the choice lasts for this page only.
  }
  document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  listeners.forEach((fn) => fn(lang));
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, params = {}) {
  const value = DICTS[current][key] ?? DICTS['zh-TW'][key];
  if (value === undefined) return key;
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}
