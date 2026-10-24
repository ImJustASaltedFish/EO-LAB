import { test, assert, assertEqual, assertClose, assertThrows } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';

const DEG = Math.PI / 180;

test('michelson state: deterministic per seed; hand errors in range and correctable', () => {
  assertEqual(JSON.stringify(S.createMichelsonState(5)), JSON.stringify(S.createMichelsonState(5)));
  for (let seed = 0; seed < 200; seed++) {
    const { hidden } = S.createMichelsonState(seed);
    const within = (value, [lo, hi]) => Math.abs(value) >= lo * DEG - 1e-12 && Math.abs(value) <= hi * DEG + 1e-12;
    assert(within(hidden.bsHeading, MI.errors.bsHeading), `bs heading ${hidden.bsHeading}`);
    assert(within(hidden.bsTilt, MI.errors.bsTilt), `bs tilt ${hidden.bsTilt}`);
    for (const key of ['m1H', 'm1V', 'm2H', 'm2V']) assert(within(hidden[key], MI.errors.mirrorTilt), `${key} ${hidden[key]}`);
    assert(Math.abs(hidden.bsHeading) <= MI.bs.rotationRange && Math.abs(hidden.bsTilt) <= MI.bs.tiltRange, 'bs knobs reach');
    assert(Math.abs(hidden.m1H) <= MI.mirror.tiltRange, 'mirror knobs reach');
  }
  const s = S.createMichelsonState(1);
  assertEqual(s.laser.on, false);
  assertEqual(s.parts.bs.placed, false);
  assertEqual(s.parts.bs.heading, 3, 'the beam splitter starts reflecting toward the front');
  assertEqual(s.parts.m1.heading, 4, 'mirrors start facing the laser');
  assertClose(s.parts.m1.stage, 0.0125, 0);
});

test('michelson state: parts snap to holes; lenses slide along their row in 1 mm steps', () => {
  let s = S.createMichelsonState(1);
  s = S.placePart(s, 'bs', { x: 0.004, z: 0.3104 });
  assertEqual(JSON.stringify(s.parts.bs.pos), JSON.stringify({ x: 0, z: 0.3 }));
  s = S.placePart(s, 'lens1', { x: 0.004, z: 0.4123 }, 0);
  assertEqual(JSON.stringify(s.parts.lens1.pos), JSON.stringify({ x: 0, z: 0.412 }));
  s = S.placePart(s, 'lens2', { x: 0.1034, z: 0.3104 }, 2);
  assertEqual(JSON.stringify(s.parts.lens2.pos), JSON.stringify({ x: 0.103, z: 0.3 }));
  const moved = S.movePartBy(s, 'lens1', 0.001, 0);
  assertClose(moved.parts.lens1.pos.z, 0.413, 1e-12, 'one millimetre along the row');
  assertClose(S.movePartBy(s, 'bs', 0, 0.025).parts.bs.pos.x, 0.025, 1e-12, 'one hole across');
});

test('michelson state: overlaps, off-table spots and the source strip are refused', () => {
  const s = S.placePart(S.createMichelsonState(1), 'bs', { x: 0, z: 0.3 });
  assertEqual(S.placePart(s, 'm2', { x: 0.025, z: 0.3 }), s, 'too close to the beam splitter');
  assertEqual(S.placePart(s, 'm2', { x: 0, z: 1.2 }), s, 'off the table');
  assertEqual(S.placePart(s, 'm2', { x: 0, z: -0.2 }), s, 'on the source');
  assert(S.placePart(s, 'm2', { x: 0.1, z: -0.2 }).parts.m2.placed, 'beside the source is fine');
  assert(S.placePart(s, 'm2', { x: 0.075, z: 0.3 }).parts.m2.placed, 'three holes away is fine');
  const turned = S.turnPart(s, 'bs', 1);
  assertEqual(turned.parts.bs.heading, 4);
  assertEqual(S.turnPart(s, 'bs', -4).parts.bs.heading, 7, 'headings wrap around');
  assertThrows(() => S.placePart(s, 'laser', { x: 0, z: 0 }));
});

test('michelson state: Place finds the nearest free hole; knobs clamp; updates never mutate', () => {
  const base = S.placePart(S.createMichelsonState(1), 'bs', { x: 0, z: 0.3 });
  const s = S.placeNear(base, 'm1', { x: 0, z: 0.3 });
  assert(s.parts.m1.placed, 'placed next to the beam splitter');
  const found = Math.hypot(s.parts.m1.pos.x, s.parts.m1.pos.z - 0.3);
  for (let di = -4; di <= 4; di++) {
    for (let dj = -4; dj <= 4; dj++) {
      if (Math.hypot(di, dj) * MI.table.pitch < found - 1e-9) {
        assertEqual(S.placePart(base, 'm1', { x: dj * MI.table.pitch, z: 0.3 + di * MI.table.pitch }), base, `hole (${di}, ${dj}) is nearer but taken`);
      }
    }
  }
  const before = S.createMichelsonState(1);
  const after = S.setValue(before, 'parts.m1.h', 1);
  assertClose(after.parts.m1.h, MI.mirror.tiltRange, 0);
  assertClose(before.parts.m1.h, 0, 0, 'input untouched');
  assertThrows(() => S.setValue(before, 'parts.m2.stage', 0.01), 'M2 has no stage');
  assert(S.atStageEdge(S.setValue(before, 'parts.m1.stage', 1)), 'at the end of travel');
  assert(!S.atStageEdge(before), 'mid travel');
});
