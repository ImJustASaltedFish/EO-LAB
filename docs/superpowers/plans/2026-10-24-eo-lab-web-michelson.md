# EO LAB Web — Michelson Interferometer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `michelson.html`, the browser version of handout 實驗十六 (Michelson interferometer) specified in `docs/superpowers/specs/2026-10-24-eo-lab-web-michelson-design.md`, and link it from the lobby.

**Architecture:** A new page with its own pure modules — `js/optics/tracer.js` (3D centre-ray tracing through parts posed anywhere on the breadboard), `js/optics/interference.js` (two-beam fringes on the screen), and `js/michelson/` (config, state, bench, steps, tips) — reusing the tested Experiment 1 optics and UI modules. Data flows one way: input → state → `michelsonBench(state)` → 3D scene, close-ups, panel and step checks. Experiment 1 behaviour does not change.

**Tech Stack:** Plain HTML/CSS/JavaScript ES modules, no build step; three.js 0.170.0 vendored in `js/vendor/`; tests in the repository's own harness, run in headless Edge by `python tools/run_tests.py`.

## Global Constraints

- Plain ES modules, no build step, no new dependencies; three.js 0.170.0 stays the only third-party code.
- 繁體中文 by default with an English switch: every new string goes into both `js/i18n/zh-TW.js` and `js/i18n/en.js` with the same keys.
- Internal units are SI (m, rad); every Michelson constant lives in `js/michelson/config.js`.
- Experiment 1 behaviour does not change: its 83 tests must keep passing; shared-module changes are backward-compatible.
- Files use LF line endings (`.gitattributes` has `eol=lf`). On Windows, Python's `Path.write_text` writes CRLF — write bytes or use the Write/Edit tools.
- Work on branch `feat/michelson` (already created from `main`; the spec is committed there).
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run tests from the repository root (`eo-lab-web/`). A single `FAIL (load error)` in a full run that passes on a re-run is a known flake of the local test server; re-run before debugging.

## File structure

New:

| File | Responsibility |
|---|---|
| `js/optics/tracer.js` | Vector helpers, ray matrices and `trace()`: centre rays through splitters, mirrors, lenses, screens and stops posed anywhere |
| `js/optics/interference.js` | `coherenceContrast`, `profile`, `interferenceSampler` (intensity on the card) and `fringeNumbers` |
| `js/michelson/config.js` | `MI`: every Michelson constant, range and tolerance, the layout guide |
| `js/michelson/state.js` | Bench state, hand errors, hole snapping, footprints, place / move / turn / remove, knob values |
| `js/michelson/bench.js` | `michelsonBench(state)`: poses → elements → trace → arms, iris spots, card trial, screen beams and images, fringe numbers |
| `js/michelson/steps.js` | `STEPS`, checks, flow (hints, tip, guide, card trials), warnings, `guideFor` |
| `js/michelson/tips.js` | `tipFor`: the tip about what is wrong right now |
| `js/scene/michelson-models.js` | Breadboard with the ready source, the Michelson part models, layout-guide outlines, rack slots, `yawFor` |
| `js/scene/table.js` | Breadboard pointer interaction: hole-snapped dragging, rack drop, tap-to-place, R to turn |
| `js/michelson-app.js` | The page: wiring state, bench, scene, close-ups, panel, controls, tips, tap the table, timer |
| `michelson.html` | The page shell (same layout as `laser.html`) |
| `tests/page.js` | Shared iframe page loader for the page tests |
| `tests/optics/tracer.test.js`, `tests/optics/interference.test.js`, `tests/michelson/{fixtures,state,bench,steps,tips}.test.js` (fixtures is `fixtures.js`), `tests/scene/michelson-scene.test.js`, `tests/michelson-app.test.js` | Tests |

Changed (backward-compatible): `js/optics/rng.js` (salt), `js/optics/screen.js` (`brightPixel`), `js/ui/insets.js` (labelled beams, `pixel` option), `js/ui/panel.js` (`renderTip`), `js/scene/beam.js` (spot normals), `js/scene/view.js` (custom presets, look-at point), `js/scene/models.js` (`createScreenModel`, exported `buildLaser`), `js/i18n/zh-TW.js`, `js/i18n/en.js`, `css/style.css`, `index.html`, `tests/all.js`, `tests/i18n.test.js`, `tests/app.test.js`, `tests/lobby.test.js`, existing scene/ui/screen tests (new cases).

---
### Task 1: Centre-ray tracer

