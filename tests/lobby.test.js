import { test, assert, assertEqual } from './harness.js';

test('lobby: shows the experiment cards and switches language', async () => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:900px;height:700px;position:absolute;left:-9999px;top:0;border:0';
  frame.src = '../index.html';
  document.body.appendChild(frame);
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (frame.contentWindow && frame.contentWindow.eolabLobby && frame.contentWindow.eolabLobby.ready) resolve();
      else if (Date.now() - started > 20000) reject(new Error('lobby did not load'));
      else setTimeout(poll, 50);
    };
    poll();
  });
  const doc = frame.contentDocument;
  const { t } = frame.contentWindow.eolabLobby;
  assertEqual(doc.querySelector('h1').textContent, t('app.title'));
  assertEqual(doc.querySelectorAll('.card').length, 3);
  assert(doc.querySelector('.card a[href="./laser.html"]'), 'link to Experiment 1');
  assert(doc.querySelector('.card a[href="./michelson.html"]'), 'link to the Michelson');
  const before = doc.querySelector('h1').textContent;
  doc.querySelector('.lang-btn').click();
  assert(doc.querySelector('h1').textContent !== before, 'title changes language');
  doc.querySelector('.lang-btn').click();
  frame.remove();
});
