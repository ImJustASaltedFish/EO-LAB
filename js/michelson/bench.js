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
const BOUNDS = { xMin: T.xMin, xMax: T.xMax, zMin: T.zMin, zMax: T.zMax };
const ORIGIN = { x: 0, y: MI.beamHeight, z: MI.source.irisZ };
// Light coming back lands on the iris and the source face around it (60 mm), where students see the reflected spots.
const IRIS = { id: 'iris', kind: 'stop', position: ORIGIN, normal: { x: 0, y: 0, z: 1 }, shape: 'square', aperture: MI.source.stopHalf, mount: MI.source.stopHalf };
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
  const aperture = state.iris.opening / 2;
  const source = { waist: MI.source.waistRadius, aperture };
  const irisT = gaussianThroughHole(MI.source.waistRadius, 0, aperture);
  const elements = [IRIS, ...PART_IDS.filter((id) => state.parts[id].placed).map((id) => elementOf(poseOf(state, id)))];
  const rays = trace({ origin: ORIGIN, direction: { x: 0, y: 0, z: 1 }, power: 1, from: 'iris' }, elements,
    { maxInteractions: MI.trace.maxInteractions, minPower: MI.trace.minPower, bounds: BOUNDS });
  const drawn = (A) => Math.max(Math.abs(A) * Math.min(aperture, MI.source.waistRadius), MI.trace.minSpot);

  result.rays = rays;
  result.irisT = irisT;
  result.segments = rays.map((r) => ({
    z0: r.start.z, x0: r.start.x, y0: r.start.y, z1: r.end.z, x1: r.end.x, y1: r.end.y,
    r0: drawn(r.matrix0.A), r1: drawn(r.matrix1.A), power: r.power,
  }));
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
