import { test, assert, assertEqual, assertClose, assertRelClose } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';
import { michelsonBench, distanceToBs } from '../../js/michelson/bench.js';
import { CONFIG } from '../../js/optics/config.js';
import { gaussianThroughHole } from '../../js/optics/iris.js';
import { aligned } from './fixtures.js';

test('michelson bench: laser off gives no beam', () => {
  const r = michelsonBench(S.createMichelsonState(1));
  assertEqual(r.laserOn, false);
  assertEqual(r.segments.length, 0);
  assertEqual(r.screen, null);
});

test('michelson bench: the source is Experiment 1 finished; Aperture 1, halfway from the pinhole to the lens, sets the beam', () => {
  const SRC = MI.source;
  const r = michelsonBench(S.setValue(S.setLaserOn(S.createMichelsonState(1), true), 'iris.opening', 1e-3));
  assertClose(r.segments[0].z0, SRC.laserZ, 1e-12, 'the beam is drawn from the laser');
  const cone = r.segments.find((g) => Math.abs(g.z0 - SRC.a1Z) < 1e-12);
  assertClose(cone.r0, 0.5e-3, 1e-12, 'through the 1 mm hole');
  assertClose(cone.z1, SRC.lensZ, 1e-12);
  assertClose(cone.r1, 1e-3, 1e-12, 'twice as far from the pinhole, twice as wide');
  assertClose(r.rays[0].start.z, SRC.lensZ, 1e-12, 'the collimated beam leaves the lens');
  assertClose(r.irisT, gaussianThroughHole(SRC.waistRadius, 0, 1e-3), 1e-12, 'a 2 mm collimated beam');
});

test('michelson bench: the aligned standard layout has 300 mm arms, returned spots and overlapping beams', () => {
  const r = michelsonBench(aligned());
  assertClose(r.bsHit.offset, 0, 1e-12, 'beam on the splitter centre');
  assertClose(r.reflected.x, 1, 1e-12, 'reflected along +x');
  assertEqual(r.arms.T.mirror, 'm1');
  assertEqual(r.arms.R.mirror, 'm2');
  assertClose(r.arms.T.length, 0.3, 1e-9);
  assertClose(r.arms.R.length, 0.3, 1e-9);
  assertEqual(r.iris.spots.length, 2);
  for (const spot of r.iris.spots) assertClose(Math.hypot(spot.dx, spot.dy), 0, 1e-9, `spot ${spot.label} on the hole`);
  assertClose(r.fringe.pathDifference, 0, 1e-12);
  assertClose(r.fringe.contrast, 1, 1e-12);
  assertClose(r.fringe.overlap, 0, 1e-9);
  assertEqual(r.fringe.spacing, Infinity, 'exactly parallel beams: no straight fringes');
  // Aperture 1 wide open would make the beam 24 mm wide at the lens: the lens rim (22.9 mm) sets it instead.
  const irisT = gaussianThroughHole(MI.source.waistRadius, 0, CONFIG.lens.clearAperture / 2);
  assertClose(r.power, 0.5 * irisT, 1e-12, 'each arm brings a quarter of the light to the screen');
  assert(r.screen.window.image.length > 0 && r.screen.card.image.length > 0, 'screen images rendered');
});

test('michelson bench: a mirror 1 mrad off moves its returned spot and tilts its beam by 2 mrad', () => {
  const s = aligned();
  const r = michelsonBench(S.setValue(s, 'parts.m2.h', s.parts.m2.h + 1e-3));
  const spot = r.iris.spots.find((p) => p.mirror === 'm2');
  // Back through the source lens (f) to Aperture 1, d before it: 2ε (L (1 − d/f) + d), with L from M2 to the lens.
  const L = 0.3 + (0.3 - MI.source.lensZ);
  const d = MI.source.lensZ - MI.source.a1Z;
  const f = CONFIG.lens.focalLength;
  assertRelClose(Math.hypot(spot.dx, spot.dy), 2e-3 * (L * (1 - d / f) + d), 0.01, 'spot offset on Aperture 1');
  assertRelClose(r.fringe.alpha, 2e-3, 1e-3);
  assertRelClose(r.fringe.spacing, MI.wavelength / 2e-3, 1e-3);
  assertRelClose(r.fringe.overlap, 2e-3 * (0.3 + 0.25), 0.01);
});

test('michelson bench: reflected spots that miss the lens and Aperture 1 itself still land on the source face', () => {
  const s = aligned();
  // M2 18 mrad off vertically (its light still meets the beam splitter), pushing the knob away from its end so it
  // does not clamp.
  const r = michelsonBench(S.setValue(s, 'parts.m2.v', s.parts.m2.v - Math.sign(s.parts.m2.v || 1) * 18e-3));
  const spot = r.iris.spots.find((p) => p.mirror === 'm2');
  assert(spot && Math.hypot(spot.dx, spot.dy) > MI.iris.plateRadius, `18 mrad off: ${spot && Math.hypot(spot.dx, spot.dy)}`);
});

test('michelson bench: at the start of step 2 both mirrors send their light back onto Aperture 1', () => {
  for (let seed = 0; seed < 100; seed++) {
    const s = aligned(seed);
    const crooked = ['m1', 'm2'].reduce((acc, m) => S.setValue(S.setValue(acc, `parts.${m}.h`, 0), `parts.${m}.v`, 0), s);
    const spots = michelsonBench(crooked, { render: false }).iris.spots;
    for (const m of ['m1', 'm2']) {
      const spot = spots.find((p) => p.mirror === m);
      assert(spot && Math.hypot(spot.dx, spot.dy) < MI.iris.plateRadius, `seed ${seed}: ${m}'s spot ${spot && Math.hypot(spot.dx, spot.dy)}`);
    }
  }
});

test('michelson bench: arms one hole apart lose the fringe contrast', () => {
  const s = S.placePart(aligned(), 'm2', { x: 0.325, z: 0.3 });
  const r = michelsonBench(s);
  assertClose(r.arms.R.length - r.arms.T.length, 0.025, 1e-9);
  assertClose(Math.abs(r.fringe.pathDifference), 0.05, 1e-9, 'the path difference is twice the arm difference');
  assert(r.fringe.contrast < 1e-6, `contrast ${r.fringe.contrast}`);
});

test('michelson bench: distances from the beam splitter, M1 riding its stage', () => {
  const s = aligned(1, { parts: ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2'] });
  assertClose(distanceToBs(s, 'm1'), 0.3, 1e-9);
  assertClose(distanceToBs(s, 'm2'), 0.3, 1e-9);
  assertClose(distanceToBs(s, 'lens1'), 0.2, 1e-9);
  assertClose(distanceToBs(S.movePartBy(s, 'lens2', 0, -0.001), 'lens2'), 0.199, 1e-9);
  assertClose(distanceToBs(S.setValue(s, 'parts.m1.stage', MI.stage.initial + 1e-3), 'm1'), 0.301, 1e-9, 'a larger reading moves M1 back');
  assertEqual(distanceToBs(S.removePart(s, 'bs'), 'm1'), null, 'no beam splitter');
  assertEqual(distanceToBs(S.removePart(s, 'm2'), 'm2'), null, 'not placed');
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
