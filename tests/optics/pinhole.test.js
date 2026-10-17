import { test, assert, assertClose, assertRelClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { createNoise } from '../../js/optics/noise.js';
import { computePinhole, sampleFarField, maskedFraction } from '../../js/optics/pinhole.js';

const base = () => ({
  wavelength: CONFIG.wavelength,
  focalLength: CONFIG.objective.focalLength,
  beamRadius: CONFIG.laser.waistRadius,
  offset: { x: 0, y: 0 },
  angle: { x: 0, y: 0 },
  defocus: 0,
  objectiveAxis: { x: 0, y: 0.1 },
  pinholeCentre: { x: 0, y: 0.1 },
  pinholeRadius: CONFIG.pinhole.radius,
  noise: [],
});
const thetaW = CONFIG.laser.waistRadius / CONFIG.objective.focalLength;   // 55.6 mrad

test('pinhole: centred at focus passes everything as a clean Gaussian', () => {
  const r = computePinhole(base());
  assert(r.transmission >= 0.999, `transmission ${r.transmission}`);
  assertRelClose(r.thetaE, thetaW, 0.03, '1/e² half-angle of the far field');
  assertClose(sampleFarField(r.farField, 0, 0), 1, 0.03, 'on-axis far field equals the ideal peak');
  assertClose(r.centroid.x, 0, 1e-4);
});

test('pinhole: overfilled pinhole gives an Airy pattern (first dark ring at 1.22λ/D)', () => {
  const r = computePinhole({ ...base(), defocus: 5e-3 });
  assert(r.transmission < 0.01, `overfilled transmission should be small: ${r.transmission}`);
  const { data, size, span } = r.farField;
  const d = (2 * span) / size;
  const row = size / 2;
  let minIndex = -1;
  for (let m = size / 2 + 1; m < size - 1; m++) {
    const v = data[row * size + m];
    if (v < data[row * size + m - 1] && v <= data[row * size + m + 1]) {
      minIndex = m;
      break;
    }
  }
  const thetaMin = -span + (minIndex + 0.5) * d;
  const expected = (1.22 * CONFIG.wavelength) / (2 * CONFIG.pinhole.radius);
  assertClose(thetaMin, expected, d, 'first minimum angle');
});

test('pinhole: off-centre pinhole loses power symmetrically', () => {
  const t0 = computePinhole(base()).transmission;
  const tPlus = computePinhole({ ...base(), pinholeCentre: { x: 10e-6, y: 0.1 } }).transmission;
  const tMinus = computePinhole({ ...base(), pinholeCentre: { x: -10e-6, y: 0.1 } }).transmission;
  const tFar = computePinhole({ ...base(), pinholeCentre: { x: 20e-6, y: 0.1 } }).transmission;
  assertClose(tPlus, tMinus, 1e-6, 'symmetric in x');
  assert(tPlus < t0 && tFar < tPlus, `should decrease with offset: ${t0}, ${tPlus}, ${tFar}`);
});

test('pinhole: defocus lowers transmission', () => {
  const tFocus = computePinhole(base()).transmission;
  const tNear = computePinhole({ ...base(), defocus: 0.3e-3 }).transmission;
  const tFar = computePinhole({ ...base(), defocus: 2e-3 }).transmission;
  assert(tNear < tFocus && tFar < tNear, `${tFocus} > ${tNear} > ${tFar}`);
});

test('pinhole: beam offset at the objective tilts the far field by −u/f0', () => {
  const r = computePinhole({ ...base(), offset: { x: 0.1e-3, y: 0 } });
  assertClose(r.centroid.x, -0.1e-3 / CONFIG.objective.focalLength, 0.5e-3);
});

test('pinhole: centred at focus blocks the dust noise', () => {
  const r = computePinhole({ ...base(), noise: createNoise(11).components });
  assert(r.noiseTransmission <= 0.01, `noise transmission ${r.noiseTransmission}`);
});

test('pinhole: masked fraction of the far field', () => {
  const r = computePinhole(base());
  assertClose(maskedFraction(r.farField, () => true), 1, 1e-12);
  assertClose(maskedFraction(r.farField, (tx) => tx > 0), 0.5, 0.02);
});
