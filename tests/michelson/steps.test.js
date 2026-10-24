import { test, assert, assertEqual } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';
import * as F from '../../js/michelson/steps.js';
import { michelsonBench } from '../../js/michelson/bench.js';
import { aligned } from './fixtures.js';

const flowAt = (id) => ({ ...F.createFlow(), index: F.STEPS.findIndex((s) => s.id === id) });
const passes = (flow, state, id) => F.evaluateChecks(flow, state, michelsonBench(state)).find((c) => c.id === id).pass;
const checkIds = (id) => F.STEPS.find((s) => s.id === id).checks.map((c) => c.id).join();

test('michelson steps: step 1 needs the reflected beam along a hole row and the card tried near and far', () => {
  assertEqual(checkIds('mi1'), 'irisClosed,bsOnBeam,along,cardTested');
  const s = aligned(1, { parts: ['bs'], opening: MI.iris.openingMin });
  let flow = flowAt('mi1');
  for (const x of [0.1, 0.3]) flow = F.observe(flow, michelsonBench(S.placePart(s, 'screen', { x, z: 0.3 }, 6)));
  assert(F.canAdvance(flow, s, michelsonBench(s)), JSON.stringify(F.evaluateChecks(flow, s, michelsonBench(s))));
  const once = F.observe(flowAt('mi1'), michelsonBench(S.placePart(s, 'screen', { x: 0.1, z: 0.3 }, 6)));
  assert(!passes(once, s, 'cardTested'), 'one position is not enough');
  assert(!passes(flow, S.setValue(s, 'parts.bs.rotation', s.parts.bs.rotation + 1e-3), 'along'), 'reflected beam 2 mrad off its row');
  assert(!passes(flow, S.setValue(s, 'iris.opening', 0.012), 'irisClosed'));
  assertEqual(F.observe(flowAt('mi2'), michelsonBench(S.placePart(s, 'screen', { x: 0.1, z: 0.3 }, 6))).trials.max, -Infinity, 'only step 1 records card trials');
});

test('michelson steps: step 2 needs equal arms and both reflected spots on the iris hole', () => {
  assertEqual(checkIds('mi2'), 'onBeams,equalArms,returned');
  const s = aligned(1, { opening: MI.iris.openingMin });
  const flow = flowAt('mi2');
  assert(F.canAdvance(flow, s, michelsonBench(s)), JSON.stringify(F.evaluateChecks(flow, s, michelsonBench(s))));
  assert(!passes(flow, S.placePart(s, 'm2', { x: 0.225, z: 0.3 }), 'equalArms'), 'M2 one hole farther');
  assert(!passes(flow, S.setValue(s, 'parts.m1.h', s.parts.m1.h + 1e-3), 'returned'), 'M1 1 mrad off');
  assert(!passes(flow, S.removePart(s, 'm2'), 'onBeams'), 'M2 missing');
});

test('michelson steps: step 3 needs visible, broad straight fringes on the screen', () => {
  assertEqual(checkIds('mi3'), 'irisOpen,screenOut,overlap,visible,spacing');
  const parallel = aligned();
  const flow = flowAt('mi3');
  assert(!passes(flow, parallel, 'spacing'), 'exactly parallel beams show no fringes');
  const tilted = S.setValue(parallel, 'parts.m1.h', parallel.parts.m1.h + 0.1e-3);
  assert(F.canAdvance(flow, tilted, michelsonBench(tilted)), JSON.stringify(F.evaluateChecks(flow, tilted, michelsonBench(tilted))));
  const far = S.placePart(tilted, 'm2', { x: 0.225, z: 0.3 });
  assert(!passes(flow, far, 'visible'), 'arms one hole apart: no contrast');
});

