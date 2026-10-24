// Michelson bench state: parts on the breadboard, knob values and the hidden hand errors (spec §3.3, §4.1).
// Every update returns a new object; a refused update returns the same object.
import { MI } from './config.js';
import { createRng, deriveSeed, uniform, randomSign, SALT } from '../optics/rng.js';

export const PART_IDS = Object.freeze(['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2']);
export const KINDS = Object.freeze({ bs: 'bs', m1: 'mirror', m2: 'mirror', screen: 'screen', lens1: 'lens', lens2: 'lens' });
const START_HEADING = Object.freeze({ bs: 3, m1: 4, m2: 4, screen: 4, lens1: 0, lens2: 0 });
const T = MI.table;

// Heading h (45° steps) as a unit vector in the table plane: 0 = +z, 2 = +x, 4 = −z (toward the laser), 6 = −x.
export function headingVector(heading) {
  const a = (heading * Math.PI) / 4;
  return { x: Math.sin(a), y: 0, z: Math.cos(a) };
}

export function createMichelsonState(seed) {
  const rng = createRng(deriveSeed(seed, SALT.michelson));
  const draw = ([lo, hi]) => (randomSign(rng) * uniform(rng, lo, hi) * Math.PI) / 180;
  const E = MI.errors;
  const part = (id, extra = {}) => ({ placed: false, pos: { x: 0, z: 0 }, heading: START_HEADING[id], ...extra });
  return {
    seed,
    laser: { on: false },
    iris: { opening: MI.iris.openingInitial },
    parts: {
      bs: part('bs', { rotation: 0, tilt: 0 }),
      m1: part('m1', { h: 0, v: 0, stage: MI.stage.initial }),
      m2: part('m2', { h: 0, v: 0 }),
      screen: part('screen'),
      lens1: part('lens1'),
      lens2: part('lens2'),
    },
    hidden: {
      bsHeading: draw(E.bsHeading),
      bsTilt: draw(E.bsTilt),
      m1H: draw(E.mirrorTilt),
      m1V: draw(E.mirrorTilt),
      m2H: draw(E.mirrorTilt),
      m2V: draw(E.mirrorTilt),
    },
  };
}

const { bs: B, mirror: M, stage: S, iris: I } = MI;
const RANGES = {
  'iris.opening': [I.openingMin, I.openingMax],
  'parts.bs.rotation': [-B.rotationRange, B.rotationRange],
  'parts.bs.tilt': [-B.tiltRange, B.tiltRange],
  'parts.m1.h': [-M.tiltRange, M.tiltRange],
  'parts.m1.v': [-M.tiltRange, M.tiltRange],
  'parts.m1.stage': [0, S.travel],
  'parts.m2.h': [-M.tiltRange, M.tiltRange],
  'parts.m2.v': [-M.tiltRange, M.tiltRange],
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
  keys.reduce((obj, key) => obj[key], next)[last] = Math.min(range[1], Math.max(range[0], value));
  return next;
}

export function setLaserOn(state, on) {
  const next = structuredClone(state);
  next.laser.on = Boolean(on);
  return next;
}

const tidy = (v) => Math.round(v * 1e6) / 1e6;   // keep hole positions exact to the micrometre
const toHole = (value, origin) => tidy(origin + Math.round((value - origin) / T.pitch) * T.pitch);

// Where a part can actually stand near `pos`: a hole; a lens on a hole row, sliding along it in 1 mm steps.
export function snapPosition(id, heading, pos) {
  const x = toHole(pos.x, T.holeX0);
  const z = toHole(pos.z, T.holeZ0);
  if (KINDS[id] !== 'lens' || heading % 2 === 1) return { x, z };
  const mm = (value) => tidy(Math.round(value / MI.lens.slide) * MI.lens.slide);
  return heading % 4 === 0 ? { x, z: mm(pos.z) } : { x: mm(pos.x), z };
}

