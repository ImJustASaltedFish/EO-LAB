// bench(state): trace the laser beam through everything on the rail and return all observables (spec §4).
// Pure: no DOM, no three.js. Transverse positions are rail-frame metres (x right, y up); z runs along the rail.
import { CONFIG } from './config.js';
import { propagateRay, thinLensRay } from './ray.js';
import { qAtWaist, propagateQ, thinLensQ, beamRadius, distanceToWaist } from './gaussian.js';
import { gaussianThroughHole } from './iris.js';
import { createNoise } from './noise.js';
import { computePinhole, sampleFarField, maskedFraction } from './pinhole.js';
import { rawBeamSampler, angularSampler, expandedPattern, gaussianSpotSampler, renderScreen, screenWindow } from './screen.js';

const LAMBDA = CONFIG.wavelength;
const F0 = CONFIG.objective.focalLength;
const hyp = (v) => Math.hypot(v.x, v.y);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

export function laserAngles(state) {
  return { x: state.hidden.yaw0 + state.laser.yaw, y: state.hidden.pitch0 + state.laser.pitch };
}

export function objectiveAxis(state) {
  const sf = state.parts.sf;
  const off = state.hidden.objectiveOffset ?? { x: 0, y: 0 };
  return { x: off.x + sf.objX, y: sf.height + off.y + sf.objY };
}

export function pinholeCentre(state) {
  const sf = state.parts.sf;
  const off = state.hidden.pinholeOffset ?? { x: 0, y: 0 };
  return { x: off.x + sf.phX, y: sf.height + off.y + sf.phY };
}

export function defocus(state) {
  return state.parts.sf.focus - CONFIG.objective.focusAt;
}

export function objectivePlaneZ(state, focus = state.parts.sf.focus) {
  return state.parts.sf.z - (F0 + focus - CONFIG.objective.focusAt);
}

export function ringPlaneZ(state) {
  return state.parts.sf.z - CONFIG.mount.ringOffset;
}

let noiseCache = { seed: null, noise: null };
function noiseFor(seed) {
  if (noiseCache.seed !== seed) noiseCache = { seed, noise: createNoise(seed) };
  return noiseCache.noise;
}

let pinholeCache = { key: null, value: null };
function pinholeFor(params, seed) {
  const key = `${seed}|${[
    params.beamRadius, params.offset.x, params.offset.y, params.angle.x, params.angle.y, params.defocus,
    params.objectiveAxis.x, params.objectiveAxis.y, params.pinholeCentre.x, params.pinholeCentre.y,
  ].map((v) => Math.round(v * 1e10)).join(',')}`;
  if (pinholeCache.key !== key) pinholeCache = { key, value: computePinhole(params) };
  return pinholeCache.value;
}

function buildElements(state) {
  const { parts } = state;
  const list = [];
  for (const id of ['a1', 'a2']) {
    const p = parts[id];
    if (p.onRail) list.push({ kind: 'hole', id, z: p.z, centre: { x: 0, y: p.height }, r: p.opening / 2 });
  }
  if (parts.sf.onRail) {
    list.push({ kind: 'hole', id: 'ring', z: ringPlaneZ(state), centre: { x: 0, y: parts.sf.height }, r: CONFIG.mount.ringRadius });
    if (parts.sf.objective) list.push({ kind: 'objective', id: 'objective', z: objectivePlaneZ(state), axis: objectiveAxis(state) });
    if (parts.sf.pinhole) list.push({ kind: 'pinhole', id: 'pinhole', z: parts.sf.z, centre: pinholeCentre(state) });
  }
  if (parts.lens.onRail) {
    list.push({
      kind: 'lens', id: 'lens', z: parts.lens.z, axis: { x: 0, y: parts.lens.height },
      f: CONFIG.lens.focalLength, r: CONFIG.lens.clearAperture / 2,
    });
  }
  if (parts.screen.onRail) list.push({ kind: 'screen', id: 'screen', z: parts.screen.z });
  list.push({ kind: 'block', id: 'block', z: CONFIG.rail.beamBlockZ });
  return list.sort((a, b) => a.z - b.z);
}

