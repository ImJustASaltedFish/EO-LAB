// michelsonBench(state): trace the beam through the Michelson parts and return everything observable (spec §4).
// Pure: no DOM, no three.js. Positions are table-frame metres: x across, y up, z along the source beam.
import { MI } from './config.js';
import { CONFIG } from '../optics/config.js';
import { gaussianThroughHole } from '../optics/iris.js';
import { renderScreen, screenWindow } from '../optics/screen.js';
import { trace, sub, scale, dot, surfaceAxes } from '../optics/tracer.js';
import { interferenceSampler, fringeNumbers, profile } from '../optics/interference.js';
import { PART_IDS, KINDS, headingVector } from './state.js';

const T = MI.table;
const SRC = MI.source;
const BOUNDS = { xMin: T.xMin, xMax: T.xMax, zMin: T.zMin, zMax: T.zMax };
const ALONG = { x: 0, y: 0, z: 1 };
const onAxis = (z) => ({ x: 0, y: MI.beamHeight, z });
// Experiment 1's collimating lens. Light coming back through it converges toward the pinhole; light coming back
// beside it carries on (the model gives it no mount).
const LENS_RADIUS = CONFIG.lens.clearAperture / 2;
const SOURCE_LENS = {
  id: 'sourceLens', kind: 'lens', position: onAxis(SRC.lensZ), normal: ALONG, shape: 'disc',
  aperture: LENS_RADIUS, mount: LENS_RADIUS, focalLength: CONFIG.lens.focalLength,
};
// Light coming back lands on Aperture 1 and the source face around it (60 mm), where students see the reflected spots.
const IRIS = { id: 'iris', kind: 'stop', position: onAxis(SRC.a1Z), normal: ALONG, shape: 'square', aperture: SRC.stopHalf, mount: SRC.stopHalf };
// The cone from the pinhole is this many times wider on the lens than on Aperture 1 (2: Aperture 1 sits halfway).
const SPREAD = (SRC.lensZ - SRC.pinholeZ) / (SRC.a1Z - SRC.pinholeZ);
// Screen images use card coordinates: u across the card, and height above the table (the card centre is at beam height).
const CARD_CENTRE = { x: 0, y: MI.beamHeight };

// The direction a part faces: its heading, turned by `yaw` about the vertical and tipped up by `pitch`.
export function facing(heading, yaw, pitch) {
  const a = (heading * Math.PI) / 4 + yaw;
  return { x: Math.cos(pitch) * Math.sin(a), y: Math.sin(pitch), z: Math.cos(pitch) * Math.cos(a) };
}

export function poseOf(state, id) {
  const part = state.parts[id];
  const { hidden } = state;
  let yaw = 0;
  let pitch = 0;
  if (id === 'bs') {
    yaw = hidden.bsHeading + part.rotation;
    pitch = hidden.bsTilt + part.tilt;
  } else if (KINDS[id] === 'mirror') {
    yaw = hidden[`${id}H`] + part.h;
    pitch = hidden[`${id}V`] + part.v;
  }
  let position = { x: part.pos.x, y: MI.beamHeight, z: part.pos.z };
  // M1's stage moves the mirror along its heading; larger readings move it back, away from the face.
  if (id === 'm1') position = sub(position, scale(headingVector(part.heading), part.stage - MI.stage.initial));
  return { id, kind: KINDS[id], position, normal: facing(part.heading, yaw, pitch), yaw, pitch };
}

function elementOf(pose) {
  const base = { id: pose.id, position: pose.position, normal: pose.normal, shape: 'disc' };
  if (pose.kind === 'bs') return { ...base, kind: 'splitter', aperture: MI.bs.radius, mount: MI.bs.mountHalf, R: MI.bs.R, T: MI.bs.T };
  if (pose.kind === 'mirror') return { ...base, kind: 'mirror', aperture: MI.mirror.radius, mount: MI.mirror.mountHalf };
  if (pose.kind === 'lens') return { ...base, kind: 'lens', aperture: MI.lens.radius, mount: MI.lens.mountHalf, focalLength: MI.lens.focalLength };
  return { ...base, kind: 'screen', shape: 'square', aperture: MI.screen.size / 2, mount: MI.screen.size / 2 + 0.003 };
}