**Files:**
- Create: `js/optics/tracer.js`
- Test: `tests/optics/tracer.test.js`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `add, sub, scale, dot, cross, length, normalize` (vectors `{x, y, z}` in table metres: x across, y up, z along the source beam); `reflect(d, n)`; `surfaceAxes(normal) → {u, v}` (u to the viewer's right, v up); `rayMatrix.{identity, free(m, d), lens(m, f)}` on `{A, B, C, D}`; `trace(source, elements, {maxInteractions, minPower, bounds, maxLength}) → rays[]`. Element: `{id, kind: 'splitter'|'mirror'|'lens'|'screen'|'stop', position, normal, shape: 'disc'|'square', aperture, mount, R, T, focalLength}`. Ray: `{index, parent, start, end, direction, power, opl0, opl1, matrix0, matrix1, path: string[], stop: {kind, id, point, local: {u, v}, normal}}`; path tags are element ids, or `id:R` / `id:T` at a splitter; `stop.kind` is the element kind, `'mount'`, `'edge'` or `'limit'`.

- [ ] **Step 1: Write the failing test**

Create `tests/optics/tracer.test.js`:

```js
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

test('tracer: surface axes are right-handed with v up', () => {
  const { u, v } = surfaceAxes({ x: 0, y: 0, z: -1 });
  assertClose(u.x, 1, 1e-12);
  assertClose(v.y, 1, 1e-12);
  const back = surfaceAxes({ x: 0, y: 0, z: 1 });
  assertClose(back.u.x, -1, 1e-12, 'seen from the other side, +x is on the left');
});
```

In `tests/all.js`, replace (register the new test file):

```js
import './optics/screen.test.js';
```

with:

```js
import './optics/screen.test.js';
import './optics/tracer.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "tracer"`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Write the tracer**

Create `js/optics/tracer.js`:

```js
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "tracer"`

Expected:

```
PASS tracer: a mirror tilted by ε turns the ray by 2ε
PASS tracer: a beam splitter at 45° reflects at 90° and transmits straight, half the power each
PASS tracer: thin lens deflects by −(p − c)/f; a lens at f + δ from a mirror gives A = −1 − 2δ/f, C = 2δ/f²
PASS tracer: rays stop on screens, stops, mounts and the table edge, and after the interaction limit
PASS tracer: surface axes are right-handed with v up
SUMMARY passed=5 failed=0
```

- [ ] **Step 5: Commit**

Run:

```bash
git add js/optics/tracer.js tests/optics/tracer.test.js tests/all.js
git commit -F - <<'EOF'
feat(optics): add a 3D centre-ray tracer for posed parts

Splitters, mirrors, thin lenses, screens and stops at any pose; ray matrices
for beam size and curvature; rays stop on mounts, the table edge and an
interaction limit (Michelson spec §4.2–4.3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 2: Two-beam interference

**Files:**
- Create: `js/optics/interference.js`
- Test: `tests/optics/interference.test.js`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `coherenceContrast(pathDifference, coherenceLength)`; `curvature(beam) → 1/R`; `profile(beam, source) → {w, r, peak}`; `interferenceSampler(beams, {source, wavelength, coherenceLength, pixel, extraPhase}) → (u, v) => intensity`; `fringeNumbers(a, b, {source, wavelength, coherenceLength}) → {contrast, pathDifference, alpha, spacing, rings, centre, centred, overlap, radius}`. A beam: `{centre: {u, v}, tilt: {u, v}, opl, A, C, power}`; the source: `{waist, aperture}`.

- [ ] **Step 1: Write the failing test**

Create `tests/optics/interference.test.js`:

```js
import { test, assert, assertClose, assertRelClose } from '../harness.js';
import { coherenceContrast, interferenceSampler, fringeNumbers } from '../../js/optics/interference.js';

const LAMBDA = 532e-9;
const SOURCE = { waist: 11.1e-3, aperture: 6e-3 };
const OPTIONS = { source: SOURCE, wavelength: LAMBDA, coherenceLength: 0.03 };
const beam = (extra = {}) => ({ centre: { u: 0, v: 0 }, tilt: { u: 0, v: 0 }, opl: 1, A: 1, C: 0, power: 0.25, ...extra });

// The first u in (from, to] where I(u, 0) is smallest (or largest), scanning in fine steps.
function extremum(sample, from, to, wantMax) {
  let best = from;
  let bestValue = sample(from, 0);
  for (let i = 1; i <= 4000; i++) {
    const u = from + ((to - from) * i) / 4000;
    const value = sample(u, 0);
    if (wantMax ? value > bestValue : value < bestValue) {
      best = u;
      bestValue = value;
    }
  }
  return best;
}

test('interference: straight fringes repeat every λ/α', () => {
  const alpha = 0.25e-3;
  const sample = interferenceSampler([beam({ tilt: { u: alpha / 2, v: 0 } }), beam({ tilt: { u: -alpha / 2, v: 0 } })], OPTIONS);
  const period = LAMBDA / alpha;
  assertRelClose(extremum(sample, 0.05 * period, 0.95 * period, false), period / 2, 0.02, 'first dark fringe');
  assertRelClose(extremum(sample, 0.55 * period, 1.45 * period, true), period, 0.02, 'next bright fringe');
  const n = fringeNumbers(beam({ tilt: { u: alpha / 2, v: 0 } }), beam({ tilt: { u: -alpha / 2, v: 0 } }), OPTIONS);
  assertRelClose(n.spacing, period, 1e-12);
  assertClose(n.overlap, 0, 1e-15);
});

test('interference: contrast falls to 0.2 at half the coherence length', () => {
  assertClose(coherenceContrast(0, 0.03), 1, 1e-12);
  assertClose(coherenceContrast(0.015, 0.03), 0.2, 1e-12);
  // A very wide, flat beam, so the envelope does not change over the two fringes measured.
  const flat = { ...OPTIONS, source: { waist: 1, aperture: 0.05 } };
  const sample = interferenceSampler([beam({ tilt: { u: 1e-4, v: 0 } }), beam({ opl: 1.015, tilt: { u: -1e-4, v: 0 } })], flat);
  const period = LAMBDA / 2e-4;
  const values = Array.from({ length: 200 }, (_, i) => sample((i * period) / 100, 0));
  const max = Math.max(...values);
  const min = Math.min(...values);
  assertRelClose((max - min) / (max + min), 0.2, 0.01, 'measured fringe contrast');
});

test('interference: ring radii follow √(2nλ / |1/R₁ − 1/R₂|) with a bright centre', () => {
  const q = 0.2;   // 1/R₂ − 1/R₁ in 1/m: R₂ = 5 m against a flat wave
  const sample = interferenceSampler([beam(), beam({ A: 1, C: q })], OPTIONS);
  const r1 = Math.sqrt((2 * LAMBDA) / q);
  assertRelClose(extremum(sample, 0.8 * Math.sqrt(LAMBDA / q), 1.3 * r1, true), r1, 0.02, 'first bright ring');
  const n = fringeNumbers(beam(), beam({ C: q }), OPTIONS);
  assertRelClose(n.rings, (6e-3 ** 2 * q) / (2 * LAMBDA), 1e-12);
  assertClose(n.centre.u, 0, 1e-12);
  assert(n.centred, 'ring centre inside the spot');
});

test('interference: fringes finer than a pixel average out', () => {
  const alpha = 2.66e-3;   // 0.2 mm spacing on 1 mm pixels
  const sample = interferenceSampler([beam({ tilt: { u: alpha / 2, v: 0 } }), beam({ tilt: { u: -alpha / 2, v: 0 } })], { ...OPTIONS, pixel: 1e-3 });
  const values = Array.from({ length: 200 }, (_, i) => sample(i * 1e-5, 0));
  const max = Math.max(...values);
  const min = Math.min(...values);
  assert((max - min) / (max + min) < 0.05, `averaged contrast ${(max - min) / (max + min)}`);
});

test('interference: one beam alone is a plain spot; the tap phase shifts the fringes', () => {
  const single = interferenceSampler([beam()], OPTIONS);
  assert(single(0, 0) > single(3e-3, 0), 'bright centre');
  assertClose(single(7e-3, 0), 0, 0, 'outside the iris-sized disc');
  const plain = interferenceSampler([beam(), beam()], OPTIONS);
  const tapped = interferenceSampler([beam(), beam()], { ...OPTIONS, extraPhase: Math.PI });
  assert(tapped(0, 0) < 0.01 * plain(0, 0), 'half a fringe shift turns the centre dark');
});
```

In `tests/all.js`, replace (register the new test file):

```js
import './optics/tracer.test.js';
```

with:

```js
import './optics/tracer.test.js';
import './optics/interference.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "interference"`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Write the interference module**

Create `js/optics/interference.js`:

```js
// Interference of the beams that reach the observation screen (Michelson spec §4.4–4.5). Pure: no DOM.
// A beam on the card: { centre: {u, v}, tilt: {u, v}, opl, A, C, power } — its hit point, its direction along the
// card axes, its optical path length there, its ray matrix (for parallel input rays) and its power. The source
// is { waist, aperture }: the Gaussian radius and the iris radius at the start.

const LN5 = Math.log(5);

export function coherenceContrast(pathDifference, coherenceLength) {
  return Math.exp(-LN5 * ((2 * pathDifference) / coherenceLength) ** 2);
}

// 1/R of the wavefront (0 for a flat one, and at a focus, where the geometric model stops).
export const curvature = (beam) => (Math.abs(beam.A) < 1e-9 ? 0 : beam.C / beam.A);

// Spot on the card: Gaussian radius w, disc radius r and centre intensity (power / area integral).
export function profile(beam, source, minSpot = 50e-6) {
  let w = Math.abs(beam.A) * source.waist;
  let r = Math.abs(beam.A) * source.aperture;
  if (Math.min(w, r) < minSpot) {
    w = minSpot;
    r = 3 * minSpot;
  }
  const area = ((Math.PI * w * w) / 2) * (1 - Math.exp((-2 * r * r) / (w * w)));
  return { w, r, peak: beam.power / area };
}

const sinc = (x) => (Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x);

// Intensity on the card at (u, v): Σ|Eᵢ|² + Σ 2|Eᵢ||Eⱼ|·V·S·cos(Δφ). `pixel` averages fringes finer than a pixel;
// `extraPhase` (tap the table) is added to the first beam.
export function interferenceSampler(beams, { source, wavelength, coherenceLength, pixel = 0, extraPhase = 0 }) {
  const k = (2 * Math.PI) / wavelength;
  const prepared = beams.map((beam) => ({ ...beam, ...profile(beam, source), q: curvature(beam) }));
  const pairs = [];
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i];
      const b = prepared[j];
      pairs.push({ i, j, a, b, V: coherenceContrast(a.opl - b.opl, coherenceLength), offset: k * (a.opl - b.opl) + (i === 0 ? extraPhase : 0) });
    }
  }
  const amplitude = (b, du, dv) => {
    const rho2 = du * du + dv * dv;
    return rho2 > b.r * b.r ? 0 : Math.sqrt(b.peak) * Math.exp(-rho2 / (b.w * b.w));
  };
  return (u, v) => {
    const amps = prepared.map((b) => amplitude(b, u - b.centre.u, v - b.centre.v));
    let intensity = 0;
    for (const a of amps) intensity += a * a;
    for (const p of pairs) {
      const ea = amps[p.i];
      const eb = amps[p.j];
      if (ea === 0 || eb === 0) continue;
      const au = u - p.a.centre.u;
      const av = v - p.a.centre.v;
      const bu = u - p.b.centre.u;
      const bv = v - p.b.centre.v;
      const phase = p.offset + k * (p.a.tilt.u * au + p.a.tilt.v * av - p.b.tilt.u * bu - p.b.tilt.v * bv
        + 0.5 * (p.a.q * (au * au + av * av) - p.b.q * (bu * bu + bv * bv)));
      let smear = 1;
      if (pixel > 0) {
        const gu = k * (p.a.tilt.u - p.b.tilt.u + p.a.q * au - p.b.q * bu);
        const gv = k * (p.a.tilt.v - p.b.tilt.v + p.a.q * av - p.b.q * bv);
        smear = sinc((Math.hypot(gu, gv) * pixel) / 2);
      }
      intensity += 2 * ea * eb * p.V * smear * Math.cos(phase);
    }
    return Math.max(0, intensity);
  };
}

// The numbers the checks and readouts use for a pair of beams (spec §4.5).
export function fringeNumbers(a, b, { source, wavelength, coherenceLength }) {
  const pa = profile(a, source);
  const pb = profile(b, source);
  const qa = curvature(a);
  const qb = curvature(b);
  const du = a.tilt.u - b.tilt.u;
  const dv = a.tilt.v - b.tilt.v;
  const alpha = Math.hypot(du, dv);
  const radius = Math.min(pa.r, pb.r);
  const dq = qa - qb;
  // The ring centre is where the phase difference is flat: (tₐ − t_b) + qₐ(s − cₐ) − q_b(s − c_b) = 0.
  const centre = Math.abs(dq) > 1e-9
    ? { u: (qa * a.centre.u - qb * b.centre.u - du) / dq, v: (qa * a.centre.v - qb * b.centre.v - dv) / dq }
    : null;
  const mid = { u: (a.centre.u + b.centre.u) / 2, v: (a.centre.v + b.centre.v) / 2 };
  return {
    contrast: coherenceContrast(a.opl - b.opl, coherenceLength),
    pathDifference: a.opl - b.opl,
    alpha,
    spacing: alpha > 1e-12 ? wavelength / alpha : Infinity,   // below 1e-12 rad the beams are parallel
    rings: (radius * radius * Math.abs(dq)) / (2 * wavelength),
    centre,
    centred: centre !== null && Math.hypot(centre.u - mid.u, centre.v - mid.v) < radius,
    overlap: Math.hypot(a.centre.u - b.centre.u, a.centre.v - b.centre.v),
    radius,
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "interference"`

Expected:

```
PASS interference: straight fringes repeat every λ/α
PASS interference: contrast falls to 0.2 at half the coherence length
PASS interference: ring radii follow √(2nλ / |1/R₁ − 1/R₂|) with a bright centre
PASS interference: fringes finer than a pixel average out
PASS interference: one beam alone is a plain spot; the tap phase shifts the fringes
SUMMARY passed=5 failed=0
```

- [ ] **Step 5: Commit**

Run:

```bash
git add js/optics/interference.js tests/optics/interference.test.js tests/all.js
git commit -F - <<'EOF'
feat(optics): add two-beam interference on the screen

Fields with tilt and curvature, coherence contrast, pixel averaging of
fine fringes, and the fringe numbers the checks use (Michelson spec
§4.4–4.5).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 3: Michelson config and bench state

**Files:**
- Create: `js/michelson/config.js`
- Create: `js/michelson/state.js`
- Modify: `js/optics/rng.js`
- Test: `tests/michelson/state.test.js`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: `createRng, deriveSeed, uniform, randomSign, SALT` from `js/optics/rng.js`.
- Produces: `MI` (config, incl. `MI.guide.{bs, m1, m2, screen, card, lens1, lens2}` = `{pos: {x, z}, heading}`); `PART_IDS`, `KINDS`, `headingVector(h)`, `createMichelsonState(seed)`, `VALUE_PATHS`, `getValue`, `setValue(state, path, value)`, `setLaserOn`, `snapPosition(id, heading, pos)`, `canStand(state, id, pos, heading)`, `placePart(state, id, pos, heading?)`, `placeNear(state, id, wanted, heading?)`, `turnPart(state, id, steps)`, `movePartBy(state, id, dz, dx)`, `removePart`, `atStageEdge`. State: `{seed, laser: {on}, iris: {opening}, parts: {bs: {placed, pos, heading, rotation, tilt}, m1: {…, h, v, stage}, m2: {…, h, v}, screen, lens1, lens2}, hidden: {bsHeading, bsTilt, m1H, m1V, m2H, m2V}}`. Headings are 45° steps: 0 = +z, 2 = +x, 4 = −z (toward the laser), 6 = −x.

- [ ] **Step 1: Write the failing test**

Create `tests/michelson/state.test.js`:

```js
import { test, assert, assertEqual, assertClose, assertThrows } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';

const DEG = Math.PI / 180;

test('michelson state: deterministic per seed; hand errors in range and correctable', () => {
  assertEqual(JSON.stringify(S.createMichelsonState(5)), JSON.stringify(S.createMichelsonState(5)));
  for (let seed = 0; seed < 200; seed++) {
    const { hidden } = S.createMichelsonState(seed);
    const within = (value, [lo, hi]) => Math.abs(value) >= lo * DEG - 1e-12 && Math.abs(value) <= hi * DEG + 1e-12;
    assert(within(hidden.bsHeading, MI.errors.bsHeading), `bs heading ${hidden.bsHeading}`);
    assert(within(hidden.bsTilt, MI.errors.bsTilt), `bs tilt ${hidden.bsTilt}`);
    for (const key of ['m1H', 'm1V', 'm2H', 'm2V']) assert(within(hidden[key], MI.errors.mirrorTilt), `${key} ${hidden[key]}`);
    assert(Math.abs(hidden.bsHeading) <= MI.bs.rotationRange && Math.abs(hidden.bsTilt) <= MI.bs.tiltRange, 'bs knobs reach');
    assert(Math.abs(hidden.m1H) <= MI.mirror.tiltRange, 'mirror knobs reach');
  }
  const s = S.createMichelsonState(1);
  assertEqual(s.laser.on, false);
  assertEqual(s.parts.bs.placed, false);
  assertEqual(s.parts.bs.heading, 3, 'the beam splitter starts reflecting toward the front');
  assertEqual(s.parts.m1.heading, 4, 'mirrors start facing the laser');
  assertClose(s.parts.m1.stage, 0.0125, 0);
});

test('michelson state: parts snap to holes; lenses slide along their row in 1 mm steps', () => {
  let s = S.createMichelsonState(1);
  s = S.placePart(s, 'bs', { x: 0.004, z: 0.3104 });
  assertEqual(JSON.stringify(s.parts.bs.pos), JSON.stringify({ x: 0, z: 0.3 }));
  s = S.placePart(s, 'lens1', { x: 0.004, z: 0.4123 }, 0);
  assertEqual(JSON.stringify(s.parts.lens1.pos), JSON.stringify({ x: 0, z: 0.412 }));
  s = S.placePart(s, 'lens2', { x: 0.1034, z: 0.3104 }, 2);
  assertEqual(JSON.stringify(s.parts.lens2.pos), JSON.stringify({ x: 0.103, z: 0.3 }));
  const moved = S.movePartBy(s, 'lens1', 0.001, 0);
  assertClose(moved.parts.lens1.pos.z, 0.413, 1e-12, 'one millimetre along the row');
  assertClose(S.movePartBy(s, 'bs', 0, 0.025).parts.bs.pos.x, 0.025, 1e-12, 'one hole across');
});

test('michelson state: overlaps, off-table spots and the source strip are refused', () => {
  const s = S.placePart(S.createMichelsonState(1), 'bs', { x: 0, z: 0.3 });
  assertEqual(S.placePart(s, 'm2', { x: 0.025, z: 0.3 }), s, 'too close to the beam splitter');
  assertEqual(S.placePart(s, 'm2', { x: 0, z: 1.2 }), s, 'off the table');
  assertEqual(S.placePart(s, 'm2', { x: 0, z: -0.2 }), s, 'on the source');
  assert(S.placePart(s, 'm2', { x: 0.1, z: -0.2 }).parts.m2.placed, 'beside the source is fine');
  assert(S.placePart(s, 'm2', { x: 0.075, z: 0.3 }).parts.m2.placed, 'three holes away is fine');
  const turned = S.turnPart(s, 'bs', 1);
  assertEqual(turned.parts.bs.heading, 4);
  assertEqual(S.turnPart(s, 'bs', -4).parts.bs.heading, 7, 'headings wrap around');
  assertThrows(() => S.placePart(s, 'laser', { x: 0, z: 0 }));
});

test('michelson state: Place finds the nearest free hole; knobs clamp; updates never mutate', () => {
  const base = S.placePart(S.createMichelsonState(1), 'bs', { x: 0, z: 0.3 });
  const s = S.placeNear(base, 'm1', { x: 0, z: 0.3 });
  assert(s.parts.m1.placed, 'placed next to the beam splitter');
  const found = Math.hypot(s.parts.m1.pos.x, s.parts.m1.pos.z - 0.3);
  for (let di = -4; di <= 4; di++) {
    for (let dj = -4; dj <= 4; dj++) {
      if (Math.hypot(di, dj) * MI.table.pitch < found - 1e-9) {
        assertEqual(S.placePart(base, 'm1', { x: dj * MI.table.pitch, z: 0.3 + di * MI.table.pitch }), base, `hole (${di}, ${dj}) is nearer but taken`);
      }
    }
  }
  const before = S.createMichelsonState(1);
  const after = S.setValue(before, 'parts.m1.h', 1);
  assertClose(after.parts.m1.h, MI.mirror.tiltRange, 0);
  assertClose(before.parts.m1.h, 0, 0, 'input untouched');
  assertThrows(() => S.setValue(before, 'parts.m2.stage', 0.01), 'M2 has no stage');
  assert(S.atStageEdge(S.setValue(before, 'parts.m1.stage', 1)), 'at the end of travel');
  assert(!S.atStageEdge(before), 'mid travel');
});
```

In `tests/all.js`, replace (register the new test file):

```js
import './lab/steps.test.js';
```

with:

```js
import './lab/steps.test.js';
import './michelson/state.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "michelson state"`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Add the random-number salt for the hand errors**

In `js/optics/rng.js`, replace:

```js
export const SALT = Object.freeze({ laser: 1, noise: 2, pinhole: 4, lateral: 5 });
```

with:

```js
export const SALT = Object.freeze({ laser: 1, noise: 2, pinhole: 4, lateral: 5, michelson: 6 });
```

- [ ] **Step 4: Write the config**

Create `js/michelson/config.js`:

```js
// Every Michelson constant, range and tolerance (SI units: m, rad).
// Source of truth: docs/superpowers/specs/2026-10-24-eo-lab-web-michelson-design.md
function deepFreeze(value) {
  Object.values(value).forEach((v) => {
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(value);
}

export const MI = deepFreeze({
  wavelength: 532e-9,
  beamHeight: 0.100,
  // Breadboard: z along the source beam, x across (+x toward the front edge); M6 holes every 25 mm.
  table: { zMin: -0.500, zMax: 0.900, xMin: -0.450, xMax: 0.450, pitch: 0.025, holeZ0: -0.475, holeX0: -0.425 },
  // Ready source on row x = 0: laser, spatial filter, f = 200 mm lens, iris (the exit). Parts keep out of its strip.
  source: { waistRadius: 11.1e-3, laserZ: -0.320, pinholeZ: -0.270, lensZ: -0.070, irisZ: -0.025, keepOutZ: 0.000, keepOutHalfWidth: 0.040, stopHalf: 0.060 },
  iris: { openingMin: 1.0e-3, openingMax: 12.0e-3, openingInitial: 12.0e-3, step: 0.1e-3, plateRadius: 0.025 },
  bs: { R: 0.5, T: 0.5, radius: 12.7e-3, mountHalf: 0.020, rotationRange: 50e-3, rotationFine: 0.05e-3, rotationCoarse: 1e-3, tiltRange: 20e-3, tiltFine: 0.05e-3, tiltCoarse: 1e-3 },
  mirror: { radius: 12.7e-3, mountHalf: 0.020, tiltRange: 25e-3, tiltFine: 0.02e-3, tiltCoarse: 0.5e-3 },
  stage: { travel: 25e-3, initial: 12.5e-3, fine: 0.05e-6, coarse: 10e-6 },
  lens: { focalLength: 0.100, radius: 24e-3, mountHalf: 0.030, slide: 1e-3 },
  screen: { size: 0.150 },
  coherenceLength: 0.030,
  // Footprint rectangles [along the heading, across] in metres; two footprints keep minGap apart.
  footprints: { bs: [0.040, 0.040], m1: [0.060, 0.050], m2: [0.040, 0.040], screen: [0.020, 0.160], lens1: [0.020, 0.070], lens2: [0.020, 0.070] },
  minGap: 0.005,
  // Hand errors (degrees), drawn once per run with a random sign.
  errors: { bsHeading: [0.5, 2], bsTilt: [0.1, 0.5], mirrorTilt: [0.2, 1] },
  trace: { maxInteractions: 8, minPower: 0.01, minSpot: 50e-6 },
  checks: {
    mi1: { irisClosedMax: 1.5e-3, bsCentreTol: 2e-3, angleTol: 1e-3, cardSpan: 0.150 },
    mi2: { mirrorCentreTol: 3e-3, armTol: 12.5e-3, returnTol: 0.5e-3 },
    mi3: { irisOpenMin: 8e-3, overlapTol: 1e-3, contrastMin: 0.5, spacingMin: 1e-3, spacingMax: 5e-3 },
    mi4: { lensCentreTol: 1e-3, focusTol: 10e-3, ringsMin: 3 },
  },
  spacingShownMax: 0.050,
  tap: { amplitude: 3 * Math.PI, decay: 0.4, frequency: 12, duration: 1.5 },
  // Layout guide (spec §3.6): positions (m) and headings (45° steps; 0 = +z, 2 = +x, 4 = −z, 6 = −x).
  guide: {
    bs: { pos: { x: 0, z: 0.300 }, heading: 3 },
    m1: { pos: { x: 0, z: 0.500 }, heading: 4 },
    m2: { pos: { x: 0.200, z: 0.300 }, heading: 6 },
    screen: { pos: { x: -0.250, z: 0.300 }, heading: 2 },
    card: { pos: { x: 0.100, z: 0.300 }, heading: 6 },   // step 1: the screen as the alignment card on the reflected row
    lens1: { pos: { x: 0, z: 0.400 }, heading: 0 },
    lens2: { pos: { x: 0.100, z: 0.300 }, heading: 2 },
  },
});
```

- [ ] **Step 5: Write the state module**

Create `js/michelson/state.js`:

```js
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
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "michelson state"`

Expected:

```
PASS michelson state: deterministic per seed; hand errors in range and correctable
PASS michelson state: parts snap to holes; lenses slide along their row in 1 mm steps
PASS michelson state: overlaps, off-table spots and the source strip are refused
PASS michelson state: Place finds the nearest free hole; knobs clamp; updates never mutate
SUMMARY passed=4 failed=0
```

- [ ] **Step 7: Commit**

Run:

```bash
git add js/michelson/config.js js/michelson/state.js js/optics/rng.js tests/michelson/state.test.js tests/all.js
git commit -F - <<'EOF'
feat(michelson): add the config and the breadboard state

Parts snap to the 25 mm hole grid (lenses slide 1 mm along their row),
turn in 45° steps and keep their footprints apart; each run draws fixed
hand errors for the beam splitter and the mirrors.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 4: Michelson bench

**Files:**
- Create: `js/michelson/bench.js`
- Create: `tests/michelson/fixtures.js`
- Test: `tests/michelson/bench.test.js`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: Task 1 `trace, sub, scale, dot, surfaceAxes`; Task 2 `interferenceSampler, fringeNumbers, profile`; Task 3 `MI, PART_IDS, KINDS, headingVector`; existing `gaussianThroughHole` (`js/optics/iris.js`), `renderScreen, screenWindow` (`js/optics/screen.js`), `CONFIG` (`js/optics/config.js`).
- Produces: `facing(heading, yaw, pitch)`, `poseOf(state, id) → {id, kind, position, normal, yaw, pitch}`, `michelsonBench(state, {render, tapPhase}) → {laserOn, rays, segments, spots, bsHit: {offset}|null, reflected: direction|null, arms: {T, R} (each {side, mirror, offset, length, lenses: [{id, offset, at, toMirror}]}|null), iris: {spots: [{mirror, label, dx, dy, radius, power}]}, cardOn: {distance, u, v}|null, screen: {beams, window, card}|null, fringe: fringeNumbers|null, power, irisT}`. Screen images are brightness √(I/I_ref) in card coordinates (u across, height above the table). `tests/michelson/fixtures.js` exports `aligned(seed, {parts, opening})`: the layout-guide positions with every hand error corrected.

- [ ] **Step 1: Write the failing test**

Create `tests/michelson/fixtures.js`:

```js
// Shared Michelson test states: the layout-guide positions (spec §3.6) with every hand error corrected by its knobs.
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';

export function aligned(seed = 1, { parts = ['bs', 'm1', 'm2', 'screen'], opening = MI.iris.openingMax } = {}) {
  let s = S.setLaserOn(S.createMichelsonState(seed), true);
  for (const id of parts) s = S.placePart(s, id, MI.guide[id].pos, MI.guide[id].heading);
  const h = s.hidden;
  s = S.setValue(s, 'parts.bs.rotation', -h.bsHeading);
  s = S.setValue(s, 'parts.bs.tilt', -h.bsTilt);
  for (const m of ['m1', 'm2']) {
    s = S.setValue(s, `parts.${m}.h`, -h[`${m}H`]);
    s = S.setValue(s, `parts.${m}.v`, -h[`${m}V`]);
  }
  return S.setValue(s, 'iris.opening', opening);
}
```

Create `tests/michelson/bench.test.js`:

```js
import { test, assert, assertEqual, assertClose, assertRelClose } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';
import { michelsonBench } from '../../js/michelson/bench.js';
import { gaussianThroughHole } from '../../js/optics/iris.js';
import { aligned } from './fixtures.js';

test('michelson bench: laser off gives no beam', () => {
  const r = michelsonBench(S.createMichelsonState(1));
  assertEqual(r.laserOn, false);
  assertEqual(r.segments.length, 0);
  assertEqual(r.screen, null);
});

test('michelson bench: the aligned standard layout has equal arms, returned spots and overlapping beams', () => {
  const r = michelsonBench(aligned());
  assertClose(r.bsHit.offset, 0, 1e-12, 'beam on the splitter centre');
  assertClose(r.reflected.x, 1, 1e-12, 'reflected along +x');
  assertEqual(r.arms.T.mirror, 'm1');
  assertEqual(r.arms.R.mirror, 'm2');
  assertClose(r.arms.T.length, 0.2, 1e-9);
  assertClose(r.arms.R.length, 0.2, 1e-9);
  assertEqual(r.iris.spots.length, 2);
  for (const spot of r.iris.spots) assertClose(Math.hypot(spot.dx, spot.dy), 0, 1e-9, `spot ${spot.label} on the hole`);
  assertClose(r.fringe.pathDifference, 0, 1e-12);
  assertClose(r.fringe.contrast, 1, 1e-12);
  assertClose(r.fringe.overlap, 0, 1e-9);
  assertEqual(r.fringe.spacing, Infinity, 'exactly parallel beams: no straight fringes');
  const irisT = gaussianThroughHole(MI.source.waistRadius, 0, MI.iris.openingMax / 2);
  assertClose(r.power, 0.5 * irisT, 1e-12, 'each arm brings a quarter of the light to the screen');
  assert(r.screen.window.image.length > 0 && r.screen.card.image.length > 0, 'screen images rendered');
});

test('michelson bench: a mirror 1 mrad off moves its returned spot and tilts its beam by 2 mrad', () => {
  const s = aligned();
  const r = michelsonBench(S.setValue(s, 'parts.m2.h', s.parts.m2.h + 1e-3));
  const spot = r.iris.spots.find((p) => p.mirror === 'm2');
  assertRelClose(Math.hypot(spot.dx, spot.dy), 2e-3 * (0.2 + 0.325), 0.01, 'spot offset = 2ε × path back to the iris');
  assertRelClose(r.fringe.alpha, 2e-3, 1e-3);
  assertRelClose(r.fringe.spacing, MI.wavelength / 2e-3, 1e-3);
  assertRelClose(r.fringe.overlap, 2e-3 * (0.2 + 0.25), 0.01);
});

test('michelson bench: reflected spots that miss the iris itself still land on the source face', () => {
  const s = aligned();
  // 1° (17.5 mrad) off in both tilts, pushing each knob away from its end so the knob range does not clamp it.
  const push = (v) => v - Math.sign(v || 1) * 17.5e-3;
  const r = michelsonBench(S.setValue(S.setValue(s, 'parts.m2.h', push(s.parts.m2.h)), 'parts.m2.v', push(s.parts.m2.v)));
  const spot = r.iris.spots.find((p) => p.mirror === 'm2');
  assert(spot && Math.hypot(spot.dx, spot.dy) > MI.iris.plateRadius, `1° off in both tilts: ${spot && Math.hypot(spot.dx, spot.dy)}`);
});

test('michelson bench: arms one hole apart lose the fringe contrast', () => {
  const s = S.placePart(aligned(), 'm2', { x: 0.225, z: 0.3 });
  const r = michelsonBench(s);
  assertClose(r.arms.R.length - r.arms.T.length, 0.025, 1e-9);
  assertClose(Math.abs(r.fringe.pathDifference), 0.05, 1e-9, 'the path difference is twice the arm difference');
  assert(r.fringe.contrast < 1e-6, `contrast ${r.fringe.contrast}`);
});

test('michelson bench: off the beam row the splitter is missed', () => {
  const s = S.placePart(S.setLaserOn(S.createMichelsonState(1), true), 'bs', { x: 0.025, z: 0.3 });
  const r = michelsonBench(s);
  assertEqual(r.bsHit, null);
  assertEqual(r.reflected, null);
});

test('michelson bench: lenses about f from their mirrors give rings when their distances differ', () => {
  const withLenses = aligned(1, { parts: ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2'] });
  const same = michelsonBench(withLenses);
  assertClose(same.arms.T.lenses[0].toMirror, 0.1, 1e-9);
  assertClose(same.arms.R.lenses[0].toMirror, 0.1, 1e-9);
  assert(same.fringe.rings < 0.5, `equal lens distances: ${same.fringe.rings} rings`);
  const offset = michelsonBench(S.movePartBy(withLenses, 'lens2', 0, -0.001));
  assertClose(offset.arms.R.lenses[0].toMirror, 0.101, 1e-9);
  assert(offset.fringe.rings >= 3, `rings ${offset.fringe.rings}`);
  assert(offset.fringe.centred, 'ring centre inside the spot');
});

test('michelson bench: the card on the reflected row reports its distance; an uncorrected splitter makes the spot drift', () => {
  const base = aligned(1, { parts: ['bs'] });
  const at = (state, x) => michelsonBench(S.placePart(state, 'screen', { x, z: 0.3 }, 6)).cardOn;
  assertClose(at(base, 0.15).distance, 0.15, 1e-9);
  assertClose(at(base, 0.3).u - at(base, 0.1).u, 0, 1e-9, 'corrected: no drift');
  const crooked = S.setValue(base, 'parts.bs.rotation', 0);
  const drift = Math.abs(at(crooked, 0.3).u - at(crooked, 0.1).u);
  assertRelClose(drift, Math.abs(Math.tan(2 * crooked.hidden.bsHeading)) * 0.2, 0.02, 'drift = 2 × the splitter error × distance');
});
```

In `tests/all.js`, replace (register the new test file):

```js
import './michelson/state.test.js';
```

with:

```js
import './michelson/state.test.js';
import './michelson/bench.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "michelson bench"`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Write the bench**

Create `js/michelson/bench.js`:

```js
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "michelson bench"`

Expected:

```
PASS michelson bench: laser off gives no beam
PASS michelson bench: the aligned standard layout has equal arms, returned spots and overlapping beams
PASS michelson bench: a mirror 1 mrad off moves its returned spot and tilts its beam by 2 mrad
PASS michelson bench: reflected spots that miss the iris itself still land on the source face
PASS michelson bench: arms one hole apart lose the fringe contrast
PASS michelson bench: off the beam row the splitter is missed
PASS michelson bench: lenses about f from their mirrors give rings when their distances differ
PASS michelson bench: the card on the reflected row reports its distance; an uncorrected splitter makes the spot drift
SUMMARY passed=8 failed=0
```

- [ ] **Step 5: Commit**

Run:

```bash
git add js/michelson/bench.js tests/michelson/fixtures.js tests/michelson/bench.test.js tests/all.js
git commit -F - <<'EOF'
feat(michelson): trace the interferometer and render its fringes

Poses with hand errors, knobs and the M1 stage; arms, reflected spots on
the source face, the alignment card, and the fringe image on the screen
(Michelson spec §4).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 5: Procedure: steps, checks, flow and warnings

**Files:**
- Create: `js/michelson/steps.js`
- Test: `tests/michelson/steps.test.js`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: Task 3 `MI, atStageEdge`; Task 4 results (`bsHit, reflected, arms, iris.spots, cardOn, fringe`).
- Produces: `reflectedErrors(direction)`, `STEPS` (ids `miStart, mi1, mi2, mi3, mi4, miDone`, each `{id, parts, controls, insets, camera, checks: [{id, test(state, result, flow)}], hints, questions}`), `STEP_LABELS`, `createFlow()` (`{index, stepStart, hintsShown, tipOn, guideOn, warningsShown, active, trials: {min, max}}`), `currentStep`, `evaluateChecks`, `canAdvance`, `advance`, `revealHint(flow, hasTip)`, `guideAvailable`, `toggleGuide`, `guideFor(id, stepId)`, `isPartUnlocked`, `lockedPartStepLabel`, `unlockedControls`, `observe(flow, result)`, `detectWarnings(flow, prev, next, result) → {flow, shown}` (warning ids `miBs`, `miStage`). Control ids: `laser.power`, `iris.opening`, `<part>.place`, `bs.rotation`, `bs.tilt`, `m1.h`, `m1.v`, `m1.stage`, `m2.h`, `m2.v`, `tap`.

- [ ] **Step 1: Write the failing test**

Create `tests/michelson/steps.test.js`:

```js
import { test, assert, assertEqual } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';
import * as F from '../../js/michelson/steps.js';
import { michelsonBench } from '../../js/michelson/bench.js';
import { aligned } from './fixtures.js';

const flowAt = (id) => ({ ...F.createFlow(), index: F.STEPS.findIndex((s) => s.id === id) });
const passes = (flow, state, id) => F.evaluateChecks(flow, state, michelsonBench(state)).find((c) => c.id === id).pass;
const checkIds = (id) => F.STEPS.find((s) => s.id === id).checks.map((c) => c.id).join();

test('michelson steps: step 1 needs the reflected beam along a hole row and the card tried near and far', () => {
  assertEqual(checkIds('mi1'), 'irisClosed,bsOnBeam,along,cardTested');
  const s = aligned(1, { parts: ['bs'], opening: MI.iris.openingMin });
  let flow = flowAt('mi1');
  for (const x of [0.1, 0.3]) flow = F.observe(flow, michelsonBench(S.placePart(s, 'screen', { x, z: 0.3 }, 6)));
  assert(F.canAdvance(flow, s, michelsonBench(s)), JSON.stringify(F.evaluateChecks(flow, s, michelsonBench(s))));
  const once = F.observe(flowAt('mi1'), michelsonBench(S.placePart(s, 'screen', { x: 0.1, z: 0.3 }, 6)));
  assert(!passes(once, s, 'cardTested'), 'one position is not enough');
  assert(!passes(flow, S.setValue(s, 'parts.bs.rotation', s.parts.bs.rotation + 1e-3), 'along'), 'reflected beam 2 mrad off its row');
  assert(!passes(flow, S.setValue(s, 'iris.opening', 0.012), 'irisClosed'));
  assertEqual(F.observe(flowAt('mi2'), michelsonBench(S.placePart(s, 'screen', { x: 0.1, z: 0.3 }, 6))).trials.max, -Infinity, 'only step 1 records card trials');
});

test('michelson steps: step 2 needs equal arms and both reflected spots on the iris hole', () => {
  assertEqual(checkIds('mi2'), 'onBeams,equalArms,returned');
  const s = aligned(1, { opening: MI.iris.openingMin });
  const flow = flowAt('mi2');
  assert(F.canAdvance(flow, s, michelsonBench(s)), JSON.stringify(F.evaluateChecks(flow, s, michelsonBench(s))));
  assert(!passes(flow, S.placePart(s, 'm2', { x: 0.225, z: 0.3 }), 'equalArms'), 'M2 one hole farther');
  assert(!passes(flow, S.setValue(s, 'parts.m1.h', s.parts.m1.h + 1e-3), 'returned'), 'M1 1 mrad off');
  assert(!passes(flow, S.removePart(s, 'm2'), 'onBeams'), 'M2 missing');
});

test('michelson steps: step 3 needs visible, broad straight fringes on the screen', () => {
  assertEqual(checkIds('mi3'), 'irisOpen,screenOut,overlap,visible,spacing');
  const parallel = aligned();
  const flow = flowAt('mi3');
  assert(!passes(flow, parallel, 'spacing'), 'exactly parallel beams show no fringes');
  const tilted = S.setValue(parallel, 'parts.m1.h', parallel.parts.m1.h + 0.1e-3);
  assert(F.canAdvance(flow, tilted, michelsonBench(tilted)), JSON.stringify(F.evaluateChecks(flow, tilted, michelsonBench(tilted))));
  const far = S.placePart(tilted, 'm2', { x: 0.225, z: 0.3 });
  assert(!passes(flow, far, 'visible'), 'arms one hole apart: no contrast');
});

test('michelson steps: step 4 needs a lens about f from each mirror, at different distances', () => {
  assertEqual(checkIds('mi4'), 'lensesIn,focusOnMirror,rings');
  const same = aligned(1, { parts: ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2'] });
  const flow = flowAt('mi4');
  assert(!passes(flow, same, 'rings'), 'equal distances give no rings');
  const rings = S.movePartBy(same, 'lens2', 0, -0.001);
  assert(F.canAdvance(flow, rings, michelsonBench(rings)), JSON.stringify(F.evaluateChecks(flow, rings, michelsonBench(rings))));
  assert(!passes(flow, S.movePartBy(rings, 'lens1', -0.025, 0), 'focusOnMirror'), 'a lens 125 mm from its mirror');
});

test('michelson steps: warnings fire and re-arm; parts unlock in order', () => {
  const s0 = aligned();
  const r = michelsonBench(s0);
  const moved = S.setValue(s0, 'parts.bs.rotation', s0.parts.bs.rotation + 1e-3);
  let out = F.detectWarnings(flowAt('mi2'), s0, moved, r);
  assertEqual(out.shown.join(), 'miBs');
  out = F.detectWarnings(out.flow, moved, S.setValue(moved, 'parts.bs.rotation', 0), r);
  assertEqual(out.shown.length, 0, 'the same adjustment');
  assertEqual(F.detectWarnings(flowAt('mi1'), s0, moved, r).shown.length, 0, 'the splitter is adjusted freely in step 1');
  assertEqual(F.detectWarnings(flowAt('mi3'), s0, S.setValue(s0, 'parts.m1.stage', 0), r).shown.join(), 'miStage');
  assert(!F.isPartUnlocked(flowAt('miStart'), 'bs') && F.isPartUnlocked(flowAt('mi1'), 'screen'), 'beam splitter and screen in step 1');
  assert(!F.isPartUnlocked(flowAt('mi1'), 'm1') && F.isPartUnlocked(flowAt('mi2'), 'm2'), 'mirrors in step 2');
  assertEqual(F.lockedPartStepLabel('lens1'), '4');
  const { current, earlier } = F.unlockedControls(flowAt('mi3'));
  assert(current.includes('m1.stage') && earlier.includes('bs.rotation'), 'current and earlier controls');
});

test('michelson steps: hints, tip and layout guide', () => {
  let flow = flowAt('mi1');
  flow = F.revealHint(flow, true);
  assert(flow.tipOn && flow.hintsShown === 0, 'the first press shows the tip');
  for (let i = 0; i < 5; i++) flow = F.revealHint(flow, true);
  assertEqual(flow.hintsShown, 4);
  assert(F.guideAvailable(flow), 'the guide comes after the last hint');
  assert(F.toggleGuide(flow).guideOn);
  assert(!F.advance(F.toggleGuide(flow), aligned(), 0).guideOn, 'a new step starts without the guide');
  assertEqual(F.guideFor('screen', 'mi1'), MI.guide.card, 'in step 1 the screen goes on the reflected row');
  assertEqual(F.guideFor('screen', 'mi3'), MI.guide.screen, 'later at the output');
});

// Play every step with ideal actions computed from the hidden errors: every random start must be solvable.
function solve(seed) {
  let state = S.createMichelsonState(seed);
  let flow = F.createFlow();
  const finish = (id) => {
    const result = michelsonBench(state);
    assertEqual(F.currentStep(flow).id, id);
    const failing = F.evaluateChecks(flow, state, result).filter((c) => !c.pass).map((c) => c.id);
    assert(failing.length === 0, `seed ${seed}, step ${id}: failing ${failing.join(', ')}`);
    flow = F.advance(flow, state, 0);
  };
  const act = (next) => {
    state = next;
    flow = F.observe(flow, michelsonBench(state));
  };
  const g = MI.guide;
  act(S.setLaserOn(state, true));
  finish('miStart');

  act(S.setValue(state, 'iris.opening', MI.iris.openingMin));
  act(S.placePart(state, 'bs', g.bs.pos, g.bs.heading));
  act(S.setValue(state, 'parts.bs.rotation', -state.hidden.bsHeading));
  act(S.setValue(state, 'parts.bs.tilt', -state.hidden.bsTilt));
  act(S.placePart(state, 'screen', { x: 0.1, z: 0.3 }, 6));
  act(S.placePart(state, 'screen', { x: 0.3, z: 0.3 }, 6));
  finish('mi1');

  for (const m of ['m1', 'm2']) {
    act(S.placePart(state, m, g[m].pos, g[m].heading));
    act(S.setValue(state, `parts.${m}.h`, -state.hidden[`${m}H`]));
    act(S.setValue(state, `parts.${m}.v`, -state.hidden[`${m}V`]));
  }
  finish('mi2');

  act(S.setValue(state, 'iris.opening', MI.iris.openingMax));
  act(S.placePart(state, 'screen', g.screen.pos, g.screen.heading));
  act(S.setValue(state, 'parts.m1.h', state.parts.m1.h + 0.1e-3));
  finish('mi3');

  act(S.placePart(state, 'lens1', g.lens1.pos, g.lens1.heading));
  act(S.placePart(state, 'lens2', g.lens2.pos, g.lens2.heading));
  act(S.movePartBy(state, 'lens2', 0, -0.001));
  finish('mi4');
  assertEqual(F.currentStep(flow).id, 'miDone');
}

test('michelson steps: ideal actions complete every step for several random starts', () => {
  for (const seed of [1, 2, 3, 4, 5]) solve(seed);
});
```

In `tests/all.js`, replace (register the new test file):

```js
import './michelson/bench.test.js';
```

with:

```js
import './michelson/bench.test.js';
import './michelson/steps.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "michelson steps"`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Write the steps module**

Create `js/michelson/steps.js`:

```js
// Michelson procedure (handout 實驗十六 §4 steps 3, 4 and 6, the way the lab does them): steps, checks, hints,
// card trials and warnings (spec §3.5–3.7). Pure logic.
import { MI } from './config.js';
import { atStageEdge } from './state.js';

const C = MI.checks;

// How far the reflected beam is off a hole row across the table: horizontally (from ±x) and from level.
export function reflectedErrors(direction) {
  return { horizontal: Math.atan2(Math.abs(direction.z), Math.abs(direction.x)), vertical: Math.abs(Math.asin(direction.y)) };
}

// One lens in each arm, each a different lens, each centred on its beam.
function lensPerArm(r) {
  const { T, R } = r.arms;
  if (!T?.mirror || !R?.mirror || T.lenses.length !== 1 || R.lenses.length !== 1) return false;
  return T.lenses[0].id !== R.lenses[0].id && [T, R].every((arm) => arm.lenses[0].offset <= C.mi4.lensCentreTol);
}

const fringe = (r, test) => r.fringe !== null && test(r.fringe);

export const STEPS = Object.freeze([
  {
    id: 'miStart',
    parts: [],
    controls: ['laser.power'],
    insets: ['iris'],
    camera: 'source',
    checks: [{ id: 'on', test: (s) => s.laser.on }],
    hints: 1,
    questions: [],
  },
  {
    id: 'mi1',
    parts: ['bs', 'screen'],
    controls: ['iris.opening', 'bs.place', 'bs.rotation', 'bs.tilt', 'screen.place'],
    insets: ['iris', 'screen'],
    camera: 'bs',
    checks: [
      { id: 'irisClosed', test: (s) => s.iris.opening <= C.mi1.irisClosedMax },
      { id: 'bsOnBeam', test: (s, r) => r.bsHit !== null && r.bsHit.offset <= C.mi1.bsCentreTol },
      {
        id: 'along',
        test: (s, r) => {
          if (!r.reflected) return false;
          const e = reflectedErrors(r.reflected);
          return e.horizontal <= C.mi1.angleTol && e.vertical <= C.mi1.angleTol;
        },
      },
      { id: 'cardTested', test: (s, r, flow) => flow.trials.max - flow.trials.min >= C.mi1.cardSpan },
    ],
    hints: 4,
    questions: [],
  },
  {
    id: 'mi2',
    parts: ['m1', 'm2'],
    controls: ['m1.place', 'm1.h', 'm1.v', 'm2.place', 'm2.h', 'm2.v'],
    insets: ['iris', 'screen'],
    camera: 'overview',
    checks: [
      {
        id: 'onBeams',
        test: (s, r) => {
          const { T, R } = r.arms;
          return Boolean(T?.mirror && R?.mirror) && T.mirror !== R.mirror
            && T.offset <= C.mi2.mirrorCentreTol && R.offset <= C.mi2.mirrorCentreTol;
        },
      },
      { id: 'equalArms', test: (s, r) => Boolean(r.arms.T?.mirror && r.arms.R?.mirror) && Math.abs(r.arms.T.length - r.arms.R.length) <= C.mi2.armTol },
      {
        id: 'returned',
        test: (s, r) => s.iris.opening <= C.mi1.irisClosedMax
          && ['m1', 'm2'].every((m) => r.iris.spots.some((p) => p.mirror === m && Math.hypot(p.dx, p.dy) <= C.mi2.returnTol)),
      },
    ],
    hints: 4,
    questions: [],
  },
  {
    id: 'mi3',
    parts: [],
    controls: ['iris.opening', 'screen.place', 'm1.h', 'm1.v', 'm1.stage', 'tap'],
    insets: ['screen'],
    camera: 'screen',
    checks: [
      { id: 'irisOpen', test: (s) => s.iris.opening >= C.mi3.irisOpenMin },
      { id: 'screenOut', test: (s, r) => r.fringe !== null },
      { id: 'overlap', test: (s, r) => fringe(r, (f) => f.overlap <= C.mi3.overlapTol) },
      { id: 'visible', test: (s, r) => fringe(r, (f) => f.contrast >= C.mi3.contrastMin) },
      { id: 'spacing', test: (s, r) => fringe(r, (f) => f.spacing >= C.mi3.spacingMin && f.spacing <= C.mi3.spacingMax) },
    ],
    hints: 4,
    questions: ['mi1', 'mi2', 'mi4'],
  },
  {
    id: 'mi4',
    parts: ['lens1', 'lens2'],
    controls: ['lens1.place', 'lens2.place', 'tap'],
    insets: ['screen'],
    camera: 'overview',
    checks: [
      { id: 'lensesIn', test: (s, r) => lensPerArm(r) },
      {
        id: 'focusOnMirror',
        test: (s, r) => lensPerArm(r)
          && [r.arms.T, r.arms.R].every((arm) => Math.abs(arm.lenses[0].toMirror - MI.lens.focalLength) <= C.mi4.focusTol),
      },
      { id: 'rings', test: (s, r) => fringe(r, (f) => f.rings >= C.mi4.ringsMin && f.centred) },
    ],
    hints: 4,
    questions: ['mi3', 'mi5'],
  },
  { id: 'miDone', parts: [], controls: [], insets: ['screen'], camera: 'overview', checks: [], hints: 0, questions: [] },
]);

export const STEP_LABELS = Object.freeze({ miStart: 'start', mi1: '1', mi2: '2', mi3: '3', mi4: '4', miDone: 'done' });

const noTrials = () => ({ min: Infinity, max: -Infinity });

export function createFlow() {
  return { index: 0, stepStart: { time: 0 }, hintsShown: 0, tipOn: false, guideOn: false, warningsShown: 0, active: {}, trials: noTrials() };
}

export const currentStep = (flow) => STEPS[flow.index];

export function evaluateChecks(flow, state, result) {
  return currentStep(flow).checks.map((c) => ({ id: c.id, pass: Boolean(c.test(state, result, flow)) }));
}

export function canAdvance(flow, state, result) {
  return flow.index < STEPS.length - 1 && evaluateChecks(flow, state, result).every((c) => c.pass);
}

export function advance(flow, state, now = 0) {
  return {
    ...flow,
    index: Math.min(STEPS.length - 1, flow.index + 1),
    stepStart: { time: now },
    hintsShown: 0,
    tipOn: false,
    guideOn: false,
    active: {},
    trials: noTrials(),
  };
}

// The first press shows the tip about what is wrong now (when there is one); later presses show the hints in order.
export function revealHint(flow, hasTip) {
  if (hasTip && !flow.tipOn) return { ...flow, tipOn: true };
  return { ...flow, hintsShown: Math.min(currentStep(flow).hints, flow.hintsShown + 1) };
}

export const guideAvailable = (flow) => currentStep(flow).hints > 0 && flow.hintsShown >= currentStep(flow).hints;

export const toggleGuide = (flow) => ({ ...flow, guideOn: !flow.guideOn });

// Where the layout guide (and the panel's Place button) puts a part: in step 1 the screen is the alignment card.
export function guideFor(id, stepId) {
  return id === 'screen' && stepId === 'mi1' ? MI.guide.card : MI.guide[id];
}

export function isPartUnlocked(flow, id) {
  return STEPS.slice(0, flow.index + 1).some((s) => s.parts.includes(id));
}

export function lockedPartStepLabel(id) {
  const step = STEPS.find((s) => s.parts.includes(id));
  return step ? STEP_LABELS[step.id] : '';
}

export function unlockedControls(flow) {
  const current = [...currentStep(flow).controls];
  const earlier = [...new Set(STEPS.slice(0, flow.index).flatMap((s) => s.controls))].filter((c) => !current.includes(c));
  return { current, earlier };
}

// Step 1: remember how far along the reflected beam the card has caught it.
export function observe(flow, result) {
  if (currentStep(flow).id !== 'mi1' || !result.cardOn) return flow;
  const d = result.cardOn.distance;
  if (d >= flow.trials.min && d <= flow.trials.max) return flow;
  return { ...flow, trials: { min: Math.min(flow.trials.min, d), max: Math.max(flow.trials.max, d) } };
}

// Warnings (spec §3.7). A warning shows once and re-arms when its condition stops being true.
const bsChanged = (a, b) => ['placed', 'heading', 'rotation', 'tilt'].some((k) => a[k] !== b[k]) || a.pos.x !== b.pos.x || a.pos.z !== b.pos.z;
const WARNINGS = [
  { id: 'miBs', test: (flow, prev, next) => flow.index > STEPS.findIndex((s) => s.id === 'mi1') && bsChanged(prev.parts.bs, next.parts.bs) },
  { id: 'miStage', test: (flow, prev, next) => next.parts.m1.placed && atStageEdge(next) },
];

export function detectWarnings(flow, prev, next, result) {
  const active = { ...flow.active };
  const shown = [];
  for (const w of WARNINGS) {
    const on = Boolean(w.test(flow, prev, next, result));
    if (on && !active[w.id]) shown.push(w.id);
    active[w.id] = on;
  }
  return { flow: { ...flow, active, warningsShown: flow.warningsShown + shown.length }, shown };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "michelson steps"`

Expected:

```
PASS michelson steps: step 1 needs the reflected beam along a hole row and the card tried near and far
PASS michelson steps: step 2 needs equal arms and both reflected spots on the iris hole
PASS michelson steps: step 3 needs visible, broad straight fringes on the screen
PASS michelson steps: step 4 needs a lens about f from each mirror, at different distances
PASS michelson steps: warnings fire and re-arm; parts unlock in order
PASS michelson steps: hints, tip and layout guide
PASS michelson steps: ideal actions complete every step for several random starts
SUMMARY passed=7 failed=0
```

- [ ] **Step 5: Commit**

Run:

```bash
git add js/michelson/steps.js tests/michelson/steps.test.js tests/all.js
git commit -F - <<'EOF'
feat(michelson): add the procedure, checks and warnings

Steps 1–4 as the lab does them (card slid along the hole rows, reflected
spots back on the iris, straight fringes, rings), card trials, hints with
a tip first, the layout guide, and the beam-splitter and stage warnings.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 6: Tips when lost

**Files:**
- Create: `js/michelson/tips.js`
- Test: `tests/michelson/tips.test.js`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: Task 3 `MI`; Task 5 `reflectedErrors`; Task 4 results.
- Produces: `tipFor(stepId, state, result, flow) → {key, params}|null`; keys `tip.mi1.bsOffBeam`, `tip.mi1.reflectedOff {theta}`, `tip.mi1.card`, `tip.mi2.mirrorOff {mirror, d}`, `tip.mi2.arms {n}`, `tip.mi2.spotOffH|spotOffV {mirror, d}`, `tip.mi3.contrast {dl}`, `tip.mi3.fine {s}`, `tip.mi3.parallel`, `tip.mi4.lensFar {lens, d}`, `tip.mi4.same`.

- [ ] **Step 1: Write the failing test**

Create `tests/michelson/tips.test.js`:

```js
import { test, assertEqual, assertClose } from '../harness.js';
import { MI } from '../../js/michelson/config.js';
import * as S from '../../js/michelson/state.js';
import * as F from '../../js/michelson/steps.js';
import { tipFor } from '../../js/michelson/tips.js';
import { michelsonBench } from '../../js/michelson/bench.js';
import { aligned } from './fixtures.js';

const tip = (stepId, state, flow = F.createFlow()) => tipFor(stepId, state, michelsonBench(state), flow);

test('michelson tips: step 1 — beam splitter off the beam, reflected beam off its row, card not tried', () => {
  const lit = S.setLaserOn(S.createMichelsonState(1), true);
  assertEqual(tip('mi1', lit).key, 'tip.mi1.bsOffBeam');
  const crooked = S.placePart(lit, 'bs', MI.guide.bs.pos, MI.guide.bs.heading);
  const t = tip('mi1', crooked);
  assertEqual(t.key, 'tip.mi1.reflectedOff');
  assertClose(Number(t.params.theta), 2 * Math.abs(crooked.hidden.bsHeading) * 1e3, 0.15);
  const straight = aligned(1, { parts: ['bs'] });
  assertEqual(tip('mi1', straight).key, 'tip.mi1.card');
  const tried = { ...F.createFlow(), trials: { min: 0.1, max: 0.3 } };
  assertEqual(tip('mi1', straight, tried), null);
});

test('michelson tips: step 2 — mirror off its beam, unequal arms, reflected spot off the hole', () => {
  const s = aligned();
  const off = tip('mi2', S.placePart(s, 'm2', { x: 0.2, z: 0.35 }));
  assertEqual(off.key, 'tip.mi2.mirrorOff');
  assertEqual(off.params.mirror, 'M2');
  assertClose(Number(off.params.d), 50, 0.1);
  const arms = tip('mi2', S.placePart(s, 'm2', { x: 0.225, z: 0.3 }));
  assertEqual(arms.key, 'tip.mi2.arms');
  assertEqual(arms.params.n, 1);
  const spot = tip('mi2', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 1e-3));
  assertEqual(spot.key, 'tip.mi2.spotOffH');
  assertEqual(spot.params.mirror, 'M1');
  assertEqual(tip('mi2', s), null);
});

test('michelson tips: step 3 — contrast, then too fine, then too parallel', () => {
  const s = aligned();
  assertEqual(tip('mi3', s).key, 'tip.mi3.parallel');
  assertEqual(tip('mi3', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 2e-3)).key, 'tip.mi3.fine');
  const far = tip('mi3', S.placePart(S.setValue(s, 'parts.m1.h', s.parts.m1.h + 2e-3), 'm2', { x: 0.225, z: 0.3 }));
  assertEqual(far.key, 'tip.mi3.contrast');
  assertEqual(far.params.dl, '50.0');
  assertEqual(tip('mi3', S.setValue(s, 'parts.m1.h', s.parts.m1.h + 0.1e-3)), null);
});

test('michelson tips: step 4 — a lens far from its focal distance, or both lenses at the same distance', () => {
  const s = aligned(1, { parts: ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2'] });
  assertEqual(tip('mi4', s).key, 'tip.mi4.same');
  const far = tip('mi4', S.movePartBy(s, 'lens1', -0.025, 0));
  assertEqual(far.key, 'tip.mi4.lensFar');
  assertEqual(far.params.lens, 'L1');
  assertEqual(far.params.d, '125');
  assertEqual(tip('mi4', S.movePartBy(s, 'lens2', 0, -0.001)), null);
  assertEqual(tip('mi4', S.createMichelsonState(1)), null, 'no tips with the laser off');
});
```

In `tests/all.js`, replace (register the new test file):

```js
import './michelson/steps.test.js';
```

with:

```js
import './michelson/steps.test.js';
import './michelson/tips.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "michelson tips"`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Write the tips module**

Create `js/michelson/tips.js`:

```js
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "michelson tips"`

Expected:

```
PASS michelson tips: step 1 — beam splitter off the beam, reflected beam off its row, card not tried
PASS michelson tips: step 2 — mirror off its beam, unequal arms, reflected spot off the hole
PASS michelson tips: step 3 — contrast, then too fine, then too parallel
PASS michelson tips: step 4 — a lens far from its focal distance, or both lenses at the same distance
SUMMARY passed=4 failed=0
```

- [ ] **Step 5: Commit**

Run:

```bash
git add js/michelson/tips.js tests/michelson/tips.test.js tests/all.js
git commit -F - <<'EOF'
feat(michelson): add tips about what is wrong right now

The first matching situation in the current step, with the numbers a
student can act on (Michelson spec §3.6).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 7: Michelson strings in both languages

**Files:**
- Modify: `js/i18n/zh-TW.js`
- Modify: `js/i18n/en.js`
- Modify: `tests/i18n.test.js`

**Interfaces:**
- Consumes: Task 5 `STEPS`; Task 6 tip keys.
- Produces: keys `lobby.michelson.body`, `mi.title`, `ui.camera.source|bs`, `part.bs|m1|m2|lens1|lens2|source`, `control.mi.*`, `inset.iris`, `readout.mi.contrast|spacing|rings`, `step.mi*.*`, `question.mi1…mi5`, `tip.mi*`, `warning.miBs|miStage` (94 keys in each language).

- [ ] **Step 1: Write the failing test**

In `tests/i18n.test.js`, replace:

```js
import { STEPS } from '../js/lab/steps.js';
```

with:

```js
import { STEPS } from '../js/lab/steps.js';
import { STEPS as MI_STEPS } from '../js/michelson/steps.js';
```

In `tests/i18n.test.js`, replace (add the Michelson key test before the t() test):

```js
test('i18n: t() switches language
```

with:

```js
test('i18n: every key the Michelson steps, tips and warnings use exists', () => {
  const missing = [];
  const need = (k) => {
    if (!(k in dictionaries['zh-TW'])) missing.push(k);
  };
  for (const step of MI_STEPS) {
    need(`step.${step.id}.title`);
    need(`step.${step.id}.body`);
    step.checks.forEach((c) => need(`step.${step.id}.check.${c.id}`));
    for (let i = 1; i <= step.hints; i++) need(`step.${step.id}.hint.${i}`);
    step.questions.forEach((q) => need(`question.${q}`));
    step.insets.forEach((id) => need(`inset.${id}`));
    need(`ui.camera.${step.camera}`);
  }
  ['tip.mi1.bsOffBeam', 'tip.mi1.reflectedOff', 'tip.mi1.card', 'tip.mi2.mirrorOff', 'tip.mi2.arms', 'tip.mi2.spotOffH',
    'tip.mi2.spotOffV', 'tip.mi3.fine', 'tip.mi3.parallel', 'tip.mi3.contrast', 'tip.mi4.lensFar', 'tip.mi4.same',
    'warning.miBs', 'warning.miStage', 'warning.m5'].forEach(need);
  ['bs', 'm1', 'm2', 'screen', 'lens1', 'lens2', 'source'].forEach((id) => need(`part.${id}`));
  assertEqual(missing.join(', '), '', 'missing keys');
});

test('i18n: t() switches language
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "i18n"`

Expected:

```
FAIL i18n: every key the Michelson steps, tips and warnings use exists — missing keys: expected "", got "step.miStart.title, …"
SUMMARY passed=3 failed=1
```

- [ ] **Step 3: Add the zh-TW strings**

In `js/i18n/zh-TW.js`, insert this block just before the closing `};`:

```js
  // Michelson（邁克森干涉儀）
  'lobby.michelson.body': '用分光鏡把擴束光分成兩臂，對準兩面反射鏡，在屏幕上看到直線與環狀的干涉條紋。',
  'mi.title': '邁克森干涉儀',
  'ui.camera.source': '光源',
  'ui.camera.bs': '分光鏡',
  'part.bs': '分光鏡',
  'part.m1': '反射鏡 M1',
  'part.m2': '反射鏡 M2',
  'part.lens1': '凸透鏡 L1',
  'part.lens2': '凸透鏡 L2',
  'part.source': '雷射光源',
  'control.mi.iris': '光圈孔徑',
  'control.mi.rotation': '旋轉',
  'control.mi.tilt': '俯仰',
  'control.mi.h': '水平旋鈕',
  'control.mi.v': '垂直旋鈕',
  'control.mi.stage': '測微頭',
  'control.mi.tap': '輕拍桌面',
  'control.mi.guide': '版面參考',
  'control.mi.place': '放上桌面',
  'control.mi.position': '位置',
  'control.mi.turnLeft': '左轉 45°',
  'control.mi.turnRight': '右轉 45°',
  'control.mi.towardLaser': '往雷射',
  'control.mi.awayLaser': '遠離雷射',
  'control.mi.back': '往後',
  'control.mi.front': '往前',
  'inset.iris': '光圈（返回光點）',
  'readout.mi.contrast': '條紋對比',
  'readout.mi.spacing': '條紋間距',
  'readout.mi.rings': '環數',
  'step.miStart.title': '開始',
  'step.miStart.body': '打開雷射電源。光源（雷射、空間濾波器、準直透鏡與光圈）已依實驗一對準好，會送出一道平行的擴束光。注意：任何時候都不要直視雷射光束。',
  'step.miStart.check.on': '雷射已開啟',
  'step.miStart.hint.1': '在控制區按下「雷射電源」。',
  'step.mi1.title': '步驟1　分光鏡',
  'step.mi1.body': '把光圈關到最小。光束沿著中央那排孔前進：把分光鏡放在這一排的一個孔上，轉到大約 45°，反射光就會沿著垂直的另一排孔射出。把屏幕放在那排孔上，先靠近分光鏡、再移遠，同時轉動和俯仰分光鏡，直到每個孔位上光點都停在靶心：反射光就沿著孔排前進，而且與桌面平行。穿透光則保持在光源那一排。',
  'step.mi1.check.irisClosed': '光圈孔徑 ≤ 1.5 mm',
  'step.mi1.check.bsOnBeam': '光束打在分光鏡中心（≤ 2 mm）',
  'step.mi1.check.along': '反射光沿著孔排且與桌面平行（≤ 1 mrad）',
  'step.mi1.check.cardTested': '屏幕在反射光上前後試過至少 150 mm',
  'step.mi1.hint.1': '先關小光圈；光束沿著中央那排孔走，分光鏡就放在這排的孔上。',
  'step.mi1.hint.2': '分光鏡轉到 45° 時，反射光會沿著垂直的那排孔射出。',
  'step.mi1.hint.3': '把屏幕沿著那排孔前後移動：光點左右漂移就轉動分光鏡，上下漂移就調俯仰。',
  'step.mi1.hint.4': '近處和遠處光點都停在靶心時，反射光就沿著孔排前進了。',
  'step.mi2.title': '步驟2　反射鏡',
  'step.mi2.body': '把 M1 放在穿透光那排孔上、M2 放在反射光那排孔上，兩面鏡子離分光鏡的孔數要一樣。每面鏡子放上去都有一點歪：轉動它的旋鈕，直到它的反射光點回到光圈的小孔上（光圈特寫裡標示為 1 和 2），這時光就沿原路回到雷射。',
  'step.mi2.check.onBeams': '兩臂各有一面鏡子，光打在鏡子中心（≤ 3 mm）',
  'step.mi2.check.equalArms': '兩臂一樣長（差 ≤ 12.5 mm，孔數相同）',
  'step.mi2.check.returned': '光圈仍關小，兩個反射光點都回到小孔上（≤ 0.5 mm）',
  'step.mi2.hint.1': '數一數分光鏡到兩面鏡子各有幾個孔。',
  'step.mi2.hint.2': '看光圈特寫：光點 1 是 M1 的，光點 2 是 M2 的。',
  'step.mi2.hint.3': '光點偏左右就轉那面鏡子的水平旋鈕，偏上下就轉垂直旋鈕。',
  'step.mi2.hint.4': '兩個光點都在小孔上：兩道光都沿原路回去了。',
  'step.mi3.title': '步驟3　干涉條紋',
  'step.mi3.body': '打開光圈，把屏幕放在分光鏡的第四邊、面向分光鏡，也就是兩道回來的光一起射出的地方。用微調轉動 M1 的旋鈕，直到光斑上出現幾條寬而直的條紋（兩道光完全平行時光斑是均勻的）。轉動 M1 的測微頭，條紋會移動：鏡子每移動 λ/2，條紋移動一條。',
  'step.mi3.check.irisOpen': '光圈孔徑 ≥ 8 mm',
  'step.mi3.check.screenOut': '兩道回來的光都打在屏幕上',
  'step.mi3.check.overlap': '兩個光斑重疊（中心相距 ≤ 1 mm）',
  'step.mi3.check.visible': '看得到條紋（對比 ≥ 0.5）',
  'step.mi3.check.spacing': '直條紋間距 1–5 mm',
  'step.mi3.hint.1': '先把光圈打開。',
  'step.mi3.hint.2': '合成光從分光鏡的另一邊射出，在 M2 的對面。',
  'step.mi3.hint.3': '條紋又多又細表示兩道光夾角太大：用 M1 的微調讓它們更平行。',
  'step.mi3.hint.4': '完全看不到條紋：兩道光完全平行，把 M1 稍微轉一點；或是兩臂差太多，再數一次孔。',
  'step.mi4.title': '步驟4　環狀干涉',
  'step.mi4.body': '在兩臂上各放一個 100 mm 凸透鏡（在分光鏡和反射鏡之間），沿著孔排前後移動。透鏡離鏡子大約一個焦距（10 cm）時，光會聚焦在鏡面上；當兩個透鏡離鏡子的距離稍微不同時，屏幕上就會出現環狀的干涉條紋。',
  'step.mi4.check.lensesIn': '兩臂各有一個透鏡，光打在透鏡中心（≤ 1 mm）',
  'step.mi4.check.focusOnMirror': '每個透鏡離鏡子 100 ± 10 mm',
  'step.mi4.check.rings': '至少 3 個環，環心在光斑內',
  'step.mi4.hint.1': '每臂放一個透鏡，對準光束中心。',
  'step.mi4.hint.2': '透鏡離鏡子大約 10 cm 時，焦點落在鏡面上。',
  'step.mi4.hint.3': '兩個透鏡離鏡子完全一樣遠時沒有環：把其中一個移動 1–2 mm。',
  'step.mi4.hint.4': '兩個距離差得越多，環就越多、越密。',
  'step.miDone.title': '完成',
  'step.miDone.body': '恭喜！你的架設與講義圖 16-3 相同：光源 → 分光鏡 → 兩面反射鏡 → 屏幕上的干涉條紋。',
  'question.mi1': '（講義問題1）兩束光要互相干涉需要哪些條件？',
  'question.mi2': '（講義問題2）如果兩道光完全平行、重合、方向相同，不用凸透鏡時會有干涉圖案嗎？要怎樣才能出現直線條紋？',
  'question.mi3': '（講義問題3）什麼是 Fizeau、Mach–Zehnder 和 Sagnac 干涉儀？',
  'question.mi4': '（講義問題4）輕拍桌面時，干涉圖形會怎樣變化？',
  'question.mi5': '（講義問題5，挑戰）邁克森干涉儀和 Mach–Zehnder 干涉儀有什麼不同？',
  'tip.mi1.bsOffBeam': '光束沿著中央那排孔前進，把分光鏡放在這一排的孔上。',
  'tip.mi1.reflectedOff': '反射光偏離孔排 {theta} mrad：左右偏用旋轉旋鈕，上下偏用俯仰旋鈕。',
  'tip.mi1.card': '把屏幕放在反射光那排孔上，先靠近分光鏡，再移遠至少 150 mm。',
  'tip.mi2.mirrorOff': '{mirror} 離光束 {d} mm，把它移到光束經過的那排孔上。',
  'tip.mi2.arms': '兩臂相差 {n} 個孔位，數一數孔，讓兩面鏡子離分光鏡一樣遠。',
  'tip.mi2.spotOffH': '{mirror} 的反射光點偏離光圈中心 {d} mm，調整它的水平旋鈕。',
  'tip.mi2.spotOffV': '{mirror} 的反射光點偏離光圈中心 {d} mm，調整它的垂直旋鈕。',
  'tip.mi3.fine': '條紋太密（{s} mm），用 M1 的微調讓兩道光更平行。',
  'tip.mi3.parallel': '兩道光幾乎完全平行，所以看不到條紋：把 M1 稍微轉一點。',
  'tip.mi3.contrast': '兩臂光程差 {dl} mm，超過同調長度：數孔位，或用 M1 的測微頭。',
  'tip.mi4.lensFar': '{lens} 離鏡子 {d} mm，焦點應該落在鏡面上（約 100 mm）。',
  'tip.mi4.same': '兩個透鏡離鏡子一樣遠，所以沒有環：把其中一個移 1–2 mm。',
  'warning.miBs': '分光鏡已對準，移動它會讓兩臂都要重新對準。',
  'warning.miStage': 'M1 已到微調平台的行程極限，請把整個 M1 移一個孔位。',
```

- [ ] **Step 4: Add the English strings**

In `js/i18n/en.js`, insert this block just before the closing `};`:

```js
  // Michelson
  'lobby.michelson.body': 'Split the expanded beam into two arms with a beam splitter, align the two mirrors, and see straight and ring interference fringes on the screen.',
  'mi.title': 'Michelson',
  'ui.camera.source': 'Source',
  'ui.camera.bs': 'Beam splitter',
  'part.bs': 'Beam splitter',
  'part.m1': 'Mirror M1',
  'part.m2': 'Mirror M2',
  'part.lens1': 'Lens L1',
  'part.lens2': 'Lens L2',
  'part.source': 'Light source',
  'control.mi.iris': 'Iris opening',
  'control.mi.rotation': 'Rotation',
  'control.mi.tilt': 'Tilt',
  'control.mi.h': 'Horizontal knob',
  'control.mi.v': 'Vertical knob',
  'control.mi.stage': 'Micrometer',
  'control.mi.tap': 'Tap the table',
  'control.mi.guide': 'Layout guide',
  'control.mi.place': 'Place on the table',
  'control.mi.position': 'Position',
  'control.mi.turnLeft': 'Turn left 45°',
  'control.mi.turnRight': 'Turn right 45°',
  'control.mi.towardLaser': 'Toward laser',
  'control.mi.awayLaser': 'Away from laser',
  'control.mi.back': 'Back',
  'control.mi.front': 'Front',
  'inset.iris': 'Iris (returned spots)',
  'readout.mi.contrast': 'Fringe contrast',
  'readout.mi.spacing': 'Fringe spacing',
  'readout.mi.rings': 'Rings',
  'step.miStart.title': 'Start',
  'step.miStart.body': 'Turn on the laser. The light source (laser, spatial filter, collimating lens and iris) is already aligned as in Experiment 1 and sends out a collimated, expanded beam. Never look into the laser beam.',
  'step.miStart.check.on': 'Laser is on',
  'step.miStart.hint.1': 'Press "Laser power" in the controls.',
  'step.mi1.title': 'Step 1 · Beam splitter',
  'step.mi1.body': 'Close the iris to the minimum. The beam runs along the centre hole row: put the beam splitter on a hole in that row and turn it to about 45°, so the reflected beam leaves along a perpendicular row. Put the screen on that row, first near the beam splitter, then farther away, and turn and tilt the beam splitter until the spot stays on the target centre at every hole: the reflected beam then runs along the holes, level with the table. The transmitted beam stays on the source\'s row.',
  'step.mi1.check.irisClosed': 'Iris opening ≤ 1.5 mm',
  'step.mi1.check.bsOnBeam': 'Beam on the beam splitter centre (≤ 2 mm)',
  'step.mi1.check.along': 'Reflected beam along a hole row, level with the table (≤ 1 mrad)',
  'step.mi1.check.cardTested': 'Screen tried on the reflected beam at least 150 mm apart',
  'step.mi1.hint.1': 'Close the iris first. The beam follows the centre hole row, so the beam splitter goes on a hole in that row.',
  'step.mi1.hint.2': 'At 45° the reflected beam leaves along the perpendicular hole row.',
  'step.mi1.hint.3': 'Slide the screen along that row: a spot drifting sideways means turn the beam splitter; drifting up or down means tilt it.',
  'step.mi1.hint.4': 'When the spot stays on the target centre near and far, the reflected beam runs along the holes.',
  'step.mi2.title': 'Step 2 · Mirrors',
  'step.mi2.body': 'Put M1 on the transmitted beam\'s row and M2 on the reflected beam\'s row, the same number of holes from the beam splitter. Each mirror sits slightly crooked: turn its knobs until its reflected spot comes back onto the iris hole (labelled 1 and 2 in the iris close-up); the light then goes back into the laser.',
  'step.mi2.check.onBeams': 'One mirror on each arm, hit near its centre (≤ 3 mm)',
  'step.mi2.check.equalArms': 'Arms the same length (within 12.5 mm: the same hole count)',
  'step.mi2.check.returned': 'Iris still closed; both reflected spots back on the hole (≤ 0.5 mm)',
  'step.mi2.hint.1': 'Count the holes from the beam splitter to each mirror.',
  'step.mi2.hint.2': 'Look at the iris close-up: spot 1 is M1\'s, spot 2 is M2\'s.',
  'step.mi2.hint.3': 'A spot off to one side means turn that mirror\'s horizontal knob; above or below means its vertical knob.',
  'step.mi2.hint.4': 'Both spots on the hole: both beams go back exactly the way they came.',
  'step.mi3.title': 'Step 3 · Fringes',
  'step.mi3.body': 'Open the iris and put the screen on the fourth side of the beam splitter, facing it, where both returning beams leave together. Turn M1\'s knobs in fine steps until a few broad, straight fringes cross the spot (perfectly parallel beams give a uniform spot). Turning M1\'s micrometer makes the fringes move: one fringe for every λ/2 of mirror travel.',
  'step.mi3.check.irisOpen': 'Iris opening ≥ 8 mm',
  'step.mi3.check.screenOut': 'Both returning beams on the screen',
  'step.mi3.check.overlap': 'The two spots overlap (centres within 1 mm)',
  'step.mi3.check.visible': 'Fringes visible (contrast ≥ 0.5)',
  'step.mi3.check.spacing': 'Straight-fringe spacing 1–5 mm',
  'step.mi3.hint.1': 'Open the iris first.',
  'step.mi3.hint.2': 'The combined beam leaves the beam splitter on the side opposite M2.',
  'step.mi3.hint.3': 'Many thin fringes mean the beams cross at too large an angle: make them more parallel with M1\'s fine steps.',
  'step.mi3.hint.4': 'No fringes at all: the beams are exactly parallel, so turn M1 a little; or the arms differ too much, so count the holes again.',
  'step.mi4.title': 'Step 4 · Ring fringes',
  'step.mi4.body': 'Put a 100 mm lens in each arm, between the beam splitter and the mirror, and slide it along the row. About one focal length (10 cm) from the mirror the light focuses on the mirror, and rings appear on the screen once the two lenses sit at slightly different distances.',
  'step.mi4.check.lensesIn': 'One lens in each arm, the beam within 1 mm of its centre',
  'step.mi4.check.focusOnMirror': 'Each lens 100 ± 10 mm from its mirror',
  'step.mi4.check.rings': 'At least 3 rings, centred within the spot',
  'step.mi4.hint.1': 'One lens per arm, centred on the beam.',
  'step.mi4.hint.2': 'About 10 cm from the mirror the focus lands on the mirror.',
  'step.mi4.hint.3': 'Both lenses at exactly the same distance give no rings: move one by 1–2 mm.',
  'step.mi4.hint.4': 'The bigger the difference between the two distances, the more rings.',
  'step.miDone.title': 'Done',
  'step.miDone.body': 'Well done! Your setup matches Fig. 16-3 of the handout: light source → beam splitter → two mirrors → fringes on the screen.',
  'question.mi1': '(Handout Q1) What conditions must two beams meet to interfere?',
  'question.mi2': '(Handout Q2) If the two beams are perfectly parallel, overlapping and travelling the same way, is there an interference pattern without lenses? How do you get straight fringes?',
  'question.mi3': '(Handout Q3) What are the Fizeau, Mach–Zehnder and Sagnac interferometers?',
  'question.mi4': '(Handout Q4) How does the interference pattern change when you tap the table?',
  'question.mi5': '(Handout Q5, challenge) How does the Michelson interferometer differ from the Mach–Zehnder?',
  'tip.mi1.bsOffBeam': 'The beam runs along the centre hole row: put the beam splitter on a hole in that row.',
  'tip.mi1.reflectedOff': 'The reflected beam is {theta} mrad off its hole row: use the rotation knob for sideways, the tilt knob for up and down.',
  'tip.mi1.card': 'Put the screen on the reflected beam\'s row near the beam splitter, then at least 150 mm farther.',
  'tip.mi2.mirrorOff': '{mirror} is {d} mm from the beam: move it onto the row the beam follows.',
  'tip.mi2.arms': 'The arms differ by {n} holes: count them so both mirrors are equally far from the beam splitter.',
  'tip.mi2.spotOffH': '{mirror}\'s reflected spot is {d} mm off the iris hole: turn its horizontal knob.',
  'tip.mi2.spotOffV': '{mirror}\'s reflected spot is {d} mm off the iris hole: turn its vertical knob.',
  'tip.mi3.fine': 'The fringes are too fine ({s} mm): make the beams more parallel with M1\'s fine steps.',
  'tip.mi3.parallel': 'The beams are almost exactly parallel, so there are no fringes: turn M1 a little.',
  'tip.mi3.contrast': 'The path difference is {dl} mm, more than the coherence length: count the holes, or use M1\'s micrometer.',
  'tip.mi4.lensFar': '{lens} is {d} mm from its mirror; the focus should land on the mirror (about 100 mm).',
  'tip.mi4.same': 'Both lenses are equally far from their mirrors, so there are no rings: move one by 1–2 mm.',
  'warning.miBs': 'The beam splitter is aligned; moving it means realigning both arms.',
  'warning.miStage': 'M1\'s stage is at the end of its travel: move the whole of M1 by one hole.',
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "i18n"`

Expected:

```
PASS i18n: zh-TW and en have the same keys and no empty strings
PASS i18n: every key the steps and warnings use exists
PASS i18n: every key the Michelson steps, tips and warnings use exists
PASS i18n: t() switches language, fills parameters and fills [data-i18n]
SUMMARY passed=4 failed=0
```

- [ ] **Step 6: Commit**

Run:

```bash
git add js/i18n/zh-TW.js js/i18n/en.js tests/i18n.test.js
git commit -F - <<'EOF'
feat(i18n): add the Michelson strings in zh-TW and English

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 8: Shared modules: backward-compatible extensions

**Files:**
- Modify: `js/optics/screen.js` (add `brightPixel`)
- Modify: `js/ui/insets.js` (labelled beams; `pixel` option)
- Modify: `js/ui/panel.js` (`renderTip`)
- Modify: `js/scene/beam.js` (spot normals)
- Modify: `js/scene/view.js` (custom presets; look-at point)
- Modify: `js/scene/models.js` (`createScreenModel`, export `buildLaser`)
- Test: `tests/optics/screen.test.js`, `tests/ui/insets.test.js`, `tests/ui/panel.test.js`, `tests/scene/beam-interact.test.js`, `tests/scene/scene.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `brightPixel(v)`; `drawApertureInset(canvas, {r, outer, beam | beams: [{dx, dy, radius, label}]})`; `drawScreenInset(canvas, screen, {mark, target, noLightText, pixel})`; `panel.renderTip(text|null)`; beam spots may carry `normal` (table axes); `createView(container, {presets})` and `setPreset(name, focus)` where `focus` may be a world point `{x, y, z}`; `createScreenModel({pixel})`; `buildLaser(root)` exported.

- [ ] **Step 1: Write the failing tests**

In `tests/optics/screen.test.js`, replace:

```js
  toneMap, beamColour, cardPixel, screenWindow,
```

with:

```js
  toneMap, beamColour, cardPixel, brightPixel, screenWindow,
```

Append to the end of `tests/optics/screen.test.js`:

```js

test('screen: brightPixel lights the card linearly; cardPixel is brightPixel on the log curve', () => {
  assertEqual(brightPixel(0).join(), '68,70,72');
  assertEqual(brightPixel(1)[1], 255);
  assertEqual(cardPixel(0.3).join(), brightPixel(toneMap(0.3)).join());
});
```

In `tests/ui/insets.test.js`, replace:

```js
import { renderScreen, gaussianSpotSampler } from '../../js/optics/screen.js';
```

with:

```js
import { renderScreen, gaussianSpotSampler, brightPixel } from '../../js/optics/screen.js';
```

Append to the end of `tests/ui/insets.test.js`:

```js

test('insets: an iris face shows several labelled spots; the screen close-up takes a pixel mapping', () => {
  const c = makeCanvas();
  // Spots 1.5 mm left and right: half-size 1.6·(1.5 + 0.5) = 3.2 mm → spot centres at 80 ∓ 37.5 px.
  drawApertureInset(c, { r: 0.5e-3, outer: 0.025, beams: [{ dx: -1.5e-3, dy: 0, radius: 0.5e-3, label: '1' }, { dx: 1.5e-3, dy: 0, radius: 0.5e-3, label: '2' }] });
  assert(pixel(c, 42, 80)[1] > 150 && pixel(c, 118, 80)[1] > 150, `both spots lit: ${pixel(c, 42, 80)} ${pixel(c, 118, 80)}`);
  drawApertureInset(c, { r: 0.5e-3, outer: 0.025, beam: { dx: 1.5e-3, dy: 0, radius: 0.5e-3 } });
  assert(pixel(c, 42, 80)[1] < 120, 'the single-beam form still works');
  const flat = { image: new Float32Array(16).fill(1), pixels: 4, size: 0.01, centre: { x: 0, y: 0.1 } };
  drawScreenInset(c, { window: flat }, { pixel: brightPixel });
  assert(pixel(c, 80, 80)[1] === 255, 'brightness 1 maps straight to full green');
});
```

Append to the end of `tests/ui/panel.test.js`:

```js

test('panel: a tip line shows under the hint button and hides again', () => {
  const root = mount();
  const panel = createPanel(root, { t, onNext() {}, onHint() {}, onRestart() {} });
  const tip = root.querySelector('.tip');
  assert(tip.hidden, 'hidden at first');
  panel.renderTip('M2 is 40 mm from the beam');
  assert(!tip.hidden && tip.textContent === 'M2 is 40 mm from the beam', 'shown');
  panel.renderTip(null);
  assert(tip.hidden, 'hidden again');
  root.remove();
});
```

Append to the end of `tests/scene/beam-interact.test.js`:

```js

test('scene: a spot with a surface normal faces along it, just in front of the surface', () => {
  const scene = new THREE.Scene();
  const beam = createBeamView(scene);
  beam.update({ laserOn: true, segments: [], spots: [{ z: 0.3, x: -0.25, y: 0.1, radius: 2e-3, power: 0.25, normal: { x: 1, y: 0, z: 0 } }] });
  const disc = beam.group.children[0];
  assertClose(disc.position.z, -0.25 + 0.0012, 1e-9, 'offset toward +x (world Z)');
  assertClose(disc.position.x, 0.3, 1e-9);
  const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(disc.quaternion);
  assertClose(facing.z, 1, 1e-9, 'faces table +x');
});
```

In `tests/scene/scene.test.js`, replace:

```js
import { buildBench, createPartModel, rackSlot } from '../../js/scene/models.js';
```

with:

```js
import { buildBench, createPartModel, rackSlot, createScreenModel, buildLaser } from '../../js/scene/models.js';
```

Append to the end of `tests/scene/scene.test.js`:

```js

test('scene: custom camera presets, and looking at a given point', () => {
  const host = document.createElement('div');
  host.style.cssText = 'width:800px;height:600px;position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const presets = { overview: { position: [1, 1, 1], target: [0, 0, 0], halfWidth: 0 }, close: { position: [0.2, 0.3, 0.4], target: [0.1, 0.1, 0.1], halfWidth: 0 } };
  const view = createView(host, { presets });
  view.setPreset('close');
  assertClose(view.controls.target.x, 0.1, 1e-12);
  view.setPreset('close', { x: 0.5, y: 0.1, z: -0.2 });
  assertClose(view.controls.target.z, -0.2, 1e-12);
  assertClose(view.camera.position.x - view.controls.target.x, 0.1, 1e-9, 'same offset, new target');
  view.dispose();
  host.remove();
});

test('scene: the screen card takes a pixel mapping; the laser model can be built on its own', () => {
  const screen = createScreenModel({ pixel: () => [200, 10, 10] });
  screen.update({ placed: true }, { cardImage: new Float32Array(CONFIG.screen.cardPixels ** 2) });
  const canvas = screen.group.getObjectByName('card').material.map.image;
  const [r, g] = canvas.getContext('2d').getImageData(20, 20, 1, 1).data;
  assert(r > 150 && g < 50, `painted with the given mapping: ${r},${g}`);
  const laser = buildLaser(new THREE.Group());
  laser.update({ height: 0.1 });
  assertEqual(laser.group.name, 'laser');
});
```

In `tests/scene/scene.test.js`, replace:

```js
import { test, assert, assertEqual, assertClose } from '../harness.js';
```

with:

```js
import * as THREE from 'three';
import { test, assert, assertEqual, assertClose } from '../harness.js';
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `python tools/run_tests.py`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Extend the shared modules**

In `js/optics/screen.js`, replace:

```js
// A white card in a dim lab, lit by the green beam.
export function cardPixel(relative) {
  const [r, g, b] = beamColour(toneMap(relative));
  return [Math.min(255, CARD_BASE[0] + r), Math.min(255, CARD_BASE[1] + g), Math.min(255, CARD_BASE[2] + b)];
}
```

with:

```js
// A white card in a dim lab, lit to brightness v (0–1) with no tone curve (the Michelson fringes).
export function brightPixel(v) {
  const [r, g, b] = beamColour(v);
  return [Math.min(255, CARD_BASE[0] + r), Math.min(255, CARD_BASE[1] + g), Math.min(255, CARD_BASE[2] + b)];
}

// A white card in a dim lab, lit by the green beam (relative intensity through the log tone curve).
export function cardPixel(relative) {
  return brightPixel(toneMap(relative));
}
```

In `js/ui/insets.js`, replace:

```js
// An iris or ring face: plate, hole and the beam's light where it lands (metres, relative to the hole centre).
// Brightness uses a square-root curve rather than the screen's log curve, so the brightest part of a beam that
// overfills the plate (the expanded beam in step 2b) still shows where its centre is.
export function drawApertureInset(canvas, { r, outer, beam }) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const half = Math.min(0.04, Math.max(0.003, 2.5 * r, beam ? 1.6 * (Math.hypot(beam.dx, beam.dy) + beam.radius) : 0));
```

with:

```js
// An iris or ring face: plate, hole and the light of one `beam` or several labelled `beams` where they land
// (metres, relative to the hole centre). Brightness uses a square-root curve rather than the screen's log curve, so
// the brightest part of a beam that overfills the plate (the expanded beam in step 2b) still shows where its centre is.
export function drawApertureInset(canvas, { r, outer, beam = null, beams = beam ? [beam] : [] }) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const reach = Math.max(0, ...beams.map((b) => 1.6 * (Math.hypot(b.dx, b.dy) + b.radius)));
  const half = Math.min(0.04, Math.max(0.003, 2.5 * r, reach));
```

In `js/ui/insets.js`, replace:

```js
      let light = 0;
      if (beam) {
        const dx = x - beam.dx;
        const dy = y - beam.dy;
        light = Math.exp((-2 * (dx * dx + dy * dy)) / (beam.radius * beam.radius));
        if (rho <= r) light *= 0.25;          // light going through the hole barely shows on this face
        else if (rho > outer) light *= 0.1;
      }
```

with:

```js
      let light = 0;
      for (const b of beams) {
        const dx = x - b.dx;
        const dy = y - b.dy;
        light += Math.exp((-2 * (dx * dx + dy * dy)) / (b.radius * b.radius));
      }
      if (rho <= r) light *= 0.25;            // light going through the hole barely shows on this face
      else if (rho > outer) light *= 0.1;
```

In `js/ui/insets.js`, replace:

```js
  ctx.arc(width / 2, height / 2, Math.max(1, r * scale), 0, 2 * Math.PI);
  ctx.stroke();
  drawScaleBar(ctx, width, height, half);
}
```

with:

```js
  ctx.arc(width / 2, height / 2, Math.max(1, r * scale), 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  for (const b of beams) {
    if (b.label) ctx.fillText(b.label, width / 2 + b.dx * scale + 5, height / 2 - b.dy * scale - 5);
  }
  drawScaleBar(ctx, width, height, half);
}
```

In `js/ui/insets.js`, replace:

```js
export function drawScreenInset(canvas, screen, { mark = null, target = null, noLightText = '—' } = {}) {
```

with:

```js
export function drawScreenInset(canvas, screen, { mark = null, target = null, noLightText = '—', pixel = cardPixel } = {}) {
```

In `js/ui/insets.js`, replace:

```js
    const [r, g, b] = cardPixel(image[i]);
    data.data[4 * i] = r;
```

with:

```js
    const [r, g, b] = pixel(image[i]);
    data.data[4 * i] = r;
```

In `js/ui/panel.js`, replace:

```js
      <button type="button" class="hint-btn"></button>
      <ol class="hints"></ol>
```

with:

```js
      <button type="button" class="hint-btn"></button>
      <p class="tip" hidden></p>
      <ol class="hints"></ol>
```

In `js/ui/panel.js`, replace:

```js
    setMoreVisible(visible) {
      q('.controls-more').hidden = !visible;
    },
```

with:

```js
    setMoreVisible(visible) {
      q('.controls-more').hidden = !visible;
    },
    // A tip about what is wrong right now (Michelson), or null to hide it.
    renderTip(text) {
      q('.tip').hidden = !text;
      q('.tip').textContent = text || '';
    },
```

In `js/scene/beam.js`, replace:

```js
const MIN_RADIUS = 0.0006;
const UP = new THREE.Vector3(0, 1, 0);
```

with:

```js
const MIN_RADIUS = 0.0006;
const UP = new THREE.Vector3(0, 1, 0);
const FACE = new THREE.Vector3(0, 0, 1);   // a circle geometry faces +Z
```

In `js/scene/beam.js`, replace:

```js
        const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(spot.radius, 0.001), 32), glowMaterial(beamOpacity(spot.power)));
        disc.rotation.y = Math.PI / 2;
        disc.position.set(spot.z - 0.0012, spot.y, spot.x);
        group.add(disc);
```

with:

```js
        const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(spot.radius, 0.001), 32), glowMaterial(beamOpacity(spot.power)));
        if (spot.normal) {
          // A spot on a surface facing anywhere (Michelson): `normal` in table axes, toward where the light came from.
          const facing = new THREE.Vector3(spot.normal.z, spot.normal.y, spot.normal.x).normalize();
          disc.quaternion.setFromUnitVectors(FACE, facing);
          disc.position.set(spot.z, spot.y, spot.x).addScaledVector(facing, 0.0012);
        } else {
          disc.rotation.y = Math.PI / 2;
          disc.position.set(spot.z - 0.0012, spot.y, spot.x);
        }
        group.add(disc);
```

In `js/scene/view.js`, replace:

```js
export function createView(container) {
```

with:

```js
// `presets` replaces the Experiment 1 camera presets (the Michelson page has its own).
export function createView(container, { presets = PRESETS } = {}) {
```

In `js/scene/view.js`, replace:

```js
  function setPreset(name, focusX) {
    const base = PRESETS[name] ?? PRESETS.overview;
    const preset = camera.aspect < 1 && base.portrait ? base.portrait : base;
    const shift = focusX !== undefined && (name === 'filter' || name === 'screen') ? focusX - preset.target[0] : 0;
    const target = new THREE.Vector3(preset.target[0] + shift, preset.target[1], preset.target[2]);
```

with:

```js
  // `focus`: a rail z for the Experiment 1 'filter' and 'screen' presets, or a world point {x, y, z} to look at.
  function setPreset(name, focus) {
    const base = presets[name] ?? presets.overview;
    const preset = camera.aspect < 1 && base.portrait ? base.portrait : base;
    const target = new THREE.Vector3(...preset.target);
    if (focus && typeof focus === 'object') target.set(focus.x, focus.y, focus.z);
    else if (focus !== undefined && (name === 'filter' || name === 'screen')) target.x = focus;
```

In `js/scene/models.js`, replace:

```js
function buildLaser(root) {
```

with:

```js
export function buildLaser(root) {
```

In `js/scene/models.js`, replace:

```js
function paintCard(ctx, light, image, target) {
```

with:

```js
function paintCard(ctx, light, image, target, pixel) {
```

In `js/scene/models.js`, replace:

```js
    const [r, g, b] = cardPixel(image ? image[i] : 0);
    data.data[4 * i] = r;
```

with:

```js
    const [r, g, b] = pixel(image ? image[i] : 0);
    data.data[4 * i] = r;
```

In `js/scene/models.js`, replace:

```js
function buildScreen() {
  const materials = partMaterials();
```

with:

```js
// The screen card; `pixel` turns an image value into a colour (Experiment 1: relative intensity on the log curve).
export function createScreenModel({ pixel = cardPixel } = {}) {
  const materials = partMaterials();
```

In `js/scene/models.js`, replace:

```js
    paintCard(canvas.getContext('2d'), light, image, target ?? { x: 0, y: centreHeight });
```

with:

```js
    paintCard(canvas.getContext('2d'), light, image, target ?? { x: 0, y: centreHeight }, pixel);
```

In `js/scene/models.js`, replace:

```js
const BUILDERS = { a1: buildIris, a2: buildIris, sf: buildSpatialFilter, lens: buildLens, screen: buildScreen };
```

with:

```js
const BUILDERS = { a1: buildIris, a2: buildIris, sf: buildSpatialFilter, lens: buildLens, screen: () => createScreenModel() };
```

- [ ] **Step 4: Run the whole suite and make sure everything passes**

Run: `python tools/run_tests.py`

Expected:

```
SUMMARY passed=123 failed=0
```

- [ ] **Step 5: Commit**

Run:

```bash
git add js/optics/screen.js js/ui/insets.js js/ui/panel.js js/scene/beam.js js/scene/view.js js/scene/models.js tests/optics/screen.test.js tests/ui/insets.test.js tests/ui/panel.test.js tests/scene/beam-interact.test.js tests/scene/scene.test.js
git commit -F - <<'EOF'
feat: extend shared modules for the Michelson page

brightPixel; labelled iris spots and a pixel mapping in the close-ups; a
tip line in the panel; beam spots that face any way; custom camera presets
and a look-at point; a screen card with its own pixel mapping; buildLaser
exported. Experiment 1 behaviour is unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 9: 3D models and breadboard interaction

**Files:**
- Create: `js/scene/michelson-models.js`
- Create: `js/scene/table.js`
- Test: `tests/scene/michelson-scene.test.js`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: Task 3 `MI`; Task 8 `createScreenModel`, `buildLaser`, `brightPixel`; existing `createPartModel` (`js/scene/models.js`), `groundPoint` (`js/scene/interact.js`).
- Produces: `buildMichelsonTable(scene) → {root, setIris(opening)}`; `createMichelsonPart(id) → {group, update(part, look)}`; `createGhost(id)`; `yawFor(heading, extra)`; `rackSlot(id) → {x, z}` (world); `tableDrop(point) → {kind: 'table', pos}|{kind: 'rack'}|{kind: 'cancel'}`; `createTableInteraction({view, parts, canPick, onLocked, preview, onDrop, onRemove, onSelect, onTurn})`.

- [ ] **Step 1: Write the failing test**

Create `tests/scene/michelson-scene.test.js`:

```js
import * as THREE from 'three';
import { test, assert, assertEqual, assertClose } from '../harness.js';
import { createView } from '../../js/scene/view.js';
import { buildMichelsonTable, createMichelsonPart, createGhost, yawFor, rackSlot } from '../../js/scene/michelson-models.js';
import { tableDrop } from '../../js/scene/table.js';
import { createMichelsonState, PART_IDS } from '../../js/michelson/state.js';

test('michelson scene: the table, the ready source and every part build and render', () => {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px;position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const view = createView(host);
  const table = buildMichelsonTable(view.scene);
  table.setIris(1e-3);
  const parts = createMichelsonState(1).parts;
  for (const id of PART_IDS) {
    const model = createMichelsonPart(id);
    view.scene.add(model.group);
    const slot = rackSlot(id);
    model.group.position.set(slot.x, 0, slot.z);
    model.update(parts[id], { locked: id === 'lens1', selected: id === 'bs', cardImage: null });
    assertEqual(model.group.userData.partId, id);
    view.scene.add(createGhost(id));
  }
  view.renderOnce();
  assert(view.renderer.info.render.calls > 20, `draw calls ${view.renderer.info.render.calls}`);
  view.dispose();
  host.remove();
});

test('michelson scene: headings turn models built facing the laser; M1 rides its stage', () => {
  const facing = (heading) => new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawFor(heading));
  assertClose(facing(4).x, -1, 1e-12, 'heading 4 faces the laser (−X)');
  assertClose(facing(2).z, 1, 1e-12, 'heading 2 faces table +x (world +Z)');
  assertClose(facing(6).z, -1, 1e-12, 'heading 6 faces table −x');
  const m1 = createMichelsonPart('m1');
  m1.update({ ...createMichelsonState(1).parts.m1, stage: 0.0225 }, {});
  const head = m1.group.children[0];
  assertClose(head.position.x, 0.01, 1e-12, 'stage 22.5 mm moves the mirror 10 mm back');
});

test('michelson scene: pointer drops land on the table, on the rack, or nowhere', () => {
  const onTable = tableDrop({ x: 0.3, z: 0.1 });
  assertEqual(onTable.kind, 'table');
  assertClose(onTable.pos.z, 0.3, 1e-12, 'world X is table z');
  assertClose(onTable.pos.x, 0.1, 1e-12, 'world Z is table x');
  assertEqual(tableDrop({ x: 0.3, z: -0.5 }).kind, 'rack');
  assertEqual(tableDrop({ x: 0.3, z: 0.6 }).kind, 'cancel');
  assertEqual(tableDrop(null).kind, 'cancel');
});
```

In `tests/all.js`, replace (register the new test file):

```js
import './scene/beam-interact.test.js';
```

with:

```js
import './scene/beam-interact.test.js';
import './scene/michelson-scene.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "michelson scene"`

Expected:

```
FAIL (load error) Failed to fetch dynamically imported module: http://127.0.0.1:<port>/tests/all.js
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Write the models**

Create `js/scene/michelson-models.js`:

```js
// three.js models for the Michelson page: the breadboard with the ready source, the parts students place, and the
// layout-guide outlines. World axes as Experiment 1: X = table z (along the source beam), Y = height, Z = table x.
import * as THREE from 'three';
import { MI } from '../michelson/config.js';
import { CONFIG } from '../optics/config.js';
import { brightPixel } from '../optics/screen.js';
import { createPartModel, createScreenModel, buildLaser } from './models.js';

const standard = (options) => new THREE.MeshStandardMaterial(options);
const SHARED = {
  table: standard({ color: 0x1d2025, roughness: 0.85, metalness: 0.1 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x0b0c0e }),
  rail: standard({ color: 0x3b3f47, roughness: 0.6, metalness: 0.5 }),
  rack: standard({ color: 0x34383f, roughness: 0.7, metalness: 0.2 }),
};

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function cylinder(radius, height, material, segments = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
}

// A cylinder lying along X (an optic facing ±X, a knob or a micrometer barrel).
function cylinderX(radius, length, material, segments = 32) {
  const mesh = cylinder(radius, length, material, segments);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

// A post from the table up to `top`, at local x.
function post(material, top, x = 0) {
  const mesh = cylinder(0.006, top, material);
  mesh.position.set(x, top / 2, 0);
  return mesh;
}

// The three.js yaw that turns a model built facing world −X (toward the laser) to face `heading` (+ `extra` rad).
export function yawFor(heading, extra = 0) {
  return Math.PI - (heading * Math.PI) / 4 - extra;
}

function partMaterials() {
  return {
    anodised: standard({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
    post: standard({ color: 0xb9bec7, roughness: 0.35, metalness: 0.8 }),
    silver: standard({ color: 0xe8ecf2, roughness: 0.05, metalness: 1, side: THREE.DoubleSide }),
    knurl: standard({ color: 0xc8cbd0, roughness: 0.6, metalness: 0.5 }),
  };
}

function applyLook(materials, { locked = false, selected = false } = {}) {
  for (const m of Object.values(materials)) {
    m.transparent = locked;
    m.opacity = locked ? 0.35 : 1;
    m.emissive.setHex(selected ? 0x0a4a5c : 0x000000);
  }
}

const glass = (opacity, color = 0xccffff, metalness = 0) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness, transparent: true, opacity, side: THREE.DoubleSide });

export function buildMichelsonTable(scene) {
  const root = new THREE.Group();
  root.name = 'table';
  const T = MI.table;
  const top = box(T.zMax - T.zMin, 0.03, T.xMax - T.xMin, SHARED.table);
  top.position.set((T.zMax + T.zMin) / 2, -0.015, (T.xMax + T.xMin) / 2);
  root.add(top);

  const zs = [];
  const xs = [];
  for (let z = T.holeZ0; z < T.zMax; z += T.pitch) zs.push(z);
  for (let x = T.holeX0; x < T.xMax; x += T.pitch) xs.push(x);
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.003, 12), SHARED.hole, zs.length * xs.length);
  const matrix = new THREE.Matrix4();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  let index = 0;
  for (const z of zs) {
    for (const x of xs) {
      matrix.compose(new THREE.Vector3(z, 0.0005, x), flat, one);
      holes.setMatrixAt(index++, matrix);
    }
  }
  root.add(holes);

  const rack = box(1.0, 0.01, 0.08, SHARED.rack);
  rack.position.set(0.35, 0.005, T.xMin - 0.07);
  root.add(rack);

  // The ready source on row x = 0: laser, spatial filter, collimating lens and iris on a short rail.
  const railStart = MI.source.laserZ - 0.17;
  const rail = box(MI.source.irisZ - railStart + 0.02, 0.008, 0.03, SHARED.rail);
  rail.position.set((MI.source.irisZ + railStart) / 2, 0.004, 0);
  root.add(rail);
  const laser = buildLaser(root);
  laser.update({ height: MI.beamHeight });
  laser.group.position.x = MI.source.laserZ;
  const filter = createPartModel('sf');
  filter.group.position.x = MI.source.pinholeZ;
  filter.update({ height: MI.beamHeight, objective: true, pinhole: true, focus: CONFIG.objective.focusAt, phX: 0, phY: 0 }, {});
  const lens = createPartModel('lens');
  lens.group.position.x = MI.source.lensZ;
  lens.update({ height: MI.beamHeight }, {});
  const iris = createPartModel('a2');
  iris.group.position.x = MI.source.irisZ;
  root.add(filter.group, lens.group, iris.group);
  scene.add(root);
  return {
    root,
    setIris(opening) {
      iris.update({ height: MI.beamHeight, opening }, {});
    },
  };
}

// 50:50 plate in a ring mount on a rotation stage. The plate faces ±X; the heading turns the whole group.
function buildSplitter() {
  const materials = partMaterials();
  const plateMaterial = glass(0.45, 0xbfe8ff, 0.3);
  const group = new THREE.Group();
  const holder = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(MI.bs.radius + 0.002, 0.0025, 12, 48), materials.anodised);
  ring.rotation.y = Math.PI / 2;
  holder.add(ring, cylinderX(MI.bs.radius, 0.002, plateMaterial, 48));
  holder.position.y = MI.beamHeight;
  const stage = cylinder(0.02, 0.012, materials.anodised, 32);
  stage.position.y = 0.006;
  group.add(holder, post(materials.post, MI.beamHeight - MI.bs.radius - 0.004), stage);
  return {
    group,
    update(part, look = {}) {
      holder.rotation.set(0, -part.rotation, part.tilt);   // the knobs turn and tip the plate (visual feedback)
      applyLook(materials, look);
      plateMaterial.opacity = look.locked ? 0.15 : 0.45;
    },
  };
}

// Flat mirror in a square kinematic mount with two knobs; M1 sits on a linear stage with a micrometer.
function buildMirror(withStage) {
  const materials = partMaterials();
  const group = new THREE.Group();
  const head = new THREE.Group();
  const plate = box(0.01, 0.04, 0.04, materials.anodised);
  plate.position.set(0.006, MI.beamHeight, 0);
  const surface = cylinderX(MI.mirror.radius, 0.004, materials.silver, 40);
  surface.position.set(-0.001, MI.beamHeight, 0);
  const knobs = [[0.013, -0.013], [-0.013, 0.013]].map(([dy, dz]) => {
    const knob = cylinderX(0.004, 0.012, materials.knurl, 16);
    knob.position.set(0.017, MI.beamHeight + dy, dz);
    return knob;
  });
  head.add(plate, surface, ...knobs);
  group.add(head);
  if (withStage) {
    const stageTop = MI.beamHeight - 0.02;
    const stage = box(0.06, 0.015, 0.05, materials.anodised);
    stage.position.set(0.006, stageTop - 0.0075, 0);
    const barrel = cylinderX(0.004, 0.025, materials.silver, 16);
    barrel.position.set(0.05, stageTop - 0.0075, 0.012);
    const thimble = cylinderX(0.006, 0.018, materials.knurl, 24);
    thimble.position.set(0.07, stageTop - 0.0075, 0.012);
    group.add(stage, barrel, thimble, post(materials.post, stageTop - 0.015, 0.006));
  } else {
    group.add(post(materials.post, MI.beamHeight - 0.02, 0.006));
  }
  return {
    group,
    update(part, look = {}) {
      if (withStage) head.position.x = part.stage - MI.stage.initial;   // larger readings move the mirror back
      knobs[0].rotation.x = part.h * 300;   // knobs turn with their settings (visual feedback only)
      knobs[1].rotation.x = part.v * 300;
      applyLook(materials, look);
    },
  };
}

function buildBigLens() {
  const materials = partMaterials();
  const lensMaterial = glass(0.35);
  const group = new THREE.Group();
  const radius = 0.0254;
  const holder = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.003, 0.0035, 12, 56), materials.anodised);
  holder.rotation.y = Math.PI / 2;
  holder.position.y = MI.beamHeight;
  const disc = cylinderX(radius, 0.006, lensMaterial, 56);
  disc.position.y = MI.beamHeight;
  group.add(holder, disc, post(materials.post, MI.beamHeight - radius - 0.006));
  return {
    group,
    update(part, look = {}) {
      applyLook(materials, look);
      lensMaterial.opacity = look.locked ? 0.15 : 0.35;
    },
  };
}

