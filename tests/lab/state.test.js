import { test, assert, assertEqual, assertClose, assertThrows } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import * as S from '../../js/lab/state.js';

test('state: initial state is deterministic; laser height and starting left–right offsets are in range', () => {
  assertEqual(JSON.stringify(S.createInitialState(5)), JSON.stringify(S.createInitialState(5)));
  for (let seed = 0; seed < 200; seed++) {
    const s = S.createInitialState(seed);
    const h = s.hidden.laserHeight;
    assert(Math.abs(h - CONFIG.laser.exitHeight) <= CONFIG.laser.exitHeightJitter + 1e-12, `height ${h}`);
    assert(h >= CONFIG.post.min && h <= CONFIG.post.max, 'reachable by posts');
    for (const id of ['a1', 'a2', 'sf']) {
      const x = Math.abs(s.parts[id].x);
      assert(x >= CONFIG.lateral.startMin - 1e-12 && x <= CONFIG.lateral.startMax + 1e-12, `${id} starts ${x} m to the side`);
      assert(x <= CONFIG.lateral.range, 'correctable by the left–right control');
    }
  }
  const s = S.createInitialState(5);
  assertEqual(s.laser.on, false);
  assertEqual(s.parts.a1.onRail, false);
  assertEqual('pitch' in s.laser, false, 'the laser is fixed: no tilt knobs');
});

test('state: setValue clamps, rejects unknown paths and never mutates its input', () => {
  let s = S.createInitialState(1);
  s = S.setValue(s, 'parts.a1.opening', 0);
  assertClose(s.parts.a1.opening, CONFIG.iris.openingMin, 0);
  s = S.setValue(s, 'parts.a1.x', 1);
  assertClose(s.parts.a1.x, CONFIG.lateral.range, 0);
  assertThrows(() => S.setValue(s, 'laser.pitch', 0.001), 'the laser cannot be tilted');
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

test('state: the objective is fixed in the mount; the pinhole lands 30–120 µm off the focus', () => {
  let s = S.createInitialState(9);
  s = S.placePart(s, 'sf', 0.25);
  s = S.installObjective(s);
  assert(s.parts.sf.objective, 'installed');
  assertEqual('objectiveOffset' in s.hidden, false, 'no objective offset: you move the whole spatial filter');
  assertEqual(S.installObjective(s), s, 'second install is a no-op');
  const focus = { x: s.parts.sf.x, y: s.parts.sf.height };
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
