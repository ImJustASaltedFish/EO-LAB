import { test, assert, assertEqual, assertClose, assertRelClose } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';
import { michelsonBench } from '../../js/michelson/bench.js';
import { gaussianThroughHole } from '../../js/optics/iris.js';
import { aligned } from './fixtures.js';

test('michelson bench: laser off gives no beam', () => {
  const r = michelsonBench(S.createMichelsonState(1));
  assertEqual(r.laserOn, false);
  assertEqual(r.segments.length, 0);
  assertEqual(r.screen, null);
});

test('michelson bench: the aligned standard layout has equal arms, returned spots and overlapping beams', () => {
  const r = michelsonBench(aligned());
  assertClose(r.bsHit.offset, 0, 1e-12, 'beam on the splitter centre');
  assertClose(r.reflected.x, 1, 1e-12, 'reflected along +x');
  assertEqual(r.arms.T.mirror, 'm1');
  assertEqual(r.arms.R.mirror, 'm2');
  assertClose(r.arms.T.length, 0.2, 1e-9);
  assertClose(r.arms.R.length, 0.2, 1e-9);
  assertEqual(r.iris.spots.length, 2);
  for (const spot of r.iris.spots) assertClose(Math.hypot(spot.dx, spot.dy), 0, 1e-9, `spot ${spot.label} on the hole`);
  assertClose(r.fringe.pathDifference, 0, 1e-12);
  assertClose(r.fringe.contrast, 1, 1e-12);
  assertClose(r.fringe.overlap, 0, 1e-9);
  assertEqual(r.fringe.spacing, Infinity, 'exactly parallel beams: no straight fringes');
  const irisT = gaussianThroughHole(MI.source.waistRadius, 0, MI.iris.openingMax / 2);
  assertClose(r.power, 0.5 * irisT, 1e-12, 'each arm brings a quarter of the light to the screen');
  assert(r.screen.window.image.length > 0 && r.screen.card.image.length > 0, 'screen images rendered');
});

test('michelson bench: a mirror 1 mrad off moves its returned spot and tilts its beam by 2 mrad', () => {
  const s = aligned();
  const r = michelsonBench(S.setValue(s, 'parts.m2.h', s.parts.m2.h + 1e-3));
  const spot = r.iris.spots.find((p) => p.mirror === 'm2');
  assertRelClose(Math.hypot(spot.dx, spot.dy), 2e-3 * (0.2 + 0.325), 0.01, 'spot offset = 2ε × path back to the iris');
  assertRelClose(r.fringe.alpha, 2e-3, 1e-3);
  assertRelClose(r.fringe.spacing, MI.wavelength / 2e-3, 1e-3);
  assertRelClose(r.fringe.overlap, 2e-3 * (0.2 + 0.25), 0.01);
});

test('michelson bench: reflected spots that miss the iris itself still land on the source face', () => {
  const s = aligned();
  // 1° (17.5 mrad) off in both tilts, pushing each knob away from its end so the knob range does not clamp it.
  const push = (v) => v - Math.sign(v || 1) * 17.5e-3;
  const r = michelsonBench(S.setValue(S.setValue(s, 'parts.m2.h', push(s.parts.m2.h)), 'parts.m2.v', push(s.parts.m2.v)));
  const spot = r.iris.spots.find((p) => p.mirror === 'm2');
  assert(spot && Math.hypot(spot.dx, spot.dy) > MI.iris.plateRadius, `1° off in both tilts: ${spot && Math.hypot(spot.dx, spot.dy)}`);
});

test('michelson bench: arms one hole apart lose the fringe contrast', () => {
  const s = S.placePart(aligned(), 'm2', { x: 0.225, z: 0.3 });
  const r = michelsonBench(s);
  assertClose(r.arms.R.length - r.arms.T.length, 0.025, 1e-9);
  assertClose(Math.abs(r.fringe.pathDifference), 0.05, 1e-9, 'the path difference is twice the arm difference');
  assert(r.fringe.contrast < 1e-6, `contrast ${r.fringe.contrast}`);
});

test('michelson bench: off the beam row the splitter is missed', () => {
  const s = S.placePart(S.setLaserOn(S.createMichelsonState(1), true), 'bs', { x: 0.025, z: 0.3 });
  const r = michelsonBench(s);
  assertEqual(r.bsHit, null);
  assertEqual(r.reflected, null);
});

test('michelson bench: lenses about f from their mirrors give rings when their distances differ', () => {
  const withLenses = aligned(1, { parts: ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2'] });
  const same = michelsonBench(withLenses);
  assertClose(same.arms.T.lenses[0].toMirror, 0.1, 1e-9);
  assertClose(same.arms.R.lenses[0].toMirror, 0.1, 1e-9);
  assert(same.fringe.rings < 0.5, `equal lens distances: ${same.fringe.rings} rings`);
  const offset = michelsonBench(S.movePartBy(withLenses, 'lens2', 0, -0.001));
  assertClose(offset.arms.R.lenses[0].toMirror, 0.101, 1e-9);
  assert(offset.fringe.rings >= 3, `rings ${offset.fringe.rings}`);
  assert(offset.fringe.centred, 'ring centre inside the spot');
});

test('michelson bench: the card on the reflected row reports its distance; an uncorrected splitter makes the spot drift', () => {
  const base = aligned(1, { parts: ['bs'] });
  const at = (state, x) => michelsonBench(S.placePart(state, 'screen', { x, z: 0.3 }, 6)).cardOn;
  assertClose(at(base, 0.15).distance, 0.15, 1e-9);
  assertClose(at(base, 0.3).u - at(base, 0.1).u, 0, 1e-9, 'corrected: no drift');
  const crooked = S.setValue(base, 'parts.bs.rotation', 0);
  const drift = Math.abs(at(crooked, 0.3).u - at(crooked, 0.1).u);
  assertRelClose(drift, Math.abs(Math.tan(2 * crooked.hidden.bsHeading)) * 0.2, 0.02, 'drift = 2 × the splitter error × distance');
});