const BUILDERS = {
  bs: buildSplitter,
  m1: () => buildMirror(true),
  m2: () => buildMirror(false),
  screen: () => createScreenModel({ pixel: brightPixel }),
  lens1: buildBigLens,
  lens2: buildBigLens,
};

export function createMichelsonPart(id) {
  const part = BUILDERS[id]();
  part.group.name = id;
  part.group.userData.partId = id;
  part.group.traverse((object) => {
    if (object.isMesh) object.userData.partId = id;
  });
  return part;
}

// A faint box the size of a part's footprint, for the layout guide.
export function createGhost(id) {
  const [along, across] = MI.footprints[id];
  const material = new THREE.MeshBasicMaterial({ color: 0x00bfff, transparent: true, opacity: 0.22, depthWrite: false });
  const ghost = box(along, 0.12, across, material);
  ghost.position.y = 0.06;
  const group = new THREE.Group();
  group.name = `guide-${id}`;
  group.add(ghost);
  return group;
}

const RACK_X = { bs: 0.0, m1: 0.15, m2: 0.3, screen: 0.5, lens1: 0.68, lens2: 0.8 };

// Where a part waits on the rack (world X, Z).
export function rackSlot(id) {
  return { x: RACK_X[id], z: MI.table.xMin - 0.07 };
}
```

- [ ] **Step 4: Write the breadboard interaction**

Create `js/scene/table.js`:

```js
// Pointer interaction on the Michelson breadboard (spec §3.4): drag parts from the rack or the table and see them
// snap where they can stand, drop them on the rack to remove them, tap-to-place, and R / Shift+R to turn the selected
// part. World axes: X = table z, Y = height, Z = table x.
import * as THREE from 'three';
import { groundPoint } from './interact.js';
import { MI } from '../michelson/config.js';

