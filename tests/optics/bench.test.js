import { test, assert, assertEqual, assertClose, assertRelClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import * as S from '../../js/lab/state.js';
import { bench, objectiveAlignmentAt, objectivePlaneZ } from '../../js/optics/bench.js';
import { afterStep1, fullyAligned } from '../fixtures.js';

function withObjective() {
  let s = afterStep1();
  s = S.placePart(s, 'sf', 0.250);
  s.parts.sf.objective = true;
  return s;
}

test('bench: laser off gives no beam', () => {
  const r = bench(S.createInitialState(1));
  assertEqual(r.laserOn, false);
  assertEqual(r.segments.length, 0);
  assertEqual(r.powerAtScreen, 0);
});

test('bench: aligned beam passes two closed irises and reaches the beam block', () => {
  const r = bench(afterStep1());
  assertClose(r.at.a1.T, 1 - Math.exp(-2), 0.01, 'A1 transmission (1 mm hole, 1 mm beam)');
  assert(r.at.a2.T > 0.5, `A2 transmission ${r.at.a2.T}`);
  assertClose(Math.hypot(r.at.a2.offset.x, r.at.a2.offset.y), 0, 1e-9);
  assertEqual(r.stoppedAt, 'block');
  assertEqual(r.segments.length, 3, 'laser→A1→A2→block');
});

test('bench: the fixed laser runs level along the rail centreline; an iris 1.6 mm aside blocks it', () => {
  const s = afterStep1();
  for (const seg of bench(s).segments) {
    for (const [x, y] of [[seg.x0, seg.y0], [seg.x1, seg.y1]]) {
      assertClose(x, 0, 1e-12, 'on the centreline');
      assertClose(y, s.hidden.laserHeight, 1e-12, 'level');
    }
  }
  const r = bench(S.setValue(s, 'parts.a2.x', 1.6e-3));
  assertClose(r.at.a2.offset.x, -1.6e-3, 1e-12, 'beam 1.6 mm to the side of the hole');
  assertEqual(r.stoppedAt, 'a2');
  assertEqual(r.powerAtScreen, 0);
});

test('bench: eq. 1-1 — the filtered beam is 22.2 mm across at the lens', () => {
  const r = bench(fullyAligned());
  assert(r.pinhole.transmission >= 0.999, `T_ph ${r.pinhole.transmission}`);
  const expected = (CONFIG.lens.focalLength / CONFIG.objective.focalLength) * 2 * CONFIG.laser.waistRadius;
  assertRelClose(2 * r.at.lens.w, expected, 0.02);
  assertRelClose(r.at.lens.extent, 16e-3, 0.02, 'iris-trimmed extent at the lens');
});

test('bench: collimation follows the lens distance', () => {
  const exact = bench(fullyAligned()).divergence;
  assertEqual(exact.state, 'collimated');
  assert(Math.abs(exact.theta) < 0.05e-3, `θ' at L = f_e: ${exact.theta}`);
  const moved = (dz) => {
    const s = fullyAligned();
    return bench(S.placePart(s, 'lens', s.parts.lens.z + dz)).divergence;
  };
  assertEqual(moved(-0.010).state, 'diverging');
  assertEqual(moved(0.010).state, 'converging');
});

test('bench: plane A rings are centred only when the spatial filter is centred on the beam', () => {
  const s = withObjective();
  for (const ring of bench(s).planeA.rings) assertClose(Math.hypot(ring.x, ring.y), 0, 1e-9);
  const delta = 0.1e-3;
  const shifted = bench(S.setValue(s, 'parts.sf.x', delta)).planeA;
  const dA = objectivePlaneZ(s) - s.parts.a1.z;
  CONFIG.objective.surfaceRadii.forEach((R, j) => {
    assertRelClose(shifted.rings[j].x, (-delta * 2 * dA) / R, 1e-6, `ring ${j}`);
  });
});

test('bench: objective alignment probe reports plane-A and Aperture 2 offsets', () => {
  const s = withObjective();
  const good = objectiveAlignmentAt(s, 0);
  assert(good.planeA < 1e-9 && good.a2 < 1e-9, `centred: ${JSON.stringify(good)}`);
  const bad = objectiveAlignmentAt(S.setValue(s, 'parts.sf.x', 0.1e-3), CONFIG.objective.travel);
  assert(bad.planeA > 0.5e-3 && bad.a2 > 1e-3, `decentred: ${JSON.stringify(bad)}`);
});

test('bench: the objective and pinhole move with the spatial filter', () => {
  const s = fullyAligned();
  const moved = S.setValue(S.setValue(s, 'parts.sf.x', 20e-6), 'parts.sf.height', s.parts.sf.height - 20e-6);
  const r = bench(moved);
  assertClose(r.at.objective.focusCentre.x, 20e-6, 1e-12, 'the focus follows the objective');
  assertClose(r.at.pinhole.x, 20e-6, 1e-12, 'the pinhole follows the mount');
  assert(r.pinhole.transmission >= CONFIG.checks.s3.transmissionMin, `still filtering cleanly: ${r.pinhole.transmission}`);
});

test('bench: the screen shows a bright filtered spot when everything is aligned', () => {
  const r = bench(fullyAligned());
  assert(r.screen && r.screen.window.peak > 0.5, 'bright spot');
  assert(r.powerAtScreen > 0.3, `power at screen ${r.powerAtScreen}`);
  assertRelClose(r.screen.window.d4sigma, 16e-3, 0.25, 'iris-trimmed beam at the screen');
});