// Horizontal distance from the beam splitter's centre to a part (M1 with its stage); null unless both are placed.
export function distanceToBs(state, id) {
  if (!state.parts.bs.placed || !state.parts[id].placed) return null;
  const a = poseOf(state, 'bs').position;
  const b = poseOf(state, id).position;
  return Math.hypot(b.x - a.x, b.z - a.z);
}

// The source as Experiment 1 leaves it, drawn (not traced): the laser beam into the objective, its focus on the
// pinhole, the cone opening to Aperture 1, and the part of it Aperture 1 lets through, opening to the lens.
function sourceSegments(opening) {
  const piece = (z0, z1, r0, r1) => ({ z0, x0: 0, y0: MI.beamHeight, z1, x1: 0, y1: MI.beamHeight, r0, r1, power: 1 });
  const objectiveZ = SRC.pinholeZ - CONFIG.objective.focalLength;
  const onA1 = SRC.waistRadius / SPREAD;
  const through = Math.min(onA1, opening / 2);
  return [
    piece(SRC.laserZ, objectiveZ, CONFIG.laser.waistRadius, CONFIG.laser.waistRadius),
    piece(objectiveZ, SRC.pinholeZ, CONFIG.laser.waistRadius, MI.trace.minSpot),
    piece(SRC.pinholeZ, SRC.a1Z, MI.trace.minSpot, onA1),
    piece(SRC.a1Z, SRC.lensZ, through, SPREAD * through),
  ];
}

const mirrorOf = (path) => path.find((tag) => KINDS[tag] === 'mirror') ?? null;
const offsetOf = (stop) => Math.hypot(stop.local.u, stop.local.v);

// Follow one arm out of the beam splitter: the lenses it passes and the mirror it meets, with distances along it.
function armOf(rays, side) {
  let ray = rays.find((r) => r.path.length === 1 && r.path[0] === `bs:${side}`);
  const lenses = [];
  let distance = 0;
  while (ray) {
    distance += ray.opl1 - ray.opl0;
    const { stop } = ray;
    if (stop.kind === 'mirror') {
      return { side, mirror: stop.id, offset: offsetOf(stop), length: distance, lenses: lenses.map((l) => ({ ...l, toMirror: distance - l.at })) };
    }
    if (stop.kind !== 'lens') return { side, mirror: null, offset: Infinity, length: distance, lenses: [] };
    lenses.push({ id: stop.id, offset: offsetOf(stop), at: distance });
    const parent = ray.index;
    ray = rays.find((r) => r.parent === parent);
  }
  return null;
}

// Brightness images of the screen: √(I / I_ref), where I_ref is the centre intensity of the beams all in phase.
function renderCard(beams, source, tapPhase) {
  const options = { source, wavelength: MI.wavelength, coherenceLength: MI.coherenceLength, extraPhase: tapPhase };
  const spots = beams.map((b) => profile(b, source));
  const reference = spots.reduce((sum, p) => sum + Math.sqrt(p.peak), 0) ** 2;
  const brightness = (sampler) => (x, y) => Math.sqrt(Math.min(1, sampler(x, y - MI.beamHeight) / reference));
  const centre = {
    x: beams.reduce((sum, b) => sum + b.centre.u, 0) / beams.length,
    y: MI.beamHeight + beams.reduce((sum, b) => sum + b.centre.v, 0) / beams.length,
  };
  const size = screenWindow(2 * Math.max(...spots.map((p) => p.r)));
  const near = interferenceSampler(beams, { ...options, pixel: size / CONFIG.screen.imageSize });
  const whole = interferenceSampler(beams, { ...options, pixel: MI.screen.size / CONFIG.screen.cardPixels });
  return {
    window: renderScreen({ sample: brightness(near), centre, size }),
    card: renderScreen({ sample: brightness(whole), centre: CARD_CENTRE, size: MI.screen.size, pixels: CONFIG.screen.cardPixels }),
  };
}

