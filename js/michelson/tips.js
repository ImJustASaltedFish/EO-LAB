// Tips about what is wrong right now (spec §3.6): the first matching situation in the current step. Pure logic.
import { MI } from './config.js';
import { reflectedErrors } from './steps.js';

const C = MI.checks;
const NAMES = Object.freeze({ m1: 'M1', m2: 'M2', lens1: 'L1', lens2: 'L2' });
const mm = (metres, digits = 1) => (metres * 1e3).toFixed(digits);

// Distance in the table plane from point p to the line along a ray.
function offLine(p, ray) {
  const dx = p.x - ray.start.x;
  const dz = p.z - ray.start.z;
  const h = Math.hypot(ray.direction.x, ray.direction.z);
  return Math.abs(dx * ray.direction.z - dz * ray.direction.x) / h;
}

function stepOne(state, result, flow) {
  if (!result.bsHit) return { key: 'tip.mi1.bsOffBeam' };
  if (result.reflected) {
    const e = reflectedErrors(result.reflected);
    const theta = Math.max(e.horizontal, e.vertical);
    if (theta > C.mi1.angleTol) return { key: 'tip.mi1.reflectedOff', params: { theta: (theta * 1e3).toFixed(1) } };
  }
  if (flow.trials.max - flow.trials.min < C.mi1.cardSpan) return { key: 'tip.mi1.card' };
  return null;
}

function stepTwo(state, result) {
  const arms = [result.arms.T, result.arms.R].filter(Boolean);
  const armRays = result.rays.filter((r) => r.path.length === 1 && (r.path[0] === 'bs:T' || r.path[0] === 'bs:R'));
  for (const m of ['m1', 'm2']) {
    if (!state.parts[m].placed) continue;
    const arm = arms.find((a) => a.mirror === m);
    const d = arm ? arm.offset : Math.min(...armRays.map((ray) => offLine(state.parts[m].pos, ray)));
    if (d > C.mi2.mirrorCentreTol) return { key: 'tip.mi2.mirrorOff', params: { mirror: NAMES[m], d: mm(d) } };
  }
  const { T, R } = result.arms;
  if (T?.mirror && R?.mirror && Math.abs(T.length - R.length) > C.mi2.armTol) {
    return { key: 'tip.mi2.arms', params: { n: Math.round(Math.abs(T.length - R.length) / MI.table.pitch) } };
  }
  const worst = [...result.iris.spots].sort((a, b) => Math.hypot(b.dx, b.dy) - Math.hypot(a.dx, a.dy))[0];
  if (worst && Math.hypot(worst.dx, worst.dy) > C.mi2.returnTol) {
    const key = Math.abs(worst.dx) >= Math.abs(worst.dy) ? 'tip.mi2.spotOffH' : 'tip.mi2.spotOffV';
    return { key, params: { mirror: NAMES[worst.mirror], d: mm(Math.hypot(worst.dx, worst.dy)) } };
  }
  return null;
}

// Contrast first: without it no fringes show, whatever their spacing.
function stepThree(state, result) {
  const f = result.fringe;
  if (!f) return null;
  if (f.contrast < C.mi3.contrastMin) return { key: 'tip.mi3.contrast', params: { dl: mm(Math.abs(f.pathDifference)) } };
  if (f.spacing < C.mi3.spacingMin) return { key: 'tip.mi3.fine', params: { s: mm(f.spacing, 2) } };
  if (f.spacing > C.mi3.spacingMax) return { key: 'tip.mi3.parallel' };
  return null;
}

function stepFour(state, result) {
  const lenses = [result.arms.T, result.arms.R].filter((arm) => arm?.mirror && arm.lenses.length === 1).map((arm) => arm.lenses[0]);
  for (const lens of lenses) {
    if (Math.abs(lens.toMirror - MI.lens.focalLength) > C.mi4.focusTol) {
      return { key: 'tip.mi4.lensFar', params: { lens: NAMES[lens.id], d: mm(lens.toMirror, 0) } };
    }
  }
  if (lenses.length === 2 && result.fringe && result.fringe.rings < C.mi4.ringsMin
    && Math.abs(lenses[0].toMirror - lenses[1].toMirror) < 0.5e-3) return { key: 'tip.mi4.same' };
  return null;
}

const BY_STEP = { mi1: stepOne, mi2: stepTwo, mi3: stepThree, mi4: stepFour };

// { key, params } for the current step, or null when no tip applies.
export function tipFor(stepId, state, result, flow) {
  const tip = BY_STEP[stepId] && result.laserOn ? BY_STEP[stepId](state, result, flow) : null;
  return tip ? { params: {}, ...tip } : null;
}
