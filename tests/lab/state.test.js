import { test, assert, assertEqual, assertClose, assertThrows } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import * as S from '../../js/lab/state.js';

test('state: initial state is deterministic and hidden values are in range', () => {
  assertEqual(JSON.stringify(S.createInitialState(5)), JSON.stringify(S.createInitialState(5)));
  for (let seed = 0; seed < 200; seed++) {
    const s = S.createInitialState(seed);
    for (const tilt of [s.hidden.pitch0, s.hidden.yaw0]) {
      assert(Math.abs(tilt) >= CONFIG.laser.tiltMin && Math.abs(tilt) <= CONFIG.laser.tiltMax, `tilt ${tilt}`);
      assert(Math.abs(tilt) <= CONFIG.laser.knobRange, 'tilt correctable by the knobs');
    }
    const h = s.hidden.laserHeight;
    assert(Math.abs(h - CONFIG.laser.exitHeight) <= CONFIG.laser.exitHeightJitter + 1e-12, `height ${h}`);
    assert(h >= CONFIG.post.min && h <= CONFIG.post.max, 'reachable by posts');
  }
  const s = S.createInitialState(5);
  assertEqual(s.laser.on, false);
  assertEqual(s.parts.a1.onRail, false);
  assertEqual(s.hidden.objectiveOffset, null);
});

test('state: setValue clamps, rejects unknown paths and never mutates its input', () => {
  let s = S.createInitialState(1);
  s = S.setValue(s, 'parts.a1.opening', 0);
  assertClose(s.parts.a1.opening, CONFIG.iris.openingMin, 0);
  s = S.setValue(s, 'laser.pitch', 1);
  assertClose(s.laser.pitch, CONFIG.laser.knobRange, 0);
  assertThrows(() => S.setValue(s, 'parts.a1.colour', 1));
  const before = S.createInitialState(1);
  S.setValue(before, 'parts.a1.height', 0.09);
  assertClose(before.parts.a1.height, CONFIG.post.initial, 0);
});

test('state: placing parts snaps to 1 mm, refuses overlaps and out-of-range', () => {
  let s = S.createInitialState(1);
  s = S.placePart(s, 'a1', 0.1004);
  assertClose(s.parts.a1.z, 0.100, 1e-12);
  assert(s.parts.a1.onRail, 'on rail');
  assertEqual(S.placePart(s, 'a2', 0.105), s, 'overlap refused (same object returned)');
  assertEqual(S.placePart(s, 'a2', 1.5), s, 'beyond the rail refused');
  const z = S.nearestFreeZ(s, 'a2', 0.100);
  assert(z !== null && Math.abs(z - 0.100) >= 0.025 - 1e-9, `nearest free z ${z}`);
  assertEqual(S.removePart(s, 'a1').parts.a1.onRail, false);
});

test('state: moving the screen accumulates travel', () => {
  let s = S.createInitialState(1);
  s = S.placePart(s, 'screen', 0.9);
  assertClose(s.stats.screenTravel, 0, 0, 'first placement is not travel');
  s = S.placePart(s, 'screen', 1.0);
  s = S.placePart(s, 'screen', 0.8);
  assertClose(s.stats.screenTravel, 0.3, 1e-9);
});

test('state: installing the objective and pinhole draws offsets within range', () => {
  let s = S.createInitialState(9);
  s = S.placePart(s, 'sf', 0.25);
  const beam = { x: 0.1e-3, y: s.parts.sf.height + 0.2e-3 };
  s = S.installObjective(s, beam);
  assert(s.parts.sf.objective, 'installed');
  const extra = { x: s.hidden.objectiveOffset.x - beam.x, y: s.hidden.objectiveOffset.y - (beam.y - s.parts.sf.height) };
  const m = Math.hypot(extra.x, extra.y);
  assert(m >= CONFIG.objective.installOffsetMin - 1e-12 && m <= CONFIG.objective.installOffsetMax + 1e-12, `objective extra ${m}`);
  assertEqual(S.installObjective(s, beam), s, 'second install is a no-op');
  const focus = { x: 0, y: s.parts.sf.height };
  const p = S.installPinhole(s, focus).hidden.pinholeOffset;
  const pm = Math.hypot(p.x, p.y);
  assert(pm >= CONFIG.pinhole.installOffsetMin - 1e-12 && pm <= CONFIG.pinhole.installOffsetMax + 1e-12, `pinhole extra ${pm}`);
  assertEqual(S.installPinhole(S.createInitialState(9), focus).parts.sf.pinhole, false, 'pinhole needs the objective');
});

test('state: only screen moves behind a placed lens count as collimation testing', () => {
  let s = S.createInitialState(1);
  s = S.placePart(s, 'screen', 0.9);
  s = S.placePart(s, 'screen', 1.0);
  assertClose(s.stats.testTravel, 0, 0, 'no lens on the rail yet');
  s = S.placePart(s, 'lens', 0.45);
  s = S.placePart(s, 'screen', 0.7);
  s = S.placePart(s, 'screen', 1.0);
  assertClose(s.stats.testTravel, 0.6, 1e-9);
  assertClose(s.stats.screenTravel, 0.7, 1e-9);
});

test('state: marking the screen stores the spot relative to the card centre', () => {
  const s = S.markScreen(S.createInitialState(1), { x: 1e-3, y: CONFIG.screen.centreHeight + 2e-3 });
  assertClose(s.parts.screen.mark.x, 1e-3, 1e-12);
  assertClose(s.parts.screen.mark.y, 2e-3, 1e-12);
});