function emptyResult(state) {
  return {
    laserOn: Boolean(state.laser.on), rays: [], segments: [], spots: [], bsHit: null, reflected: null,
    arms: { T: null, R: null }, iris: { spots: [] }, cardOn: null, screen: null, fringe: null, power: 0, irisT: 0,
  };
}

export function michelsonBench(state, { render = true, tapPhase = 0 } = {}) {
  const result = emptyResult(state);
  if (!state.laser.on) return result;
  // The collimated beam: Aperture 1's hole, seen from the pinhole, spread to the lens and cut by its rim.
  const aperture = Math.min((SPREAD * state.iris.opening) / 2, LENS_RADIUS);
  const source = { waist: SRC.waistRadius, aperture };
  const irisT = gaussianThroughHole(SRC.waistRadius, 0, aperture);
  const placed = PART_IDS.filter((id) => state.parts[id].placed).map((id) => elementOf(poseOf(state, id)));
  const rays = trace({ origin: SOURCE_LENS.position, direction: ALONG, power: 1, from: SOURCE_LENS.id }, [SOURCE_LENS, IRIS, ...placed],
    { maxInteractions: MI.trace.maxInteractions, minPower: MI.trace.minPower, bounds: BOUNDS });
  const drawn = (A) => Math.max(Math.abs(A) * Math.min(aperture, SRC.waistRadius), MI.trace.minSpot);

  result.rays = rays;
  result.irisT = irisT;
  result.segments = [...sourceSegments(state.iris.opening), ...rays.map((r) => ({
    z0: r.start.z, x0: r.start.x, y0: r.start.y, z1: r.end.z, x1: r.end.x, y1: r.end.y,
    r0: drawn(r.matrix0.A), r1: drawn(r.matrix1.A), power: r.power,
  }))];
  result.spots = rays.filter((r) => ['screen', 'stop', 'mount'].includes(r.stop.kind))
    .map((r) => ({ x: r.end.x, y: r.end.y, z: r.end.z, radius: drawn(r.matrix1.A), power: r.power, normal: r.stop.normal }));

  if (rays[0].stop.kind === 'splitter') result.bsHit = { offset: offsetOf(rays[0].stop) };
  const reflected = rays.find((r) => r.path.length === 1 && r.path[0] === 'bs:R');
  result.reflected = reflected ? reflected.direction : null;
  result.arms = { T: armOf(rays, 'T'), R: armOf(rays, 'R') };
  result.iris.spots = rays.filter((r) => r.stop.kind === 'stop' && r.stop.id === 'iris' && mirrorOf(r.path)).map((r) => ({
    mirror: mirrorOf(r.path), label: mirrorOf(r.path) === 'm1' ? '1' : '2',
    dx: r.stop.local.u, dy: r.stop.local.v, radius: drawn(r.matrix1.A), power: r.power,
  }));

  const onScreen = rays.filter((r) => r.stop.kind === 'screen');
  const card = onScreen.find((r) => r.path.length === 1 && r.path[0] === 'bs:R');
  if (card) result.cardOn = { distance: card.opl1 - card.opl0, u: card.stop.local.u, v: card.stop.local.v };
  if (onScreen.length > 0) {
    const beams = onScreen.map((r) => {
      const axes = surfaceAxes(r.stop.normal);
      return {
        mirror: mirrorOf(r.path), centre: r.stop.local, tilt: { u: dot(r.direction, axes.u), v: dot(r.direction, axes.v) },
        opl: r.opl1, A: r.matrix1.A, C: r.matrix1.C, power: r.power * irisT,
      };
    });
    result.power = beams.reduce((sum, b) => sum + b.power, 0);
    const a = beams.find((b) => b.mirror === 'm1');
    const b = beams.find((beam) => beam.mirror === 'm2');
    if (a && b) result.fringe = fringeNumbers(a, b, { source, wavelength: MI.wavelength, coherenceLength: MI.coherenceLength });
    result.screen = { beams, ...(render ? renderCard(beams, source, tapPhase) : {}) };
  }
  return result;
}
