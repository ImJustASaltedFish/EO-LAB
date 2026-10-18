import { test, assert, assertEqual, assertClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { createNoise, noiseMultiplier } from '../../js/optics/noise.js';

test('noise: deterministic per seed with spec frequencies and power', () => {
  const a = createNoise(42);
  const b = createNoise(42);
  const c = createNoise(43);
  assertEqual(a.components.length, CONFIG.noise.count);
  assertEqual(a.components[5].fx, b.components[5].fx);
  assert(a.components[5].fx !== c.components[5].fx, 'different seeds differ');
  let power = 0;
  for (const k of a.components) {
    const f = Math.hypot(k.fx, k.fy);
    assert(f >= CONFIG.noise.freqMin && f <= CONFIG.noise.freqMax, `frequency out of range: ${f}`);
    power += k.re * k.re + k.im * k.im;
  }
  assertClose(power, CONFIG.noise.power, 1e-12);
});

test('noise: multiplier averages 1 + ε², is visibly uneven, and looks up grid samples', () => {
  const n = createNoise(7);
  let sum = 0;
  let sumSq = 0;
  for (const v of n.field) {
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n.field.length;
  const std = Math.sqrt(sumSq / n.field.length - mean * mean);
  assertClose(mean, 1 + CONFIG.noise.power, 0.02);
  assert(std > 0.1, `noise should be visible, std=${std}`);
  const i = 100;
  const j = 120;
  const x = -n.half + (i + 0.5) * n.step;
  const y = -n.half + (j + 0.5) * n.step;
  assertClose(noiseMultiplier(n, x, y), n.field[j * n.gridSize + i], 1e-5);
  assertEqual(noiseMultiplier(n, 1, 1), 1, 'outside the grid the multiplier is 1');
});
