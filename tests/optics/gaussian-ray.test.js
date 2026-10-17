import { test, assert, assertClose, assertRelClose } from '../harness.js';
import { CONFIG, DERIVED } from '../../js/optics/config.js';
import { qAtWaist, propagateQ, thinLensQ, beamRadius, waistRadiusOf, distanceToWaist, curvatureRadius } from '../../js/optics/gaussian.js';
import { propagateRay, thinLensRay, offsetFrom, radial } from '../../js/optics/ray.js';

const LAMBDA = CONFIG.wavelength;
const W0 = CONFIG.laser.waistRadius;

test('gaussian: free-space radius follows w0·sqrt(1 + (d/zR)²)', () => {
  const zR = DERIVED.laserRayleigh;
  const q0 = qAtWaist(W0, LAMBDA);
  for (const d of [0, 0.1, 0.5, 1.476, 3]) {
    const expected = W0 * Math.sqrt(1 + (d / zR) ** 2);
    assertRelClose(beamRadius(propagateQ(q0, d), LAMBDA), expected, 1e-9, `w at d=${d}`);
  }
});

test('gaussian: curvature radius is 2·zR one Rayleigh range from the waist', () => {
  const zR = DERIVED.laserRayleigh;
  assertRelClose(curvatureRadius(propagateQ(qAtWaist(W0, LAMBDA), zR)), 2 * zR, 1e-12);
  assert(curvatureRadius(qAtWaist(W0, LAMBDA)) === Infinity, 'flat wavefront at the waist');
});

test('gaussian: 1 mm beam through f0 = 9 mm focuses to 3.05 µm at f0', () => {
  const f0 = CONFIG.objective.focalLength;
  const q = thinLensQ(qAtWaist(W0, LAMBDA), f0);
  assertRelClose(waistRadiusOf(q, LAMBDA), 3.048e-6, 5e-3, 'focused waist');
  assertRelClose(distanceToWaist(q), f0, 1e-3, 'focus distance');
});

test('ray: free-space propagation and lens deflection', () => {
  const r = propagateRay({ x: 1e-3, y: 0.1, tx: 2e-3, ty: -1e-3 }, 0.5);
  assertClose(r.x, 2e-3, 1e-15);
  assertClose(r.y, 0.0995, 1e-15);
  const bent = thinLensRay({ x: 0.1e-3, y: 0, tx: 0, ty: 0 }, 9e-3, { x: 0, y: 0 });
  assertClose(bent.tx, -11.111e-3, 1e-6, 'ray 0.1 mm off a 9 mm lens bends by −11.1 mrad');
});

test('ray: parallel rays meet at the focal point of a decentred lens', () => {
  const f = 0.2;
  const axis = { x: 0.3e-3, y: 0.1 };
  for (const h of [-2e-3, 0, 1e-3, 5e-3]) {
    const atFocus = propagateRay(thinLensRay({ x: h, y: 0.1 + h, tx: 0, ty: 0 }, f, axis), f);
    assertClose(atFocus.x, axis.x, 1e-12);
    assertClose(atFocus.y, axis.y, 1e-12);
  }
  assertClose(radial(offsetFrom({ x: 3, y: 4 }, { x: 0, y: 0 })), 5, 1e-12);
});
