import { test, assert, assertEqual } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { bench } from '../../js/optics/bench.js';
import * as S from '../../js/lab/state.js';
import * as F from '../../js/lab/steps.js';
import { afterStep1, fullyAligned } from '../fixtures.js';

const flowAt = (id) => ({ ...F.createFlow(), index: F.STEPS.findIndex((s) => s.id === id) });

test('steps: step 1 passes when aligned and fails with a 1 mrad tilt', () => {
  const s = afterStep1();
  assert(F.canAdvance(flowAt('s1'), s, bench(s)), JSON.stringify(F.evaluateChecks(flowAt('s1'), s, bench(s))));
  const tilted = afterStep1();
  tilted.hidden.pitch0 = 1e-3;
  assert(!F.canAdvance(flowAt('s1'), tilted, bench(tilted)), 'tilted beam must not pass');
});

test('steps: M1 fires for a far iris height change in step 1, not a near one', () => {
  const s = afterStep1();
  const r = bench(s);
  assertEqual(F.detectWarnings(flowAt('s1'), s, S.setValue(s, 'parts.a2.height', 0.101), r).shown.join(), 'm1');
  assertEqual(F.detectWarnings(flowAt('s1'), s, S.setValue(s, 'parts.a1.height', 0.101), r).shown.length, 0);
});

test('steps: M2 fires once per continuous laser adjustment after step 1', () => {
  let flow = flowAt('s2a');
  const s0 = afterStep1();
  const r = bench(s0);
  const s1 = S.setValue(s0, 'laser.pitch', 0.1e-3);
  let out = F.detectWarnings(flow, s0, s1, r);
  assertEqual(out.shown.join(), 'm2');
  flow = out.flow;
  const s2 = S.setValue(s1, 'laser.pitch', 0.2e-3);
  out = F.detectWarnings(flow, s1, s2, r);
  assertEqual(out.shown.length, 0, 'still the same adjustment');
  flow = out.flow;
  const s3 = S.setValue(s2, 'parts.a1.opening', 2e-3);
  flow = F.detectWarnings(flow, s2, s3, r).flow;
  const s4 = S.setValue(s3, 'laser.yaw', 0.1e-3);
  assertEqual(F.detectWarnings(flow, s3, s4, r).shown.join(), 'm2', 'a different action re-arms the warning');
  assertEqual(F.detectWarnings(flowAt('s1'), s0, s1, r).shown.length, 0, 'laser knobs are allowed in step 1');
});

test('steps: step 3 needs a focused, centred pinhole', () => {
  const s = S.setValue(fullyAligned(), 'parts.a2.opening', 8e-3);
  const clean = (state) => F.evaluateChecks(flowAt('s3'), state, bench(state)).find((c) => c.id === 'clean').pass;
  assert(clean(s), 'focused and centred');
  assert(!clean(S.setValue(s, 'parts.sf.focus', CONFIG.objective.focusAt + 0.5e-3)), 'defocused by 0.5 mm');
});

test('steps: step 4 passes when collimated and fails while Aperture 2 is on the rail', () => {
  const flow = flowAt('s4');
  let s = fullyAligned();
  s = S.placePart(s, 'screen', 0.700);
  s = S.placePart(s, 'screen', 1.000);
  assert(F.canAdvance(flow, s, bench(s)), JSON.stringify(F.evaluateChecks(flow, s, bench(s))));
  const withA2 = S.placePart(s, 'a2', 1.100);
  assert(!F.canAdvance(flow, withA2, bench(withA2)), 'Aperture 2 still on the rail');
});

test('steps: parts unlock in handout order', () => {
  assert(!F.isPartUnlocked(flowAt('start'), 'a1'), 'nothing before step 1');
  assert(F.isPartUnlocked(flowAt('s1'), 'a1') && !F.isPartUnlocked(flowAt('s1'), 'sf'), 'irises in step 1');
  assert(F.isPartUnlocked(flowAt('s2a'), 'sf') && F.isPartUnlocked(flowAt('s2a'), 'screen'), 'mount and screen in 2a');
  assert(!F.isPartUnlocked(flowAt('s3'), 'lens') && F.isPartUnlocked(flowAt('s4'), 'lens'), 'lens in step 4');
  assertEqual(F.lockedPartStepLabel('lens'), '4');
  const { current, earlier } = F.unlockedControls(flowAt('s2a'));
  assert(current.includes('sf.height') && earlier.includes('laser.pitch'), 'current and earlier controls');
});

// Play every step with ideal actions, computed from the hidden offsets: every random start must be solvable.
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

  state = S.setValue(state, 'laser.pitch', -state.hidden.pitch0);
  state = S.setValue(state, 'laser.yaw', -state.hidden.yaw0);
  state = S.placePart(state, 'a1', 0.100);
  state = S.placePart(state, 'a2', 0.800);
  for (const id of ['a1', 'a2']) {
    state = S.setValue(state, `parts.${id}.height`, state.hidden.laserHeight);
    state = S.setValue(state, `parts.${id}.opening`, CONFIG.iris.openingMin);
  }
  finish('s1');

  state = S.placePart(state, 'sf', 0.250);
  state = S.setValue(state, 'parts.sf.height', state.hidden.laserHeight);
  state = S.placePart(state, 'screen', 0.900);
  state = S.markScreen(state, bench(state).at.screen);
  finish('s2a');

  state = S.installObjective(state, bench(state).at.ring);
  const obj = bench(state).at.objective;
  const oo = state.hidden.objectiveOffset;
  state = S.setValue(state, 'parts.sf.objX', obj.x - oo.x);
  state = S.setValue(state, 'parts.sf.objY', obj.y - state.parts.sf.height - oo.y);
  state = S.setValue(state, 'parts.sf.focus', CONFIG.objective.travel);
  finish('s2b');

  state = S.installPinhole(state, bench(state).at.objective.focusCentre);
  state = S.removePart(state, 'screen');
  state = S.placePart(state, 'screen', 0.400);
  state = S.setValue(state, 'parts.sf.focus', CONFIG.objective.focusAt);
  const spot = bench(state).at.objective.focusCentre;
  const po = state.hidden.pinholeOffset;
  state = S.setValue(state, 'parts.sf.phX', spot.x - po.x);
  state = S.setValue(state, 'parts.sf.phY', spot.y - state.parts.sf.height - po.y);
  state = S.setValue(state, 'parts.a2.opening', 8e-3);
  finish('s3');

  state = S.removePart(state, 'a2');
  state = S.removePart(state, 'a1');
  state = S.placePart(state, 'a1', 0.350);
  state = S.setValue(state, 'parts.a1.opening', 8e-3);
  state = S.removePart(state, 'screen');
  state = S.placePart(state, 'lens', 0.250 + CONFIG.lens.focalLength);
  state = S.setValue(state, 'parts.lens.height', bench(state).at.lens.y);
  state = S.placePart(state, 'screen', 0.700);
  state = S.placePart(state, 'screen', 1.000);
  finish('s4');
  assertEqual(F.currentStep(flow).id, 'done');
}

test('steps: ideal actions complete every step for several random starts', () => {
  for (const seed of [1, 2, 3, 4, 5]) solve(seed);
});
