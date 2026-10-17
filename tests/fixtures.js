// Shared test states: a laser with no hidden tilt, and aligned setups at the end of steps.
import { CONFIG } from '../js/optics/config.js';
import * as S from '../js/lab/state.js';

export function alignedLaser(seed = 1) {
  const s = S.createInitialState(seed);
  s.hidden.pitch0 = 0;
  s.hidden.yaw0 = 0;
  s.hidden.laserHeight = 0.100;
  s.laser.on = true;
  return s;
}

// Laser plus both irises closed and centred (end of step 1).
export function afterStep1(seed = 1) {
  let s = alignedLaser(seed);
  s = S.placePart(s, 'a1', 0.100);
  s = S.placePart(s, 'a2', 0.800);
  s = S.setValue(s, 'parts.a1.opening', CONFIG.iris.openingMin);
  s = S.setValue(s, 'parts.a2.opening', CONFIG.iris.openingMin);
  return s;
}

// Objective and pinhole centred and focused, Aperture 1 trimming before the lens, lens at f_e, Aperture 2 removed.
export function fullyAligned(seed = 1) {
  let s = afterStep1(seed);
  s = S.placePart(s, 'sf', 0.250);
  s.parts.sf.objective = true;
  s.parts.sf.pinhole = true;
  s.hidden.objectiveOffset = { x: 0, y: 0 };
  s.hidden.pinholeOffset = { x: 0, y: 0 };
  s.parts.sf.focus = CONFIG.objective.focusAt;
  s = S.removePart(s, 'a2');
  s = S.removePart(s, 'a1');
  s = S.placePart(s, 'a1', 0.350);
  s = S.setValue(s, 'parts.a1.opening', 8e-3);
  s = S.placePart(s, 'lens', 0.250 + CONFIG.lens.focalLength);
  s = S.placePart(s, 'screen', 0.900);
  return s;
}
