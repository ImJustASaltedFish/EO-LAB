// Lobby page: translated cards and the language switch.
import { t, getLanguage, setLanguage, onLanguageChange, applyTranslations } from './i18n/index.js';

function render() {
  applyTranslations(document);
  document.documentElement.lang = getLanguage() === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  document.title = t('app.title');
  document.querySelector('.lang-btn').textContent = t('ui.switchLanguage');
}

document.querySelector('.lang-btn').addEventListener('click', () => setLanguage(getLanguage() === 'zh-TW' ? 'en' : 'zh-TW'));
onLanguageChange(render);
render();
window.eolabLobby = { ready: true, t };