const TAP_PIXELS = 5;

// Where a pointer on the table plane (world X, Z) drops a part: on the table (table position), on the rack, or nowhere.
export function tableDrop(point) {
  if (!point) return { kind: 'cancel' };
  const pos = { x: point.z, z: point.x };
  const T = MI.table;
  if (pos.x < T.xMin && pos.x > T.xMin - 0.2) return { kind: 'rack' };
  if (pos.x >= T.xMin && pos.x <= T.xMax && pos.z >= T.zMin && pos.z <= T.zMax) return { kind: 'table', pos };
  return { kind: 'cancel' };
}

// preview(id, pos) → the snapped table position the part would take, or null if it cannot stand there.
export function createTableInteraction({ view, parts, canPick, onLocked, preview, onDrop, onRemove, onSelect, onTurn }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const canvas = view.renderer.domElement;
  let drag = null;       // { id, x, y, moved }
  let press = null;      // pointer-down on empty space: { x, y }
  let selected = null;

  function rayFrom(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, view.camera);
    return raycaster.ray;
  }

  function pick(event) {
    rayFrom(event);
    const meshes = [];
    parts.forEach((part) => part.group.traverse((object) => {
      if (object.isMesh) meshes.push(object);
    }));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.partId : null;
  }

  function dropOf(event) {
    const ray = rayFrom(event);
    return tableDrop(groundPoint(ray.origin, ray.direction));
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    const id = pick(event);
    if (!id) {
      press = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!canPick(id)) {
      onLocked(id);
      return;
    }
    drag = { id, x: event.clientX, y: event.clientY, moved: false };
    view.controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > TAP_PIXELS) drag.moved = true;
    if (!drag.moved) return;
    const group = parts.get(drag.id).group;
    const drop = dropOf(event);
    if (drop.kind === 'table') {
      const at = preview(drag.id, drop.pos) ?? drop.pos;
      group.position.set(at.z, 0, at.x);
      return;
    }
    const ray = rayFrom(event);
    const p = groundPoint(ray.origin, ray.direction);
    if (p) group.position.set(p.x, 0, p.z);
  }

  function onPointerUp(event) {
    view.controls.enabled = true;
    if (drag) {
      const { id, moved } = drag;
      drag = null;
      if (!moved) {
        selected = selected === id ? null : id;
        onSelect(selected);
        return;
      }
      const drop = dropOf(event);
      if (drop.kind === 'table') onDrop(id, drop.pos);
      else if (drop.kind === 'rack') onRemove(id);
      else onDrop(id, null);
      return;
    }
    const wasTap = press && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TAP_PIXELS;
    press = null;
    if (wasTap && selected) {
      const drop = dropOf(event);
      if (drop.kind === 'table') onDrop(selected, drop.pos);
      selected = null;
      onSelect(null);
    }
  }

  function onKeyDown(event) {
    if (!selected || (event.key !== 'r' && event.key !== 'R')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return;
    onTurn(selected, event.shiftKey ? -1 : 1);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  return {
    get selected() {
      return selected;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "michelson scene"`

Expected:

```
PASS michelson scene: the table, the ready source and every part build and render
PASS michelson scene: headings turn models built facing the laser; M1 rides its stage
PASS michelson scene: pointer drops land on the table, on the rack, or nowhere
SUMMARY passed=3 failed=0
```

- [ ] **Step 6: Commit**

Run:

```bash
git add js/scene/michelson-models.js js/scene/table.js tests/scene/michelson-scene.test.js tests/all.js
git commit -F - <<'EOF'
feat(scene): add the Michelson table, parts and breadboard dragging

The breadboard with the ready source, the beam splitter, kinematic
mirrors (M1 on its stage), 2-inch lenses and layout-guide outlines; parts
snap where they can stand while dragged, R turns the selected part.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 10: The Michelson page

**Files:**
- Create: `michelson.html`
- Create: `js/michelson-app.js`
- Create: `tests/page.js`
- Test: `tests/michelson-app.test.js`
- Modify: `tests/app.test.js` (use `tests/page.js`)
- Modify: `css/style.css`
- Modify: `tests/all.js`

**Interfaces:**
- Consumes: everything above, plus the existing `createPanel`, `createKnob`, `createSlider`, `createButton`, `showToast`, `createClock`, `formatClock`, `webglAvailable`, `randomSeed`, i18n functions.
- Produces: the page; `window.eolab = {ready, errors, t, seed, getState, getFlow, getResult, lastBenchMs, lastRenderMs}`; panel controls with `data-control` ids `laser.power`, `iris.opening`, `bs.rotation`, `bs.tilt`, `m1.h`, `m1.v`, `m1.stage`, `m2.h`, `m2.v`, `tap`, `guide`, and per part `<id>.place` groups holding `<id>.add`, `<id>.towardLaser`, `<id>.awayLaser`, `<id>.back`, `<id>.front`, `<id>.turnLeft`, `<id>.turnRight`, `<id>.remove`.

- [ ] **Step 1: Write the failing test**

Create `tests/page.js`:

```js
// Load a page in a hidden iframe and wait until its script reports ready (window.eolab.ready).
export function loadPage(src) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1200px;height:800px;position:absolute;left:-9999px;top:0;border:0';
    frame.src = src;
    document.body.appendChild(frame);
    const started = Date.now();
    const poll = () => {
      const app = frame.contentWindow && frame.contentWindow.eolab;
      if (app && app.ready) {
        resolve({ frame, app, doc: frame.contentDocument });
      } else if (app && app.errors.length) {
        reject(new Error(`page errors: ${app.errors.join(' | ')}`));
      } else if (Date.now() - started > 30000) {
        reject(new Error('page did not become ready'));
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}
```

In `tests/app.test.js`, replace (use the shared loader):

```js
import { test, assert, assertEqual } from './harness.js';

function loadPage(src) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1200px;height:800px;position:absolute;left:-9999px;top:0;border:0';
    frame.src = src;
    document.body.appendChild(frame);
    const started = Date.now();
    const poll = () => {
      const app = frame.contentWindow && frame.contentWindow.eolab;
      if (app && app.ready) {
        resolve({ frame, app, doc: frame.contentDocument });
      } else if (app && app.errors.length) {
        reject(new Error(`page errors: ${app.errors.join(' | ')}`));
      } else if (Date.now() - started > 30000) {
        reject(new Error('page did not become ready'));
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}
```

with:

```js
import { test, assert, assertEqual } from './harness.js';
import { loadPage } from './page.js';
```

Create `tests/michelson-app.test.js`:

```js
import { test, assert, assertEqual } from './harness.js';
import { loadPage } from './page.js';

test('michelson app: boots, turns the laser on and places the beam splitter from the panel', async () => {
  const { frame, app, doc } = await loadPage('../michelson.html?seed=3');
  assertEqual(app.errors.length, 0, `errors: ${app.errors.join(' | ')}`);
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.miStart.title'));
  assert(doc.querySelector('#viewport canvas'), '3D canvas created');
  assert(/^\d{2}:\d{2}$/.test(doc.querySelector('.timer').textContent), 'timer shows mm:ss');
  doc.querySelector('[data-control="laser.power"]').click();
  doc.querySelector('.next-btn').click();
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.mi1.title'));
  doc.querySelector('[data-control="bs.add"]').click();
  const { bs } = app.getState().parts;
  assert(bs.placed && bs.pos.x === 0 && bs.pos.z === 0.3, `placed at the layout-guide hole: ${JSON.stringify(bs.pos)}`);
  assert(app.getResult().bsHit, 'the beam hits it');
  doc.querySelector('[data-control="bs.awayLaser"]').click();
  assertEqual(app.getState().parts.bs.pos.z, 0.325, 'one hole farther along the beam');
  doc.querySelector('.hint-btn').click();
  assert(!doc.querySelector('.tip').hidden, 'the first hint press shows a tip');
  assertEqual(doc.querySelectorAll('.inset:not([hidden])').length, 2, 'iris and screen close-ups');
  frame.remove();
});
```

In `tests/all.js`, replace (register the page test):

```js
import './app.test.js';
```

with:

```js
import './app.test.js';
import './michelson-app.test.js';
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "michelson app"`

Expected:

```
FAIL michelson app: boots, turns the laser on and places the beam splitter from the panel — page did not become ready
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Write the page shell**

Create `michelson.html` (the same shell as `laser.html`, with its own title and script):

```html
<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EO LAB · 邁克森干涉儀</title>
  <link rel="stylesheet" href="./css/style.css">
  <script>
    window.eolab = { ready: false, errors: [] };
    window.addEventListener('error', (e) => window.eolab.errors.push(String(e.message || e)));
    window.addEventListener('unhandledrejection', (e) => window.eolab.errors.push(String((e.reason && e.reason.message) || e.reason)));
  </script>
  <script type="importmap">
    { "imports": { "three": "./js/vendor/three.module.min.js", "three/addons/": "./js/vendor/addons/" } }
  </script>
</head>
<body class="lab-page">
  <header class="topbar">
    <a class="topbar-back" href="./index.html" data-i18n="ui.back"></a>
    <ol class="progress"></ol>
    <div class="topbar-actions">
      <span class="timer" role="timer">00:00</span>
      <button type="button" class="lang-btn"></button>
      <button type="button" class="restart-btn" data-i18n="ui.restart"></button>
    </div>
  </header>
  <main class="lab">
    <div class="viewport" id="viewport"></div>
    <div class="nowebgl" hidden data-i18n="ui.noWebgl"></div>
    <div class="camera-presets" id="camera-presets"></div>
    <div class="insets" id="insets"></div>
    <aside class="panel" id="panel"></aside>
  </main>
  <script type="module" src="./js/michelson-app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write the page script**

Create `js/michelson-app.js`:

```js
// Michelson page (michelson.html): input → state → michelsonBench() → 3D table, close-ups, panel and step checks.
import { MI } from './michelson/config.js';
import { randomSeed } from './optics/rng.js';
import { brightPixel } from './optics/screen.js';
import { michelsonBench } from './michelson/bench.js';
import * as S from './michelson/state.js';
import * as F from './michelson/steps.js';
import { tipFor } from './michelson/tips.js';
import { t, getLanguage, setLanguage, onLanguageChange, applyTranslations } from './i18n/index.js';
import { createPanel } from './ui/panel.js';
import { createKnob, createSlider, createButton } from './ui/controls.js';
import { drawApertureInset, drawScreenInset } from './ui/insets.js';
import { showToast } from './ui/toast.js';
import { createClock, formatClock } from './ui/clock.js';
import { webglAvailable } from './scene/webgl.js';

const modeLabels = { fine: () => t('ui.fine'), coarse: () => t('ui.coarse') };
const partLabel = (id, key) => () => `${t(`part.${id}`)} · ${t(key)}`;
const mrad = (v) => (v * 1e3).toFixed(2);

function mirrorKnob(id, axis) {
  const M = MI.mirror;
  return { path: `parts.${id}.${axis}`, label: partLabel(id, `control.mi.${axis}`), unit: 'mrad', format: mrad, min: -M.tiltRange, max: M.tiltRange, fine: M.tiltFine, coarse: M.tiltCoarse };
}

const KNOBS = {
  'bs.rotation': { path: 'parts.bs.rotation', label: partLabel('bs', 'control.mi.rotation'), unit: 'mrad', format: mrad, min: -MI.bs.rotationRange, max: MI.bs.rotationRange, fine: MI.bs.rotationFine, coarse: MI.bs.rotationCoarse },
  'bs.tilt': { path: 'parts.bs.tilt', label: partLabel('bs', 'control.mi.tilt'), unit: 'mrad', format: mrad, min: -MI.bs.tiltRange, max: MI.bs.tiltRange, fine: MI.bs.tiltFine, coarse: MI.bs.tiltCoarse },
  'm1.h': mirrorKnob('m1', 'h'),
  'm1.v': mirrorKnob('m1', 'v'),
  'm2.h': mirrorKnob('m2', 'h'),
  'm2.v': mirrorKnob('m2', 'v'),
  'm1.stage': { path: 'parts.m1.stage', label: partLabel('m1', 'control.mi.stage'), unit: 'mm', format: (v) => (v * 1e3).toFixed(5), min: 0, max: MI.stage.travel, fine: MI.stage.fine, coarse: MI.stage.coarse },
};
const INSET_IDS = ['iris', 'screen'];
const CAMERAS = ['overview', 'source', 'bs', 'screen'];
const CARD_TARGET = { x: 0, y: MI.beamHeight };   // the target paper sits on the card centre, at beam height
// Camera presets in world coordinates (X = table z, Y = height, Z = table x); 'screen' follows the card.
const PRESETS = {
  overview: {
    position: [0.25, 1.05, 1.0], target: [0.2, 0.05, 0], halfWidth: 0.75,
    portrait: { position: [-0.55, 0.8, 0.55], target: [0.25, 0.05, 0], halfWidth: 0 },
  },
  source: { position: [0.15, 0.3, 0.35], target: [-0.08, 0.1, 0], halfWidth: 0.18 },
  bs: { position: [0.5, 0.35, 0.4], target: [0.3, 0.1, 0], halfWidth: 0.2 },
  screen: { position: [0.42, 0.28, 0.2], target: [0.3, 0.1, -0.25], halfWidth: 0.12 },
};

// ---- state ----
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : randomSeed();
let state = S.createMichelsonState(seed);
let flow = F.createFlow();
let result = michelsonBench(state);
let selectedPart = null;
let scene3d = null;
let tap = null;   // { start, offset } while the table is shaking
const clock = createClock();
const debug = window.eolab ?? (window.eolab = { errors: [] });

const panel = createPanel(document.getElementById('panel'), {
  t,
  onNext: () => {
    if (!F.canAdvance(flow, state, result)) return;
    flow = F.advance(flow, state, performance.now());
    enterStep();
  },
  onHint: () => {
    const guideBefore = F.guideAvailable(flow);
    flow = F.revealHint(flow, currentTip() !== null);
    if (F.guideAvailable(flow) !== guideBefore) buildControls();
    render();
  },
  onRestart: restart,
});

function restart() {
  if (window.confirm(t('ui.restartConfirm'))) location.search = `?seed=${randomSeed()}`;
}

const currentTip = () => tipFor(F.currentStep(flow).id, state, result, flow);

function update(next) {
  if (next !== state) {
    const prev = state;
    state = next;
    const t0 = performance.now();
    result = michelsonBench(state);
    debug.lastBenchMs = performance.now() - t0;
    const detected = F.detectWarnings(flow, prev, state, result);
    flow = F.observe(detected.flow, result);
    detected.shown.forEach((id) => showToast(t(`warning.${id}`)));
  }
  render();
}

function warnLocked(id) {
  flow = { ...flow, warningsShown: flow.warningsShown + 1 };
  showToast(t('warning.m5', { step: F.lockedPartStepLabel(id) }));
}

// ---- 3D scene (optional: the page still works without WebGL) ----
async function createScene3d() {
  const [{ createView }, models, { createBeamView }, { createTableInteraction }] = await Promise.all([
    import('./scene/view.js'),
    import('./scene/michelson-models.js'),
    import('./scene/beam.js'),
    import('./scene/table.js'),
  ]);
  const view = createView(document.getElementById('viewport'), { presets: PRESETS });
  const table = models.buildMichelsonTable(view.scene);
  const parts = new Map(S.PART_IDS.map((id) => {
    const model = models.createMichelsonPart(id);
    view.scene.add(model.group);
    return [id, model];
  }));
  const ghosts = new Map(S.PART_IDS.map((id) => {
    const ghost = models.createGhost(id);
    view.scene.add(ghost);
    return [id, ghost];
  }));
  const beam = createBeamView(view.scene);
  createTableInteraction({
    view,
    parts,
    canPick: (id) => F.isPartUnlocked(flow, id),
    onLocked: warnLocked,
    preview: (id, pos) => {
      const { heading } = state.parts[id];
      const snapped = S.snapPosition(id, heading, pos);
      return S.canStand(state, id, snapped, heading) ? snapped : null;
    },
    onDrop: (id, pos) => (pos === null ? renderScene() : update(S.placePart(state, id, pos))),
    onRemove: (id) => update(S.removePart(state, id)),
    onSelect: (id) => {
      selectedPart = id;
      renderScene();
    },
    onTurn: (id, steps) => update(S.turnPart(state, id, steps)),
  });
  view.start();
  return { view, table, parts, ghosts, beam, models };
}

function renderScene() {
  if (!scene3d) return;
  const { table, parts, ghosts, beam, models } = scene3d;
  table.setIris(state.iris.opening);
  for (const id of S.PART_IDS) {
    const part = state.parts[id];
    const model = parts.get(id);
    if (part.placed) {
      model.group.position.set(part.pos.z, 0, part.pos.x);
      model.group.rotation.y = models.yawFor(part.heading);
    } else {
      const slot = models.rackSlot(id);
      model.group.position.set(slot.x, 0, slot.z);
      model.group.rotation.y = 0;
    }
    model.update(part, {
      locked: !F.isPartUnlocked(flow, id),
      selected: selectedPart === id,
      cardImage: id === 'screen' && result.screen?.card ? result.screen.card.image : null,
      target: CARD_TARGET,
    });
  }
  const stepId = F.currentStep(flow).id;
  for (const [id, ghost] of ghosts) {
    const guide = F.guideFor(id, stepId);
    ghost.visible = flow.guideOn && (S.KINDS[id] !== 'lens' || stepId === 'mi4');
    ghost.position.set(guide.pos.z, 0, guide.pos.x);
    ghost.rotation.y = models.yawFor(guide.heading);
  }
  beam.update(result);
}

function applyCamera(name) {
  if (!scene3d) return;
  const id = name === 'bs' || name === 'screen' ? name : null;
  const part = id ? state.parts[id] : null;
  if (part?.placed && id === 'screen') {
    // Look at the card from the side it faces, from above and off to one side (clear of the arm behind the camera).
    const h = S.headingVector(part.heading);
    const side = { x: h.z, z: -h.x };
    PRESETS.screen.target = [part.pos.z, MI.beamHeight, part.pos.x];
    PRESETS.screen.position = [part.pos.z + 0.3 * h.z + 0.18 * side.z, 0.32, part.pos.x + 0.3 * h.x + 0.18 * side.x];
  }
  scene3d.view.setPreset(name, part?.placed ? { x: part.pos.z, y: MI.beamHeight, z: part.pos.x } : undefined);
}

function buildCameraButtons() {
  document.getElementById('camera-presets').replaceChildren(...CAMERAS.map((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.camera = name;
    button.addEventListener('click', () => applyCamera(name));
    return button;
  }));
}

// ---- close-ups ----
const insetVisible = new Set();
const insetParts = {};

function buildInsets() {
  const host = document.getElementById('insets');
  const toggles = document.createElement('div');
  toggles.className = 'inset-toggles';
  toggles.setAttribute('role', 'group');
  host.append(toggles);
  for (const id of INSET_IDS) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset.inset = id;
    toggle.addEventListener('click', () => {
      if (insetVisible.has(id)) insetVisible.delete(id);
      else insetVisible.add(id);
      renderInsets();
    });
    toggles.append(toggle);
    const figure = document.createElement('figure');
    figure.className = 'inset';
    figure.hidden = true;
    figure.innerHTML = '<figcaption></figcaption><canvas width="160" height="160"></canvas>';
    host.append(figure);
    insetParts[id] = { figure, toggle, canvas: figure.querySelector('canvas'), caption: figure.querySelector('figcaption') };
  }
}

function renderInsets() {
  document.querySelector('.inset-toggles').setAttribute('aria-label', t('ui.insets'));
  for (const id of INSET_IDS) {
    const { figure, toggle, canvas, caption } = insetParts[id];
    const visible = insetVisible.has(id);
    toggle.textContent = t(`inset.${id}`);
    toggle.setAttribute('aria-pressed', String(visible));
    caption.textContent = t(`inset.${id}`);
    figure.hidden = !visible;
    if (!visible) continue;
    if (id === 'iris') {
      const beams = result.iris.spots.map((s) => ({ dx: s.dx, dy: s.dy, radius: s.radius, label: s.label }));
      // The whole source face counts as plate here, so a spot that misses the iris itself still shows.
      drawApertureInset(canvas, { r: state.iris.opening / 2, outer: MI.source.stopHalf, beams });
    } else {
      drawScreenInset(canvas, result.screen?.window ? result.screen : null, { target: CARD_TARGET, noLightText: t('inset.noLight'), pixel: brightPixel });
    }
  }
}

// ---- controls ----
const widgets = new Map();

function controlEnabled(id) {
  const { parts } = state;
  switch (id) {
    case 'bs.rotation':
    case 'bs.tilt': return parts.bs.placed;
    case 'tap': return Boolean(result.screen);
    default: {
      const part = id.split('.')[0];
      return part in parts ? parts[part].placed : true;
    }
  }
}

// Move steps for the panel buttons: one hole, or 1 mm along a lens's own row.
function moveSteps(id) {
  const { heading } = state.parts[id];
  if (S.KINDS[id] !== 'lens' || heading % 2 === 1) return { dz: MI.table.pitch, dx: MI.table.pitch };
  return heading % 4 === 0 ? { dz: MI.lens.slide, dx: MI.table.pitch } : { dz: MI.table.pitch, dx: MI.lens.slide };
}

function placeFromPanel(id) {
  if (!F.isPartUnlocked(flow, id)) {
    warnLocked(id);
    return;
  }
  const guide = F.guideFor(id, F.currentStep(flow).id);
  update(S.placeNear(state, id, guide.pos, guide.heading));
}

function placementGroup(id) {
  const box = document.createElement('div');
  box.className = 'control place-group';
  box.dataset.control = `${id}.place`;
  const label = document.createElement('div');
  label.className = 'control-label';
  const row = document.createElement('div');
  row.className = 'place-row';
  const button = (key, control, onClick) => {
    const widget = createButton({ label: () => t(key), onClick });
    widget.el.dataset.control = `${id}.${control}`;
    return widget;
  };
  const add = button('control.mi.place', 'add', () => placeFromPanel(id));
  const moves = [
    button('control.mi.towardLaser', 'towardLaser', () => update(S.movePartBy(state, id, -moveSteps(id).dz, 0))),
    button('control.mi.awayLaser', 'awayLaser', () => update(S.movePartBy(state, id, moveSteps(id).dz, 0))),
    button('control.mi.back', 'back', () => update(S.movePartBy(state, id, 0, -moveSteps(id).dx))),
    button('control.mi.front', 'front', () => update(S.movePartBy(state, id, 0, moveSteps(id).dx))),
    button('control.mi.turnLeft', 'turnLeft', () => update(S.turnPart(state, id, -1))),
    button('control.mi.turnRight', 'turnRight', () => update(S.turnPart(state, id, 1))),
    button('ui.remove', 'remove', () => update(S.removePart(state, id))),
  ];
  row.append(add.el, ...moves.map((m) => m.el));
  box.append(label, row);
  widgets.set(`${id}.place`, { kind: 'place', id, label, add, moves });
  return [box];
}

const BUTTONS = {
  'laser.power': {
    label: () => `${t('control.laser.power')}: ${state.laser.on ? t('ui.on') : t('ui.off')}`,
    onClick: () => update(S.setLaserOn(state, !state.laser.on)),
  },
  tap: { label: () => t('control.mi.tap'), onClick: () => startTap() },
  guide: {
    label: () => t('control.mi.guide'),
    onClick: () => {
      flow = F.toggleGuide(flow);
      render();
    },
  },
};

function makeControl(id) {
  if (KNOBS[id]) {
    const def = KNOBS[id];
    const widget = createKnob({ ...def, value: S.getValue(state, def.path), labels: modeLabels, onChange: (v) => update(S.setValue(state, def.path, v)) });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: def.path });
    return [widget.el];
  }
  if (id === 'iris.opening') {
    const I = MI.iris;
    const widget = createSlider({
      label: () => `${t('part.source')} · ${t('control.mi.iris')}`, unit: 'mm', value: state.iris.opening, min: I.openingMin, max: I.openingMax,
      step: I.step, format: (v) => (v * 1e3).toFixed(1), onChange: (v) => update(S.setValue(state, 'iris.opening', v)),
    });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: 'iris.opening' });
    return [widget.el];
  }
  if (id.endsWith('.place')) return placementGroup(id.split('.')[0]);
  const widget = createButton(BUTTONS[id]);
  widget.el.dataset.control = id;
  widgets.set(id, { kind: 'button', widget });
  return [widget.el];
}

function buildControls() {
  widgets.clear();
  const { current, earlier } = F.unlockedControls(flow);
  const shown = F.guideAvailable(flow) ? [...current, 'guide'] : current;
  panel.currentControls.replaceChildren(...shown.flatMap(makeControl));
  panel.earlierControls.replaceChildren(...earlier.flatMap(makeControl));
  panel.setMoreVisible(earlier.length > 0);
  refreshControls();
}

function refreshControls() {
  for (const [id, entry] of widgets) {
    if (entry.kind === 'value') {
      entry.widget.setValue(S.getValue(state, entry.path));
      entry.widget.refresh();
      entry.widget.setEnabled(controlEnabled(id));
    } else if (entry.kind === 'place') {
      const part = state.parts[entry.id];
      const where = part.placed ? ` · ${t('control.mi.position')}: z ${(part.pos.z * 1e3).toFixed(0)} mm, x ${(part.pos.x * 1e3).toFixed(0)} mm` : '';
      entry.label.textContent = `${t(`part.${entry.id}`)}${where}`;
      entry.add.el.hidden = part.placed;
      entry.add.refresh();
      for (const m of entry.moves) {
        m.el.hidden = !part.placed;
        m.refresh();
      }
    } else {
      entry.widget.refresh();
      entry.widget.setEnabled(controlEnabled(id));
      if (id === 'guide') entry.widget.setPressed(flow.guideOn);
    }
  }
}

// ---- tap the table (spec §4.9) ----
function tapPhase(now) {
  const s = (now - tap.start) / 1000;
  if (s > MI.tap.duration) return null;
  return MI.tap.amplitude * Math.exp(-s / MI.tap.decay) * Math.sin(2 * Math.PI * MI.tap.frequency * s + tap.offset);
}

function tapFrame(now) {
  if (!tap) return;
  const phase = tapPhase(now);
  result = michelsonBench(state, { tapPhase: phase ?? 0 });
  renderInsets();
  renderScene();
  if (phase === null) tap = null;
  else requestAnimationFrame(tapFrame);
}

function startTap() {
  const running = tap !== null;
  tap = { start: performance.now(), offset: Math.random() * 2 * Math.PI };
  if (!running) requestAnimationFrame(tapFrame);
}

// ---- panel ----
function readouts() {
  const none = t('readout.none');
  const f = result.fringe;
  const items = [
    { label: t('readout.power'), value: result.laserOn ? `${(result.power * 100).toFixed(1)} %` : none },
    { label: t('readout.mi.contrast'), value: f ? f.contrast.toFixed(2) : none },
    { label: t('readout.mi.spacing'), value: f && f.spacing <= MI.spacingShownMax ? `${(f.spacing * 1e3).toFixed(2)} mm` : none },
  ];
  if (state.parts.lens1.placed || state.parts.lens2.placed) {
    items.push({ label: t('readout.mi.rings'), value: f ? String(Math.floor(f.rings)) : none });
  }
  return items;
}

function summaryLines() {
  const elapsed = clock.seconds();
  return [
    t('step.done.time', { minutes: Math.floor(elapsed / 60), seconds: Math.floor(elapsed % 60) }),
    t('step.done.warnings', { count: flow.warningsShown }),
  ];
}

function renderPanel() {
  const step = F.currentStep(flow);
  panel.renderStep({
    stepId: step.id,
    checks: F.evaluateChecks(flow, state, result),
    hintsShown: flow.hintsShown,
    hintCount: step.hints,
    questions: step.questions,
    canAdvance: F.canAdvance(flow, state, result),
    isLast: step.id === 'miDone',
    summary: step.id === 'miDone' ? summaryLines() : null,
  });
  const tip = flow.tipOn ? currentTip() : null;
  panel.renderTip(tip ? t(tip.key, tip.params) : null);
  panel.renderReadouts(readouts());
}

function renderProgress() {
  document.querySelector('.progress').replaceChildren(...F.STEPS.map((step, index) => {
    const li = document.createElement('li');
    li.textContent = step.id === 'miStart' ? t('progress.start') : step.id === 'miDone' ? t('progress.done') : F.STEP_LABELS[step.id];
    li.className = index < flow.index ? 'done' : index === flow.index ? 'current' : '';
    if (index === flow.index) li.setAttribute('aria-current', 'step');
    return li;
  }));
}

function renderTimer() {
  document.querySelector('.timer').textContent = formatClock(clock.seconds());
}

function renderStatic() {
  applyTranslations(document);
  document.documentElement.lang = getLanguage() === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  document.title = `EO LAB · ${t('mi.title')}`;
  document.querySelector('.lang-btn').textContent = t('ui.switchLanguage');
  const timer = document.querySelector('.timer');
  timer.title = t('ui.timer');
  timer.setAttribute('aria-label', t('ui.timer'));
  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.textContent = t(`ui.camera.${button.dataset.camera}`);
  });
  panel.renderLabels();
}

function render() {
  const t0 = performance.now();
  renderScene();
  renderInsets();
  renderPanel();
  refreshControls();
  renderProgress();
  debug.lastRenderMs = performance.now() - t0;
}

function enterStep() {
  const step = F.currentStep(flow);
  if (step.id === 'miDone') {
    clock.stop();
    renderTimer();
  }
  insetVisible.clear();
  step.insets.forEach((id) => insetVisible.add(id));
  buildControls();
  applyCamera(step.camera);
  render();
}

// ---- boot ----
document.querySelector('.lang-btn').addEventListener('click', () => setLanguage(getLanguage() === 'zh-TW' ? 'en' : 'zh-TW'));
document.querySelector('.restart-btn').addEventListener('click', restart);
onLanguageChange(() => {
  panel.invalidate();
  renderStatic();
  render();
});
buildInsets();
buildCameraButtons();
if (webglAvailable()) {
  try {
    scene3d = await createScene3d();
  } catch (error) {
    debug.errors.push(`3D view failed: ${error.message}`);
    document.querySelector('.nowebgl').hidden = false;
  }
} else {
  document.querySelector('.nowebgl').hidden = false;
}
renderStatic();
enterStep();
renderTimer();
setInterval(renderTimer, 1000);
Object.assign(debug, { ready: true, t, seed, getState: () => state, getFlow: () => flow, getResult: () => result });
```

- [ ] **Step 5: Add the styles**

Append to the end of `css/style.css`:

```css
/* Michelson: the tip about what is wrong right now, and the placement buttons */
.tip { margin: 8px 0 0; padding: 8px 10px; border-left: 3px solid var(--warn); border-radius: 6px; background: var(--surface-2); line-height: 1.5; }
.place-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.place-row .button { padding: 4px 8px; font-size: 13px; }
@media (max-width: 767px) {
  .inset-toggles { flex-basis: 100%; }   /* the close-up toggles always get a line of their own */
}
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `python tools/run_tests.py`

Expected:

```
…
PASS app: laser page boots, turns the laser on and moves to step 1
PASS michelson app: boots, turns the laser on and places the beam splitter from the panel
…
SUMMARY passed=127 failed=0
```

- [ ] **Step 7: Commit**

Run:

```bash
git add michelson.html js/michelson-app.js tests/page.js tests/michelson-app.test.js tests/app.test.js css/style.css tests/all.js
git commit -F - <<'EOF'
feat: add the Michelson experiment page

The 3D breadboard, close-ups of the iris (reflected spots) and screen
(fringes on the target paper), the step panel with tips and the layout
guide, placement controls for keyboard and no-WebGL use, readouts, tap
the table, and the timer.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 11: Lobby link

**Files:**
- Modify: `index.html`
- Modify: `tests/lobby.test.js`

**Interfaces:**
- Consumes: Task 7 `lobby.michelson.body`; Task 10 `michelson.html`.
- Produces: an active Michelson card linking to `./michelson.html`.

- [ ] **Step 1: Write the failing test**

In `tests/lobby.test.js`, replace:

```js
  assert(doc.querySelector('.card a[href="./laser.html"]'), 'link to Experiment 1');
```

with:

```js
  assert(doc.querySelector('.card a[href="./laser.html"]'), 'link to Experiment 1');
  assert(doc.querySelector('.card a[href="./michelson.html"]'), 'link to the Michelson');
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python tools/run_tests.py --filter "lobby"`

Expected:

```
FAIL lobby: shows the experiment cards and switches language — link to the Michelson
SUMMARY passed=0 failed=1
```

- [ ] **Step 3: Activate the card**

In `index.html`, replace:

```html
      <article class="card disabled" aria-disabled="true">
        <h2 data-i18n="lobby.michelson.title"></h2>
        <p data-i18n="lobby.comingLater"></p>
      </article>
```

with:

```html
      <article class="card">
        <h2 data-i18n="lobby.michelson.title"></h2>
        <p data-i18n="lobby.michelson.body"></p>
        <a class="card-action" href="./michelson.html" data-i18n="lobby.start"></a>
      </article>
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `python tools/run_tests.py --filter "lobby"`

Expected:

```
PASS lobby: shows the experiment cards and switches language
SUMMARY passed=1 failed=0
```

- [ ] **Step 5: Commit**

Run:

```bash
git add index.html tests/lobby.test.js
git commit -F - <<'EOF'
feat(lobby): open the Michelson experiment from its card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 12: Check in the browser, record changes in the spec, and finish

**Files:**
- Modify: `docs/superpowers/specs/2026-10-24-eo-lab-web-michelson-design.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a verified page and a spec that matches the code.

- [ ] **Step 1: Run the whole suite**

Run: `python tools/run_tests.py`

Expected:

```
SUMMARY passed=127 failed=0   (83 Experiment 1 tests + 44 new)
```

- [ ] **Step 2: Play the experiment in the browser**

Start the preview server (`python tools/serve.py`, or the Browser pane's `eo-lab-web` preview) and open `http://127.0.0.1:8765/michelson.html?seed=3`. Play the whole experiment with the panel controls and with dragging in 3D, and confirm:

- Step 1: the first 提示 press shows the reflected-beam tip with the angle in mrad; after correcting the beam splitter it disappears; the screen's Place puts it on the reflected row; sliding it 200 mm completes the card trial.
- Step 2: before alignment the iris close-up shows spots 1 and 2 off the hole (visible even when they miss the iris itself); after correcting both mirrors all three checks pass.
- Step 3: after opening the iris and moving the screen to the output (Remove, then Place), a few fine clicks on M1's horizontal knob give 1–5 mm straight fringes; the 屏幕 camera shows the card face, not a mount; 輕拍桌面 shakes the fringes for about 1.5 s with the Browser pane visible.
- Step 4: both lenses at 100 mm show the "same distance" tip; moving one by 1 mm gives centred rings (about 6) and all checks pass; the layout guide shows outlines after the last hint.
- Done: the summary shows the time and warnings; the timer stops.
- English mode shows no raw keys; at phone size (375 × 812) there is no horizontal scroll and the close-up toggles are small chips.
- `window.eolab.lastBenchMs` stays under 10 ms and `lastRenderMs` under 16 ms; no console errors.

- [ ] **Step 3: Record the build-time changes in the spec**

In `docs/superpowers/specs/2026-10-24-eo-lab-web-michelson-design.md`:

1. In §3.6, after the layout-guide positions, add: "In step 1 the screen's guide position is the alignment card on the reflected row (x = +100 mm on row z = 300 mm, facing the beam splitter); from step 2 it is the output position."
2. In §4.2, change the iris bullet to: "**Iris and source face (returning rays):** the ray stops on the source face (a 60 mm square around the iris); its offset from the hole centre is recorded for the iris close-up, which draws the whole face, so a spot that misses the iris itself still shows. Light through the hole returns into the laser and is not traced further."
3. In §5, under "Changed, backward-compatibly", add: `js/optics/screen.js` (`brightPixel`), `js/ui/panel.js` (`renderTip`), `js/scene/view.js` (custom presets and a look-at point), `js/scene/models.js` (`createScreenModel` with a pixel mapping; `buildLaser` exported), `css/style.css` (tip line, placement buttons, close-up toggles on their own line on narrow screens), and `tests/page.js` (shared page loader); remove `view` from the "Reused unchanged" list.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/specs/2026-10-24-eo-lab-web-michelson-design.md
git commit -F - <<'EOF'
docs: record the Michelson build-time changes in the spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch: verify the tests, then push `feat/michelson` and open a pull request into `main` (pushes go through Git Credential Manager; open the PR in the Browser pane, which is signed in to GitHub). The PR description ends with "🤖 Generated with [Claude Code](https://claude.com/claude-code)".

