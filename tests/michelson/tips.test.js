import { test, assertEqual, assertClose } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';
import * as F from '../../js/michelson/steps.js';
import { tipFor } from '../../js/michelson/tips.js';
import { michelsonBench } from '../../js/michelson/bench.js';
import { aligned } from './fixtures.js';

const tip = (stepId, state, flow = F.createFlow()) => tipFor(stepId, state, michelsonBench(state), flow);

test('michelson tips: step 1 — beam splitter off the beam, reflected beam off its row, card not tried', () => {
  const lit = S.setLaserOn(S.createMichelsonState(1), true);
  assertEqual(tip('mi1', lit).key, 'tip.mi1.bsOffBeam');
  const crooked = S.placePart(lit, 'bs', MI.guide.bs.pos, MI.guide.bs.heading);
  const t = tip('mi1', crooked);
  assertEqual(t.key, 'tip.mi1.reflectedOff');
  assertClose(Number(t.params.theta), 2 * Math.abs(crooked.hidden.bsHeading) * 1e3, 0.15);
  const straight = aligned(1, { parts: ['bs'] });
  assertEqual(tip('mi1', straight).key, 'tip.mi1.card');
  const tried = { ...F.createFlow(), trials: { min: 0.1, max: 0.3 } };
  assertEqual(tip('mi1', straight, tried), null);
});

test('michelson tips: step 2 — mirror off its beam, unequal arms, reflected spot off the hole', () => {
  const s = aligned();
  const off = tip('mi2', S.placePart(s, 'm2', { x: 0.2, z: 0.35 }));
  assertEqual(off.key, 'tip.mi2.mirrorOff');
  assertEqual(off.params.mirror, 'M2');
  assertClose(Number(off.params.d), 50, 0.1);
  const arms = tip('mi2', S.placePart(s, 'm2', { x: 0.225, z: 0.3 }));
  assertEqual(arms.key, 'tip.mi2.arms');
  assertEqual(arms.params.n, 1);
  const spot = tip('mi2', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 1e-3));
  assertEqual(spot.key, 'tip.mi2.spotOffH');
  assertEqual(spot.params.mirror, 'M1');
  assertEqual(tip('mi2', s), null);
});

test('michelson tips: step 3 — contrast, then too fine, then too parallel', () => {
  const s = aligned();
  assertEqual(tip('mi3', s).key, 'tip.mi3.parallel');
  assertEqual(tip('mi3', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 2e-3)).key, 'tip.mi3.fine');
  const far = tip('mi3', S.placePart(S.setValue(s, 'parts.m1.h', s.parts.m1.h + 2e-3), 'm2', { x: 0.225, z: 0.3 }));
  assertEqual(far.key, 'tip.mi3.contrast');
  assertEqual(far.params.dl, '50.0');
  assertEqual(tip('mi3', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 0.1e-3)), null);
});

test('michelson tips: step 4 — a lens far from its focal distance, or both lenses at the same distance', () => {
  const s = aligned(1, { parts: ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2'] });
  assertEqual(tip('mi4', s).key, 'tip.mi4.same');
  const far = tip('mi4', S.movePartBy(s, 'lens1', -0.025, 0));
  assertEqual(far.key, 'tip.mi4.lensFar');
  assertEqual(far.params.lens, 'L1');
  assertEqual(far.params.d, '125');
  assertEqual(tip('mi4', S.movePartBy(s, 'lens2', 0, -0.001)), null);
  assertEqual(tip('mi4', S.createMichelsonState(1)), null, 'no tips with the laser off');
});
