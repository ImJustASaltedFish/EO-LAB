// Bench state: everything the student can change, plus hidden random values (spec §3.3, §4.1).
// Every update returns a new object; a refused update returns the same object.
import { CONFIG } from '../optics/config.js';
import { createRng, deriveSeed, uniform, randomSign, randomVector, SALT } from '../optics/rng.js';

export const PART_IDS = Object.freeze(['a1', 'a2', 'sf', 'lens', 'screen']);

// The laser is fixed and level on the rail centreline (x = 0); only its height is random. The irises and the
// spatial filter mount start 0.5–2 mm to one side, so the student centres them left–right as well as in height.
export function createInitialState(seed) {
  const rng = createRng(deriveSeed(seed, SALT.laser));
  const side = createRng(deriveSeed(seed, SALT.lateral));
  const { laser, post, iris, objective, lateral } = CONFIG;
  const offCentre = () => randomSign(side) * uniform(side, lateral.startMin, lateral.startMax);
  return {
    seed,
    laser: { on: false },
    parts: {
      a1: { onRail: false, z: 0, x: offCentre(), height: post.initial, opening: iris.openingInitial },
      a2: { onRail: false, z: 0, x: offCentre(), height: post.initial, opening: iris.openingInitial },
      sf: {
        onRail: false, z: 0, x: offCentre(), height: post.initial, objective: false, pinhole: false,
        focus: objective.startAt, phX: 0, phY: 0,
      },
      lens: { onRail: false, z: 0, height: post.initial },
      screen: { onRail: false, z: 0, mark: null },
    },
    hidden: {
      laserHeight: laser.exitHeight + uniform(rng, -laser.exitHeightJitter, laser.exitHeightJitter),
      pinholeOffset: null,
    },
    stats: { screenTravel: 0, testTravel: 0 },
  };
}

const { post: P, lateral: X, iris: I, objective: O, pinhole: PH } = CONFIG;
const RANGES = {
  'parts.a1.height': [P.min, P.max],
  'parts.a2.height': [P.min, P.max],
  'parts.sf.height': [P.min, P.max],
  'parts.lens.height': [P.min, P.max],
  'parts.a1.x': [-X.range, X.range],
  'parts.a2.x': [-X.range, X.range],
  'parts.sf.x': [-X.range, X.range],
  'parts.a1.opening': [I.openingMin, I.openingMax],
  'parts.a2.opening': [I.openingMin, I.openingMax],
  'parts.sf.focus': [0, O.travel],
  'parts.sf.phX': [-PH.range, PH.range],
  'parts.sf.phY': [-PH.range, PH.range],
};

export const VALUE_PATHS = Object.freeze(Object.keys(RANGES));

export function getValue(state, path) {
  return path.split('.').reduce((obj, key) => obj[key], state);
}

export function setValue(state, path, value) {
  const range = RANGES[path];
  if (!range) throw new Error(`unknown value path: ${path}`);
  const next = structuredClone(state);
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((obj, key) => obj[key], next);
  target[last] = Math.min(range[1], Math.max(range[0], value));
  return next;
}

export function setLaserOn(state, on) {
  const next = structuredClone(state);
  next.laser.on = Boolean(on);
  return next;
}

function footprint(id, z) {
  const [lo, hi] = CONFIG.footprint[id];
  return [z + lo, z + hi];
}

export function isFree(state, id, z) {
  const { zMin, zMax, minGap } = CONFIG.rail;
  if (z < zMin - 1e-9 || z > zMax + 1e-9) return false;
  const [lo, hi] = footprint(id, z);
  for (const other of PART_IDS) {
    if (other === id || !state.parts[other].onRail) continue;
    const [olo, ohi] = footprint(other, state.parts[other].z);
    if (lo < ohi + minGap - 1e-9 && hi > olo - minGap + 1e-9) return false;
  }
  return true;
}

export function snapZ(z) {
  return Math.round(z / CONFIG.rail.grid) * CONFIG.rail.grid;
}

// Nearest free position to `wanted`, searching outwards on the 1 mm grid; null if the rail is full.
export function nearestFreeZ(state, id, wanted) {
  const { zMin, zMax, grid } = CONFIG.rail;
  const start = snapZ(Math.min(zMax, Math.max(zMin, wanted)));
  const steps = Math.ceil((zMax - zMin) / grid);
  for (let n = 0; n <= steps; n++) {
    for (const z of [start + n * grid, start - n * grid]) {
      if (isFree(state, id, z)) return snapZ(z);
    }
  }
  return null;
}

export function placePart(state, id, z) {
  if (!PART_IDS.includes(id)) throw new Error(`unknown part: ${id}`);
  const target = snapZ(z);
  if (!isFree(state, id, target)) return state;
  const next = structuredClone(state);
  const part = next.parts[id];
  if (id === 'screen' && part.onRail) {
    const moved = Math.abs(target - part.z);
    next.stats.screenTravel += moved;
    // Only moves behind a lens that is on the rail test collimation (step 4).
    const lens = next.parts.lens;
    if (lens.onRail && part.z > lens.z && target > lens.z) next.stats.testTravel += moved;
  }
  part.onRail = true;
  part.z = target;
  return next;
}

export function removePart(state, id) {
  const next = structuredClone(state);
  next.parts[id].onRail = false;
  return next;
}

// The objective is fixed on the mount axis: centring it means moving the whole spatial filter (spec §4.1).
export function installObjective(state) {
  if (state.parts.sf.objective) return state;
  const next = structuredClone(state);
  next.parts.sf.objective = true;
  return next;
}

// The pinhole lands 30–120 µm off the focused spot. The offset is relative to the mount axis.
export function installPinhole(state, focusCentre) {
  const sf = state.parts.sf;
  if (sf.pinhole || !sf.objective) return state;
  const extra = randomVector(createRng(deriveSeed(state.seed, SALT.pinhole)), PH.installOffsetMin, PH.installOffsetMax);
  const next = structuredClone(state);
  next.hidden.pinholeOffset = { x: focusCentre.x - sf.x + extra.x, y: focusCentre.y - sf.height + extra.y };
  next.parts.sf.pinhole = true;
  return next;
}

export function markScreen(state, beamAtScreen) {
  const next = structuredClone(state);
  next.parts.screen.mark = beamAtScreen
    ? { x: beamAtScreen.x, y: beamAtScreen.y - CONFIG.screen.centreHeight }
    : null;
  return next;
}
