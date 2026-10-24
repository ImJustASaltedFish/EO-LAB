import { test, assert, assertEqual } from '../harness.js';
import { createPanel } from '../../js/ui/panel.js';

const t = (key) => key;
function mount() {
  const root = document.createElement('aside');
  document.getElementById('sandbox').appendChild(root);
  return root;
}

test('panel: renders checks, hints, think cards and the next button state', () => {
  const root = mount();
  let next = 0;
  let hint = 0;
  const panel = createPanel(root, { t, onNext: () => { next += 1; }, onHint: () => { hint += 1; }, onRestart() {} });
  panel.renderStep({
    stepId: 's1', checks: [{ id: 'closed', pass: true }, { id: 'positions', pass: false }],
    hintsShown: 1, hintCount: 4, questions: ['q3'], canAdvance: false, isLast: false,
  });
  const items = root.querySelectorAll('.checklist li');
  assertEqual(items.length, 2);
  assert(items[0].classList.contains('pass') && items[1].classList.contains('fail'), 'pass/fail classes');
  assertEqual(items[0].textContent, '✓step.s1.check.closed');
  assertEqual(root.querySelector('.step-title').textContent, 'step.s1.title');
  assertEqual(root.querySelectorAll('.hints li').length, 1);
  assertEqual(root.querySelectorAll('.think details').length, 1);
  assert(root.querySelector('.next-btn').disabled, 'next disabled until checks pass');
  root.querySelector('.hint-btn').click();
  assertEqual(hint, 1);
  panel.renderStep({
    stepId: 's1', checks: [{ id: 'closed', pass: true }], hintsShown: 4, hintCount: 4,
    questions: [], canAdvance: true, isLast: false,
  });
  assert(!root.querySelector('.next-btn').disabled, 'next enabled');
  assert(root.querySelector('.hint-btn').disabled, 'all hints shown');
  assertEqual(root.querySelector('.hint-btn').textContent, 'ui.noMoreHints');
  root.querySelector('.next-btn').click();
  assertEqual(next, 1);
  panel.renderReadouts([{ label: 'Power', value: '50.0 %' }]);
  assertEqual(root.querySelector('.readouts dd').textContent, '50.0 %');
  root.remove();
});

test('panel: think cards stay open while the same step re-renders; last step shows the summary', () => {
  const root = mount();
  const panel = createPanel(root, { t, onNext() {}, onHint() {}, onRestart() {} });
  const args = { stepId: 's2b', checks: [], hintsShown: 0, hintCount: 4, questions: ['q3'], canAdvance: false, isLast: false };
  panel.renderStep(args);
  root.querySelector('.think details').open = true;
  panel.renderStep(args);
  assert(root.querySelector('.think details').open, 'still open after a re-render');
  panel.renderStep({ ...args, stepId: 's3', questions: ['q1'] });
  assert(!root.querySelector('.think details').open, 'a new step starts closed');
  panel.renderStep({ ...args, stepId: 'done', hintCount: 0, questions: [], isLast: true, summary: ['line 1', 'line 2'] });
  assertEqual(root.querySelectorAll('.summary p').length, 2);
  assert(root.querySelector('.next-btn').hidden, 'no next button on the last step');
  assert(!root.querySelector('.summary-restart').hidden, 'restart offered');
  root.remove();
});

test('panel: a tip line shows under the hint button and hides again', () => {
  const root = mount();
  const panel = createPanel(root, { t, onNext() {}, onHint() {}, onRestart() {} });
  const tip = root.querySelector('.tip');
  assert(tip.hidden, 'hidden at first');
  panel.renderTip('M2 is 40 mm from the beam');
  assert(!tip.hidden && tip.textContent === 'M2 is 40 mm from the beam', 'shown');
  panel.renderTip(null);
  assert(tip.hidden, 'hidden again');
  root.remove();
});
