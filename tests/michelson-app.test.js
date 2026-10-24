import { test, assert, assertEqual } from './harness.js';
import { loadPage } from './page.js';

test('michelson app: boots, turns the laser on and places the beam splitter from the panel', async () => {
  const { frame, app, doc } = await loadPage('../michelson.html?seed=3');
  assertEqual(app.errors.length, 0, `errors: ${app.errors.join(' | ')}`);
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.miStart.title'));
  assert(doc.querySelector('#viewport canvas'), '3D canvas created');
  assert(/^\d{2}:\d{2}$/.test(doc.querySelector('.timer').textContent), 'timer shows mm:ss');
  doc.querySelector('[data-control="laser.power"]').click();
  doc.querySelector('.next-btn').click();
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.mi1.title'));
  doc.querySelector('[data-control="bs.add"]').click();
  const { bs } = app.getState().parts;
  assert(bs.placed && bs.pos.x === 0 && bs.pos.z === 0.3, `placed at the layout-guide hole: ${JSON.stringify(bs.pos)}`);
  assert(app.getResult().bsHit, 'the beam hits it');
  doc.querySelector('[data-control="bs.awayLaser"]').click();
  assertEqual(app.getState().parts.bs.pos.z, 0.325, 'one hole farther along the beam');
  doc.querySelector('.hint-btn').click();
  assert(!doc.querySelector('.tip').hidden, 'the first hint press shows a tip');
  assertEqual(doc.querySelectorAll('.inset:not([hidden])').length, 2, 'iris and screen close-ups');
  frame.remove();
});
