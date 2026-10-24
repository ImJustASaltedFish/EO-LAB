// Shared Michelson test states: the layout-guide positions (spec §3.6) with every hand error corrected by its knobs.
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';

export function aligned(seed = 1, { parts = ['bs', 'm1', 'm2', 'screen'], opening = MI.iris.openingMax } = {}) {
  let s = S.setLaserOn(S.createMichelsonState(seed), true);
  for (const id of parts) s = S.placePart(s, id, MI.guide[id].pos, MI.guide[id].heading);
  const h = s.hidden;
  s = S.setValue(s, 'parts.bs.rotation', -h.bsHeading);
  s = S.setValue(s, 'parts.bs.tilt', -h.bsTilt);
  for (const m of ['m1', 'm2']) {
    s = S.setValue(s, `parts.${m}.h`, -h[`${m}H`]);
    s = S.setValue(s, `parts.${m}.v`, -h[`${m}V`]);
  }
  return S.setValue(s, 'iris.opening', opening);
}
