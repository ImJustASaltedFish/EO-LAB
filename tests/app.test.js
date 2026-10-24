import { test, assert, assertEqual } from './harness.js';
import { loadPage } from './page.js';

test('app: laser page boots, turns the laser on and moves to step 1', async () => {
  const { frame, app, doc } = await loadPage('../laser.html?seed=7');
  assertEqual(app.errors.length, 0, `errors: ${app.errors.join(' | ')}`);
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.start.title'));
  assert(doc.querySelector('#viewport canvas'), '3D canvas created');
  assert(/^\d{2}:\d{2}$/.test(doc.querySelector('.timer').textContent), `timer shows mm:ss: ${doc.querySelector('.timer').textContent}`);
  doc.querySelector('[data-control="laser.power"]').click();
  assert(doc.querySelector('.checklist li').classList.contains('pass'), 'laser-on check passes');
  const next = doc.querySelector('.next-btn');
  assert(!next.disabled, 'next enabled');
  next.click();
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.s1.title'));
  assert(doc.querySelector('[data-control="a1.x"]') && doc.querySelector('[data-control="a2.x"]'), 'left–right controls for both irises');
  assertEqual(doc.querySelector('[data-control^="laser.pitch"], [data-control^="laser.yaw"]'), null, 'the laser has no tilt knobs');
  doc.querySelector('[data-control="a1.place"]').click();
  assert(app.getState().parts.a1.onRail, 'Aperture 1 placed on the rail');
  assert(app.getResult().segments.length > 0, 'beam traced');
  assertEqual(doc.querySelectorAll('.inset:not([hidden])').length, 2, 'step 1 shows the two iris close-ups');
  frame.remove();
});
