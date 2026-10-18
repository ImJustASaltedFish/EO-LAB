// Shared test states: a laser at 100 mm with every part centred sideways, and aligned setups at the end of steps.
import { CONFIG } from '../js/optics/config.js';
import * as S from '../js/lab/state.js';

export function alignedLaser(seed = 1) {
  const s = S.createInitialState(seed);
  s.hidden.laserHeight = 0.100;
  s.laser.on = true;
  for (const id of ['a1', 'a2', 'sf']) s.parts[id].x = 0;
  return s;
}

// Both irises closed and centred: Aperture 1 near the laser, Aperture 2 far (end of step 1).
export function afterStep1(seed = 1) {
  let s = alignedLaser(seed);
  s = S.placePart(s, 'a1', 0.100);
  s = S.placePart(s, 'a2', 0.800);
  s = S.setValue(s, 'parts.a1.opening', CONFIG.iris.openingMin);
  s = S.setValue(s, 'parts.a2.opening', CONFIG.iris.openingMin);
  return s;
}

// Spatial filter centred, pinhole focused; Aperture 1 trimming before the lens at f_e; Aperture 2 left in place;
// the screen between the lens and Aperture 2.
export function fullyAligned(seed = 1) {
  let s = afterStep1(seed);
  s = S.placePart(s, 'sf', 0.250);
  s.parts.sf.objective = true;
  s.parts.sf.pinhole = true;
  s.hidden.pinholeOffset = { x: 0, y: 0 };
  s.parts.sf.focus = CONFIG.objective.focusAt;
  s = S.removePart(s, 'a1');
  s = S.placePart(s, 'a1', 0.350);
  s = S.setValue(s, 'parts.a1.opening', 8e-3);
  s = S.placePart(s, 'lens', 0.250 + CONFIG.lens.focalLength);
  s = S.placePart(s, 'screen', 0.700);
  return s;
}
