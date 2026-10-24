// Centre-ray tracing through parts standing anywhere on the breadboard (Michelson spec §4.2–4.3). Pure: no DOM.
// Vectors are table-frame metres {x, y, z}: x across the table, y up, z along the source beam.

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const length = (a) => Math.sqrt(dot(a, a));
export const normalize = (a) => scale(a, 1 / length(a));

const UP = { x: 0, y: 1, z: 0 };

export function reflect(direction, normal) {
  return sub(direction, scale(normal, 2 * dot(direction, normal)));
}

// In-plane axes of a surface whose normal points at the viewer: u to the viewer's right (horizontal), v up.
export function surfaceAxes(normal) {
  let u = cross(normal, UP);
  u = length(u) < 1e-9 ? { x: 1, y: 0, z: 0 } : normalize(u);
  return { u, v: normalize(cross(u, normal)) };
}

// Paraxial ray matrices (A B; C D), rotationally symmetric; flat mirrors and the beam splitter are the identity.
export const rayMatrix = Object.freeze({
  identity: Object.freeze({ A: 1, B: 0, C: 0, D: 1 }),
  free: (m, d) => ({ A: m.A + d * m.C, B: m.B + d * m.D, C: m.C, D: m.D }),
  lens: (m, f) => ({ A: m.A, B: m.B, C: m.C - m.A / f, D: m.D - m.B / f }),
});

// The nearest part plane ahead of the ray whose mount face it meets (the part it just left is skipped).
function nearestHit(ray, elements) {
  let best = null;
  for (const el of elements) {
    if (el.id === ray.from) continue;
    const facing = dot(ray.direction, el.normal);
    if (Math.abs(facing) < 1e-12) continue;
    const t = dot(sub(el.position, ray.origin), el.normal) / facing;
    if (!(t > 1e-9) || (best && t >= best.t)) continue;
    const local = sub(add(ray.origin, scale(ray.direction, t)), el.position);
    const axes = surfaceAxes(el.normal);
    const u = dot(local, axes.u);
    const v = dot(local, axes.v);
    if (Math.max(Math.abs(u), Math.abs(v)) > el.mount) continue;
    const inside = el.shape === 'square' ? Math.max(Math.abs(u), Math.abs(v)) <= el.aperture : Math.hypot(u, v) <= el.aperture;
    if (!inside && el.mount <= el.aperture) continue;   // no mount around it: the ray passes by
    best = { el, t, local, inside };
  }
  return best;
}

// Distance along the ray to where it leaves the breadboard (or maxLength).
function exitDistance(ray, bounds, maxLength) {
  let t = maxLength;
  if (!bounds) return t;
  const { origin: o, direction: d } = ray;
  if (d.x > 1e-12) t = Math.min(t, (bounds.xMax - o.x) / d.x);
  if (d.x < -1e-12) t = Math.min(t, (bounds.xMin - o.x) / d.x);
  if (d.z > 1e-12) t = Math.min(t, (bounds.zMax - o.z) / d.z);
  if (d.z < -1e-12) t = Math.min(t, (bounds.zMin - o.z) / d.z);
  return Math.max(0, t);
}

// Trace a centre ray through the elements. Each element: { id, kind: 'splitter' | 'mirror' | 'lens' | 'screen' |
// 'stop', position, normal, shape: 'disc' | 'square', aperture, mount, R, T (splitter), focalLength (lens) }.
// Returns every ray segment: { index, parent, start, end, direction, power, opl0, opl1, matrix0, matrix1, path,
// stop: { kind, id, point, local: {u, v}, normal } } — stop.kind is the element kind, 'mount', 'edge' or 'limit'.
export function trace(source, elements, { maxInteractions = 8, minPower = 0.01, bounds = null, maxLength = 3 } = {}) {
  const rays = [];
  const queue = [{
    origin: source.origin, direction: normalize(source.direction), power: source.power ?? 1, opl: 0,
    matrix: rayMatrix.identity, path: [], interactions: 0, from: source.from ?? null, parent: -1,
  }];
  while (queue.length > 0) {
    const ray = queue.shift();
    const hit = nearestHit(ray, elements);
    const edge = exitDistance(ray, bounds, maxLength);
    const t = hit && hit.t < edge ? hit.t : edge;
    const end = add(ray.origin, scale(ray.direction, t));
    const record = {
      index: rays.length, parent: ray.parent, start: ray.origin, end, direction: ray.direction, power: ray.power,
      opl0: ray.opl, opl1: ray.opl + t, matrix0: ray.matrix, matrix1: rayMatrix.free(ray.matrix, t), path: ray.path,
      stop: { kind: 'edge' },
    };
    rays.push(record);
    if (!hit || hit.t >= edge) continue;

    const { el } = hit;
    const normal = dot(ray.direction, el.normal) < 0 ? el.normal : scale(el.normal, -1);
    const axes = surfaceAxes(normal);
    const where = { id: el.id, point: end, local: { u: dot(hit.local, axes.u), v: dot(hit.local, axes.v) }, normal };
    if (!hit.inside) {
      record.stop = { kind: 'mount', ...where };
      continue;
    }
    const stops = el.kind === 'screen' || el.kind === 'stop';
    record.stop = { kind: !stops && ray.interactions >= maxInteractions ? 'limit' : el.kind, ...where };
    if (stops || record.stop.kind === 'limit') continue;

    const next = (direction, power, matrix, tag) => {
      if (power < minPower) return;
      queue.push({
        origin: end, direction: normalize(direction), power, opl: record.opl1, matrix,
        path: [...ray.path, tag], interactions: ray.interactions + 1, from: el.id, parent: record.index,
      });
    };
    if (el.kind === 'mirror') {
      next(reflect(ray.direction, el.normal), ray.power, record.matrix1, el.id);
    } else if (el.kind === 'splitter') {
      next(reflect(ray.direction, el.normal), ray.power * el.R, record.matrix1, `${el.id}:R`);
      next(ray.direction, ray.power * el.T, record.matrix1, `${el.id}:T`);
    } else if (el.kind === 'lens') {
      const offset = sub(end, el.position);   // lies in the lens plane
      next(sub(ray.direction, scale(offset, 1 / el.focalLength)), ray.power, rayMatrix.lens(record.matrix1, el.focalLength), el.id);
    }
  }
  return rays;
}
