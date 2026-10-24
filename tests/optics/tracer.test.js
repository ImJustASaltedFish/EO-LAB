import { test, assert, assertEqual, assertClose } from '../harness.js';
import { trace, reflect, surfaceAxes, rayMatrix, normalize } from '../../js/optics/tracer.js';

const along = { x: 0, y: 0, z: 1 };
const source = (extra = {}) => ({ origin: { x: 0, y: 0.1, z: 0 }, direction: along, power: 1, ...extra });
const mirror = (id, z, normal) => ({ id, kind: 'mirror', position: { x: 0, y: 0.1, z }, normal, shape: 'disc', aperture: 0.0127, mount: 0.02 });
const BOUNDS = { xMin: -0.5, xMax: 0.5, zMin: -0.5, zMax: 1 };

test('tracer: a mirror tilted by ε turns the ray by 2ε', () => {
  const eps = 3e-3;
  const rays = trace(source(), [mirror('m', 0.5, { x: Math.sin(eps), y: 0, z: -Math.cos(eps) })], { bounds: BOUNDS });
  const back = rays[1].direction;
  assertClose(Math.atan2(back.x, -back.z), 2 * eps, 1e-9);
  assertEqual(rays[0].stop.kind, 'mirror');
  assertEqual(rays[1].path.join(), 'm');
});

test('tracer: a beam splitter at 45° reflects at 90° and transmits straight, half the power each', () => {
  const n = normalize({ x: 1, y: 0, z: -1 });
  const splitter = { id: 'bs', kind: 'splitter', position: { x: 0, y: 0.1, z: 0.3 }, normal: n, shape: 'disc', aperture: 0.0127, mount: 0.02, R: 0.5, T: 0.5 };
  const rays = trace(source(), [splitter], { bounds: BOUNDS });
  const reflected = rays.find((r) => r.path.join() === 'bs:R');
  const transmitted = rays.find((r) => r.path.join() === 'bs:T');
  assertClose(reflected.direction.x, 1, 1e-12);
  assertClose(transmitted.direction.z, 1, 1e-12);
  assertClose(reflected.power, 0.5, 1e-12);
  assertClose(transmitted.power, 0.5, 1e-12);
  assertClose(rays[0].stop.local.u, 0, 1e-12, 'hit at the centre');
  assertClose(reflect(along, n).x, 1, 1e-12);
});

test('tracer: thin lens deflects by −(p − c)/f; a lens at f + δ from a mirror gives A = −1 − 2δ/f, C = 2δ/f²', () => {
  const f = 0.1;
  const lens = (z) => ({ id: 'L', kind: 'lens', position: { x: 0, y: 0.1, z }, normal: { x: 0, y: 0, z: 1 }, shape: 'disc', aperture: 0.024, mount: 0.03, focalLength: f });
  const offset = trace(source({ origin: { x: 0.002, y: 0.1, z: 0 } }), [lens(0.2)], { bounds: BOUNDS });
  const d = offset[1].direction;
  assertClose(d.x / d.z, -0.002 / f, 1e-12, 'slope −h/f');
  const delta = 1e-3;
  const rays = trace(source(), [lens(1e-6), mirror('m', 1e-6 + f + delta, { x: 0, y: 0, z: -1 })], { bounds: BOUNDS });
  const out = rays.find((r) => r.path.join() === 'L,m,L');
  assertClose(out.matrix0.A, -1 - (2 * delta) / f, 1e-5);
  assertClose(out.matrix0.C, (2 * delta) / (f * f), 1e-4);
  const m = rayMatrix.lens(rayMatrix.free(rayMatrix.lens(rayMatrix.identity, f), 2 * (f + delta)), f);
  assertClose(m.A, -1 - (2 * delta) / f, 1e-12);
  assertClose(m.C, (2 * delta) / (f * f), 1e-12);
});

test('tracer: rays stop on screens, stops, mounts and the table edge, and after the interaction limit', () => {
  const screen = { id: 'screen', kind: 'screen', position: { x: 0, y: 0.1, z: 0.6 }, normal: { x: 0, y: 0, z: -1 }, shape: 'square', aperture: 0.075, mount: 0.078 };
  const hitScreen = trace(source({ origin: { x: 0.01, y: 0.12, z: 0 } }), [screen], { bounds: BOUNDS });
  assertEqual(hitScreen[0].stop.kind, 'screen');
  assertClose(hitScreen[0].stop.local.u, 0.01, 1e-12, 'card u is +x for a card facing the laser');
  assertClose(hitScreen[0].stop.local.v, 0.02, 1e-12);
  const onMount = trace(source({ origin: { x: 0.015, y: 0.1, z: 0 } }), [mirror('m', 0.5, { x: 0, y: 0, z: -1 })], { bounds: BOUNDS });
  assertEqual(onMount[0].stop.kind, 'mount', 'outside the mirror but on its mount');
  const missed = trace(source(), [], { bounds: BOUNDS });
  assertEqual(missed[0].stop.kind, 'edge');
  assertClose(missed[0].end.z, 1, 1e-12);
  const pair = [mirror('a', 0.2, { x: 0, y: 0, z: 1 }), mirror('b', 0.5, { x: 0, y: 0, z: -1 })];
  const bounced = trace(source({ origin: { x: 0, y: 0.1, z: 0.3 } }), pair, { bounds: BOUNDS, maxInteractions: 3 });
  assertEqual(bounced.at(-1).stop.kind, 'limit');
  assert(bounced.length === 4, `three reflections, then the limit: ${bounced.length}`);
});

test('tracer: a part whose mount is no larger than its aperture lets rays outside it pass by', () => {
  const lens = { id: 'L', kind: 'lens', position: { x: 0, y: 0.1, z: 0.2 }, normal: { x: 0, y: 0, z: 1 }, shape: 'disc', aperture: 0.011, mount: 0.011, focalLength: 0.2 };
  const screen = { id: 'screen', kind: 'screen', position: { x: 0, y: 0.1, z: 0.6 }, normal: { x: 0, y: 0, z: -1 }, shape: 'square', aperture: 0.075, mount: 0.078 };
  const beside = trace(source({ origin: { x: 0.0105, y: 0.1105, z: 0 } }), [lens, screen], { bounds: BOUNDS });
  assertEqual(beside[0].stop.kind, 'screen', 'outside the round lens, inside its square: passes by');
  const through = trace(source({ origin: { x: 0.005, y: 0.1, z: 0 } }), [lens, screen], { bounds: BOUNDS });
  assertEqual(through[0].stop.kind, 'lens');
});

test('tracer: surface axes are right-handed with v up', () => {
  const { u, v } = surfaceAxes({ x: 0, y: 0, z: -1 });
  assertClose(u.x, 1, 1e-12);
  assertClose(v.y, 1, 1e-12);
  const back = surfaceAxes({ x: 0, y: 0, z: 1 });
  assertClose(back.u.x, -1, 1e-12, 'seen from the other side, +x is on the left');
});
