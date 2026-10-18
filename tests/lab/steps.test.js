import { test, assert, assertEqual } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { bench } from '../../js/optics/bench.js';
import * as S from '../../js/lab/state.js';
import * as F from '../../js/lab/steps.js';
import { afterStep1, fullyAligned } from '../fixtures.js';

const flowAt = (id) => ({ ...F.createFlow(), index: F.STEPS.findIndex((s) => s.id === id) });
const checkIds = (id) => F.STEPS.find((s) => s.id === id).checks.map((c) => c.id).join();
const passes = (id, state, check) => F.evaluateChecks(flowAt(id), state, bench(state)).find((c) => c.id === check).pass;

// Step 3 as the student meets it: Aperture 1 still near the laser, pinhole focused, screen just after the mount.
function inStep3(screenZ) {
  let s = afterStep1();
  s = S.placePart(s, 'sf', 0.250);
  s.parts.sf.objective = true;
  s.parts.sf.pinhole = true;
  s.hidden.pinholeOffset = { x: 0, y: 0 };
  s.parts.sf.focus = CONFIG.objective.focusAt;
  return S.placePart(s, 'screen', screenZ);
}

test('steps: step 1 passes with both irises centred at the same height', () => {
  const s = afterStep1();
  assertEqual(checkIds('s1'), 'closed,positions,sameHeight,passes');
  assert(F.canAdvance(flowAt('s1'), s, bench(s)), JSON.stringify(F.evaluateChecks(flowAt('s1'), s, bench(s))));
  assert(!passes('s1', S.setValue(s, 'parts.a2.height', s.parts.a2.height + 0.3e-3), 'sameHeight'), 'heights 0.3 mm apart');
  const aside = S.setValue(s, 'parts.a1.x', 0.4e-3);
  assert(!passes('s1', aside, 'passes'), 'Aperture 1 0.4 mm to the side');
  assert(passes('s1', aside, 'sameHeight'), 'left–right does not change the height check');
});

test('steps: the laser and objective are fixed and Aperture 2 has no remove button', () => {
  const all = F.STEPS.flatMap((s) => s.controls);
  for (const gone of ['laser.pitch', 'laser.yaw', 'sf.objX', 'sf.objY', 'a2.remove']) assert(!all.includes(gone), `${gone} is gone`);
  const s2b = F.STEPS.find((s) => s.id === 's2b').controls;
  assert(s2b.includes('sf.height') && s2b.includes('sf.x'), 'step 2b moves the whole spatial filter');
});

test('steps: M3 fires when Aperture 2 is moved or removed after step 1, and re-arms', () => {
  const s0 = afterStep1();
  const r = bench(s0);
  let flow = flowAt('s2a');
  const moved = S.setValue(s0, 'parts.a2.x', 0.1e-3);
  let out = F.detectWarnings(flow, s0, moved, r);
  assertEqual(out.shown.join(), 'm3');
  flow = out.flow;
  const again = S.setValue(moved, 'parts.a2.x', 0.2e-3);
  out = F.detectWarnings(flow, moved, again, r);
  assertEqual(out.shown.length, 0, 'still the same adjustment');
  flow = out.flow;
  const other = S.setValue(again, 'parts.a1.opening', 2e-3);
  flow = F.detectWarnings(flow, again, other, r).flow;
  assertEqual(F.detectWarnings(flow, other, S.removePart(other, 'a2'), r).shown.join(), 'm3', 'removing it warns again');
  assertEqual(F.detectWarnings(flowAt('s2b'), s0, S.setValue(s0, 'parts.a2.height', 0.1001), r).shown.join(), 'm3', 'height');
  for (const id of ['s3', 's4']) {
    assertEqual(F.detectWarnings(flowAt(id), s0, S.placePart(s0, 'a2', 0.900), r).shown.join(), 'm3', `along the rail in ${id}`);
  }
  assertEqual(F.detectWarnings(flowAt('s2a'), s0, S.setValue(s0, 'parts.a2.opening', 2e-3), r).shown.length, 0, 'opening is not moving');
  assertEqual(F.detectWarnings(flowAt('s1'), s0, moved, r).shown.length, 0, 'Aperture 2 is adjusted freely in step 1');
});

test('steps: step 3 needs a clean spot on a screen within 300 mm after the pinhole, in front of Aperture 2', () => {
  const s = inStep3(0.400);
  assertEqual(checkIds('s3'), 'installed,clean,screenClose');
  assert(F.canAdvance(flowAt('s3'), s, bench(s)), JSON.stringify(F.evaluateChecks(flowAt('s3'), s, bench(s))));
  assert(!passes('s3', S.setValue(s, 'parts.sf.focus', CONFIG.objective.focusAt + 0.5e-3), 'clean'), 'defocused by 0.5 mm');
  assert(!passes('s3', inStep3(0.600), 'screenClose'), '350 mm after the pinhole is too far');
  assert(!passes('s3', inStep3(0.900), 'screenClose'), 'behind Aperture 2');
});