function footprint(id, pos, heading) {
  const [along, across] = MI.footprints[id];
  const u = headingVector(heading);
  return { c: pos, u: { x: u.x, z: u.z }, w: { x: u.z, z: -u.x }, hu: along / 2, hw: across / 2 };
}

const dot2 = (a, b) => a.x * b.x + a.z * b.z;

// Rectangles at least `gap` apart along one of their axes (separating-axis test).
function separated(a, b, gap) {
  const d = { x: b.c.x - a.c.x, z: b.c.z - a.c.z };
  return [a.u, a.w, b.u, b.w].some((axis) => {
    const ra = a.hu * Math.abs(dot2(a.u, axis)) + a.hw * Math.abs(dot2(a.w, axis));
    const rb = b.hu * Math.abs(dot2(b.u, axis)) + b.hw * Math.abs(dot2(b.w, axis));
    return Math.abs(dot2(d, axis)) >= ra + rb + gap - 1e-9;
  });
}

function onTable(fp) {
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].every(([su, sw]) => {
    const x = fp.c.x + su * fp.hu * fp.u.x + sw * fp.hw * fp.w.x;
    const z = fp.c.z + su * fp.hu * fp.u.z + sw * fp.hw * fp.w.z;
    return x >= T.xMin - 1e-9 && x <= T.xMax + 1e-9 && z >= T.zMin - 1e-9 && z <= T.zMax + 1e-9;
  });
}

const SOURCE_STRIP = {
  c: { x: 0, z: (T.zMin + MI.source.keepOutZ) / 2 }, u: { x: 0, z: 1 }, w: { x: 1, z: 0 },
  hu: (MI.source.keepOutZ - T.zMin) / 2, hw: MI.source.keepOutHalfWidth,
};

export function canStand(state, id, pos, heading) {
  const fp = footprint(id, pos, heading);
  if (!onTable(fp) || !separated(fp, SOURCE_STRIP, 0)) return false;
  return PART_IDS.every((other) => other === id || !state.parts[other].placed
    || separated(fp, footprint(other, state.parts[other].pos, state.parts[other].heading), MI.minGap));
}

export function placePart(state, id, pos, heading = state.parts[id].heading) {
  if (!PART_IDS.includes(id)) throw new Error(`unknown part: ${id}`);
  const target = snapPosition(id, heading, pos);
  if (!canStand(state, id, target, heading)) return state;
  const next = structuredClone(state);
  Object.assign(next.parts[id], { placed: true, pos: target, heading });
  return next;
}

// Hole offsets up to 40 holes away, nearest first.
const OFFSETS = [];
for (let di = -40; di <= 40; di++) {
  for (let dj = -40; dj <= 40; dj++) OFFSETS.push([di, dj]);
}
OFFSETS.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));

// The free spot nearest to `wanted` (the panel's Place button).
export function placeNear(state, id, wanted, heading = state.parts[id].heading) {
  for (const [di, dj] of OFFSETS) {
    const next = placePart(state, id, { x: wanted.x + dj * T.pitch, z: wanted.z + di * T.pitch }, heading);
    if (next !== state) return next;
  }
  return state;
}

export function turnPart(state, id, steps) {
  const part = state.parts[id];
  const heading = (((part.heading + steps) % 8) + 8) % 8;
  if (part.placed) return placePart(state, id, part.pos, heading);
  const next = structuredClone(state);
  next.parts[id].heading = heading;
  return next;
}

export function movePartBy(state, id, dz, dx) {
  const part = state.parts[id];
  return part.placed ? placePart(state, id, { x: part.pos.x + dx, z: part.pos.z + dz }) : state;
}

export function removePart(state, id) {
  const next = structuredClone(state);
  next.parts[id].placed = false;
  return next;
}

export function atStageEdge(state) {
  const { stage } = state.parts.m1;
  return stage <= 1e-12 || stage >= MI.stage.travel - 1e-12;
}
