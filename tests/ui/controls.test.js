import { test, assert, assertEqual, assertClose } from '../harness.js';
import { createKnob, createSlider, createButton, createPositionControl } from '../../js/ui/controls.js';
import { showToast } from '../../js/ui/toast.js';

const labels = { fine: () => 'Fine', coarse: () => 'Coarse' };
const sandbox = () => document.getElementById('sandbox');
const press = (el) => {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
};

test('controls: knob steps by fine, coarse after toggling, and clamps', () => {
  const seen = [];
  const knob = createKnob({ label: 'Pitch', unit: 'mrad', value: 0, min: -1, max: 1, fine: 0.1, coarse: 0.5, onChange: (v) => seen.push(v), labels });
  sandbox().appendChild(knob.el);
  press(knob.el.querySelector('.plus'));
  assertClose(seen.at(-1), 0.1, 1e-12);
  knob.el.querySelector('.mode').click();
  assertEqual(knob.el.querySelector('.mode').textContent, 'Coarse');
  press(knob.el.querySelector('.plus'));
  assertClose(seen.at(-1), 0.6, 1e-12);
  press(knob.el.querySelector('.plus'));
  assertClose(seen.at(-1), 1, 1e-12, 'clamped at max');
  knob.el.remove();
});

test('controls: knob keyboard arrows (Shift = coarse) and disabled state', () => {
  const seen = [];
  const knob = createKnob({ label: () => 'Y', value: 0, min: -1, max: 1, fine: 0.1, coarse: 0.5, onChange: (v) => seen.push(v), labels });
  sandbox().appendChild(knob.el);
  const dial = knob.el.querySelector('.dial');
  dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assertClose(seen.at(-1), 0.1, 1e-12);
  dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
  assertClose(seen.at(-1), -0.4, 1e-12);
  knob.setEnabled(false);
  const count = seen.length;
  press(knob.el.querySelector('.plus'));
  dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assertEqual(seen.length, count, 'disabled knob ignores input');
  knob.el.remove();
});

test('controls: slider and button report changes', () => {
  let got = null;
  let clicks = 0;
  const slider = createSlider({
    label: 'Opening', unit: 'mm', value: 0.012, min: 0.001, max: 0.012, step: 0.0001,
    format: (v) => (v * 1e3).toFixed(1), onChange: (v) => { got = v; },
  });
  sandbox().appendChild(slider.el);
  const input = slider.el.querySelector('input');
  input.value = '0.005';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assertClose(got, 0.005, 1e-12);
  assertEqual(slider.el.querySelector('.control-value').textContent, '5.0 mm');
  const button = createButton({ label: 'Go', onClick: () => { clicks += 1; } });
  sandbox().appendChild(button.el);
  button.el.click();
  assertEqual(clicks, 1);
  slider.el.remove();
  button.el.remove();
});

test('controls: position control accepts typed millimetres and ± steps', () => {
  const seen = [];
  const pos = createPositionControl({ label: 'z', value: 0.1, fine: 0.001, coarse: 0.01, onChange: (z) => seen.push(z), labels });
  sandbox().appendChild(pos.el);
  assertEqual(pos.el.querySelector('input').value, '100');
  const input = pos.el.querySelector('input');
  input.value = '250';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  assertClose(seen.at(-1), 0.25, 1e-12);
  press(pos.el.querySelector('.plus'));
  assertClose(seen.at(-1), 0.101, 1e-12, 'steps from the confirmed value');
  pos.el.remove();
});

test('toast: shows a message and removes it later', async () => {
  const toast = showToast('Hello', { duration: 50 });
  assert(document.body.contains(toast), 'shown');
  assertEqual(toast.textContent, 'Hello');
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert(!document.body.contains(toast), 'removed');
});