test('michelson steps: step 4 needs a lens about f from each mirror, at different distances', () => {
  assertEqual(checkIds('mi4'), 'lensesIn,focusOnMirror,rings');
  const same = aligned(1, { parts: ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2'] });
  const flow = flowAt('mi4');
  assert(!passes(flow, same, 'rings'), 'equal distances give no rings');
  const rings = S.movePartBy(same, 'lens2', 0, -0.001);
  assert(F.canAdvance(flow, rings, michelsonBench(rings)), JSON.stringify(F.evaluateChecks(flow, rings, michelsonBench(rings))));
  assert(!passes(flow, S.movePartBy(rings, 'lens1', -0.025, 0), 'focusOnMirror'), 'a lens 125 mm from its mirror');
});

test('michelson steps: warnings fire and re-arm; parts unlock in order', () => {
  const s0 = aligned();
  const r = michelsonBench(s0);
  const moved = S.setValue(s0, 'parts.bs.rotation', s0.parts.bs.rotation + 1e-3);
  let out = F.detectWarnings(flowAt('mi2'), s0, moved, r);
  assertEqual(out.shown.join(), 'miBs');
  out = F.detectWarnings(out.flow, moved, S.setValue(moved, 'parts.bs.rotation', 0), r);
  assertEqual(out.shown.length, 0, 'the same adjustment');
  assertEqual(F.detectWarnings(flowAt('mi1'), s0, moved, r).shown.length, 0, 'the splitter is adjusted freely in step 1');
  assertEqual(F.detectWarnings(flowAt('mi3'), s0, S.setValue(s0, 'parts.m1.stage', 0), r).shown.join(), 'miStage');
  assert(!F.isPartUnlocked(flowAt('miStart'), 'bs') && F.isPartUnlocked(flowAt('mi1'), 'screen'), 'beam splitter and screen in step 1');
  assert(!F.isPartUnlocked(flowAt('mi1'), 'm1') && F.isPartUnlocked(flowAt('mi2'), 'm2'), 'mirrors in step 2');
  assertEqual(F.lockedPartStepLabel('lens1'), '4');
  const { current, earlier } = F.unlockedControls(flowAt('mi3'));
  assert(current.includes('m1.stage') && earlier.includes('bs.rotation'), 'current and earlier controls');
});

test('michelson steps: hints, tip and layout guide', () => {
  let flow = flowAt('mi1');
  flow = F.revealHint(flow, true);
  assert(flow.tipOn && flow.hintsShown === 0, 'the first press shows the tip');
  for (let i = 0; i < 5; i++) flow = F.revealHint(flow, true);
  assertEqual(flow.hintsShown, 4);
  assert(F.guideAvailable(flow), 'the guide comes after the last hint');
  assert(F.toggleGuide(flow).guideOn);
  assert(!F.advance(F.toggleGuide(flow), aligned(), 0).guideOn, 'a new step starts without the guide');
  assertEqual(F.guideFor('screen', 'mi1'), MI.guide.card, 'in step 1 the screen goes on the reflected row');
  assertEqual(F.guideFor('screen', 'mi3'), MI.guide.screen, 'later at the output');
});

// Play every step with ideal actions computed from the hidden errors: every random start must be solvable.
function solve(seed) {
  let state = S.createMichelsonState(seed);
  let flow = F.createFlow();
  const finish = (id) => {
    const result = michelsonBench(state);
    assertEqual(F.currentStep(flow).id, id);
    const failing = F.evaluateChecks(flow, state, result).filter((c) => !c.pass).map((c) => c.id);
    assert(failing.length === 0, `seed ${seed}, step ${id}: failing ${failing.join(', ')}`);
    flow = F.advance(flow, state, 0);
  };
  const act = (next) => {
    state = next;
    flow = F.observe(flow, michelsonBench(state));
  };
  const g = MI.guide;
  act(S.setLaserOn(state, true));
  finish('miStart');

  act(S.setValue(state, 'iris.opening', MI.iris.openingMin));
  act(S.placePart(state, 'bs', g.bs.pos, g.bs.heading));
  act(S.setValue(state, 'parts.bs.rotation', -state.hidden.bsHeading));
  act(S.setValue(state, 'parts.bs.tilt', -state.hidden.bsTilt));
  act(S.placePart(state, 'screen', { x: 0.1, z: 0.3 }, 6));
  act(S.placePart(state, 'screen', { x: 0.3, z: 0.3 }, 6));
  finish('mi1');

  for (const m of ['m1', 'm2']) {
    act(S.placePart(state, m, g[m].pos, g[m].heading));
    act(S.setValue(state, `parts.${m}.h`, -state.hidden[`${m}H`]));
    act(S.setValue(state, `parts.${m}.v`, -state.hidden[`${m}V`]));
  }
  finish('mi2');

  act(S.setValue(state, 'iris.opening', MI.iris.openingMax));
  act(S.placePart(state, 'screen', g.screen.pos, g.screen.heading));
  act(S.setValue(state, 'parts.m1.h', state.parts.m1.h + 0.1e-3));
  finish('mi3');

  act(S.placePart(state, 'lens1', g.lens1.pos, g.lens1.heading));
  act(S.placePart(state, 'lens2', g.lens2.pos, g.lens2.heading));
  act(S.movePartBy(state, 'lens2', 0, -0.001));
  finish('mi4');
  assertEqual(F.currentStep(flow).id, 'miDone');
}

test('michelson steps: ideal actions complete every step for several random starts', () => {
  for (const seed of [1, 2, 3, 4, 5]) solve(seed);
});
