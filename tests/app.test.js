import { test, assert, assertEqual } from './harness.js';

function loadPage(src) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1200px;height:800px;position:absolute;left:-9999px;top:0;border:0';
    frame.src = src;
    document.body.appendChild(frame);
    const started = Date.now();
    const poll = () => {
      const app = frame.contentWindow && frame.contentWindow.eolab;
      if (app && app.ready) {
        resolve({ frame, app, doc: frame.contentDocument });
      } else if (app && app.errors.length) {
        reject(new Error(`page errors: ${app.errors.join(' | ')}`));
      } else if (Date.now() - started > 30000) {
        reject(new Error('page did not become ready'));
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}

test('app: laser page boots, turns the laser on and moves to step 1', async () => {
  const { frame, app, doc } = await loadPage('../laser.html?seed=7');
  assertEqual(app.errors.length, 0, `errors: ${app.errors.join(' | ')}`);
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.start.title'));
  assert(doc.querySelector('#viewport canvas'), '3D canvas created');
  doc.querySelector('[data-control="laser.power"]').click();
  assert(doc.querySelector('.checklist li').classList.contains('pass'), 'laser-on check passes');
  const next = doc.querySelector('.next-btn');
  assert(!next.disabled, 'next enabled');
  next.click();
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.s1.title'));
  doc.querySelector('[data-control="a1.place"]').click();
  assert(app.getState().parts.a1.onRail, 'Aperture 1 placed on the rail');
  assert(app.getResult().segments.length > 0, 'beam traced');
  assertEqual(doc.querySelectorAll('.inset:not([hidden])').length, 2, 'step 1 shows the two iris close-ups');
  frame.remove();
});
