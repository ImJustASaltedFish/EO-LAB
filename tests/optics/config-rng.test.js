import { test, assert, assertEqual, assertClose, assertRelClose, assertThrows } from '../harness.js';
import { CONFIG, DERIVED } from '../../js/optics/config.js';
import { createRng, deriveSeed, uniform, randomSign, randomVector, SALT } from '../../js/optics/rng.js';
import { complex, cadd, csub, cmul, cinv, cdiv, cabs } from '../../js/optics/complex.js';

test('config: derived laser and focus values match the spec', () => {
  assertRelClose(DERIVED.laserRayleigh, 1.476, 1e-3, 'laser Rayleigh range (m)');
  assertRelClose(DERIVED.focusWaist, 3.048e-6, 1e-3, 'focused waist (m)');
});

test('config: is deeply frozen', () => {
  assertThrows(() => { CONFIG.wavelength = 1; }, 'top level should be frozen');
  assertThrows(() => { CONFIG.checks.s1.centreTol = 1; }, 'nested objects should be frozen');
});

test('rng: same seed gives the same sequence, values in [0, 1)', () => {
  const a = createRng(1234);
  const b = createRng(1234);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assertEqual(x, b());
    assert(x >= 0 && x < 1, `value out of range: ${x}`);
  }
});

test('rng: different seeds differ; deriveSeed is deterministic and salt-dependent', () => {
  assert(createRng(1)() !== createRng(2)(), 'seeds 1 and 2 should differ');
  assertEqual(deriveSeed(99, SALT.noise), deriveSeed(99, SALT.noise));
  assert(deriveSeed(99, SALT.noise) !== deriveSeed(99, SALT.pinhole), 'salts should give different streams');
});

test('rng: helpers stay in range', () => {
  const rng = createRng(7);
  for (let i = 0; i < 500; i++) {
    const u = uniform(rng, 2, 6);
    assert(u >= 2 && u < 6, `uniform out of range: ${u}`);
    const s = randomSign(rng);
    assert(s === 1 || s === -1, 'sign must be ±1');
    const v = randomVector(rng, 0.2, 0.6);
    const m = Math.hypot(v.x, v.y);
    assert(m >= 0.2 - 1e-12 && m <= 0.6 + 1e-12, `vector magnitude out of range: ${m}`);
  }
});

test('complex: arithmetic', () => {
  const a = complex(1, 2);
  const b = complex(3, -1);
  const s = cadd(a, b);
  assertEqual(s.re, 4);
  assertEqual(s.im, 1);
  const d = csub(a, b);
  assertEqual(d.re, -2);
  assertEqual(d.im, 3);
  const p = cmul(a, b);
  assertEqual(p.re, 5);
  assertEqual(p.im, 5);
  const q = cdiv(p, b);
  assertClose(q.re, 1, 1e-12);
  assertClose(q.im, 2, 1e-12);
  const i = cinv(complex(0, 2));
  assertClose(i.re, 0, 1e-15);
  assertClose(i.im, -0.5, 1e-15);
  assertClose(cabs(complex(3, 4)), 5, 1e-15);
});
