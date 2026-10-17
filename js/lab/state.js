// Bench state: everything the student can change, plus hidden random values (spec §3.3, §4.1).
// Every update returns a new object; a refused update returns the same object.
import { CONFIG } from '../optics/config.js';
import { createRng, deriveSeed, uniform, randomSign, randomVector, SALT } from '../optics/rng.js';

export const PART_IDS = Object.freeze(['a1', 'a2', 'sf', 'lens', 'screen']);

export function createInitialState(seed) {
  const rng = createRng(deriveSeed(seed, SALT.laser));
  const { laser, post, iris, objective } = CONFIG;
  return {
    seed,
    laser: { on: false, pitch: 0, yaw: 0 },
    parts: {
      a1: { onRail: false, z: 0, height: post.initial, opening: iris.openingInitial },
      a2: { onRail: false, z: 0, height: post.initial, opening: iris.openingInitial },
      sf: {
        onRail: false, z: 0, height: post.initial, objective: false, pinhole: false,
        objX: 0, objY: 0, focus: objective.startAt, phX: 0, phY: 0,
      },
      lens: { onRail: false, z: 0, height: post.initial },
      screen: { onRail: false, z: 0, mark: null },
    },
    hidden: {
      laserHeight: laser.exitHeight + uniform(rng, -laser.exitHeightJitter, laser.exitHeightJitter),
      pitch0: randomSign(rng) * uniform(rng, laser.tiltMin, laser.tiltMax),
      yaw0: randomSign(rng) * uniform(rng, laser.tiltMin, laser.tiltMax),
      objectiveOffset: null,
      pinholeOffset: null,
    },
    stats: { screenTravel: 0, testTravel: 0 },
  };
}

const { laser: L, post: P, iris: I, objective: O, pinhole: PH } = CONFIG;
const RANGES = {
  'laser.pitch': [-L.knobRange, L.knobRange],
  'laser.yaw': [-L.knobRange, L.knobRange],
  'parts.a1.height': [P.min, P.max],
  'parts.a2.height': [P.min, P.max],
  'parts.sf.height': [P.min, P.max],
  'parts.lens.height': [P.min, P.max],
  'parts.a1.opening': [I.openingMin, I.openingMax],
  'parts.a2.opening': [I.openingMin, I.openingMax],
  'parts.sf.objX': [-O.decentreRange, O.decentreRange],
  'parts.sf.objY': [-O.decentreRange, O.decentreRange],
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

// The objective lands 0.2–0.6 mm off the current beam (spec §4.1). Offsets are relative to the mount axis.
export function installObjective(state, beamAtMount) {
  const sf = state.parts.sf;
  if (sf.objective) return state;
  const extra = randomVector(createRng(deriveSeed(state.seed, SALT.objective)), O.installOffsetMin, O.installOffsetMax);
  const next = structuredClone(state);
  next.hidden.objectiveOffset = { x: beamAtMount.x + extra.x, y: beamAtMount.y - sf.height + extra.y };
  next.parts.sf.objective = true;
  return next;
}

// The pinhole lands 30–120 µm off the focused spot.
export function installPinhole(state, focusCentre) {
  const sf = state.parts.sf;
  if (sf.pinhole || !sf.objective) return state;
  const extra = randomVector(createRng(deriveSeed(state.seed, SALT.pinhole)), PH.installOffsetMin, PH.installOffsetMax);
  const next = structuredClone(state);
  next.hidden.pinholeOffset = { x: focusCentre.x + extra.x, y: focusCentre.y - sf.height + extra.y };
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
