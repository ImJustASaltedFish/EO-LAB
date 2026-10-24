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

test('michelson tips: step 2 — card in an arm, mirror off its beam or at the wrong distance, spot lost or off the hole', () => {
  const s = aligned();
  assertEqual(tip('mi2', S.placePart(s, 'screen', { x: 0.15, z: 0.3 }, 6)).key, 'tip.mi2.cardInArm', 'the step-1 card left in M2\'s arm');
  const behind = S.placePart(S.placePart(s, 'm2', MI.place.m2.pos), 'screen', { x: 0.275, z: 0.3 }, 6);
  assertEqual(tip('mi2', behind).key, 'tip.mi2.cardInArm', 'M2 placed in front of the card cannot get past it to 300 mm');
  const off = tip('mi2', S.placePart(s, 'm2', { x: 0.3, z: 0.35 }));
  assertEqual(off.key, 'tip.mi2.mirrorOff');
  assertEqual(off.params.mirror, 'M2');
  assertClose(Number(off.params.d), 50, 0.1);
  const short = tip('mi2', S.placePart(s, 'm2', MI.place.m2.pos));
  assertEqual(short.key, 'tip.mi2.armLength');
  assertEqual(short.params.mirror, 'M2');
  assertEqual(short.params.d, '150');
  // M2's knob at the far end: its light comes back beside the beam splitter, not to Aperture 1.
  const lost = tip('mi2', S.setValue(s, 'parts.m2.h', s.parts.m2.h > 0 ? -MI.mirror.tiltRange : MI.mirror.tiltRange));
  assertEqual(lost.key, 'tip.mi2.spotLost');
  assertEqual(lost.params.mirror, 'M2');
  const spot = tip('mi2', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 1e-3));
  assertEqual(spot.key, 'tip.mi2.spotOffH');
  assertEqual(spot.params.mirror, 'M1');
  assertEqual(tip('mi2', s), null);
});

test('michelson tips: step 3 — contrast, then too fine, then too parallel', () => {
  const s = aligned();
  assertEqual(tip('mi3', s).key, 'tip.mi3.parallel');
  assertEqual(tip('mi3', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 2e-3)).key, 'tip.mi3.fine');
  const far = tip('mi3', S.placePart(S.setValue(s, 'parts.m1.h', s.parts.m1.h + 2e-3), 'm2', { x: 0.325, z: 0.3 }));
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
