import { test, assert, assertClose, assertRelClose } from '../harness.js';
import { coherenceContrast, interferenceSampler, fringeNumbers } from '../../js/optics/interference.js';

const LAMBDA = 532e-9;
const SOURCE = { waist: 11.1e-3, aperture: 6e-3 };
const OPTIONS = { source: SOURCE, wavelength: LAMBDA, coherenceLength: 0.03 };
const beam = (extra = {}) => ({ centre: { u: 0, v: 0 }, tilt: { u: 0, v: 0 }, opl: 1, A: 1, C: 0, power: 0.25, ...extra });

// The first u in (from, to] where I(u, 0) is smallest (or largest), scanning in fine steps.
function extremum(sample, from, to, wantMax) {
  let best = from;
  let bestValue = sample(from, 0);
  for (let i = 1; i <= 4000; i++) {
    const u = from + ((to - from) * i) / 4000;
    const value = sample(u, 0);
    if (wantMax ? value > bestValue : value < bestValue) {
      best = u;
      bestValue = value;
    }
  }
  return best;
}

test('interference: straight fringes repeat every λ/α', () => {
  const alpha = 0.25e-3;
  const sample = interferenceSampler([beam({ tilt: { u: alpha / 2, v: 0 } }), beam({ tilt: { u: -alpha / 2, v: 0 } })], OPTIONS);
  const period = LAMBDA / alpha;
  assertRelClose(extremum(sample, 0.05 * period, 0.95 * period, false), period / 2, 0.02, 'first dark fringe');
  assertRelClose(extremum(sample, 0.55 * period, 1.45 * period, true), period, 0.02, 'next bright fringe');
  const n = fringeNumbers(beam({ tilt: { u: alpha / 2, v: 0 } }), beam({ tilt: { u: -alpha / 2, v: 0 } }), OPTIONS);
  assertRelClose(n.spacing, period, 1e-12);
  assertClose(n.overlap, 0, 1e-15);
});

test('interference: contrast falls to 0.2 at half the coherence length', () => {
  assertClose(coherenceContrast(0, 0.03), 1, 1e-12);
  assertClose(coherenceContrast(0.015, 0.03), 0.2, 1e-12);
  // A very wide, flat beam, so the envelope does not change over the two fringes measured.
  const flat = { ...OPTIONS, source: { waist: 1, aperture: 0.05 } };
  const sample = interferenceSampler([beam({ tilt: { u: 1e-4, v: 0 } }), beam({ opl: 1.015, tilt: { u: -1e-4, v: 0 } })], flat);
  const period = LAMBDA / 2e-4;
  const values = Array.from({ length: 200 }, (_, i) => sample((i * period) / 100, 0));
  const max = Math.max(...values);
  const min = Math.min(...values);
  assertRelClose((max - min) / (max + min), 0.2, 0.01, 'measured fringe contrast');
});

test('interference: ring radii follow √(2nλ / |1/R₁ − 1/R₂|) with a bright centre', () => {
  const q = 0.2;   // 1/R₂ − 1/R₁ in 1/m: R₂ = 5 m against a flat wave
  const sample = interferenceSampler([beam(), beam({ A: 1, C: q })], OPTIONS);
  const r1 = Math.sqrt((2 * LAMBDA) / q);
  assertRelClose(extremum(sample, 0.8 * Math.sqrt(LAMBDA / q), 1.3 * r1, true), r1, 0.02, 'first bright ring');
  const n = fringeNumbers(beam(), beam({ C: q }), OPTIONS);
  assertRelClose(n.rings, (6e-3 ** 2 * q) / (2 * LAMBDA), 1e-12);
  assertClose(n.centre.u, 0, 1e-12);
  assert(n.centred, 'ring centre inside the spot');
});

test('interference: fringes finer than a pixel average out', () => {
  const alpha = 2.66e-3;   // 0.2 mm spacing on 1 mm pixels
  const sample = interferenceSampler([beam({ tilt: { u: alpha / 2, v: 0 } }), beam({ tilt: { u: -alpha / 2, v: 0 } })], { ...OPTIONS, pixel: 1e-3 });
  const values = Array.from({ length: 200 }, (_, i) => sample(i * 1e-5, 0));
  const max = Math.max(...values);
  const min = Math.min(...values);
  assert((max - min) / (max + min) < 0.05, `averaged contrast ${(max - min) / (max + min)}`);
});

test('interference: one beam alone is a plain spot; the tap phase shifts the fringes', () => {
  const single = interferenceSampler([beam()], OPTIONS);
  assert(single(0, 0) > single(3e-3, 0), 'bright centre');
  assertClose(single(7e-3, 0), 0, 0, 'outside the iris-sized disc');
  const plain = interferenceSampler([beam(), beam()], OPTIONS);
  const tapped = interferenceSampler([beam(), beam()], { ...OPTIONS, extraPhase: Math.PI });
  assert(tapped(0, 0) < 0.01 * plain(0, 0), 'half a fringe shift turns the centre dark');
});