test('steps: step 4 passes with Aperture 2 in place and the screen tested between the lens and Aperture 2', () => {
  const flow = flowAt('s4');
  let s = fullyAligned();
  s = S.placePart(s, 'screen', 0.500);
  s = S.placePart(s, 'screen', 0.750);
  assert(F.canAdvance(flow, s, bench(s)), JSON.stringify(F.evaluateChecks(flow, s, bench(s))));
  assert(!passes('s4', S.removePart(s, 'a2'), 'layout'), 'Aperture 2 must stay on the rail');
  const beyond = S.placePart(s, 'screen', 0.900);
  assert(!passes('s4', beyond, 'collimated'), 'the screen behind Aperture 2 does not count');
  const blocked = S.placePart(S.setValue(s, 'parts.a1.opening', CONFIG.iris.openingMin), 'a1', 0.600);
  assertEqual(bench(blocked).stoppedAt, 'a1', 'a closed iris after the lens stops the light');
  assert(!passes('s4', blocked, 'collimated'), 'no light on the screen');
});

test('steps: moving the screen before the lens is in place is not a collimation test', () => {
  let s = fullyAligned();
  s = S.removePart(s, 'lens');
  s = S.placePart(s, 'screen', 0.500);
  s = S.placePart(s, 'screen', 0.750);
  s = S.placePart(s, 'lens', 0.450);
  const tested = F.evaluateChecks(flowAt('s4'), s, bench(s)).find((c) => c.id === 'tested');
  assert(!tested.pass, 'screen travel before the lens was placed must not count');
});

test('steps: parts unlock in handout order', () => {
  assert(!F.isPartUnlocked(flowAt('start'), 'a1'), 'nothing before step 1');
  assert(F.isPartUnlocked(flowAt('s1'), 'a1') && !F.isPartUnlocked(flowAt('s1'), 'sf'), 'irises in step 1');
  assert(F.isPartUnlocked(flowAt('s2a'), 'sf') && F.isPartUnlocked(flowAt('s2a'), 'screen'), 'mount and screen in 2a');
  assert(!F.isPartUnlocked(flowAt('s3'), 'lens') && F.isPartUnlocked(flowAt('s4'), 'lens'), 'lens in step 4');
  assertEqual(F.lockedPartStepLabel('lens'), '4');
  const { current, earlier } = F.unlockedControls(flowAt('s2a'));
  assert(current.includes('sf.height') && current.includes('sf.x') && earlier.includes('a1.x'), 'current and earlier controls');
});

// Play every step with ideal actions, computed from the hidden values: every random start must be solvable.
function solve(seed) {
  let state = S.createInitialState(seed);
  let flow = F.createFlow();
  const finish = (id) => {
    const result = bench(state);
    assertEqual(F.currentStep(flow).id, id);
    const failing = F.evaluateChecks(flow, state, result).filter((c) => !c.pass).map((c) => c.id);
    assert(failing.length === 0, `seed ${seed}, step ${id}: failing ${failing.join(', ')}`);
    flow = F.advance(flow, state, 0);
  };
  state = S.setLaserOn(state, true);
  finish('start');

  state = S.placePart(state, 'a1', 0.100);
  state = S.placePart(state, 'a2', 0.800);
  for (const id of ['a1', 'a2']) {
    state = S.setValue(state, `parts.${id}.height`, state.hidden.laserHeight);
    state = S.setValue(state, `parts.${id}.x`, 0);
    state = S.setValue(state, `parts.${id}.opening`, CONFIG.iris.openingMin);
  }
  finish('s1');

  state = S.placePart(state, 'sf', 0.250);
  state = S.setValue(state, 'parts.sf.height', state.hidden.laserHeight + 0.2e-3);   // roughly centred in the ring
  state = S.setValue(state, 'parts.sf.x', -0.1e-3);
  state = S.placePart(state, 'screen', 0.900);
  state = S.markScreen(state, bench(state).at.screen);
  finish('s2a');

  state = S.installObjective(state);
  state = S.setValue(state, 'parts.sf.height', state.hidden.laserHeight);
  state = S.setValue(state, 'parts.sf.x', 0);
  state = S.setValue(state, 'parts.sf.focus', CONFIG.objective.travel);
  finish('s2b');

  state = S.installPinhole(state, bench(state).at.objective.focusCentre);
  state = S.placePart(state, 'screen', 0.400);   // over Aperture 2, to just after the mount
  state = S.setValue(state, 'parts.sf.focus', CONFIG.objective.focusAt);
  const spot = bench(state).at.objective.focusCentre;
  const po = state.hidden.pinholeOffset;
  state = S.setValue(state, 'parts.sf.phX', spot.x - state.parts.sf.x - po.x);
  state = S.setValue(state, 'parts.sf.phY', spot.y - state.parts.sf.height - po.y);
  finish('s3');

  state = S.removePart(state, 'a1');
  state = S.placePart(state, 'a1', 0.350);
  state = S.setValue(state, 'parts.a1.opening', 8e-3);
  state = S.placePart(state, 'screen', 0.700);
  state = S.placePart(state, 'lens', 0.250 + CONFIG.lens.focalLength);
  state = S.setValue(state, 'parts.lens.height', bench(state).at.lens.y);
  state = S.placePart(state, 'screen', 0.500);
  state = S.placePart(state, 'screen', 0.750);
  finish('s4');
  assertEqual(F.currentStep(flow).id, 'done');
}

test('steps: ideal actions complete every step for several random starts', () => {
  for (const seed of [1, 2, 3, 4, 5]) solve(seed);
});
