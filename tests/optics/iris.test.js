import { test, assert, assertClose } from '../harness.js';
import { gaussianThroughHole, besselI0e, gaussLegendre } from '../../js/optics/iris.js';

test('iris: Gauss–Legendre rule integrates polynomials exactly', () => {
  const { x, w } = gaussLegendre(64);
  let s0 = 0;
  let s2 = 0;
  let s10 = 0;
  for (let i = 0; i < x.length; i++) {
    s0 += w[i];
    s2 += w[i] * x[i] ** 2;
    s10 += w[i] * x[i] ** 10;
  }
  assertClose(s0, 2, 1e-13);
  assertClose(s2, 2 / 3, 1e-13);
  assertClose(s10, 2 / 11, 1e-13);
});

test('iris: scaled Bessel I0 matches reference values', () => {
  assertClose(besselI0e(0), 1, 1e-7);
  assertClose(besselI0e(1), 0.4657596, 2e-7);
  assertClose(besselI0e(5), 0.1835408, 2e-7);
  assertClose(besselI0e(20), 0.0897803, 2e-7);
});

test('iris: centred beam with r = w passes 1 − e^-2', () => {
  assertClose(gaussianThroughHole(0.5e-3, 0, 0.5e-3), 1 - Math.exp(-2), 1e-4);
  assertClose(gaussianThroughHole(0.5e-3, 0, 2e-3), 1, 1e-9, 'wide open');
  assertClose(gaussianThroughHole(0.5e-3, 0, 0), 0, 0, 'closed');
  assertClose(gaussianThroughHole(0.5e-3, 5e-3, 1e-3), 0, 1e-12, 'beam far outside');
});

test('iris: off-centre beam matches brute-force integration', () => {
  const w = 0.5e-3;
  const s = 0.3e-3;
  const r = 0.5e-3;
  const n = 800;
  const h = (2 * r) / n;
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const y = -r + (j + 0.5) * h;
    for (let i = 0; i < n; i++) {
      const x = -r + (i + 0.5) * h;
      if (x * x + y * y > r * r) continue;
      sum += (2 / (Math.PI * w * w)) * Math.exp((-2 * ((x - s) ** 2 + y * y)) / (w * w));
    }
  }
  assertClose(gaussianThroughHole(w, s, r), sum * h * h, 1e-3);
  assert(gaussianThroughHole(w, s, r) < gaussianThroughHole(w, 0, r), 'offset loses power');
});