// Affine map from a beam direction θ to a transverse position at plane z: x = A(z)·θ + B(z).
function mapAt(map, z) {
  return {
    A: map.A0 + map.A1 * (z - map.z0),
    B: { x: map.B0.x + map.B1.x * (z - map.z0), y: map.B0.y + map.B1.y * (z - map.z0) },
  };
}

function lensMap(map, z, f, axis) {
  const { A, B } = mapAt(map, z);
  return {
    z0: z,
    A0: A,
    A1: map.A1 - A / f,
    B0: B,
    B1: { x: map.B1.x - (B.x - axis.x) / f, y: map.B1.y - (B.y - axis.y) / f },
  };
}

function emptyResult(state) {
  return {
    laserOn: Boolean(state.laser.on),
    beamAngles: laserAngles(state),
    focusDz: defocus(state),
    at: {},
    irisFaces: {},
    segments: [],
    spots: [],
    stoppedAt: null,
    powerAtScreen: 0,
    pinhole: null,
    planeA: null,
    screen: null,
    divergence: null,
  };
}

export function bench(state, { render = true } = {}) {
  const result = emptyResult(state);
  if (!state.laser.on) return result;
  const noise = noiseFor(state.seed);
  const angles = result.beamAngles;
  // Beam modes: 'raw' (laser beam), 'expanded' (after the objective), 'filtered' (after the pinhole).
  const beam = {
    mode: 'raw',
    z: 0,
    ray: { x: 0, y: state.hidden.laserHeight, tx: angles.x, ty: angles.y },
    q: qAtWaist(CONFIG.laser.waistRadius, LAMBDA),
    clips: [],
    clipRatio: Infinity,
    map: null,
    direction: null,
    pattern: null,
    angularRadius: 0,
    masks: [],
    clipAngle: Infinity,
    farField: null,
    fraction: 1,
    objective: null,
  };
  let power = 1;

  const envelopeAt = (z) => beamRadius(propagateQ(beam.q, z - beam.z), LAMBDA);
  const centreAt = (z) => {
    if (beam.mode === 'raw') {
      const r = propagateRay(beam.ray, z - beam.z);
      return { x: r.x, y: r.y };
    }
    const { A, B } = mapAt(beam.map, z);
    return { x: A * beam.direction.x + B.x, y: A * beam.direction.y + B.y };
  };
  const drawnRadiusAt = (z) => {
    const w = envelopeAt(z);
    if (beam.mode === 'raw') return w * Math.min(1, beam.clipRatio);
    if (beam.clipAngle === Infinity) return w;
    return Math.min(w, Math.abs(mapAt(beam.map, z).A) * beam.clipAngle);
  };
  const moveTo = (z) => {
    if (z > beam.z) {
      const cuts = [beam.z];
      const waist = beam.z + distanceToWaist(beam.q);
      if (waist > beam.z + 1e-6 && waist < z - 1e-6) cuts.push(waist);
      cuts.push(z);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = centreAt(cuts[i]);
        const b = centreAt(cuts[i + 1]);
        result.segments.push({
          z0: cuts[i], x0: a.x, y0: a.y, z1: cuts[i + 1], x1: b.x, y1: b.y,
          r0: drawnRadiusAt(cuts[i]), r1: drawnRadiusAt(cuts[i + 1]), power,
        });
      }
    }
    if (beam.mode === 'raw') beam.ray = propagateRay(beam.ray, z - beam.z);
    beam.q = propagateQ(beam.q, z - beam.z);
    beam.z = z;
  };
  // A circular hole (iris, mount ring, lens aperture) at the current plane: transmission, and remember the clip.
  const passHole = (centre, r) => {
    const at = centreAt(beam.z);
    const w = envelopeAt(beam.z);
    let T;
    if (beam.mode === 'raw') {
      T = gaussianThroughHole(w, hyp(sub(at, centre)), r);
      beam.clips.push({ centre: at, radius: w, hole: centre, r });
      beam.clipRatio = Math.min(beam.clipRatio, r / w);
    } else {
      const { A, B } = mapAt(beam.map, beam.z);
      const inside = (tx, ty) => {
        const px = A * tx + B.x - centre.x;
        const py = A * ty + B.y - centre.y;
        return px * px + py * py <= r * r;
      };
      if (beam.mode === 'expanded') {
        T = gaussianThroughHole(Math.abs(A) * beam.angularRadius, hyp(sub(at, centre)), r);
      } else {
        const masks = beam.masks;
        const kept = maskedFraction(beam.farField, (tx, ty) => inside(tx, ty) && masks.every((m) => m(tx, ty)));
        T = beam.fraction > 0 ? kept / beam.fraction : 0;
        beam.fraction = kept;
      }
      beam.masks = [...beam.masks, inside];
      beam.clipAngle = Math.min(beam.clipAngle, r / Math.max(Math.abs(A), 1e-9));
    }
    return { at, w, T };
  };
  const renderScreenAt = (z, centre) => {
    let sample;
    let expected;
    if (beam.mode === 'raw') {
      const w = envelopeAt(z);
      sample = rawBeamSampler({ centre, radius: w, noise, clips: beam.clips });
      expected = 2 * w;
    } else {
      const { A, B } = mapAt(beam.map, z);
      const wq = envelopeAt(z);
      if (Math.abs(A) * beam.angularRadius < 0.5 * wq) {
        sample = gaussianSpotSampler({ centre, radius: wq });   // near a focus: diffraction-limited spot
        expected = 2 * wq;
      } else {
        sample = angularSampler({ pattern: beam.pattern, A, B, masks: beam.masks });
        expected = 2 * Math.abs(A) * Math.min(beam.angularRadius, beam.clipAngle);
      }
    }
    const window = renderScreen({ sample, centre, size: screenWindow(expected) });
    const card = renderScreen({
      sample,
      centre: { x: 0, y: CONFIG.screen.centreHeight },
      size: CONFIG.screen.size,
      pixels: CONFIG.screen.cardPixels,
    });
    return { window, card, d4sigma: window.d4sigma, centre };
  };

  for (const el of buildElements(state)) {
    moveTo(el.z);
    if (el.kind === 'hole') {
      const { at, w, T } = passHole(el.centre, el.r);
      const offset = sub(at, el.centre);
      result.at[el.id] = { x: at.x, y: at.y, offset, w, T };
      const faceRadius = beam.mode === 'filtered' ? Math.abs(mapAt(beam.map, el.z).A) * beam.angularRadius : w;
      result.irisFaces[el.id] = { dx: offset.x, dy: offset.y, radius: faceRadius, r: el.r };
      if (T < 0.95) result.spots.push({ z: el.z, x: at.x, y: at.y, radius: faceRadius, power: power * (1 - T) });
      power *= T;
      if (T < CONFIG.stopThreshold) {
        result.stoppedAt = el.id;
        break;
      }
    } else if (el.kind === 'objective') {
      const at = centreAt(el.z);
      const W = envelopeAt(el.z);
      const u = sub(at, el.axis);
      const alpha = { x: beam.ray.tx, y: beam.ray.ty };
      const focusCentre = { x: el.axis.x + F0 * alpha.x, y: el.axis.y + F0 * alpha.y };
      const direction = { x: alpha.x - u.x / F0, y: alpha.y - u.y / F0 };
      result.at.objective = { x: at.x, y: at.y, z: el.z, u, W, alpha, focusCentre };
      beam.mode = 'expanded';
      beam.q = thinLensQ(beam.q, F0);
      beam.map = { z0: el.z + F0, A0: 0, A1: 1, B0: focusCentre, B1: { x: 0, y: 0 } };
      beam.direction = direction;
      beam.angularRadius = W / F0;
      beam.pattern = expandedPattern({ direction, angularRadius: W / F0, focalLength: F0, noise });
      beam.masks = [];
      beam.clipAngle = Infinity;
      beam.objective = { W, u, alpha, axis: el.axis };
    } else if (el.kind === 'pinhole') {
      if (beam.mode !== 'expanded') continue;
      const o = beam.objective;
      const pin = pinholeFor({
        wavelength: LAMBDA, focalLength: F0, beamRadius: o.W, offset: o.u, angle: o.alpha,
        defocus: defocus(state), objectiveAxis: o.axis, pinholeCentre: el.centre,
        pinholeRadius: CONFIG.pinhole.radius, noise: noise.components,
      }, state.seed);
      result.pinhole = pin;
      result.at.pinhole = { x: el.centre.x, y: el.centre.y, T: pin.transmission };
      power *= pin.transmission;
      if (pin.transmission < CONFIG.pinholeStopThreshold) {
        result.stoppedAt = 'pinhole';
        break;
      }
      beam.mode = 'filtered';
      beam.farField = pin.farField;
      beam.fraction = 1;
      beam.map = { z0: el.z, A0: 0, A1: 1, B0: { x: el.centre.x, y: el.centre.y }, B1: { x: 0, y: 0 } };
      beam.direction = pin.centroid;
      beam.angularRadius = pin.thetaE;
      beam.pattern = (tx, ty) => sampleFarField(pin.farField, tx, ty);
      beam.masks = [];
      beam.clipAngle = Infinity;
      beam.q = qAtWaist(LAMBDA / (Math.PI * Math.max(pin.thetaE, 1e-6)), LAMBDA);
    } else if (el.kind === 'lens') {
      const filtered = beam.mode === 'filtered';
      const thetaEdge = filtered ? Math.min(beam.angularRadius, beam.clipAngle) : 0;
      const wLens = envelopeAt(el.z);
      const extent = beam.mode === 'raw'
        ? 3 * wLens
        : Math.min(3 * wLens, 2 * Math.abs(mapAt(beam.map, el.z).A) * beam.clipAngle);
      const { at, T } = passHole(el.axis, el.r);
      result.at.lens = { x: at.x, y: at.y, offset: sub(at, el.axis), w: wLens, T, extent };
      power *= T;
      if (T < CONFIG.stopThreshold) {
        result.stoppedAt = 'lens';
        break;
      }
      if (beam.mode === 'raw') beam.ray = thinLensRay(beam.ray, el.f, el.axis);
      else beam.map = lensMap(beam.map, el.z, el.f, el.axis);
      beam.q = thinLensQ(beam.q, el.f);
      if (filtered) {
        const L = el.z - state.parts.sf.z;
        const tol = CONFIG.checks.s4.collimationTol;
        result.divergence = {
          L,
          theta: thetaEdge * (1 - L / el.f),
          state: Math.abs(L - el.f) <= tol ? 'collimated' : L < el.f ? 'diverging' : 'converging',
        };
      }
    } else if (el.kind === 'screen') {
      const at = centreAt(el.z);
      result.at.screen = { x: at.x, y: at.y };
      result.powerAtScreen = power;
      result.stoppedAt = 'screen';
      if (render) result.screen = renderScreenAt(el.z, at);
      break;
    } else {
      const at = centreAt(el.z);
      result.stoppedAt = 'block';
      result.spots.push({ z: el.z, x: at.x, y: at.y, radius: drawnRadiusAt(el.z), power });
      break;
    }
  }

  // Plane A: back-reflections from the objective onto the back face of Aperture 1 (spec §4.8).
  const o = result.at.objective;
  const a1 = state.parts.a1;
  if (o && a1.onRail && a1.z < o.z && result.at.a1) {
    const dA = o.z - a1.z;
    result.planeA = {
      holeRadius: a1.opening / 2,
      rings: CONFIG.objective.surfaceRadii.map((R) => ({
        x: o.x + dA * (o.alpha.x + (2 * o.u.x) / R),
        y: o.y + dA * (o.alpha.y + (2 * o.u.y) / R) - a1.height,
        radius: o.W * (1 + (2 * dA) / R),
      })),
    };
  }
  return result;
}

// Step 2b check helper: plane-A ring offset and expanded-beam offset at Aperture 2 with the objective at `focus`.
const probeCache = new WeakMap();
export function objectiveAlignmentAt(state, focus) {
  let byFocus = probeCache.get(state);
  if (!byFocus) {
    byFocus = new Map();
    probeCache.set(state, byFocus);
  }
  if (byFocus.has(focus)) return byFocus.get(focus);
  const trial = structuredClone(state);
  trial.parts.sf.focus = focus;
  trial.parts.sf.pinhole = false;
  const r = bench(trial, { render: false });
  const planeA = r.planeA ? Math.max(...r.planeA.rings.map((g) => Math.hypot(g.x, g.y))) : Infinity;
  const a2 = r.at.a2 && state.parts.a2.z > objectivePlaneZ(trial)
    ? Math.hypot(r.at.a2.offset.x, r.at.a2.offset.y)
    : Infinity;
  const value = { planeA, a2 };
  byFocus.set(focus, value);
  return value;
}
