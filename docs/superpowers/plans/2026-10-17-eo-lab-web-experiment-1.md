# EO LAB Web — Experiment 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser version of 光電實驗(一) 實驗一「對光、平行光、與光擴束」: a 3D optical bench where students follow the handout's alignment procedure with mouse or touch, and everything they see is computed from real optics.

**Architecture:** Plain HTML/CSS/JavaScript ES modules with no build step. A pure physics core (`js/optics/`) and pure lab logic (`js/lab/`) are tested in a headless browser; three.js draws the bench (`js/scene/`) and DOM modules draw the panel and close-ups (`js/ui/`). Data flows one way: input → `state` → `bench(state)` → scene, insets, panel and step checks.

**Tech Stack:** JavaScript (ES2022 modules, import maps), three.js 0.170.0 (vendored), Python 3 (local server and test runner), Microsoft Edge headless (test execution), git.

**Spec:** `docs/superpowers/specs/2026-10-17-eo-lab-web-experiment-1-design.md` — read it before starting; section numbers below (§) refer to it.

## Global Constraints

- Repository root: `C:/Users/wongz/Desktop/LAB/VR/eo-lab-web`. Every command in this plan runs from there. Never modify `C:/Users/wongz/Desktop/LAB/VR/My project` (the Unity project).
- No build tools, no npm, no runtime dependencies except three.js **0.170.0** vendored in `js/vendor/` (single-file module build) and mapped with an import map.
- No external network requests at runtime: no CDN, no web fonts, no analytics.
- Internal physics units are SI (m, rad). UI shows mm, µm, mrad.
- Bench coordinates: z along the rail from the laser exit (z = 0), y = height above the table, x horizontal (positive to the right looking along +z). three.js world = (X, Y, Z) = (bench z, bench y, bench x).
- Wavelength 532 nm; laser waist W₀ = 0.5 mm; objective 20× f₀ = 9.0 mm; pinhole Ø 25 µm; convex lens f_e = 200 mm, Ø 25.4 mm, clear aperture 22.9 mm; irises Ø 1.0–12.0 mm.
- UI text lives only in `js/i18n/zh-TW.js` and `js/i18n/en.js` (same keys). Default language zh-TW; English toggle. Handout questions are paraphrased and shown without answers.
- ✓/✗ always appear with text, never colour alone. Every control is keyboard-operable.
- `localStorage` access is always wrapped in try/catch.
- Run tests with `python tools/run_tests.py` (optionally `--filter <text>`). A task is done only when the full suite reports `failed=0`.
- Commit after every task with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (second `-m`).
- Downloading three.js (Task 12) and publishing anywhere require the user's explicit approval first.

## File Structure

```
eo-lab-web/
  .gitattributes, .gitignore, README.md
  index.html                 lobby (Task 18)
  laser.html                 Experiment 1 page (Task 17)
  css/style.css              all styles (Task 17, lobby styles Task 18)
  tools/
    serve.py                 local static server with correct JS MIME types (Task 1)
    run_tests.py             headless-Edge test runner (Task 1)
  js/
    app.js                   wires everything for laser.html (Task 17)
    lobby.js                 lobby page script (Task 18)
    vendor/                  three.module.min.js, addons/controls/OrbitControls.js, LICENSE-three.txt (Task 12)
    i18n/index.js            t(), language switching, applyTranslations (Task 11)
    i18n/zh-TW.js, en.js     every UI string (Task 11)
    optics/config.js         constants, ranges, tolerances (Task 2)
    optics/rng.js            seeded random numbers (Task 2)
    optics/complex.js        complex arithmetic (Task 2)
    optics/gaussian.js       Gaussian beam q-parameter (Task 3)
    optics/ray.js            paraxial beam-centre ray (Task 3)
    optics/iris.js           Gaussian through a circular hole (Task 4)
    optics/noise.js          fixed dust noise on the beam (Task 5)
    optics/pinhole.js        pinhole field → far field, transmission (Task 6)
    optics/screen.js         screen samplers, rendering, tone map, colours (Task 7)
    optics/bench.js          bench(state) → BenchResult (Task 9)
    lab/state.js             bench state + pure updates (Task 8)
    lab/steps.js             Chapter 1 steps, checks, hints, warnings (Task 10)
    scene/webgl.js           WebGL 2 detection without three.js (Task 12)
    scene/view.js            renderer, camera, presets (Task 12)
    scene/models.js          bench and part models (Task 12)
    scene/beam.js            glowing beam and spots (Task 13)
    scene/interact.js        picking, dragging, tap-to-place (Task 13)
    ui/controls.js           knobs, sliders, buttons, position inputs (Task 14)
    ui/toast.js              warning toasts (Task 14)
    ui/insets.js             2D close-ups (Task 15)
    ui/panel.js              side panel (Task 16)
  tests/
    index.html, harness.js, all.js, fixtures.js
    smoke.test.js, i18n.test.js, app.test.js, lobby.test.js
    optics/*.test.js, lab/*.test.js, scene/*.test.js, ui/*.test.js
  docs/superpowers/specs/…, docs/superpowers/plans/…
```

---

### Task 1: Scaffold, test harness and headless test runner

**Files:**
- Create: `.gitattributes`, `.gitignore`, `README.md`
- Create: `tools/serve.py`, `tools/run_tests.py`
- Create: `tests/index.html`, `tests/harness.js`, `tests/all.js`, `tests/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `tests/harness.js` exports `test(name, fn)`, `assert(cond, msg)`, `assertEqual(actual, expected, msg)`, `assertClose(actual, expected, tol, msg)`, `assertRelClose(actual, expected, relTol, msg)`, `assertThrows(fn, msg)`, `run({ filter })`, `reportFatal(error)`. Test modules register tests on import and are listed in `tests/all.js`. `tools/serve.py` exports `ROOT` and `Handler` (used by `run_tests.py`). Runner prints lines `PASS <name>` / `FAIL <name> — <message>` and `SUMMARY passed=N failed=M`; exit code 0 only when `failed=0`.

- [ ] **Step 1: Create the repository basics and set the commit identity**

`.gitattributes`:

```
* text=auto eol=lf
```

`.gitignore`:

```
__pycache__/
*.pyc
Thumbs.db
.DS_Store
```

`README.md` (expanded in Task 18):

```markdown
# EO LAB Web

Browser version of 光電實驗(一) 實驗一「對光、平行光、與光擴束」. Work in progress.

Run the tests: `python tools/run_tests.py`
```

Git has no global identity on this machine; set a repository-local one (the user's account name and email):

```bash
git config user.name "wongz"
git config user.email "wongziy33@gmail.com"
```

- [ ] **Step 2: Write the failing smoke test**

`tests/smoke.test.js`:

```js
import { test, assertEqual, assertClose } from './harness.js';

test('smoke: harness runs', () => {
  assertEqual(1 + 1, 2);
  assertClose(0.1 + 0.2, 0.3, 1e-12);
});
```

`tests/all.js`:

```js
// Every test module is imported here; tests register themselves on import.
import './smoke.test.js';
```

`tests/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>EO LAB tests</title>
  <script type="importmap">
    { "imports": { "three": "../js/vendor/three.module.min.js", "three/addons/": "../js/vendor/addons/" } }
  </script>
</head>
<body>
  <h1>EO LAB tests</h1>
  <pre id="results">running…</pre>
  <div id="sandbox"></div>
  <script type="module">
    import { run, reportFatal } from './harness.js';
    try {
      await import('./all.js');
    } catch (error) {
      reportFatal(error);
    }
    await run({ filter: new URLSearchParams(location.search).get('filter') ?? '' });
  </script>
</body>
</html>
```

- [ ] **Step 3: Write the local server and the runner**

`tools/serve.py`:

```python
#!/usr/bin/env python3
"""Serve the EO LAB site locally with correct JavaScript MIME types.

Usage (from the repository root):  python tools/serve.py [--port 8765]
Then open http://127.0.0.1:8765/ in a browser.
"""
import argparse
import functools
import http.server
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    # Some Windows machines map .js to text/plain, which breaks ES modules.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", args.port), functools.partial(Handler, directory=str(ROOT))
    )
    print(f"Serving {ROOT} at http://127.0.0.1:{args.port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
```

`tools/run_tests.py`:

```python
#!/usr/bin/env python3
"""Run the EO LAB browser tests in headless Edge/Chrome and print the results.

Usage (from the repository root):
    python tools/run_tests.py                     # every test
    python tools/run_tests.py --filter pinhole    # tests whose name contains "pinhole"

Exit code 0 when the page reports failed=0.
"""
import argparse
import functools
import html
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve import ROOT, Handler  # noqa: E402

BROWSERS = [
    os.environ.get("EOLAB_BROWSER"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    shutil.which("msedge"),
    shutil.which("google-chrome"),
    shutil.which("chromium"),
]


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


def find_browser():
    for candidate in BROWSERS:
        if candidate and Path(candidate).exists():
            return candidate
    sys.exit("No Edge or Chrome found; set EOLAB_BROWSER to the browser executable.")


def main():
    # Test names contain −, µ and Chinese; Windows consoles default to cp1252.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--filter", default="")
    parser.add_argument("--page", default="tests/index.html")
    parser.add_argument("--timeout", type=int, default=300)
    args = parser.parse_args()

    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/{args.page}"
    if args.filter:
        url += "?filter=" + urllib.parse.quote(args.filter)

    profile = tempfile.mkdtemp(prefix="eolab-tests-")
    command = [
        find_browser(),
        "--headless=new",
        "--disable-gpu",
        "--enable-unsafe-swiftshader",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        f"--user-data-dir={profile}",
        "--virtual-time-budget=120000",
        "--dump-dom",
        url,
    ]
    try:
        proc = subprocess.run(
            command, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=args.timeout,
        )
    finally:
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    match = re.search(r'<pre id="results"[^>]*>(.*?)</pre>', proc.stdout, re.S)
    text = html.unescape(match.group(1)).strip() if match else ""
    print(text or "(no results block in the page output)")
    summary = re.search(r"SUMMARY passed=(\d+) failed=(\d+)", text)
    if not summary:
        print("FAIL: the test page did not finish (no SUMMARY line)")
        return 1
    return 0 if summary.group(2) == "0" else 1


if __name__ == "__main__":
    sys.exit(main())
```

Note: headless runs use virtual time, so `performance.now()` does not advance during computation; speed checks are manual (Task 18).

- [ ] **Step 4: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: prints `running…` then `FAIL: the test page did not finish (no SUMMARY line)`; exit code 1 (`harness.js` does not exist yet).

- [ ] **Step 5: Write the harness**

`tests/harness.js`:

```js
// Tiny test harness: register with test(), run with run(); results go to <pre id="results">.
const registry = [];

export function test(name, fn) {
  registry.push({ name, fn });
}

function fmt(value) {
  return typeof value === 'number' ? String(Number(value.toPrecision(10))) : JSON.stringify(value);
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = 'values differ') {
  if (actual !== expected) throw new Error(`${message}: expected ${fmt(expected)}, got ${fmt(actual)}`);
}

export function assertClose(actual, expected, tolerance, message = 'not close') {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message}: expected ${fmt(expected)} ± ${fmt(tolerance)}, got ${fmt(actual)}`);
  }
}

export function assertRelClose(actual, expected, relTolerance, message = 'not close') {
  assertClose(actual, expected, Math.abs(expected) * relTolerance, message);
}

export function assertThrows(fn, message = 'expected an exception') {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

const lines = [];
function emit(line) {
  lines.push(line);
  console.log(line);
  const out = document.getElementById('results');
  if (out) out.textContent = lines.join('\n');
}

let fatal = 0;
export function reportFatal(error) {
  fatal += 1;
  emit(`FAIL (load error) ${error && error.message ? error.message : error}`);
}

export async function run({ filter = '' } = {}) {
  let passed = 0;
  let failed = fatal;
  for (const { name, fn } of registry) {
    if (filter && !name.includes(filter)) continue;
    try {
      await fn();
      passed += 1;
      emit(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      emit(`FAIL ${name} — ${error && error.message ? error.message : error}`);
    }
  }
  emit(`SUMMARY passed=${passed} failed=${failed}`);
  return { passed, failed };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected:
```
PASS smoke: harness runs
SUMMARY passed=1 failed=0
```

- [ ] **Step 7: Check that failures are reported**

Temporarily change `assertEqual(1 + 1, 2);` to `assertEqual(1 + 1, 3);` in `tests/smoke.test.js`.
Run: `python tools/run_tests.py`
Expected: `FAIL smoke: harness runs — values differ: expected 3, got 2`, `SUMMARY passed=0 failed=1`, exit code 1.
Revert the change and re-run; expected `SUMMARY passed=1 failed=0`.

- [ ] **Step 8: Commit**

```bash
git add .gitattributes .gitignore README.md tools tests
git commit -m "chore: scaffold repo with browser test harness and headless runner" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Configuration, seeded random numbers, complex arithmetic

**Files:**
- Create: `js/optics/config.js`, `js/optics/rng.js`, `js/optics/complex.js`
- Test: `tests/optics/config-rng.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: harness (Task 1).
- Produces:
  - `CONFIG` (deep-frozen object; every constant, range and tolerance — see code) and `DERIVED` (`laserRayleigh` m, `focusWaist` m).
  - `createRng(seed) → () => number in [0,1)`, `deriveSeed(seed, salt) → uint32`, `uniform(rng, lo, hi)`, `randomSign(rng) → ±1`, `randomVector(rng, magMin, magMax) → {x, y}`, `randomSeed() → uint32`, `SALT = { laser: 1, noise: 2, objective: 3, pinhole: 4 }`.
  - `complex(re, im)`, `cadd`, `csub`, `cmul`, `cinv`, `cdiv`, `cabs` on `{ re, im }`.

- [ ] **Step 1: Write the failing tests**

`tests/optics/config-rng.test.js`:

```js
import { test, assert, assertEqual, assertClose, assertRelClose, assertThrows } from '../harness.js';
import { CONFIG, DERIVED } from '../../js/optics/config.js';
import { createRng, deriveSeed, uniform, randomSign, randomVector, SALT } from '../../js/optics/rng.js';
import { complex, cadd, csub, cmul, cinv, cdiv, cabs } from '../../js/optics/complex.js';

test('config: derived laser and focus values match the spec', () => {
  assertRelClose(DERIVED.laserRayleigh, 1.476, 1e-3, 'laser Rayleigh range (m)');
  assertRelClose(DERIVED.focusWaist, 3.048e-6, 1e-3, 'focused waist (m)');
});

test('config: is deeply frozen', () => {
  assertThrows(() => { CONFIG.wavelength = 1; }, 'top level should be frozen');
  assertThrows(() => { CONFIG.checks.s1.centreTol = 1; }, 'nested objects should be frozen');
});

test('rng: same seed gives the same sequence, values in [0, 1)', () => {
  const a = createRng(1234);
  const b = createRng(1234);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assertEqual(x, b());
    assert(x >= 0 && x < 1, `value out of range: ${x}`);
  }
});

test('rng: different seeds differ; deriveSeed is deterministic and salt-dependent', () => {
  assert(createRng(1)() !== createRng(2)(), 'seeds 1 and 2 should differ');
  assertEqual(deriveSeed(99, SALT.noise), deriveSeed(99, SALT.noise));
  assert(deriveSeed(99, SALT.noise) !== deriveSeed(99, SALT.pinhole), 'salts should give different streams');
});

test('rng: helpers stay in range', () => {
  const rng = createRng(7);
  for (let i = 0; i < 500; i++) {
    const u = uniform(rng, 2, 6);
    assert(u >= 2 && u < 6, `uniform out of range: ${u}`);
    const s = randomSign(rng);
    assert(s === 1 || s === -1, 'sign must be ±1');
    const v = randomVector(rng, 0.2, 0.6);
    const m = Math.hypot(v.x, v.y);
    assert(m >= 0.2 - 1e-12 && m <= 0.6 + 1e-12, `vector magnitude out of range: ${m}`);
  }
});

test('complex: arithmetic', () => {
  const a = complex(1, 2);
  const b = complex(3, -1);
  const s = cadd(a, b);
  assertEqual(s.re, 4);
  assertEqual(s.im, 1);
  const d = csub(a, b);
  assertEqual(d.re, -2);
  assertEqual(d.im, 3);
  const p = cmul(a, b);
  assertEqual(p.re, 5);
  assertEqual(p.im, 5);
  const q = cdiv(p, b);
  assertClose(q.re, 1, 1e-12);
  assertClose(q.im, 2, 1e-12);
  const i = cinv(complex(0, 2));
  assertClose(i.re, 0, 1e-15);
  assertClose(i.im, -0.5, 1e-15);
  assertClose(cabs(complex(3, 4)), 5, 1e-15);
});
```

Append to `tests/all.js`:

```js
import './optics/config-rng.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: `FAIL (load error) …` mentioning a module that failed to load; `failed=1` or more; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/optics/config.js`:

```js
// Every physical constant, range and tolerance used by EO LAB (SI units: m, rad).
// Source of truth: docs/superpowers/specs/2026-10-17-eo-lab-web-experiment-1-design.md
function deepFreeze(value) {
  Object.values(value).forEach((v) => {
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(value);
}

export const CONFIG = deepFreeze({
  wavelength: 532e-9,
  laser: {
    waistRadius: 0.5e-3,
    exitHeight: 0.100,
    exitHeightJitter: 0.003,
    tiltMin: 2e-3,
    tiltMax: 6e-3,
    knobRange: 10e-3,
    knobFine: 0.05e-3,
    knobCoarse: 0.5e-3,
  },
  post: { min: 0.070, max: 0.130, initial: 0.100, fine: 0.05e-3, coarse: 0.5e-3 },
  iris: { openingMin: 1.0e-3, openingMax: 12.0e-3, openingInitial: 12.0e-3, openingStep: 0.1e-3, plateRadius: 0.025 },
  objective: {
    focalLength: 9.0e-3,
    decentreRange: 1.0e-3,
    decentreFine: 5e-6,
    decentreCoarse: 50e-6,
    installOffsetMin: 0.2e-3,
    installOffsetMax: 0.6e-3,
    travel: 6.0e-3,
    focusAt: 1.0e-3,
    startAt: 3.0e-3,
    focusFine: 2e-6,
    focusCoarse: 50e-6,
    surfaceRadii: [15e-3, 22e-3, 34e-3],
  },
  pinhole: { radius: 12.5e-6, range: 0.5e-3, fine: 1e-6, coarse: 10e-6, installOffsetMin: 30e-6, installOffsetMax: 120e-6 },
  mount: { ringRadius: 4e-3, ringOffset: 0.040 },
  lens: { focalLength: 0.200, diameter: 25.4e-3, clearAperture: 22.9e-3, zFine: 0.5e-3, zCoarse: 5e-3 },
  screen: { size: 0.150, centreHeight: 0.100, zFine: 1e-3, zCoarse: 10e-3, imageSize: 256, cardPixels: 128, windowFactor: 2.5, windowMin: 5e-3, windowMax: 0.150 },
  rail: { zMin: 0.020, zMax: 1.130, beamBlockZ: 1.150, minGap: 0.005, grid: 1e-3, zFine: 1e-3, zCoarse: 10e-3 },
  footprint: { a1: [-0.010, 0.010], a2: [-0.010, 0.010], sf: [-0.060, 0.010], lens: [-0.010, 0.010], screen: [-0.010, 0.015] },
  noise: { count: 24, freqMin: 4e3, freqMax: 15e3, power: 0.04, gridSize: 256, gridSpan: 3 },
  pinholeGrid: { samples: 48, farFieldSamples: 192, farFieldSpan: 3 },
  tone: { k: 1000 },
  stopThreshold: 0.01,
  pinholeStopThreshold: 1e-5,
  checks: {
    s1: { openingMax: 1.5e-3, a1MaxZ: 0.150, a2MinZ: 0.700, centreTol: 0.25e-3, angleTol: 0.5e-3 },
    s2a: { sfMaxZ: 0.300, centreTol: 0.3e-3, a2MinGap: 0.300 },
    s2b: { planeATol: 0.5e-3, a2CentreTol: 1.0e-3, focusMin: 5.5e-3 },
    s3: { transmissionMin: 0.97, a2OpeningMin: 5e-3 },
    s4: { lensCentreTol: 0.5e-3, extentMin: 10e-3, extentMax: 22.9e-3, screenTravelMin: 0.200, collimationTol: 2.2e-3 },
  },
  warnings: { m1FarZ: 0.300, m4DzMin: -0.5e-3 },
});

export const DERIVED = Object.freeze({
  laserRayleigh: (Math.PI * CONFIG.laser.waistRadius ** 2) / CONFIG.wavelength,
  focusWaist: (CONFIG.wavelength * CONFIG.objective.focalLength) / (Math.PI * CONFIG.laser.waistRadius),
});
```

`js/optics/rng.js`:

```js
// Seeded random numbers (mulberry32) and helpers. Same seed → same run.
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An independent stream per random event, so draws never depend on the order of events.
export function deriveSeed(seed, salt) {
  let h = (seed ^ Math.imul(salt >>> 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export const uniform = (rng, lo, hi) => lo + (hi - lo) * rng();

export const randomSign = (rng) => (rng() < 0.5 ? -1 : 1);

export function randomVector(rng, magnitudeMin, magnitudeMax) {
  const angle = 2 * Math.PI * rng();
  const magnitude = uniform(rng, magnitudeMin, magnitudeMax);
  return { x: magnitude * Math.cos(angle), y: magnitude * Math.sin(angle) };
}

export function randomSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

export const SALT = Object.freeze({ laser: 1, noise: 2, objective: 3, pinhole: 4 });
```

`js/optics/complex.js`:

```js
// Minimal complex arithmetic on { re, im } objects.
export const complex = (re, im = 0) => ({ re, im });
export const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });

export function cinv(a) {
  const d = a.re * a.re + a.im * a.im;
  return { re: a.re / d, im: -a.im / d };
}

export const cdiv = (a, b) => cmul(a, cinv(b));
export const cabs = (a) => Math.hypot(a.re, a.im);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: every line `PASS`, `SUMMARY passed=7 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/optics tests
git commit -m "feat(optics): add config, seeded rng and complex helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Gaussian beam and paraxial ray

**Files:**
- Create: `js/optics/gaussian.js`, `js/optics/ray.js`
- Test: `tests/optics/gaussian-ray.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `complex`, `cinv`, `csub` (Task 2); `CONFIG`, `DERIVED` (Task 2).
- Produces:
  - `qAtWaist(waistRadius, wavelength) → q`, `propagateQ(q, distance) → q`, `thinLensQ(q, focalLength) → q`, `beamRadius(q, wavelength) → m`, `waistRadiusOf(q, wavelength) → m`, `distanceToWaist(q) → m` (positive when the waist is ahead), `curvatureRadius(q) → m` (`Infinity` at a waist). `q` is `{ re: distance past waist, im: Rayleigh range }`.
  - `propagateRay(ray, d) → ray`, `thinLensRay(ray, f, axis) → ray`, `offsetFrom(point, centre) → {x, y}`, `radial(v) → number`. `ray` is `{ x, y, tx, ty }` (m, rad slopes).

- [ ] **Step 1: Write the failing tests**

`tests/optics/gaussian-ray.test.js`:

```js
import { test, assert, assertClose, assertRelClose } from '../harness.js';
import { CONFIG, DERIVED } from '../../js/optics/config.js';
import { qAtWaist, propagateQ, thinLensQ, beamRadius, waistRadiusOf, distanceToWaist, curvatureRadius } from '../../js/optics/gaussian.js';
import { propagateRay, thinLensRay, offsetFrom, radial } from '../../js/optics/ray.js';

const LAMBDA = CONFIG.wavelength;
const W0 = CONFIG.laser.waistRadius;

test('gaussian: free-space radius follows w0·sqrt(1 + (d/zR)²)', () => {
  const zR = DERIVED.laserRayleigh;
  const q0 = qAtWaist(W0, LAMBDA);
  for (const d of [0, 0.1, 0.5, 1.476, 3]) {
    const expected = W0 * Math.sqrt(1 + (d / zR) ** 2);
    assertRelClose(beamRadius(propagateQ(q0, d), LAMBDA), expected, 1e-9, `w at d=${d}`);
  }
});

test('gaussian: curvature radius is 2·zR one Rayleigh range from the waist', () => {
  const zR = DERIVED.laserRayleigh;
  assertRelClose(curvatureRadius(propagateQ(qAtWaist(W0, LAMBDA), zR)), 2 * zR, 1e-12);
  assert(curvatureRadius(qAtWaist(W0, LAMBDA)) === Infinity, 'flat wavefront at the waist');
});

test('gaussian: 1 mm beam through f0 = 9 mm focuses to 3.05 µm at f0', () => {
  const f0 = CONFIG.objective.focalLength;
  const q = thinLensQ(qAtWaist(W0, LAMBDA), f0);
  assertRelClose(waistRadiusOf(q, LAMBDA), 3.048e-6, 5e-3, 'focused waist');
  assertRelClose(distanceToWaist(q), f0, 1e-3, 'focus distance');
});

test('ray: free-space propagation and lens deflection', () => {
  const r = propagateRay({ x: 1e-3, y: 0.1, tx: 2e-3, ty: -1e-3 }, 0.5);
  assertClose(r.x, 2e-3, 1e-15);
  assertClose(r.y, 0.0995, 1e-15);
  const bent = thinLensRay({ x: 0.1e-3, y: 0, tx: 0, ty: 0 }, 9e-3, { x: 0, y: 0 });
  assertClose(bent.tx, -11.111e-3, 1e-6, 'ray 0.1 mm off a 9 mm lens bends by −11.1 mrad');
});

test('ray: parallel rays meet at the focal point of a decentred lens', () => {
  const f = 0.2;
  const axis = { x: 0.3e-3, y: 0.1 };
  for (const h of [-2e-3, 0, 1e-3, 5e-3]) {
    const atFocus = propagateRay(thinLensRay({ x: h, y: 0.1 + h, tx: 0, ty: 0 }, f, axis), f);
    assertClose(atFocus.x, axis.x, 1e-12);
    assertClose(atFocus.y, axis.y, 1e-12);
  }
  assertClose(radial(offsetFrom({ x: 3, y: 4 }, { x: 0, y: 0 })), 5, 1e-12);
});
```

Append to `tests/all.js`:

```js
import './optics/gaussian-ray.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/optics/gaussian.js`:

```js
// Gaussian beam optics with the complex beam parameter q (1/q = 1/R − iλ/(πw²)).
// q = z + i·zR, where z is the distance past the waist and zR the Rayleigh range.
import { complex, cinv, csub } from './complex.js';

export function qAtWaist(waistRadius, wavelength) {
  return complex(0, (Math.PI * waistRadius * waistRadius) / wavelength);
}

export function propagateQ(q, distance) {
  return complex(q.re + distance, q.im);
}

export function thinLensQ(q, focalLength) {
  return cinv(csub(cinv(q), complex(1 / focalLength, 0)));
}

export function beamRadius(q, wavelength) {
  return Math.sqrt((wavelength * (q.re * q.re + q.im * q.im)) / (Math.PI * q.im));
}

export function waistRadiusOf(q, wavelength) {
  return Math.sqrt((wavelength * q.im) / Math.PI);
}

// Distance from this plane to the waist; positive when the waist is still ahead.
export function distanceToWaist(q) {
  return -q.re;
}

export function curvatureRadius(q) {
  return q.re === 0 ? Infinity : q.re + (q.im * q.im) / q.re;
}
```

`js/optics/ray.js`:

```js
// Paraxial ray for the beam centre: positions x, y (m) and slopes tx = dx/dz, ty = dy/dz (rad).
export function propagateRay(ray, distance) {
  return { x: ray.x + ray.tx * distance, y: ray.y + ray.ty * distance, tx: ray.tx, ty: ray.ty };
}

export function thinLensRay(ray, focalLength, axis) {
  return {
    x: ray.x,
    y: ray.y,
    tx: ray.tx - (ray.x - axis.x) / focalLength,
    ty: ray.ty - (ray.y - axis.y) / focalLength,
  };
}

export const offsetFrom = (point, centre) => ({ x: point.x - centre.x, y: point.y - centre.y });

export const radial = (v) => Math.hypot(v.x, v.y);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=12 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/optics tests
git commit -m "feat(optics): add Gaussian beam q-parameter and paraxial ray" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gaussian beam through a circular hole (irises)

**Files:**
- Create: `js/optics/iris.js`
- Test: `tests/optics/iris.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `gaussianThroughHole(w, s, r) → fraction in [0,1]` (beam 1/e² radius `w`, centre offset `s`, hole radius `r`, all metres); `besselI0e(x) → e^{−|x|}·I₀(x)`; `gaussLegendre(n) → { x: Float64Array, w: Float64Array }` on [−1, 1].

- [ ] **Step 1: Write the failing tests**

`tests/optics/iris.test.js`:

```js
import { test, assert, assertClose } from '../harness.js';
import { gaussianThroughHole, besselI0e, gaussLegendre } from '../../js/optics/iris.js';

test('iris: Gauss–Legendre rule integrates polynomials exactly', () => {
  const { x, w } = gaussLegendre(64);
  let s0 = 0;
  let s2 = 0;
  let s10 = 0;
  for (let i = 0; i < x.length; i++) {
    s0 += w[i];
    s2 += w[i] * x[i] ** 2;
    s10 += w[i] * x[i] ** 10;
  }
  assertClose(s0, 2, 1e-13);
  assertClose(s2, 2 / 3, 1e-13);
  assertClose(s10, 2 / 11, 1e-13);
});

test('iris: scaled Bessel I0 matches reference values', () => {
  assertClose(besselI0e(0), 1, 1e-7);
  assertClose(besselI0e(1), 0.4657596, 2e-7);
  assertClose(besselI0e(5), 0.1835408, 2e-7);
  assertClose(besselI0e(20), 0.0897803, 2e-7);
});

test('iris: centred beam with r = w passes 1 − e^-2', () => {
  assertClose(gaussianThroughHole(0.5e-3, 0, 0.5e-3), 1 - Math.exp(-2), 1e-4);
  assertClose(gaussianThroughHole(0.5e-3, 0, 2e-3), 1, 1e-9, 'wide open');
  assertClose(gaussianThroughHole(0.5e-3, 0, 0), 0, 0, 'closed');
  assertClose(gaussianThroughHole(0.5e-3, 5e-3, 1e-3), 0, 1e-12, 'beam far outside');
});

test('iris: off-centre beam matches brute-force integration', () => {
  const w = 0.5e-3;
  const s = 0.3e-3;
  const r = 0.5e-3;
  const n = 800;
  const h = (2 * r) / n;
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const y = -r + (j + 0.5) * h;
    for (let i = 0; i < n; i++) {
      const x = -r + (i + 0.5) * h;
      if (x * x + y * y > r * r) continue;
      sum += (2 / (Math.PI * w * w)) * Math.exp((-2 * ((x - s) ** 2 + y * y)) / (w * w));
    }
  }
  assertClose(gaussianThroughHole(w, s, r), sum * h * h, 1e-3);
  assert(gaussianThroughHole(w, s, r) < gaussianThroughHole(w, 0, r), 'offset loses power');
});
```

Append to `tests/all.js`:

```js
import './optics/iris.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/optics/iris.js`:

```js
// Power fraction of a Gaussian beam (1/e² radius w, centre offset s) passing a circular hole of radius r (spec §4.7):
// T = ∫0^r (4ρ/w²)·exp(−2(ρ² + s²)/w²)·I0(4ρs/w²) dρ, by 64-point Gauss–Legendre quadrature.

export function gaussLegendre(n) {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  const m = Math.ceil(n / 2);
  for (let i = 0; i < m; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let pp = 0;
    for (let iter = 0; iter < 100; iter++) {
      let p1 = 1;
      let p2 = 0;
      for (let j = 1; j <= n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j;
      }
      pp = (n * (z * p1 - p2)) / (z * z - 1);
      const previous = z;
      z = previous - p1 / pp;
      if (Math.abs(z - previous) < 1e-15) break;
    }
    x[i] = -z;
    x[n - 1 - i] = z;
    w[i] = 2 / ((1 - z * z) * pp * pp);
    w[n - 1 - i] = w[i];
  }
  return { x, w };
}

const RULE = gaussLegendre(64);

// e^{−|x|}·I0(x), Abramowitz & Stegun 9.8.1–9.8.2.
export function besselI0e(x) {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const t = (ax / 3.75) ** 2;
    const i0 = 1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))));
    return i0 * Math.exp(-ax);
  }
  const t = 3.75 / ax;
  const poly = 0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281
    + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))));
  return poly / Math.sqrt(ax);
}

export function gaussianThroughHole(w, s, r) {
  if (r <= 0) return 0;
  if (w <= 0) return s < r ? 1 : 0;
  // Outside [s − 6w, s + 6w] the integrand is below e^−72.
  const lo = Math.max(0, s - 6 * w);
  const hi = Math.min(r, s + 6 * w);
  if (hi <= lo) return 0;
  const half = (hi - lo) / 2;
  const mid = (hi + lo) / 2;
  let sum = 0;
  for (let i = 0; i < RULE.x.length; i++) {
    const rho = mid + half * RULE.x[i];
    const d = rho - s;
    sum += RULE.w[i] * ((4 * rho) / (w * w)) * Math.exp((-2 * d * d) / (w * w)) * besselI0e((4 * rho * s) / (w * w));
  }
  return Math.min(1, Math.max(0, sum * half));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=16 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/optics/iris.js tests
git commit -m "feat(optics): add Gaussian-through-hole transmission for irises" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dust noise on the laser beam

**Files:**
- Create: `js/optics/noise.js`
- Test: `tests/optics/noise.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `CONFIG` (Task 2); `createRng`, `deriveSeed`, `uniform`, `SALT` (Task 2).
- Produces: `createNoise(seed) → { components: [{ fx, fy, re, im }], field: Float32Array, gridSize, half, step }` where `fx, fy` are spatial frequencies (cycles/m), `re, im` complex amplitudes (Σ|c|² = 0.04), and `field` is the intensity multiplier |1 + Σ c·e^{i2πν·ρ}|² sampled over ±3·W₀ (input-plane metres). `noiseMultiplier(noise, x, y) → number` (bilinear; 1 outside the grid).

- [ ] **Step 1: Write the failing tests**

`tests/optics/noise.test.js`:

```js
import { test, assert, assertEqual, assertClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { createNoise, noiseMultiplier } from '../../js/optics/noise.js';

test('noise: deterministic per seed with spec frequencies and power', () => {
  const a = createNoise(42);
  const b = createNoise(42);
  const c = createNoise(43);
  assertEqual(a.components.length, CONFIG.noise.count);
  assertEqual(a.components[5].fx, b.components[5].fx);
  assert(a.components[5].fx !== c.components[5].fx, 'different seeds differ');
  let power = 0;
  for (const k of a.components) {
    const f = Math.hypot(k.fx, k.fy);
    assert(f >= CONFIG.noise.freqMin && f <= CONFIG.noise.freqMax, `frequency out of range: ${f}`);
    power += k.re * k.re + k.im * k.im;
  }
  assertClose(power, CONFIG.noise.power, 1e-12);
});

test('noise: multiplier averages 1 + ε², is visibly uneven, and looks up grid samples', () => {
  const n = createNoise(7);
  let sum = 0;
  let sumSq = 0;
  for (const v of n.field) {
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n.field.length;
  const std = Math.sqrt(sumSq / n.field.length - mean * mean);
  assertClose(mean, 1 + CONFIG.noise.power, 0.02);
  assert(std > 0.1, `noise should be visible, std=${std}`);
  const i = 100;
  const j = 120;
  const x = -n.half + (i + 0.5) * n.step;
  const y = -n.half + (j + 0.5) * n.step;
  assertClose(noiseMultiplier(n, x, y), n.field[j * n.gridSize + i], 1e-5);
  assertEqual(noiseMultiplier(n, 1, 1), 1, 'outside the grid the multiplier is 1');
});
```

Append to `tests/all.js`:

```js
import './optics/noise.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/optics/noise.js`:

```js
// Fixed "dust noise" on the laser beam (handout Fig. 1-1a): K tilted copies of the beam, spec §4.1 and §4.4.
import { CONFIG } from './config.js';
import { createRng, deriveSeed, uniform, SALT } from './rng.js';

export function createNoise(seed) {
  const { count, freqMin, freqMax, power, gridSize, gridSpan } = CONFIG.noise;
  const rng = createRng(deriveSeed(seed, SALT.noise));
  const amplitude = Math.sqrt(power / count);
  const components = [];
  for (let k = 0; k < count; k++) {
    const direction = 2 * Math.PI * rng();
    const frequency = uniform(rng, freqMin, freqMax);
    const phase = 2 * Math.PI * rng();
    components.push({
      fx: frequency * Math.cos(direction),
      fy: frequency * Math.sin(direction),
      re: amplitude * Math.cos(phase),
      im: amplitude * Math.sin(phase),
    });
  }
  // Intensity multiplier |1 + Σ c·e^{i2πν·ρ}|² over ±gridSpan·W0 in input-plane metres.
  const half = gridSpan * CONFIG.laser.waistRadius;
  const step = (2 * half) / gridSize;
  const field = new Float32Array(gridSize * gridSize);
  for (let j = 0; j < gridSize; j++) {
    const y = -half + (j + 0.5) * step;
    for (let i = 0; i < gridSize; i++) {
      const x = -half + (i + 0.5) * step;
      let re = 1;
      let im = 0;
      for (const c of components) {
        const phi = 2 * Math.PI * (c.fx * x + c.fy * y);
        const cos = Math.cos(phi);
        const sin = Math.sin(phi);
        re += c.re * cos - c.im * sin;
        im += c.re * sin + c.im * cos;
      }
      field[j * gridSize + i] = re * re + im * im;
    }
  }
  return { components, field, gridSize, half, step };
}

// Intensity multiplier at input-plane position (x, y) relative to the beam centre (bilinear; 1 outside the grid).
export function noiseMultiplier(noise, x, y) {
  const { field, gridSize, half, step } = noise;
  const fx = (x + half) / step - 0.5;
  const fy = (y + half) / step - 0.5;
  if (fx < 0 || fy < 0 || fx >= gridSize - 1 || fy >= gridSize - 1) return 1;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const a = field[j * gridSize + i];
  const b = field[j * gridSize + i + 1];
  const c = field[(j + 1) * gridSize + i];
  const d = field[(j + 1) * gridSize + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=18 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/optics/noise.js tests
git commit -m "feat(optics): add seeded dust noise on the laser beam" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pinhole as a low-pass filter (Fourier optics)

**Files:**
- Create: `js/optics/pinhole.js`
- Test: `tests/optics/pinhole.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `CONFIG` (Task 2); `createNoise` (Task 5, tests only).
- Produces:
  - `computePinhole({ wavelength, focalLength, beamRadius, offset, angle, defocus, objectiveAxis, pinholeCentre, pinholeRadius, noise, samples?, farFieldSamples?, farFieldSpan? })` → `{ transmission, noiseTransmission, farField: { data: Float32Array(M·M), size: M, span }, thetaE, centroid: {x, y}, waistRadius, spotRadius, focusCentre: {x, y}, spotCentre: {x, y} }`. Far-field values are relative to the on-axis peak of a perfectly focused, centred, unclipped beam (= 1). `data[n·M + m]` has θx = −span + (m + ½)·2span/M and θy likewise with n. `offset` = beam centre − objective axis at the objective (u), `angle` = beam slope (α), `defocus` = Δz.
  - `sampleFarField(farField, tx, ty) → number` (bilinear, 0 outside).
  - `maskedFraction(farField, inside(tx, ty) → bool) → number`.

- [ ] **Step 1: Write the failing tests**

`tests/optics/pinhole.test.js`:

```js
import { test, assert, assertClose, assertRelClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { createNoise } from '../../js/optics/noise.js';
import { computePinhole, sampleFarField, maskedFraction } from '../../js/optics/pinhole.js';

const base = () => ({
  wavelength: CONFIG.wavelength,
  focalLength: CONFIG.objective.focalLength,
  beamRadius: CONFIG.laser.waistRadius,
  offset: { x: 0, y: 0 },
  angle: { x: 0, y: 0 },
  defocus: 0,
  objectiveAxis: { x: 0, y: 0.1 },
  pinholeCentre: { x: 0, y: 0.1 },
  pinholeRadius: CONFIG.pinhole.radius,
  noise: [],
});
const thetaW = CONFIG.laser.waistRadius / CONFIG.objective.focalLength;   // 55.6 mrad

test('pinhole: centred at focus passes everything as a clean Gaussian', () => {
  const r = computePinhole(base());
  assert(r.transmission >= 0.999, `transmission ${r.transmission}`);
  assertRelClose(r.thetaE, thetaW, 0.03, '1/e² half-angle of the far field');
  assertClose(sampleFarField(r.farField, 0, 0), 1, 0.03, 'on-axis far field equals the ideal peak');
  assertClose(r.centroid.x, 0, 1e-4);
});

test('pinhole: overfilled pinhole gives an Airy pattern (first dark ring at 1.22λ/D)', () => {
  const r = computePinhole({ ...base(), defocus: 5e-3 });
  assert(r.transmission < 0.01, `overfilled transmission should be small: ${r.transmission}`);
  const { data, size, span } = r.farField;
  const d = (2 * span) / size;
  const row = size / 2;
  let minIndex = -1;
  for (let m = size / 2 + 1; m < size - 1; m++) {
    const v = data[row * size + m];
    if (v < data[row * size + m - 1] && v <= data[row * size + m + 1]) {
      minIndex = m;
      break;
    }
  }
  const thetaMin = -span + (minIndex + 0.5) * d;
  const expected = (1.22 * CONFIG.wavelength) / (2 * CONFIG.pinhole.radius);
  assertClose(thetaMin, expected, d, 'first minimum angle');
});

test('pinhole: off-centre pinhole loses power symmetrically', () => {
  const t0 = computePinhole(base()).transmission;
  const tPlus = computePinhole({ ...base(), pinholeCentre: { x: 10e-6, y: 0.1 } }).transmission;
  const tMinus = computePinhole({ ...base(), pinholeCentre: { x: -10e-6, y: 0.1 } }).transmission;
  const tFar = computePinhole({ ...base(), pinholeCentre: { x: 20e-6, y: 0.1 } }).transmission;
  assertClose(tPlus, tMinus, 1e-6, 'symmetric in x');
  assert(tPlus < t0 && tFar < tPlus, `should decrease with offset: ${t0}, ${tPlus}, ${tFar}`);
});

test('pinhole: defocus lowers transmission', () => {
  const tFocus = computePinhole(base()).transmission;
  const tNear = computePinhole({ ...base(), defocus: 0.3e-3 }).transmission;
  const tFar = computePinhole({ ...base(), defocus: 2e-3 }).transmission;
  assert(tNear < tFocus && tFar < tNear, `${tFocus} > ${tNear} > ${tFar}`);
});

test('pinhole: beam offset at the objective tilts the far field by −u/f0', () => {
  const r = computePinhole({ ...base(), offset: { x: 0.1e-3, y: 0 } });
  assertClose(r.centroid.x, -0.1e-3 / CONFIG.objective.focalLength, 0.5e-3);
});

test('pinhole: centred at focus blocks the dust noise', () => {
  const r = computePinhole({ ...base(), noise: createNoise(11).components });
  assert(r.noiseTransmission <= 0.01, `noise transmission ${r.noiseTransmission}`);
});

test('pinhole: masked fraction of the far field', () => {
  const r = computePinhole(base());
  assertClose(maskedFraction(r.farField, () => true), 1, 1e-12);
  assertClose(maskedFraction(r.farField, (tx) => tx > 0), 0.5, 0.02);
});
```

Append to `tests/all.js`:

```js
import './optics/pinhole.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/optics/pinhole.js`:

```js
// Spatial filter (handout Fig. 1-1, 1-2): the field in the pinhole plane → far-field pattern and transmission.
// Spec §4.4. Positions are rail-frame metres; angles are radians.
import { CONFIG } from './config.js';

export function computePinhole(p) {
  const {
    wavelength: lambda,
    focalLength: f0,
    beamRadius: W,
    offset: u,
    angle: alpha,
    defocus: dz,
    objectiveAxis: ro,
    pinholeCentre: rp,
    pinholeRadius: a,
    noise = [],
    samples: G = CONFIG.pinholeGrid.samples,
    farFieldSamples: M = CONFIG.pinholeGrid.farFieldSamples,
    farFieldSpan: spanUnits = CONFIG.pinholeGrid.farFieldSpan,
  } = p;
  const k = (2 * Math.PI) / lambda;
  const w0 = (lambda * f0) / (Math.PI * W);
  const zR = (Math.PI * w0 * w0) / lambda;
  const w = w0 * Math.sqrt(1 + (dz / zR) ** 2);
  const invR = dz / (dz * dz + zR * zR);
  const amp = w0 / w;

  // Main beam: direction β = α − u/f0, waist centre ξc = r_o + f0·α. Noise copies are tilted by λν
  // and focus λν·f0 away from ξc. Every component then travels Δz past its waist.
  const bx = alpha.x - u.x / f0;
  const by = alpha.y - u.y / f0;
  const focusCentre = { x: ro.x + f0 * alpha.x, y: ro.y + f0 * alpha.y };
  const comps = [{ cx: focusCentre.x + bx * dz, cy: focusCentre.y + by * dz, tx: bx, ty: by, re: 1, im: 0 }];
  for (const n of noise) {
    const tx = bx + lambda * n.fx;
    const ty = by + lambda * n.fy;
    comps.push({
      cx: focusCentre.x + lambda * n.fx * f0 + tx * dz,
      cy: focusCentre.y + lambda * n.fy * f0 + ty * dz,
      tx,
      ty,
      re: n.re,
      im: n.im,
    });
  }

  // Sample the field over the pinhole on a G×G grid (local coordinates relative to its centre).
  const h = (2 * a) / G;
  const coords = new Float64Array(G);
  for (let i = 0; i < G; i++) coords[i] = -a + (i + 0.5) * h;
  const fieldRe = new Float64Array(G * G);
  const fieldIm = new Float64Array(G * G);
  let mainPower = 0;
  let noisePower = 0;
  for (let j = 0; j < G; j++) {
    const ey = rp.y + coords[j];
    for (let i = 0; i < G; i++) {
      if (coords[i] * coords[i] + coords[j] * coords[j] > a * a) continue;
      const ex = rp.x + coords[i];
      let mr = 0;
      let mi = 0;
      let nr = 0;
      let ni = 0;
      for (let c = 0; c < comps.length; c++) {
        const comp = comps[c];
        const dx = ex - comp.cx;
        const dy = ey - comp.cy;
        const r2 = dx * dx + dy * dy;
        const env = amp * Math.exp(-r2 / (w * w));
        if (env < 1e-12) continue;
        const phase = 0.5 * k * r2 * invR + k * (comp.tx * ex + comp.ty * ey);
        const cr = env * Math.cos(phase);
        const ci = env * Math.sin(phase);
        const vr = comp.re * cr - comp.im * ci;
        const vi = comp.re * ci + comp.im * cr;
        if (c === 0) {
          mr += vr;
          mi += vi;
        } else {
          nr += vr;
          ni += vi;
        }
      }
      fieldRe[j * G + i] = mr + nr;
      fieldIm[j * G + i] = mi + ni;
      mainPower += mr * mr + mi * mi;
      noisePower += nr * nr + ni * ni;
    }
  }
  const beamPower = (Math.PI * w0 * w0) / 2;
  const noiseTotal = noise.reduce((sum, n) => sum + n.re * n.re + n.im * n.im, 0);
  const transmission = Math.min(1, (mainPower * h * h) / beamPower);
  const noiseTransmission = noiseTotal > 0 ? Math.min(1, (noisePower * h * h) / (noiseTotal * beamPower)) : 0;

  // Far field by separable DFT: F = A·E·Aᵀ with A[m][i] = exp(−ik·θm·ρi).
  const span = (spanUnits * W) / f0;
  const dTheta = (2 * span) / M;
  const Ar = new Float64Array(M * G);
  const Ai = new Float64Array(M * G);
  for (let m = 0; m < M; m++) {
    const theta = -span + (m + 0.5) * dTheta;
    for (let i = 0; i < G; i++) {
      const ph = -k * theta * coords[i];
      Ar[m * G + i] = Math.cos(ph);
      Ai[m * G + i] = Math.sin(ph);
    }
  }
  const Tr = new Float64Array(M * G);
  const Ti = new Float64Array(M * G);
  for (let n = 0; n < M; n++) {
    for (let j = 0; j < G; j++) {
      const ar = Ar[n * G + j];
      const ai = Ai[n * G + j];
      for (let i = 0; i < G; i++) {
        const er = fieldRe[j * G + i];
        const ei = fieldIm[j * G + i];
        if (er === 0 && ei === 0) continue;
        Tr[n * G + i] += ar * er - ai * ei;
        Ti[n * G + i] += ar * ei + ai * er;
      }
    }
  }
  const data = new Float32Array(M * M);
  const norm = (h * h) / (Math.PI * w0 * w0);   // a perfect focused spot has ∫E dA = π·w0² → value 1 on axis
  let sum = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  for (let n = 0; n < M; n++) {
    const thetaY = -span + (n + 0.5) * dTheta;
    for (let m = 0; m < M; m++) {
      let fr = 0;
      let fi = 0;
      for (let i = 0; i < G; i++) {
        const tr = Tr[n * G + i];
        const ti = Ti[n * G + i];
        const ar = Ar[m * G + i];
        const ai = Ai[m * G + i];
        fr += tr * ar - ti * ai;
        fi += tr * ai + ti * ar;
      }
      const value = (fr * fr + fi * fi) * norm * norm;
      data[n * M + m] = value;
      const thetaX = -span + (m + 0.5) * dTheta;
      sum += value;
      sx += value * thetaX;
      sy += value * thetaY;
      sxx += value * thetaX * thetaX;
      syy += value * thetaY * thetaY;
    }
  }
  const centroid = sum > 0 ? { x: sx / sum, y: sy / sum } : { x: bx, y: by };
  const varX = sum > 0 ? Math.max(0, sxx / sum - centroid.x ** 2) : 0;
  const varY = sum > 0 ? Math.max(0, syy / sum - centroid.y ** 2) : 0;
  return {
    transmission,
    noiseTransmission,
    farField: { data, size: M, span },
    thetaE: 2 * Math.sqrt((varX + varY) / 2),
    centroid,
    waistRadius: w0,
    spotRadius: w,
    focusCentre,
    spotCentre: { x: comps[0].cx, y: comps[0].cy },
  };
}

export function sampleFarField(farField, tx, ty) {
  const { data, size, span } = farField;
  const d = (2 * span) / size;
  const fx = (tx + span) / d - 0.5;
  const fy = (ty + span) / d - 0.5;
  if (fx < 0 || fy < 0 || fx > size - 1 || fy > size - 1) return 0;
  const i = Math.min(size - 2, Math.floor(fx));
  const j = Math.min(size - 2, Math.floor(fy));
  const ux = fx - i;
  const uy = fy - j;
  const p00 = data[j * size + i];
  const p10 = data[j * size + i + 1];
  const p01 = data[(j + 1) * size + i];
  const p11 = data[(j + 1) * size + i + 1];
  return (p00 * (1 - ux) + p10 * ux) * (1 - uy) + (p01 * (1 - ux) + p11 * ux) * uy;
}

export function maskedFraction(farField, inside) {
  const { data, size, span } = farField;
  const d = (2 * span) / size;
  let total = 0;
  let kept = 0;
  for (let n = 0; n < size; n++) {
    const ty = -span + (n + 0.5) * d;
    for (let m = 0; m < size; m++) {
      const v = data[n * size + m];
      if (v === 0) continue;
      total += v;
      if (inside(-span + (m + 0.5) * d, ty)) kept += v;
    }
  }
  return total > 0 ? kept / total : 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=25 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/optics/pinhole.js tests
git commit -m "feat(optics): simulate the pinhole spatial filter with a far-field DFT" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Screen image, tone map and colours

**Files:**
- Create: `js/optics/screen.js`
- Test: `tests/optics/screen.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `CONFIG` (Task 2); `noiseMultiplier` (Task 5); `sampleFarField` (Task 6); `createNoise` (tests only).
- Produces (all samplers return intensity relative to the ideal aligned peak at the same screen position):
  - `toneMap(relative) → [0,1]` (v = log10(1 + k·I)/log10(1 + k), k = 1000), `beamColour(v) → [r, g, b]`, `cardPixel(relative) → [r, g, b]` (dim card + green light).
  - `screenWindow(expectedDiameter) → m` (2.5×, clamped 5–150 mm).
  - `rawBeamSampler({ centre, radius, noise, clips })` where `clips` = `[{ centre, radius, hole, r }]` (beam centre and radius at a clipping plane, its hole centre and radius).
  - `angularSampler({ pattern(tx, ty), A, B, masks })` maps screen position → angle θ = (x − B)/A.
  - `expandedPattern({ direction, angularRadius, focalLength, noise })` → `pattern(tx, ty)`.
  - `gaussianSpotSampler({ centre, radius })`.
  - `renderScreen({ sample, centre, size, pixels? }) → { image: Float32Array(pixels²), pixels, size, centre, d4sigma, centroid, peak }` (row 0 = top).

- [ ] **Step 1: Write the failing tests**

`tests/optics/screen.test.js`:

```js
import { test, assert, assertEqual, assertClose, assertRelClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { createNoise } from '../../js/optics/noise.js';
import {
  toneMap, beamColour, cardPixel, screenWindow, rawBeamSampler, angularSampler,
  expandedPattern, gaussianSpotSampler, renderScreen,
} from '../../js/optics/screen.js';

test('screen: tone map is 0 at 0, 1 at the reference, and monotonic', () => {
  assertClose(toneMap(0), 0, 0);
  assertClose(toneMap(1), 1, 1e-12);
  assertClose(toneMap(0.001), Math.log10(2) / Math.log10(1001), 1e-12);
  assert(toneMap(0.01) < toneMap(0.1) && toneMap(0.1) < toneMap(0.5), 'monotonic');
  assertClose(toneMap(5), 1, 0, 'clamped');
});

test('screen: colours go from black to green to near-white; the card stays dim when unlit', () => {
  assertEqual(beamColour(0).join(), '0,0,0');
  assertEqual(beamColour(1).join(), '230,255,230');
  assertEqual(cardPixel(0).join(), '68,70,72');
  assertEqual(cardPixel(1)[1], 255);
});

test('screen: window size is 2.5× the beam, clamped to 5–150 mm', () => {
  assertClose(screenWindow(10e-3), 25e-3, 1e-12);
  assertClose(screenWindow(0.1e-3), 5e-3, 1e-12);
  assertClose(screenWindow(1), 0.150, 1e-12);
});

test('screen: D4σ of a Gaussian spot equals its 1/e² diameter', () => {
  const centre = { x: 0.2e-3, y: 0.1 };
  const shot = renderScreen({ sample: gaussianSpotSampler({ centre, radius: 1e-3 }), centre, size: 6e-3 });
  assertRelClose(shot.d4sigma, 2e-3, 0.02);
  assertClose(shot.centroid.x, centre.x, 1e-6);
  assertClose(shot.peak, 1, 0.01);
});

test('screen: expanded beam is the magnified input (D4σ = 2·W·D/f0)', () => {
  const W = CONFIG.laser.waistRadius;
  const f0 = CONFIG.objective.focalLength;
  const D = 0.1;
  const centre = { x: 0, y: 0.1 };
  const pattern = expandedPattern({ direction: { x: 0, y: 0 }, angularRadius: W / f0, focalLength: f0, noise: null });
  const sample = angularSampler({ pattern, A: D, B: centre });
  const shot = renderScreen({ sample, centre, size: screenWindow((2 * W * D) / f0) });
  assertRelClose(shot.d4sigma, (2 * W * D) / f0, 0.02);
});

test('screen: raw beam shows the dust noise; a small hole shrinks the spot', () => {
  const centre = { x: 0, y: 0.1 };
  const radius = 0.6e-3;
  const noisy = renderScreen({ sample: rawBeamSampler({ centre, radius, noise: createNoise(3) }), centre, size: 3e-3, pixels: 128 });
  const clean = renderScreen({ sample: rawBeamSampler({ centre, radius, noise: null }), centre, size: 3e-3, pixels: 128 });
  let diff = 0;
  let count = 0;
  for (let i = 0; i < clean.image.length; i++) {
    if (clean.image[i] > Math.exp(-2)) {
      diff += Math.abs(noisy.image[i] / clean.image[i] - 1);
      count += 1;
    }
  }
  assert(diff / count > 0.05, `mean relative noise ${diff / count}`);
  const clipped = renderScreen({
    sample: rawBeamSampler({ centre, radius, noise: null, clips: [{ centre, radius, hole: centre, r: 0.2e-3 }] }),
    centre,
    size: 3e-3,
    pixels: 128,
  });
  assert(clipped.d4sigma < clean.d4sigma * 0.5, 'a small hole shrinks the spot');
});
```

Append to `tests/all.js`:

```js
import './optics/screen.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/optics/screen.js`:

```js
// What the observation screen shows (spec §4.5): samplers for each beam state, rendering, D4σ, tone map, colours.
// Samplers return intensity relative to the ideal aligned peak at the same screen position.
import { CONFIG } from './config.js';
import { noiseMultiplier } from './noise.js';

export function toneMap(relative) {
  if (!(relative > 0)) return 0;
  const { k } = CONFIG.tone;
  return Math.min(1, Math.log10(1 + k * relative) / Math.log10(1 + k));
}

// Green that rolls off toward white near saturation.
export function beamColour(v) {
  const x = Math.min(1, Math.max(0, v));
  const g = Math.min(1, x / 0.8);
  const w = Math.max(0, (x - 0.8) / 0.2);
  return [Math.round(30 * g + 200 * w), Math.round(255 * g), Math.round(60 * g + 170 * w)];
}

const CARD_BASE = [68, 70, 72];

// A white card in a dim lab, lit by the green beam.
export function cardPixel(relative) {
  const [r, g, b] = beamColour(toneMap(relative));
  return [Math.min(255, CARD_BASE[0] + r), Math.min(255, CARD_BASE[1] + g), Math.min(255, CARD_BASE[2] + b)];
}

export function screenWindow(expectedDiameter) {
  const { windowFactor, windowMin, windowMax } = CONFIG.screen;
  return Math.min(windowMax, Math.max(windowMin, windowFactor * expectedDiameter));
}

// Laser beam before the objective: Gaussian with dust noise, clipped by earlier holes.
export function rawBeamSampler({ centre, radius, noise, clips = [] }) {
  const noiseScale = CONFIG.laser.waistRadius / radius;
  return (x, y) => {
    const dx = x - centre.x;
    const dy = y - centre.y;
    for (const c of clips) {
      const s = c.radius / radius;
      const px = c.centre.x + dx * s - c.hole.x;
      const py = c.centre.y + dy * s - c.hole.y;
      if (px * px + py * py > c.r * c.r) return 0;
    }
    const env = Math.exp((-2 * (dx * dx + dy * dy)) / (radius * radius));
    if (env < 1e-9) return 0;
    return noise ? env * noiseMultiplier(noise, dx * noiseScale, dy * noiseScale) : env;
  };
}

// A beam that spreads from a point source with an angular pattern: x = A·θ + B at the screen.
export function angularSampler({ pattern, A, B, masks = [] }) {
  return (x, y) => {
    const tx = (x - B.x) / A;
    const ty = (y - B.y) / A;
    for (const inside of masks) if (!inside(tx, ty)) return 0;
    return pattern(tx, ty);
  };
}

// After the objective without a pinhole: the magnified, inverted raw beam (spec §4.4 item 6).
export function expandedPattern({ direction, angularRadius, focalLength, noise }) {
  return (tx, ty) => {
    const rx = tx - direction.x;
    const ry = ty - direction.y;
    const env = Math.exp((-2 * (rx * rx + ry * ry)) / (angularRadius * angularRadius));
    if (env < 1e-9) return 0;
    return noise ? env * noiseMultiplier(noise, -rx * focalLength, -ry * focalLength) : env;
  };
}

export function gaussianSpotSampler({ centre, radius }) {
  return (x, y) => {
    const dx = x - centre.x;
    const dy = y - centre.y;
    return Math.exp((-2 * (dx * dx + dy * dy)) / (radius * radius));
  };
}

// Render a square window centred on `centre`; row 0 is the top. D4σ = mean of 4σx and 4σy.
export function renderScreen({ sample, centre, size, pixels = CONFIG.screen.imageSize }) {
  const image = new Float32Array(pixels * pixels);
  const step = size / pixels;
  let sum = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let peak = 0;
  for (let j = 0; j < pixels; j++) {
    const y = centre.y + size / 2 - (j + 0.5) * step;
    for (let i = 0; i < pixels; i++) {
      const x = centre.x - size / 2 + (i + 0.5) * step;
      const v = sample(x, y);
      image[j * pixels + i] = v;
      if (v > 0) {
        sum += v;
        sx += v * x;
        sy += v * y;
        sxx += v * x * x;
        syy += v * y * y;
        if (v > peak) peak = v;
      }
    }
  }
  let d4sigma = 0;
  let centroid = { x: centre.x, y: centre.y };
  if (sum > 0) {
    centroid = { x: sx / sum, y: sy / sum };
    const varX = Math.max(0, sxx / sum - centroid.x ** 2);
    const varY = Math.max(0, syy / sum - centroid.y ** 2);
    d4sigma = 2 * (Math.sqrt(varX) + Math.sqrt(varY));
  }
  return { image, pixels, size, centre, d4sigma, centroid, peak };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=31 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/optics/screen.js tests
git commit -m "feat(optics): add screen samplers, rendering, tone map and colours" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Bench state and pure updates

**Files:**
- Create: `js/lab/state.js`
- Test: `tests/lab/state.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `CONFIG` (Task 2); `createRng`, `deriveSeed`, `uniform`, `randomSign`, `randomVector`, `SALT` (Task 2).
- Produces (all updates return a **new** state object, or the same object when the update is refused):
  - `PART_IDS = ['a1', 'a2', 'sf', 'lens', 'screen']`, `VALUE_PATHS` (settable paths).
  - `createInitialState(seed) → BenchState`:
    ```
    { seed,
      laser: { on, pitch, yaw },                                   // knob values (rad)
      parts: { a1: { onRail, z, height, opening }, a2: {…},
               sf: { onRail, z, height, objective, pinhole, objX, objY, focus, phX, phY },
               lens: { onRail, z, height }, screen: { onRail, z, mark } },
      hidden: { laserHeight, pitch0, yaw0, objectiveOffset, pinholeOffset },   // offsets null until installed
      stats: { screenTravel } }
    ```
    `sf.z` is the pinhole plane; `screen.mark` is `{x, y}` relative to the card centre or `null`.
  - `getValue(state, path)`, `setValue(state, path, value)` (clamped; throws on unknown path), `setLaserOn(state, on)`.
  - `isFree(state, id, z) → bool`, `snapZ(z)`, `nearestFreeZ(state, id, wanted) → z | null`, `placePart(state, id, z)`, `removePart(state, id)`.
  - `installObjective(state, beamAtMount)`, `installPinhole(state, focusCentre)`, `markScreen(state, beamAtScreen)`.

- [ ] **Step 1: Write the failing tests**

`tests/lab/state.test.js`:

```js
import { test, assert, assertEqual, assertClose, assertThrows } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import * as S from '../../js/lab/state.js';

test('state: initial state is deterministic and hidden values are in range', () => {
  assertEqual(JSON.stringify(S.createInitialState(5)), JSON.stringify(S.createInitialState(5)));
  for (let seed = 0; seed < 200; seed++) {
    const s = S.createInitialState(seed);
    for (const tilt of [s.hidden.pitch0, s.hidden.yaw0]) {
      assert(Math.abs(tilt) >= CONFIG.laser.tiltMin && Math.abs(tilt) <= CONFIG.laser.tiltMax, `tilt ${tilt}`);
      assert(Math.abs(tilt) <= CONFIG.laser.knobRange, 'tilt correctable by the knobs');
    }
    const h = s.hidden.laserHeight;
    assert(Math.abs(h - CONFIG.laser.exitHeight) <= CONFIG.laser.exitHeightJitter + 1e-12, `height ${h}`);
    assert(h >= CONFIG.post.min && h <= CONFIG.post.max, 'reachable by posts');
  }
  const s = S.createInitialState(5);
  assertEqual(s.laser.on, false);
  assertEqual(s.parts.a1.onRail, false);
  assertEqual(s.hidden.objectiveOffset, null);
});

test('state: setValue clamps, rejects unknown paths and never mutates its input', () => {
  let s = S.createInitialState(1);
  s = S.setValue(s, 'parts.a1.opening', 0);
  assertClose(s.parts.a1.opening, CONFIG.iris.openingMin, 0);
  s = S.setValue(s, 'laser.pitch', 1);
  assertClose(s.laser.pitch, CONFIG.laser.knobRange, 0);
  assertThrows(() => S.setValue(s, 'parts.a1.colour', 1));
  const before = S.createInitialState(1);
  S.setValue(before, 'parts.a1.height', 0.09);
  assertClose(before.parts.a1.height, CONFIG.post.initial, 0);
});

test('state: placing parts snaps to 1 mm, refuses overlaps and out-of-range', () => {
  let s = S.createInitialState(1);
  s = S.placePart(s, 'a1', 0.1004);
  assertClose(s.parts.a1.z, 0.100, 1e-12);
  assert(s.parts.a1.onRail, 'on rail');
  assertEqual(S.placePart(s, 'a2', 0.105), s, 'overlap refused (same object returned)');
  assertEqual(S.placePart(s, 'a2', 1.5), s, 'beyond the rail refused');
  const z = S.nearestFreeZ(s, 'a2', 0.100);
  assert(z !== null && Math.abs(z - 0.100) >= 0.025 - 1e-9, `nearest free z ${z}`);
  assertEqual(S.removePart(s, 'a1').parts.a1.onRail, false);
});

test('state: moving the screen accumulates travel', () => {
  let s = S.createInitialState(1);
  s = S.placePart(s, 'screen', 0.9);
  assertClose(s.stats.screenTravel, 0, 0, 'first placement is not travel');
  s = S.placePart(s, 'screen', 1.0);
  s = S.placePart(s, 'screen', 0.8);
  assertClose(s.stats.screenTravel, 0.3, 1e-9);
});

test('state: installing the objective and pinhole draws offsets within range', () => {
  let s = S.createInitialState(9);
  s = S.placePart(s, 'sf', 0.25);
  const beam = { x: 0.1e-3, y: s.parts.sf.height + 0.2e-3 };
  s = S.installObjective(s, beam);
  assert(s.parts.sf.objective, 'installed');
  const extra = { x: s.hidden.objectiveOffset.x - beam.x, y: s.hidden.objectiveOffset.y - (beam.y - s.parts.sf.height) };
  const m = Math.hypot(extra.x, extra.y);
  assert(m >= CONFIG.objective.installOffsetMin - 1e-12 && m <= CONFIG.objective.installOffsetMax + 1e-12, `objective extra ${m}`);
  assertEqual(S.installObjective(s, beam), s, 'second install is a no-op');
  const focus = { x: 0, y: s.parts.sf.height };
  const p = S.installPinhole(s, focus).hidden.pinholeOffset;
  const pm = Math.hypot(p.x, p.y);
  assert(pm >= CONFIG.pinhole.installOffsetMin - 1e-12 && pm <= CONFIG.pinhole.installOffsetMax + 1e-12, `pinhole extra ${pm}`);
  assertEqual(S.installPinhole(S.createInitialState(9), focus).parts.sf.pinhole, false, 'pinhole needs the objective');
});

test('state: marking the screen stores the spot relative to the card centre', () => {
  const s = S.markScreen(S.createInitialState(1), { x: 1e-3, y: CONFIG.screen.centreHeight + 2e-3 });
  assertClose(s.parts.screen.mark.x, 1e-3, 1e-12);
  assertClose(s.parts.screen.mark.y, 2e-3, 1e-12);
});
```

Append to `tests/all.js`:

```js
import './lab/state.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/lab/state.js`:

```js
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
    stats: { screenTravel: 0 },
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
  if (id === 'screen' && part.onRail) next.stats.screenTravel += Math.abs(target - part.z);
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=37 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/lab tests
git commit -m "feat(lab): add bench state with clamped updates, rail placement and install offsets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: bench() — trace the beam through the bench

**Files:**
- Create: `js/optics/bench.js`
- Create: `tests/fixtures.js`
- Test: `tests/optics/bench.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: Tasks 2–8 (`CONFIG`, ray, gaussian, iris, noise, pinhole, screen; `BenchState` shape and `placePart`/`setValue`/`removePart` in tests).
- Produces:
  - Geometry helpers: `laserAngles(state) → {x: yaw total, y: pitch total}`, `objectiveAxis(state)`, `pinholeCentre(state)`, `defocus(state) → Δz`, `objectivePlaneZ(state, focus?)`, `ringPlaneZ(state)`.
  - `bench(state, { render = true }) → BenchResult`:
    ```
    { laserOn, beamAngles: {x, y}, focusDz,
      at: { a1?, a2?, ring?: { x, y, offset: {x, y}, w, T },
            objective?: { x, y, z, u, W, alpha, focusCentre },
            pinhole?: { x, y, T }, lens?: { x, y, offset, w, T, extent }, screen?: { x, y } },
      irisFaces: { a1?, a2?, ring?: { dx, dy, radius, r } },
      segments: [{ z0, x0, y0, z1, x1, y1, r0, r1, power }],
      spots: [{ z, x, y, radius, power }],
      stoppedAt: 'a1'|'a2'|'ring'|'pinhole'|'lens'|'screen'|'block'|null,
      powerAtScreen, pinhole: computePinhole result | null,
      planeA: { holeRadius, rings: [{ x, y, radius }] } | null,      // offsets relative to the Aperture 1 hole
      screen: { window: renderScreen result, card: renderScreen result, d4sigma, centre } | null,
      divergence: { L, theta, state: 'collimated'|'diverging'|'converging' } | null }
    ```
    `at.<part>` is recorded whenever the beam reaches that plane (even if it then stops there).
  - `objectiveAlignmentAt(state, focus) → { planeA, a2 }` — largest plane-A ring offset and the expanded-beam offset at Aperture 2 (m) with the objective at `focus` (`Infinity` when not measurable). Cached per state object.
  - `tests/fixtures.js`: `alignedLaser(seed)`, `afterStep1(seed)`, `fullyAligned(seed)`.

- [ ] **Step 1: Write the fixtures and the failing tests**

`tests/fixtures.js`:

```js
// Shared test states: a laser with no hidden tilt, and aligned setups at the end of steps.
import { CONFIG } from '../js/optics/config.js';
import * as S from '../js/lab/state.js';

export function alignedLaser(seed = 1) {
  const s = S.createInitialState(seed);
  s.hidden.pitch0 = 0;
  s.hidden.yaw0 = 0;
  s.hidden.laserHeight = 0.100;
  s.laser.on = true;
  return s;
}

// Laser plus both irises closed and centred (end of step 1).
export function afterStep1(seed = 1) {
  let s = alignedLaser(seed);
  s = S.placePart(s, 'a1', 0.100);
  s = S.placePart(s, 'a2', 0.800);
  s = S.setValue(s, 'parts.a1.opening', CONFIG.iris.openingMin);
  s = S.setValue(s, 'parts.a2.opening', CONFIG.iris.openingMin);
  return s;
}

// Objective and pinhole centred and focused, Aperture 1 trimming before the lens, lens at f_e, Aperture 2 removed.
export function fullyAligned(seed = 1) {
  let s = afterStep1(seed);
  s = S.placePart(s, 'sf', 0.250);
  s.parts.sf.objective = true;
  s.parts.sf.pinhole = true;
  s.hidden.objectiveOffset = { x: 0, y: 0 };
  s.hidden.pinholeOffset = { x: 0, y: 0 };
  s.parts.sf.focus = CONFIG.objective.focusAt;
  s = S.removePart(s, 'a2');
  s = S.removePart(s, 'a1');
  s = S.placePart(s, 'a1', 0.350);
  s = S.setValue(s, 'parts.a1.opening', 8e-3);
  s = S.placePart(s, 'lens', 0.250 + CONFIG.lens.focalLength);
  s = S.placePart(s, 'screen', 0.900);
  return s;
}
```

`tests/optics/bench.test.js`:

```js
import { test, assert, assertEqual, assertClose, assertRelClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import * as S from '../../js/lab/state.js';
import { bench, objectiveAlignmentAt, objectivePlaneZ } from '../../js/optics/bench.js';
import { afterStep1, fullyAligned } from '../fixtures.js';

function withObjective() {
  let s = afterStep1();
  s = S.placePart(s, 'sf', 0.250);
  s.parts.sf.objective = true;
  s.hidden.objectiveOffset = { x: 0, y: 0 };
  return s;
}

test('bench: laser off gives no beam', () => {
  const r = bench(S.createInitialState(1));
  assertEqual(r.laserOn, false);
  assertEqual(r.segments.length, 0);
  assertEqual(r.powerAtScreen, 0);
});

test('bench: aligned beam passes two closed irises and reaches the beam block', () => {
  const r = bench(afterStep1());
  assertClose(r.at.a1.T, 1 - Math.exp(-2), 0.01, 'A1 transmission (1 mm hole, 1 mm beam)');
  assert(r.at.a2.T > 0.5, `A2 transmission ${r.at.a2.T}`);
  assertClose(Math.hypot(r.at.a2.offset.x, r.at.a2.offset.y), 0, 1e-9);
  assertEqual(r.stoppedAt, 'block');
  assertEqual(r.segments.length, 3, 'laser→A1→A2→block');
});

test('bench: a tilted beam is stopped by the far iris', () => {
  const s = afterStep1();
  s.hidden.pitch0 = 2e-3;
  const r = bench(s);
  assertClose(r.at.a2.offset.y, 2e-3 * 0.8, 1e-9, 'beam 1.6 mm high at 0.8 m');
  assertEqual(r.stoppedAt, 'a2');
  assertEqual(r.powerAtScreen, 0);
});

test('bench: eq. 1-1 — the filtered beam is 22.2 mm across at the lens', () => {
  const r = bench(fullyAligned());
  assert(r.pinhole.transmission >= 0.999, `T_ph ${r.pinhole.transmission}`);
  const expected = (CONFIG.lens.focalLength / CONFIG.objective.focalLength) * 2 * CONFIG.laser.waistRadius;
  assertRelClose(2 * r.at.lens.w, expected, 0.02);
  assertRelClose(r.at.lens.extent, 16e-3, 0.02, 'iris-trimmed extent at the lens');
});

test('bench: collimation follows the lens distance', () => {
  const exact = bench(fullyAligned()).divergence;
  assertEqual(exact.state, 'collimated');
  assert(Math.abs(exact.theta) < 0.05e-3, `θ' at L = f_e: ${exact.theta}`);
  const moved = (dz) => {
    const s = fullyAligned();
    return bench(S.placePart(s, 'lens', s.parts.lens.z + dz)).divergence;
  };
  assertEqual(moved(-0.010).state, 'diverging');
  assertEqual(moved(0.010).state, 'converging');
});

test('bench: plane A rings are centred only when the objective is centred', () => {
  const s = withObjective();
  for (const ring of bench(s).planeA.rings) assertClose(Math.hypot(ring.x, ring.y), 0, 1e-9);
  const delta = 0.1e-3;
  const shifted = bench(S.setValue(s, 'parts.sf.objX', delta)).planeA;
  const dA = objectivePlaneZ(s) - s.parts.a1.z;
  CONFIG.objective.surfaceRadii.forEach((R, j) => {
    assertRelClose(shifted.rings[j].x, (-delta * 2 * dA) / R, 1e-6, `ring ${j}`);
  });
});

test('bench: objective alignment probe reports plane-A and Aperture 2 offsets', () => {
  const s = withObjective();
  const good = objectiveAlignmentAt(s, 0);
  assert(good.planeA < 1e-9 && good.a2 < 1e-9, `centred: ${JSON.stringify(good)}`);
  const bad = objectiveAlignmentAt(S.setValue(s, 'parts.sf.objX', 0.1e-3), CONFIG.objective.travel);
  assert(bad.planeA > 0.5e-3 && bad.a2 > 1e-3, `decentred: ${JSON.stringify(bad)}`);
});

test('bench: the screen shows a bright filtered spot when everything is aligned', () => {
  const r = bench(fullyAligned());
  assert(r.screen && r.screen.window.peak > 0.5, 'bright spot');
  assert(r.powerAtScreen > 0.3, `power at screen ${r.powerAtScreen}`);
  assertRelClose(r.screen.window.d4sigma, 16e-3, 0.25, 'iris-trimmed beam at the screen');
});
```

Append to `tests/all.js`:

```js
import './optics/bench.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/optics/bench.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=45 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/optics/bench.js tests
git commit -m "feat(optics): trace the beam through the bench with bench(state)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Chapter 1 steps, checks, hints and warnings

**Files:**
- Create: `js/lab/steps.js`
- Test: `tests/lab/steps.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `CONFIG` (Task 2); `objectiveAlignmentAt` (Task 9); state functions (Task 8) and `bench` (Task 9) in tests; fixtures (Task 9).
- Produces:
  - `STEPS` — array of `{ id, parts, controls, insets, camera, checks: [{ id, test(state, result, flow) }], hints (count), questions }` with ids `start, s1, s2a, s2b, s3, s4, done`. i18n keys: `step.<id>.title`, `step.<id>.body`, `step.<id>.check.<checkId>`, `step.<id>.hint.<n>` (1-based), `question.<qid>`.
  - Control ids used in `controls`: `laser.power`, `laser.pitch`, `laser.yaw`, `a1.z`, `a1.height`, `a1.opening`, `a2.z`, `a2.height`, `a2.opening`, `a2.remove`, `sf.z`, `sf.height`, `sf.objective`, `sf.objX`, `sf.objY`, `sf.focus`, `sf.pinhole`, `sf.phX`, `sf.phY`, `lens.z`, `lens.height`, `screen.z`, `screen.mark`.
  - Inset ids: `a1`, `a2`, `ring`, `planeA`, `screen`. Camera presets: `overview`, `laser`, `filter`, `screen`.
  - `STEP_LABELS`, `createFlow() → { index, stepStart: { screenTravel, time }, hintsShown, warningsShown, active }`, `currentStep(flow)`, `evaluateChecks(flow, state, result) → [{ id, pass }]`, `canAdvance(flow, state, result)`, `advance(flow, state, now)`, `revealHint(flow)`, `isPartUnlocked(flow, id)`, `lockedPartStepLabel(id) → '1'|'2a'|'4'`, `unlockedControls(flow) → { current, earlier }`, `detectWarnings(flow, prev, next, result) → { flow, shown: ['m1'…] }`.

- [ ] **Step 1: Write the failing tests**

`tests/lab/steps.test.js`:

```js
import { test, assert, assertEqual } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { bench } from '../../js/optics/bench.js';
import * as S from '../../js/lab/state.js';
import * as F from '../../js/lab/steps.js';
import { afterStep1, fullyAligned } from '../fixtures.js';

const flowAt = (id) => ({ ...F.createFlow(), index: F.STEPS.findIndex((s) => s.id === id) });

test('steps: step 1 passes when aligned and fails with a 1 mrad tilt', () => {
  const s = afterStep1();
  assert(F.canAdvance(flowAt('s1'), s, bench(s)), JSON.stringify(F.evaluateChecks(flowAt('s1'), s, bench(s))));
  const tilted = afterStep1();
  tilted.hidden.pitch0 = 1e-3;
  assert(!F.canAdvance(flowAt('s1'), tilted, bench(tilted)), 'tilted beam must not pass');
});

test('steps: M1 fires for a far iris height change in step 1, not a near one', () => {
  const s = afterStep1();
  const r = bench(s);
  assertEqual(F.detectWarnings(flowAt('s1'), s, S.setValue(s, 'parts.a2.height', 0.101), r).shown.join(), 'm1');
  assertEqual(F.detectWarnings(flowAt('s1'), s, S.setValue(s, 'parts.a1.height', 0.101), r).shown.length, 0);
});

test('steps: M2 fires once per continuous laser adjustment after step 1', () => {
  let flow = flowAt('s2a');
  const s0 = afterStep1();
  const r = bench(s0);
  const s1 = S.setValue(s0, 'laser.pitch', 0.1e-3);
  let out = F.detectWarnings(flow, s0, s1, r);
  assertEqual(out.shown.join(), 'm2');
  flow = out.flow;
  const s2 = S.setValue(s1, 'laser.pitch', 0.2e-3);
  out = F.detectWarnings(flow, s1, s2, r);
  assertEqual(out.shown.length, 0, 'still the same adjustment');
  flow = out.flow;
  const s3 = S.setValue(s2, 'parts.a1.opening', 2e-3);
  flow = F.detectWarnings(flow, s2, s3, r).flow;
  const s4 = S.setValue(s3, 'laser.yaw', 0.1e-3);
  assertEqual(F.detectWarnings(flow, s3, s4, r).shown.join(), 'm2', 'a different action re-arms the warning');
  assertEqual(F.detectWarnings(flowAt('s1'), s0, s1, r).shown.length, 0, 'laser knobs are allowed in step 1');
});

test('steps: step 3 needs a focused, centred pinhole', () => {
  const s = S.setValue(fullyAligned(), 'parts.a2.opening', 8e-3);
  const clean = (state) => F.evaluateChecks(flowAt('s3'), state, bench(state)).find((c) => c.id === 'clean').pass;
  assert(clean(s), 'focused and centred');
  assert(!clean(S.setValue(s, 'parts.sf.focus', CONFIG.objective.focusAt + 0.5e-3)), 'defocused by 0.5 mm');
});

test('steps: step 4 passes when collimated and fails while Aperture 2 is on the rail', () => {
  const flow = flowAt('s4');
  let s = fullyAligned();
  s = S.placePart(s, 'screen', 0.700);
  s = S.placePart(s, 'screen', 1.000);
  assert(F.canAdvance(flow, s, bench(s)), JSON.stringify(F.evaluateChecks(flow, s, bench(s))));
  const withA2 = S.placePart(s, 'a2', 1.100);
  assert(!F.canAdvance(flow, withA2, bench(withA2)), 'Aperture 2 still on the rail');
});

test('steps: parts unlock in handout order', () => {
  assert(!F.isPartUnlocked(flowAt('start'), 'a1'), 'nothing before step 1');
  assert(F.isPartUnlocked(flowAt('s1'), 'a1') && !F.isPartUnlocked(flowAt('s1'), 'sf'), 'irises in step 1');
  assert(F.isPartUnlocked(flowAt('s2a'), 'sf') && F.isPartUnlocked(flowAt('s2a'), 'screen'), 'mount and screen in 2a');
  assert(!F.isPartUnlocked(flowAt('s3'), 'lens') && F.isPartUnlocked(flowAt('s4'), 'lens'), 'lens in step 4');
  assertEqual(F.lockedPartStepLabel('lens'), '4');
  const { current, earlier } = F.unlockedControls(flowAt('s2a'));
  assert(current.includes('sf.height') && earlier.includes('laser.pitch'), 'current and earlier controls');
});

// Play every step with ideal actions, computed from the hidden offsets: every random start must be solvable.
function solve(seed) {
  let state = S.createInitialState(seed);
  let flow = F.createFlow();
  const finish = (id) => {
    const result = bench(state);
    assertEqual(F.currentStep(flow).id, id);
    const failing = F.evaluateChecks(flow, state, result).filter((c) => !c.pass).map((c) => c.id);
    assert(failing.length === 0, `seed ${seed}, step ${id}: failing ${failing.join(', ')}`);
    flow = F.advance(flow, state, 0);
  };
  state = S.setLaserOn(state, true);
  finish('start');

  state = S.setValue(state, 'laser.pitch', -state.hidden.pitch0);
  state = S.setValue(state, 'laser.yaw', -state.hidden.yaw0);
  state = S.placePart(state, 'a1', 0.100);
  state = S.placePart(state, 'a2', 0.800);
  for (const id of ['a1', 'a2']) {
    state = S.setValue(state, `parts.${id}.height`, state.hidden.laserHeight);
    state = S.setValue(state, `parts.${id}.opening`, CONFIG.iris.openingMin);
  }
  finish('s1');

  state = S.placePart(state, 'sf', 0.250);
  state = S.setValue(state, 'parts.sf.height', state.hidden.laserHeight);
  state = S.placePart(state, 'screen', 0.900);
  state = S.markScreen(state, bench(state).at.screen);
  finish('s2a');

  state = S.installObjective(state, bench(state).at.ring);
  const obj = bench(state).at.objective;
  const oo = state.hidden.objectiveOffset;
  state = S.setValue(state, 'parts.sf.objX', obj.x - oo.x);
  state = S.setValue(state, 'parts.sf.objY', obj.y - state.parts.sf.height - oo.y);
  state = S.setValue(state, 'parts.sf.focus', CONFIG.objective.travel);
  finish('s2b');

  state = S.installPinhole(state, bench(state).at.objective.focusCentre);
  state = S.removePart(state, 'screen');
  state = S.placePart(state, 'screen', 0.400);
  state = S.setValue(state, 'parts.sf.focus', CONFIG.objective.focusAt);
  const spot = bench(state).at.objective.focusCentre;
  const po = state.hidden.pinholeOffset;
  state = S.setValue(state, 'parts.sf.phX', spot.x - po.x);
  state = S.setValue(state, 'parts.sf.phY', spot.y - state.parts.sf.height - po.y);
  state = S.setValue(state, 'parts.a2.opening', 8e-3);
  finish('s3');

  state = S.removePart(state, 'a2');
  state = S.removePart(state, 'a1');
  state = S.placePart(state, 'a1', 0.350);
  state = S.setValue(state, 'parts.a1.opening', 8e-3);
  state = S.removePart(state, 'screen');
  state = S.placePart(state, 'lens', 0.250 + CONFIG.lens.focalLength);
  state = S.setValue(state, 'parts.lens.height', bench(state).at.lens.y);
  state = S.placePart(state, 'screen', 0.700);
  state = S.placePart(state, 'screen', 1.000);
  finish('s4');
  assertEqual(F.currentStep(flow).id, 'done');
}

test('steps: ideal actions complete every step for several random starts', () => {
  for (const seed of [1, 2, 3, 4, 5]) solve(seed);
});
```

Append to `tests/all.js`:

```js
import './lab/steps.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/lab/steps.js`:

```js
// Chapter 1 procedure (handout §4A, Fig. 1-4): steps, checks, hints, warnings (spec §3.5–3.6). Pure logic.
import { CONFIG } from '../optics/config.js';
import { objectiveAlignmentAt } from '../optics/bench.js';

const C = CONFIG.checks;
const W = CONFIG.warnings;
const len = (v) => (v ? Math.hypot(v.x, v.y) : Infinity);
const travelEnds = () => [0, CONFIG.objective.travel];

export const STEPS = Object.freeze([
  {
    id: 'start',
    parts: [],
    controls: ['laser.power'],
    insets: [],
    camera: 'overview',
    checks: [{ id: 'on', test: (s) => s.laser.on }],
    hints: 1,
    questions: [],
  },
  {
    id: 's1',
    parts: ['a1', 'a2'],
    controls: ['laser.pitch', 'laser.yaw', 'a1.z', 'a1.height', 'a1.opening', 'a2.z', 'a2.height', 'a2.opening'],
    insets: ['a1', 'a2'],
    camera: 'laser',
    checks: [
      {
        id: 'closed',
        test: (s) => s.parts.a1.onRail && s.parts.a2.onRail
          && s.parts.a1.opening <= C.s1.openingMax && s.parts.a2.opening <= C.s1.openingMax,
      },
      { id: 'positions', test: (s) => s.parts.a1.onRail && s.parts.a2.onRail && s.parts.a1.z <= C.s1.a1MaxZ && s.parts.a2.z >= C.s1.a2MinZ },
      { id: 'passes', test: (s, r) => len(r.at.a1?.offset) <= C.s1.centreTol && len(r.at.a2?.offset) <= C.s1.centreTol },
      { id: 'parallel', test: (s, r) => Math.abs(r.beamAngles.x) <= C.s1.angleTol && Math.abs(r.beamAngles.y) <= C.s1.angleTol },
    ],
    hints: 4,
    questions: [],
  },
  {
    id: 's2a',
    parts: ['sf', 'screen'],
    controls: ['sf.z', 'sf.height', 'screen.z', 'screen.mark'],
    insets: ['ring', 'screen'],
    camera: 'filter',
    checks: [
      {
        id: 'mount',
        test: (s) => {
          const { a1, a2, sf } = s.parts;
          return sf.onRail && a1.onRail && a2.onRail && a1.z < sf.z && sf.z < a2.z && sf.z <= C.s2a.sfMaxZ;
        },
      },
      { id: 'centred', test: (s, r) => len(r.at.ring?.offset) <= C.s2a.centreTol },
      { id: 'a2far', test: (s) => s.parts.a2.onRail && s.parts.sf.onRail && s.parts.a2.z - s.parts.sf.z >= C.s2a.a2MinGap },
      {
        id: 'marked',
        test: (s) => s.parts.screen.onRail && s.parts.a2.onRail && s.parts.screen.z > s.parts.a2.z && s.parts.screen.mark !== null,
      },
    ],
    hints: 3,
    questions: [],
  },
  {
    id: 's2b',
    parts: [],
    controls: ['sf.objective', 'sf.objX', 'sf.objY', 'sf.focus', 'a2.opening'],
    insets: ['planeA', 'a2'],
    camera: 'filter',
    checks: [
      { id: 'installed', test: (s) => s.parts.sf.objective },
      { id: 'planeA', test: (s) => s.parts.sf.objective && travelEnds().every((f) => objectiveAlignmentAt(s, f).planeA <= C.s2b.planeATol) },
      { id: 'a2centre', test: (s) => s.parts.sf.objective && travelEnds().every((f) => objectiveAlignmentAt(s, f).a2 <= C.s2b.a2CentreTol) },
      { id: 'far', test: (s) => s.parts.sf.focus >= C.s2b.focusMin },
    ],
    hints: 4,
    questions: ['q3'],
  },
  {
    id: 's3',
    parts: [],
    controls: ['sf.pinhole', 'sf.phX', 'sf.phY', 'sf.focus', 'screen.z', 'a2.opening'],
    insets: ['screen'],
    camera: 'screen',
    checks: [
      { id: 'installed', test: (s) => s.parts.sf.pinhole },
      { id: 'clean', test: (s, r) => (r.pinhole?.transmission ?? 0) >= C.s3.transmissionMin },
      { id: 'opened', test: (s) => s.parts.a2.opening >= C.s3.a2OpeningMin },
    ],
    hints: 4,
    questions: ['q1', 'q4', 'q5'],
  },
  {
    id: 's4',
    parts: ['lens'],
    controls: ['a2.remove', 'a1.z', 'a1.opening', 'lens.z', 'lens.height', 'screen.z'],
    insets: ['screen'],
    camera: 'overview',
    checks: [
      {
        id: 'layout',
        test: (s) => {
          const { a1, a2, sf, lens } = s.parts;
          return !a2.onRail && a1.onRail && sf.onRail && lens.onRail && sf.z < a1.z && a1.z < lens.z;
        },
      },
      { id: 'lensCentred', test: (s, r) => len(r.at.lens?.offset) <= C.s4.lensCentreTol },
      {
        id: 'extent',
        test: (s, r) => {
          const e = r.at.lens?.extent ?? 0;
          return e >= C.s4.extentMin && e <= C.s4.extentMax;
        },
      },
      { id: 'tested', test: (s, r, flow) => s.stats.screenTravel - flow.stepStart.screenTravel >= C.s4.screenTravelMin },
      {
        id: 'collimated',
        test: (s, r) => s.parts.screen.onRail && s.parts.lens.onRail && s.parts.screen.z > s.parts.lens.z
          && r.divergence?.state === 'collimated',
      },
    ],
    hints: 4,
    questions: ['q2', 'q6'],
  },
  { id: 'done', parts: [], controls: [], insets: ['screen'], camera: 'overview', checks: [], hints: 0, questions: [] },
]);

export const STEP_LABELS = Object.freeze({ start: 'start', s1: '1', s2a: '2a', s2b: '2b', s3: '3', s4: '4', done: 'done' });

export function createFlow() {
  return { index: 0, stepStart: { screenTravel: 0, time: 0 }, hintsShown: 0, warningsShown: 0, active: {} };
}

export const currentStep = (flow) => STEPS[flow.index];

export function evaluateChecks(flow, state, result) {
  return STEPS[flow.index].checks.map((c) => ({ id: c.id, pass: Boolean(c.test(state, result, flow)) }));
}

export function canAdvance(flow, state, result) {
  return flow.index < STEPS.length - 1 && evaluateChecks(flow, state, result).every((c) => c.pass);
}

export function advance(flow, state, now = 0) {
  return {
    ...flow,
    index: Math.min(STEPS.length - 1, flow.index + 1),
    stepStart: { screenTravel: state.stats.screenTravel, time: now },
    hintsShown: 0,
    active: {},
  };
}

export function revealHint(flow) {
  return { ...flow, hintsShown: Math.min(STEPS[flow.index].hints, flow.hintsShown + 1) };
}

export function isPartUnlocked(flow, id) {
  return STEPS.slice(0, flow.index + 1).some((s) => s.parts.includes(id));
}

export function lockedPartStepLabel(id) {
  const step = STEPS.find((s) => s.parts.includes(id));
  return step ? STEP_LABELS[step.id] : '';
}

export function unlockedControls(flow) {
  const current = [...STEPS[flow.index].controls];
  const earlier = [...new Set(STEPS.slice(0, flow.index).flatMap((s) => s.controls))].filter((c) => !current.includes(c));
  return { current, earlier };
}

// Warnings (spec §3.6). A warning shows once and re-arms when its condition stops being true.
const stepIs = (flow, ...ids) => ids.includes(STEPS[flow.index].id);
const WARNINGS = [
  {
    id: 'm1',
    test: (flow, prev, next) => stepIs(flow, 's1') && ['a1', 'a2'].some((p) => prev.parts[p].height !== next.parts[p].height
      && next.parts[p].onRail && next.parts[p].z > W.m1FarZ),
  },
  {
    id: 'm2',
    test: (flow, prev, next) => flow.index > STEPS.findIndex((s) => s.id === 's1')
      && (prev.laser.pitch !== next.laser.pitch || prev.laser.yaw !== next.laser.yaw),
  },
  { id: 'm3', test: (flow, prev, next) => stepIs(flow, 's2a', 's2b', 's3') && prev.parts.a2.height !== next.parts.a2.height },
  { id: 'm4', test: (flow, prev, next, result) => next.parts.sf.objective && result.focusDz < W.m4DzMin },
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=52 failed=0`. If the solvability test fails, the message names the seed, step and failing check — fix the physics or the threshold that disagrees with the spec rather than weakening the test.

- [ ] **Step 5: Commit**

```bash
git add js/lab/steps.js tests
git commit -m "feat(lab): add Chapter 1 steps with checks, hints and mistake warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Translations (zh-TW default, English)

**Files:**
- Create: `js/i18n/index.js`, `js/i18n/zh-TW.js`, `js/i18n/en.js`
- Test: `tests/i18n.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `STEPS` (Task 10, tests only).
- Produces: `t(key, params?) → string` (falls back to zh-TW, then to the key; `{name}` placeholders filled from `params`), `getLanguage() → 'zh-TW' | 'en'`, `setLanguage(lang)` (persists in localStorage inside try/catch, sets `<html lang>`, notifies listeners), `onLanguageChange(fn) → unsubscribe`, `applyTranslations(root)` (fills `[data-i18n]` elements), `LANGUAGES`, `dictionaries` (for tests).

- [ ] **Step 1: Write the failing tests**

`tests/i18n.test.js`:

```js
import { test, assert, assertEqual } from './harness.js';
import { dictionaries, t, setLanguage, getLanguage, applyTranslations } from '../js/i18n/index.js';
import { STEPS } from '../js/lab/steps.js';

test('i18n: zh-TW and en have the same keys and no empty strings', () => {
  const zh = Object.keys(dictionaries['zh-TW']).sort();
  const en = Object.keys(dictionaries.en).sort();
  assertEqual(zh.join('|'), en.join('|'), 'key sets differ');
  for (const lang of ['zh-TW', 'en']) {
    for (const [key, value] of Object.entries(dictionaries[lang])) assert(value.trim().length > 0, `${lang} ${key} is empty`);
  }
});

test('i18n: every key the steps and warnings use exists', () => {
  const missing = [];
  const need = (k) => {
    if (!(k in dictionaries['zh-TW'])) missing.push(k);
  };
  for (const step of STEPS) {
    need(`step.${step.id}.title`);
    need(`step.${step.id}.body`);
    step.checks.forEach((c) => need(`step.${step.id}.check.${c.id}`));
    for (let i = 1; i <= step.hints; i++) need(`step.${step.id}.hint.${i}`);
    step.questions.forEach((q) => need(`question.${q}`));
    step.insets.forEach((id) => need(`inset.${id}`));
    need(`ui.camera.${step.camera}`);
  }
  ['m1', 'm2', 'm3', 'm4', 'm5'].forEach((m) => need(`warning.${m}`));
  assertEqual(missing.join(', '), '', 'missing keys');
});

test('i18n: t() switches language, fills parameters and fills [data-i18n]', () => {
  const before = getLanguage();
  setLanguage('en');
  assertEqual(t('warning.m5', { step: '4' }), 'This part is used in step 4.');
  const el = document.createElement('div');
  el.innerHTML = '<span data-i18n="ui.next"></span>';
  applyTranslations(el);
  assertEqual(el.querySelector('span').textContent, 'Next');
  setLanguage('zh-TW');
  assertEqual(t('warning.m5', { step: '4' }), '這個元件在步驟 4 才會用到。');
  assertEqual(t('no.such.key'), 'no.such.key');
  setLanguage(before);
});
```

Append to `tests/all.js`:

```js
import './i18n.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/i18n/index.js`:

```js
// UI strings: t(key) in the current language (default zh-TW), with {name} placeholders.
import zh from './zh-TW.js';
import en from './en.js';

const DICTS = { 'zh-TW': zh, en };
const STORAGE_KEY = 'eolab.lang';
const listeners = new Set();

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && DICTS[value] ? value : null;
  } catch {
    return null;
  }
}

let current = readStored() ?? 'zh-TW';

export const LANGUAGES = Object.freeze(Object.keys(DICTS));
export const dictionaries = DICTS;

export function getLanguage() {
  return current;
}

export function setLanguage(lang) {
  if (!DICTS[lang]) throw new Error(`unknown language: ${lang}`);
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage unavailable (private mode, blocked): the choice lasts for this page only.
  }
  document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  listeners.forEach((fn) => fn(lang));
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, params = {}) {
  const value = DICTS[current][key] ?? DICTS['zh-TW'][key];
  if (value === undefined) return key;
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}
```

`js/i18n/zh-TW.js`:

```js
// 繁體中文（預設）。鍵值必須與 en.js 完全相同。
export default {
  'app.title': 'EO LAB 光電實驗',
  'app.exp1Short': '實驗一',
  'lobby.subtitle': '網頁版虛擬實驗室',
  'lobby.exp1.title': '實驗一：對光、平行光、與光擴束',
  'lobby.exp1.body': '用兩個光圈對光，架設空間濾波器，再用凸透鏡得到準直的擴束光。',
  'lobby.start': '開始實驗',
  'lobby.michelson.title': '邁克森干涉儀',
  'lobby.mz.title': '馬赫–曾德干涉儀',
  'lobby.comingLater': '即將推出',
  'lobby.controls.title': '操作方式',
  'lobby.controls.mouse': '滑鼠：左鍵拖曳旋轉視角、右鍵拖曳平移、滾輪縮放；把元件從後方架子拖到光軌上。',
  'lobby.controls.touch': '觸控：單指旋轉、雙指平移與縮放；點一下元件，再點光軌即可放置。',

  'ui.back': '回大廳',
  'ui.restart': '重新開始',
  'ui.restartConfirm': '重新開始會產生新的隨機起始狀態，確定嗎？',
  'ui.next': '下一步',
  'ui.hint': '提示',
  'ui.noMoreHints': '沒有更多提示了',
  'ui.think': '思考題',
  'ui.checklist': '檢查清單',
  'ui.controls': '控制',
  'ui.moreControls': '其他控制',
  'ui.readouts': '讀數',
  'ui.fine': '微調',
  'ui.coarse': '粗調',
  'ui.place': '放上光軌',
  'ui.remove': '移除',
  'ui.on': '開',
  'ui.off': '關',
  'ui.noWebgl': '你的瀏覽器不支援 WebGL 2，無法顯示 3D 實驗台；你仍可用右側的按鈕完成實驗。建議改用最新版的 Chrome、Edge、Firefox 或 Safari。',
  'ui.switchLanguage': 'English',
  'ui.sheet': '展開／收合面板',
  'ui.insets': '特寫',
  'ui.camera.overview': '全景',
  'ui.camera.laser': '雷射端',
  'ui.camera.filter': '空間濾波器',
  'ui.camera.screen': '屏幕',
  'progress.start': '開始',
  'progress.done': '完成',

  'part.laser': '雷射',
  'part.a1': '光圈1',
  'part.a2': '光圈2',
  'part.sf': '空間濾波座',
  'part.lens': '凸透鏡',
  'part.screen': '觀測屏幕',

  'control.laser.power': '雷射電源',
  'control.laser.pitch': '雷射俯仰',
  'control.laser.yaw': '雷射水平',
  'control.height': '支柱高度',
  'control.opening': '孔徑',
  'control.z': '位置',
  'control.sf.objective': '裝上物鏡',
  'control.sf.objX': '物鏡 X',
  'control.sf.objY': '物鏡 Y',
  'control.sf.focus': '物鏡 Z（對焦）',
  'control.sf.pinhole': '裝上針孔',
  'control.sf.phX': '針孔 X',
  'control.sf.phY': '針孔 Y',
  'control.screen.mark': '標記光點',
  'control.installed': '已裝上',

  'inset.a1': '光圈1 正面',
  'inset.a2': '光圈2 正面',
  'inset.ring': '空間濾波座圓環',
  'inset.planeA': '平面A（光圈1背面）',
  'inset.screen': '觀測屏幕',
  'inset.noLight': '沒有光',

  'readout.power': '屏幕光功率',
  'readout.pinhole': '針孔穿透率',
  'readout.diameter': '屏幕光斑直徑',
  'readout.divergence': '發散角',
  'readout.collimated': '準直',
  'readout.diverging': '發散',
  'readout.converging': '會聚',
  'readout.none': '—',

  'step.start.title': '開始',
  'step.start.body': '依照助教說明的順序打開雷射電源。注意：任何時候都不要直視雷射光束。',
  'step.start.check.on': '雷射已開啟',
  'step.start.hint.1': '在控制區按下「雷射電源」。',

  'step.s1.title': '步驟1　雙光圈對光',
  'step.s1.body': '把兩個光圈都關到最小。一次一個，把光圈放在靠近雷射的地方，只調整它的高度，直到光剛好穿過圓孔。接著讓光圈1留在雷射附近，把光圈2移到光軌遠端。前後移動光圈：如果光被擋住，請調整雷射座的俯仰與水平旋鈕，不要再改光圈高度。光圈放在哪裡光都能穿過時，就完成了。',
  'step.s1.check.closed': '兩個光圈都在光軌上，且孔徑 ≤ 1.5 mm',
  'step.s1.check.positions': '光圈1 在 150 mm 以內，光圈2 在 700 mm 以外',
  'step.s1.check.passes': '光束穿過兩個光圈的中心（誤差 ≤ 0.25 mm）',
  'step.s1.check.parallel': '光束與光軌平行（≤ 0.5 mrad）',
  'step.s1.hint.1': '先關小一個光圈，放在雷射旁邊，只調高度直到光穿過；兩個光圈都這樣做。',
  'step.s1.hint.2': '把光圈2移到遠端。看「光圈2 正面」：光點落在圓孔的哪一邊，光束就偏向哪一邊。',
  'step.s1.hint.3': '遠端的光圈擋住光時，轉動雷射的旋鈕，而不是光圈高度。',
  'step.s1.hint.4': '近端看高度、遠端看雷射旋鈕，重複幾次就會收斂。',

  'step.s2a.title': '步驟2a　架設空間濾波座',
  'step.s2a.body': '先不要裝物鏡和針孔。把空間濾波座放在靠近雷射、光圈1後方的位置，調整它的支柱高度，使光束穿過圓環中心。光圈2 留在濾波座後方，越遠越好。把觀測屏幕放在光圈2後面並移近，按「標記光點」記下原本光束的位置。',
  'step.s2a.check.mount': '濾波座在光圈1與光圈2之間，且 z ≤ 300 mm',
  'step.s2a.check.centred': '光束穿過圓環中心（≤ 0.3 mm）',
  'step.s2a.check.a2far': '光圈2 在濾波座後至少 300 mm',
  'step.s2a.check.marked': '屏幕在光圈2之後，且已標記光點',
  'step.s2a.hint.1': '這一步濾波座先空著裝上，不要放物鏡和針孔。',
  'step.s2a.hint.2': '打開「空間濾波座圓環」特寫，調支柱高度讓光點落在圓環中心。',
  'step.s2a.hint.3': '光圈2 放在遠端；屏幕放在最後，按「標記光點」。',

  'step.s2b.title': '步驟2b　裝上顯微物鏡',
  'step.s2b.body': '裝上 20× 顯微物鏡。一邊前後轉動物鏡 Z 旋鈕，一邊調整物鏡 X/Y 旋鈕，使：(i) 平面A（光圈1朝向物鏡的一面）上的反射光環與圓孔同心，也就是反射光回到雷射出光口；(ii) 擴大光束的中心維持在光圈2的中心。在整個對焦行程都滿足這兩個條件後，把物鏡轉到離針孔最遠的位置。',
  'step.s2b.check.installed': '物鏡已裝上',
  'step.s2b.check.planeA': '平面A 的反射光環置中（≤ 0.5 mm，整個行程）',
  'step.s2b.check.a2centre': '擴大光束置中於光圈2（≤ 1.0 mm，整個行程）',
  'step.s2b.check.far': '物鏡在最遠位置（≥ 5.5 mm）',
  'step.s2b.hint.1': '看「光圈2 正面」：擴大的光束偏向哪一邊？',
  'step.s2b.hint.2': '用物鏡 X/Y 把擴大光束移回光圈2中心。',
  'step.s2b.hint.3': '看「平面A」：反射光環要和圓孔同心。',
  'step.s2b.hint.4': '前後轉動物鏡 Z 確認兩個條件都成立，最後把物鏡退到最遠。',

  'step.s3.title': '步驟3　裝上 25 µm 針孔',
  'step.s3.body': '裝上 25 µm 針孔，把屏幕拿起來放到濾波座附近、光圈2之前（越近越容易看到繞射光）。慢慢轉動物鏡 Z 把物鏡移近，同時調整針孔 X/Y 旋鈕，讓屏幕上的光保持最亮。出現同心圓的繞射圖案（Airy pattern）表示快到了；繼續小步調整，直到出現乾淨、明亮、沒有環的圓形光斑（球面波）。最後把光圈2開大，之後用它來調整擴束光的大小。',
  'step.s3.check.installed': '針孔已裝上',
  'step.s3.check.clean': '針孔穿透率 ≥ 97%',
  'step.s3.check.opened': '光圈2 孔徑 ≥ 5 mm',
  'step.s3.hint.1': '一開始屏幕很暗：把屏幕移到濾波座附近。',
  'step.s3.hint.2': '物鏡移近一點，就用針孔 X/Y 把屏幕調到最亮；重複。',
  'step.s3.hint.3': '出現圓環表示快到了，改用微調。',
  'step.s3.hint.4': '光斑變成圓、亮、沒有環時就完成了。',

  'step.s4.title': '步驟4　準直透鏡',
  'step.s4.body': '把光圈2拿下光軌，將光圈1移到針孔與透鏡之間。把凸透鏡（f = 200 mm）放在距離針孔約一個焦距的位置，並調整高度。把光圈開到剛好讓到達透鏡的光斑小於透鏡。然後慢慢移動透鏡，同時把屏幕前後移動：當屏幕上光斑的大小不再改變時，透鏡就在正確位置，也就是針孔恰好位於透鏡的前焦點。',
  'step.s4.check.layout': '光圈2 已拿下；光圈1 在針孔與透鏡之間',
  'step.s4.check.lensCentred': '透鏡置中（≤ 0.5 mm）',
  'step.s4.check.extent': '到達透鏡的光斑 10–22.9 mm',
  'step.s4.check.tested': '屏幕已前後移動至少 200 mm',
  'step.s4.check.collimated': '光束準直（屏幕在透鏡之後）',
  'step.s4.hint.1': '把光圈2拿下，光圈1移到針孔和透鏡之間。',
  'step.s4.hint.2': '透鏡放在距離針孔約 200 mm 處。',
  'step.s4.hint.3': '光圈開到讓光斑小於透鏡。',
  'step.s4.hint.4': '前後移動屏幕：光斑變大表示透鏡太近（發散），變小表示太遠（會聚）。',

  'step.done.title': '完成',
  'step.done.body': '恭喜！你的架設與講義圖 1-3 相同：雷射 → 物鏡 → 針孔 → 光圈 → 透鏡 → 屏幕。',
  'step.done.measured': '量到的擴束光直徑：{measured} mm（式 1-1 預測光圈修剪前為 {predicted} mm）',
  'step.done.time': '用時：{minutes} 分 {seconds} 秒',
  'step.done.warnings': '警告次數：{count}',
  'step.done.restart': '用新的隨機設定重新開始',

  'warning.m1': '步驟1(ii)：移動光圈時高度不可改變，請調整雷射座旋鈕。',
  'warning.m2': '步驟1(iii)：對光完成後，不得再調整雷射。',
  'warning.m3': '光圈2 是對準參考，請勿改變它的高度。',
  'warning.m4': '物鏡太靠近針孔，小心碰撞！',
  'warning.m5': '這個元件在步驟 {step} 才會用到。',

  'question.q1': '（講義問題1）為什麼要在系統中加入針孔？它的作用是什麼？',
  'question.q2': '（講義問題2）若要讓準直擴束後的光束直徑變為 1.5 倍，可以怎麼做？請舉出兩種方法。',
  'question.q3': '（講義問題3）裝上顯微物鏡時，平面A（光圈1朝向物鏡的一面）上出現什麼光影？它們從哪裡來？怎樣才是正確的？',
  'question.q4': '（講義問題4）裝上針孔並調整物鏡時，屏幕上會依序出現哪些情形？你如何處理？',
  'question.q5': '（講義問題5，挑戰）試挑出幾種錯誤與正確的光影分佈，並解釋它們的成因。',
  'question.q6': '（講義問題6，挑戰）在步驟4中，什麼時候可以觀察到 Airy pattern？',
};
```

`js/i18n/en.js`:

```js
// English. Keys must match zh-TW.js exactly.
export default {
  'app.title': 'EO LAB Optoelectronics Lab',
  'app.exp1Short': 'Experiment 1',
  'lobby.subtitle': 'Web virtual lab',
  'lobby.exp1.title': 'Experiment 1: Alignment, Collimation & Beam Expansion',
  'lobby.exp1.body': 'Align the laser with two irises, build a spatial filter, then collimate the expanded beam with a convex lens.',
  'lobby.start': 'Start',
  'lobby.michelson.title': 'Michelson interferometer',
  'lobby.mz.title': 'Mach–Zehnder interferometer',
  'lobby.comingLater': 'Coming later',
  'lobby.controls.title': 'Controls',
  'lobby.controls.mouse': 'Mouse: left-drag to orbit, right-drag to pan, wheel to zoom; drag parts from the rack onto the rail.',
  'lobby.controls.touch': 'Touch: one finger to orbit, two fingers to pan and zoom; tap a part, then tap the rail to place it.',

  'ui.back': 'Lobby',
  'ui.restart': 'Restart',
  'ui.restartConfirm': 'Restarting creates a new random setup. Continue?',
  'ui.next': 'Next',
  'ui.hint': 'Hint',
  'ui.noMoreHints': 'No more hints',
  'ui.think': 'Think about it',
  'ui.checklist': 'Checklist',
  'ui.controls': 'Controls',
  'ui.moreControls': 'More controls',
  'ui.readouts': 'Readouts',
  'ui.fine': 'Fine',
  'ui.coarse': 'Coarse',
  'ui.place': 'Place on rail',
  'ui.remove': 'Remove',
  'ui.on': 'On',
  'ui.off': 'Off',
  'ui.noWebgl': 'Your browser does not support WebGL 2, so the 3D bench cannot be shown; you can still do the experiment with the buttons on the right. Please use a current Chrome, Edge, Firefox or Safari.',
  'ui.switchLanguage': '中文',
  'ui.sheet': 'Expand / collapse panel',
  'ui.insets': 'Close-ups',
  'ui.camera.overview': 'Overview',
  'ui.camera.laser': 'Laser end',
  'ui.camera.filter': 'Spatial filter',
  'ui.camera.screen': 'Screen',
  'progress.start': 'Start',
  'progress.done': 'Done',

  'part.laser': 'Laser',
  'part.a1': 'Aperture 1',
  'part.a2': 'Aperture 2',
  'part.sf': 'Spatial filter mount',
  'part.lens': 'Convex lens',
  'part.screen': 'Screen',

  'control.laser.power': 'Laser power',
  'control.laser.pitch': 'Laser pitch',
  'control.laser.yaw': 'Laser yaw',
  'control.height': 'Post height',
  'control.opening': 'Opening',
  'control.z': 'Position',
  'control.sf.objective': 'Install objective',
  'control.sf.objX': 'Objective X',
  'control.sf.objY': 'Objective Y',
  'control.sf.focus': 'Objective Z (focus)',
  'control.sf.pinhole': 'Install pinhole',
  'control.sf.phX': 'Pinhole X',
  'control.sf.phY': 'Pinhole Y',
  'control.screen.mark': 'Mark beam position',
  'control.installed': 'Installed',

  'inset.a1': 'Aperture 1 face',
  'inset.a2': 'Aperture 2 face',
  'inset.ring': 'Spatial filter ring',
  'inset.planeA': 'Plane A (back of Aperture 1)',
  'inset.screen': 'Screen',
  'inset.noLight': 'No light',

  'readout.power': 'Power at screen',
  'readout.pinhole': 'Pinhole transmission',
  'readout.diameter': 'Beam diameter at screen',
  'readout.divergence': 'Divergence',
  'readout.collimated': 'collimated',
  'readout.diverging': 'diverging',
  'readout.converging': 'converging',
  'readout.none': '—',

  'step.start.title': 'Start',
  'step.start.body': 'Turn on the laser in the order your TA explained. Never look into the laser beam.',
  'step.start.check.on': 'Laser is on',
  'step.start.hint.1': 'Press "Laser power" in the controls.',

  'step.s1.title': 'Step 1 · Two-iris alignment',
  'step.s1.body': 'Close both irises to the minimum. One at a time, put each iris close to the laser and change only its height until the beam just passes through the hole. Then leave Aperture 1 near the laser and move Aperture 2 to the far end of the rail. Slide the irises back and forth: if the beam is blocked, turn the laser mount\'s pitch and yaw knobs; do not change the iris heights again. You are done when the beam passes both irises wherever they are.',
  'step.s1.check.closed': 'Both irises on the rail, opening ≤ 1.5 mm',
  'step.s1.check.positions': 'Aperture 1 within 150 mm, Aperture 2 beyond 700 mm',
  'step.s1.check.passes': 'Beam passes through both iris centres (within 0.25 mm)',
  'step.s1.check.parallel': 'Beam parallel to the rail (≤ 0.5 mrad)',
  'step.s1.hint.1': 'Close one iris, put it next to the laser and change only its height until the beam passes. Do this for both irises.',
  'step.s1.hint.2': 'Move Aperture 2 to the far end. Look at "Aperture 2 face": the side of the hole where the spot lands is the way the beam is off.',
  'step.s1.hint.3': 'When the far iris blocks the beam, turn the laser knobs, not the iris height.',
  'step.s1.hint.4': 'Near iris: height. Far iris: laser knobs. Repeat a few times and it converges.',

  'step.s2a.title': 'Step 2a · Spatial filter mount',
  'step.s2a.body': 'Without the objective or pinhole, place the spatial filter mount close to the laser, after Aperture 1, and set its post height so the beam passes through the centre of its ring. Keep Aperture 2 behind the mount, as far away as possible. Put the screen after Aperture 2, bring it close and press "Mark beam position" to record where the beam is.',
  'step.s2a.check.mount': 'Mount between Aperture 1 and Aperture 2, z ≤ 300 mm',
  'step.s2a.check.centred': 'Beam through the ring centre (≤ 0.3 mm)',
  'step.s2a.check.a2far': 'Aperture 2 at least 300 mm after the mount',
  'step.s2a.check.marked': 'Screen after Aperture 2, beam position marked',
  'step.s2a.hint.1': 'The mount goes in empty for now: no objective, no pinhole.',
  'step.s2a.hint.2': 'Open the "Spatial filter ring" close-up and adjust the post height until the spot sits in the centre of the ring.',
  'step.s2a.hint.3': 'Aperture 2 stays far away; put the screen last and press "Mark beam position".',

  'step.s2b.title': 'Step 2b · Objective',
  'step.s2b.body': 'Install the 20× objective. While turning the objective Z knob back and forth, adjust the objective X/Y knobs so that (i) the reflection rings on plane A (the side of Aperture 1 facing the objective) are concentric with its hole, meaning the reflected light goes back into the laser, and (ii) the centre of the expanded beam stays at the centre of Aperture 2. When both hold over the whole focus travel, wind the objective to its farthest position from the pinhole.',
  'step.s2b.check.installed': 'Objective installed',
  'step.s2b.check.planeA': 'Plane A rings centred (≤ 0.5 mm, whole travel)',
  'step.s2b.check.a2centre': 'Expanded beam centred on Aperture 2 (≤ 1.0 mm, whole travel)',
  'step.s2b.check.far': 'Objective at its farthest position (≥ 5.5 mm)',
  'step.s2b.hint.1': 'Look at "Aperture 2 face": which way is the expanded beam off?',
  'step.s2b.hint.2': 'Use objective X/Y to bring the expanded beam back to the centre of Aperture 2.',
  'step.s2b.hint.3': 'Look at "Plane A": the rings must be concentric with the hole.',
  'step.s2b.hint.4': 'Turn objective Z back and forth to confirm both, then wind the objective all the way out.',

  'step.s3.title': 'Step 3 · 25 µm pinhole',
  'step.s3.body': 'Install the 25 µm pinhole, then pick up the screen and put it close after the mount, in front of Aperture 2 (closer makes the diffracted light easier to see). Slowly bring the objective in with the Z knob while adjusting the pinhole X/Y knobs to keep the light on the screen as bright as possible. Concentric diffraction rings (an Airy pattern) mean you are close; keep making small adjustments until a clean, bright, ring-free round spot (a spherical wave) appears. Finally open Aperture 2; you will use it to set the size of the expanded beam.',
  'step.s3.check.installed': 'Pinhole installed',
  'step.s3.check.clean': 'Pinhole transmission ≥ 97%',
  'step.s3.check.opened': 'Aperture 2 opening ≥ 5 mm',
  'step.s3.hint.1': 'The screen is dim at first: move it close to the mount.',
  'step.s3.hint.2': 'Move the objective in a little, then make the screen brightest with pinhole X/Y; repeat.',
  'step.s3.hint.3': 'Rings mean you are nearly there: switch to fine steps.',
  'step.s3.hint.4': 'Done when the spot is round, bright and ring-free.',

  'step.s4.title': 'Step 4 · Collimating lens',
  'step.s4.body': 'Take Aperture 2 off the rail and move Aperture 1 to between the pinhole and the lens. Place the convex lens (f = 200 mm) about one focal length from the pinhole and set its height. Open the iris just enough that the beam reaching the lens is smaller than the lens. Then move the lens slowly while moving the screen back and forth: when the spot size on the screen no longer changes, the lens is in the right place, with the pinhole at the lens\'s front focal point.',
  'step.s4.check.layout': 'Aperture 2 removed; Aperture 1 between pinhole and lens',
  'step.s4.check.lensCentred': 'Lens centred (≤ 0.5 mm)',
  'step.s4.check.extent': 'Beam at the lens 10–22.9 mm across',
  'step.s4.check.tested': 'Screen moved back and forth at least 200 mm',
  'step.s4.check.collimated': 'Beam collimated (screen after the lens)',
  'step.s4.hint.1': 'Take Aperture 2 off and move Aperture 1 between the pinhole and the lens.',
  'step.s4.hint.2': 'Put the lens about 200 mm from the pinhole.',
  'step.s4.hint.3': 'Open the iris so the beam is smaller than the lens.',
  'step.s4.hint.4': 'Move the screen: a growing spot means the lens is too close (diverging); a shrinking spot means too far (converging).',

  'step.done.title': 'Done',
  'step.done.body': 'Well done! Your setup matches Fig. 1-3 of the handout: laser → objective → pinhole → iris → lens → screen.',
  'step.done.measured': 'Measured expanded-beam diameter: {measured} mm (eq. 1-1 predicts {predicted} mm before the iris trims it)',
  'step.done.time': 'Time: {minutes} min {seconds} s',
  'step.done.warnings': 'Warnings: {count}',
  'step.done.restart': 'Restart with a new random setup',

  'warning.m1': 'Step 1(ii): do not change an iris height while moving it; adjust the laser mount knobs instead.',
  'warning.m2': 'Step 1(iii): once aligned, do not adjust the laser again.',
  'warning.m3': 'Aperture 2 is the alignment reference; do not change its height.',
  'warning.m4': 'The objective is too close to the pinhole. Careful, it could crash!',
  'warning.m5': 'This part is used in step {step}.',

  'question.q1': '(Handout Q1) Why is a pinhole added to the system? What does it do?',
  'question.q2': '(Handout Q2) How could you make the collimated beam 1.5 times wider? Give two ways.',
  'question.q3': '(Handout Q3) With the objective installed, what light pattern appears on plane A (the side of Aperture 1 facing the objective)? Where does it come from, and what does a correct one look like?',
  'question.q4': '(Handout Q4) While installing the pinhole and adjusting the objective, what different patterns appear on the screen, and how do you deal with each?',
  'question.q5': '(Handout Q5, challenge) Pick out some wrong and correct patterns and explain what causes each.',
  'question.q6': '(Handout Q6, challenge) During step 4, when can you observe an Airy pattern?',
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=55 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/i18n tests
git commit -m "feat(i18n): add zh-TW and English strings with language switching" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: three.js, the 3D view and the bench models

**Files:**
- Create: `js/vendor/three.module.min.js`, `js/vendor/addons/controls/OrbitControls.js`, `js/vendor/LICENSE-three.txt` (downloaded)
- Create: `js/scene/webgl.js`, `js/scene/view.js`, `js/scene/models.js`
- Test: `tests/scene/scene.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `CONFIG` (Task 2); `cardPixel` (Task 7); `createInitialState`, `PART_IDS` (Task 8, tests only).
- Produces:
  - `webglAvailable() → bool` (no three.js import).
  - `createView(container) → { THREE, renderer, scene, camera, controls, setPreset(name, focusX?), start(), stop(), renderOnce(), onFrame(fn), dispose() }`. Presets: `overview`, `laser`, `filter`, `screen`; `focusX` (world X = bench z) re-centres `filter` and `screen`.
  - `buildBench(scene) → { root, laser: { group, update({ height, pitch, yaw }) } }`.
  - `createPartModel(id) → { group, update(partState, { locked, selected, cardImage }) }` for `a1, a2, sf, lens, screen`; every mesh has `userData.partId = id`; the group origin is the part's optical plane on the rail line, so callers set `group.position.set(z, 0, 0)` on the rail. `cardImage` is a `Float32Array(128²)` of relative intensities (row 0 = top) or `null`.
  - `rackSlot(id) → { x, z }` (world coordinates on the parts rack).

- [ ] **Step 1: Get the user's approval, then download three.js 0.170.0**

Ask the user before downloading (files, source, sizes):
- `three.module.min.js` (~0.7 MB), `examples/jsm/controls/OrbitControls.js` (~30 KB) and `LICENSE` (~1 KB) from `https://cdn.jsdelivr.net/npm/three@0.170.0/`.

After approval:

```bash
mkdir -p js/vendor/addons/controls
curl -fL -o js/vendor/three.module.min.js https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js
curl -fL -o js/vendor/addons/controls/OrbitControls.js https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js
curl -fL -o js/vendor/LICENSE-three.txt https://cdn.jsdelivr.net/npm/three@0.170.0/LICENSE
```

Verify:

```bash
grep -c "three.core" js/vendor/three.module.min.js
```
Expected: `0` (0.170.0 is the last single-file module build; if this prints more than 0, stop and tell the user).

```bash
grep -c "from 'three'" js/vendor/addons/controls/OrbitControls.js
```
Expected: `1` or more (it imports the bare specifier `three`, resolved by the import map).

- [ ] **Step 2: Write the failing tests**

`tests/scene/scene.test.js`:

```js
import { test, assert, assertEqual } from '../harness.js';
import { webglAvailable } from '../../js/scene/webgl.js';
import { createView } from '../../js/scene/view.js';
import { buildBench, createPartModel, rackSlot } from '../../js/scene/models.js';
import { createInitialState, PART_IDS } from '../../js/lab/state.js';

test('scene: WebGL 2 is available in the test browser', () => {
  assert(webglAvailable(), 'webgl2 missing');
});

test('scene: bench and every part model build and render', () => {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px;position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const view = createView(host);
  const benchModel = buildBench(view.scene);
  benchModel.laser.update({ height: 0.1, pitch: 0, yaw: 0 });
  const parts = createInitialState(1).parts;
  for (const id of PART_IDS) {
    const model = createPartModel(id);
    view.scene.add(model.group);
    const slot = rackSlot(id);
    model.group.position.set(slot.x, 0, slot.z);
    model.update({ ...parts[id], objective: true, pinhole: true }, { locked: id === 'lens', selected: id === 'a1', cardImage: null });
    assertEqual(model.group.userData.partId, id);
  }
  view.setPreset('overview');
  view.renderOnce();
  assert(view.renderer.info.render.calls > 10, `draw calls ${view.renderer.info.render.calls}`);
  view.dispose();
  host.remove();
});
```

Append to `tests/all.js`:

```js
import './scene/scene.test.js';
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 4: Write the implementation**

`js/scene/webgl.js`:

```js
// WebGL 2 detection without loading three.js, so the page can fall back to 2D-only.
export function webglAvailable() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
```

`js/scene/view.js`:

```js
// three.js renderer, camera, orbit controls and camera presets. World axes: X = rail z, Y = height, Z = rail x.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PRESETS = {
  overview: { position: [0.55, 0.75, 1.05], target: [0.55, 0.08, 0] },
  laser: { position: [-0.15, 0.32, 0.45], target: [0.15, 0.1, 0] },
  filter: { position: [0.12, 0.22, 0.3], target: [0.25, 0.1, 0] },
  screen: { position: [0.2, 0.25, 0.35], target: [0.6, 0.1, 0] },
};

export function createView(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15171c);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;   // stay above the table
  controls.minDistance = 0.05;
  controls.maxDistance = 3;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x202020, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(0.5, 1.5, 1.0);
  scene.add(sun);

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function setPreset(name, focusX) {
    const preset = PRESETS[name] ?? PRESETS.overview;
    const shift = focusX !== undefined && (name === 'filter' || name === 'screen') ? focusX - preset.target[0] : 0;
    camera.position.set(preset.position[0] + shift, preset.position[1], preset.position[2]);
    controls.target.set(preset.target[0] + shift, preset.target[1], preset.target[2]);
    controls.update();
  }
  setPreset('overview');

  const callbacks = new Set();
  let frame = null;
  function loop() {
    frame = requestAnimationFrame(loop);
    controls.update();
    callbacks.forEach((fn) => fn());
    renderer.render(scene, camera);
  }

  return {
    THREE,
    renderer,
    scene,
    camera,
    controls,
    setPreset,
    start() {
      if (frame === null) loop();
    },
    stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
    renderOnce() {
      renderer.render(scene, camera);
    },
    onFrame(fn) {
      callbacks.add(fn);
      return () => callbacks.delete(fn);
    },
    dispose() {
      this.stop();
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
```

`js/scene/models.js`:

```js
// three.js models of the bench and parts. World axes: X = rail z, Y = height, Z = rail x (metres).
import * as THREE from 'three';
import { CONFIG } from '../optics/config.js';
import { cardPixel } from '../optics/screen.js';

const standard = (options) => new THREE.MeshStandardMaterial(options);

const SHARED = {
  table: standard({ color: 0x2a2d33, roughness: 0.85, metalness: 0.1 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x0b0c0e }),
  rail: standard({ color: 0x3b3f47, roughness: 0.6, metalness: 0.5 }),
  tick: new THREE.MeshBasicMaterial({ color: 0x9aa0aa }),
  block: standard({ color: 0x0e0f11, roughness: 0.9 }),
  rack: standard({ color: 0x34383f, roughness: 0.7, metalness: 0.2 }),
  laserBody: standard({ color: 0x2f3a4a, roughness: 0.4, metalness: 0.5 }),
  laserNose: standard({ color: 0x111111, roughness: 0.6 }),
  mount: standard({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4 }),
  accent: standard({ color: 0x00bfff, roughness: 0.5 }),
};

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function cylinderX(radius, length, material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function cylinderY(radius, height, material, segments = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
}

// A post holder and a post from the table to `top`; returns a function that resizes the post.
function addPost(group, material) {
  const holder = cylinderY(0.012, 0.012, material);
  holder.position.y = 0.006;
  const post = cylinderY(0.006, 1, material);
  group.add(holder, post);
  return (top) => {
    const length = Math.max(0.001, top - 0.012);
    post.scale.y = length;
    post.position.y = 0.012 + length / 2;
  };
}

function partMaterials() {
  return {
    anodised: standard({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
    post: standard({ color: 0xb9bec7, roughness: 0.35, metalness: 0.8 }),
    accent: standard({ color: 0x00bfff, roughness: 0.5 }),
  };
}

function applyLook(materials, { locked = false, selected = false }) {
  for (const m of Object.values(materials)) {
    m.transparent = locked;
    m.opacity = locked ? 0.35 : 1;
    m.emissive.setHex(selected ? 0x0a4a5c : 0x000000);
  }
}

export function buildBench(scene) {
  const root = new THREE.Group();
  root.name = 'bench';
  const table = box(1.4, 0.03, 0.6, SHARED.table);
  table.position.set(0.5, -0.015, 0);
  root.add(table);

  const xs = [];
  const zs = [];
  for (let x = -0.1875; x < 1.2; x += 0.025) xs.push(x);
  for (let z = -0.2875; z < 0.3; z += 0.025) zs.push(z);
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.003, 12), SHARED.hole, xs.length * zs.length);
  const matrix = new THREE.Matrix4();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  let index = 0;
  for (const x of xs) {
    for (const z of zs) {
      matrix.compose(new THREE.Vector3(x, 0.0005, z), flat, one);
      holes.setMatrixAt(index++, matrix);
    }
  }
  root.add(holes);

  const rail = box(1.15, 0.008, 0.03, SHARED.rail);
  rail.position.set(0.575, 0.004, 0);
  root.add(rail);
  for (let mm = 0; mm <= 1150; mm += 50) {
    const tick = box(0.0015, 0.001, mm % 100 === 0 ? 0.03 : 0.018, SHARED.tick);
    tick.position.set(mm / 1000, 0.0085, 0.024);
    root.add(tick);
  }

  const block = box(0.02, 0.06, 0.06, SHARED.block);
  block.position.set(CONFIG.rail.beamBlockZ + 0.01, CONFIG.laser.exitHeight, 0);
  root.add(block);

  const rack = box(1.0, 0.01, 0.08, SHARED.rack);
  rack.position.set(0.5, 0.005, -0.24);
  root.add(rack);

  scene.add(root);
  return { root, laser: buildLaser(root) };
}

function buildLaser(root) {
  const group = new THREE.Group();
  group.name = 'laser';
  const body = cylinderX(0.02, 0.16, SHARED.laserBody);
  const nose = cylinderX(0.008, 0.01, SHARED.laserNose);
  const plate = box(0.12, 0.012, 0.07, SHARED.mount);
  const post = cylinderY(0.008, 1, SHARED.rail);
  const knobs = [0, 1, 2].map(() => cylinderY(0.006, 0.014, SHARED.accent));
  group.add(body, nose, plate, post, ...knobs);
  root.add(group);
  return {
    group,
    update({ height, pitch, yaw }) {
      body.position.set(-0.085, height, 0);
      nose.position.set(-0.004, height, 0);
      plate.position.set(-0.085, height - 0.028, 0);
      const postLength = Math.max(0.001, height - 0.034);
      post.scale.y = postLength;
      post.position.set(-0.085, postLength / 2, 0);
      knobs[0].position.set(-0.135, height - 0.02, 0.028);
      knobs[1].position.set(-0.135, height - 0.02, -0.028);
      knobs[2].position.set(-0.035, height - 0.02, 0.028);
      knobs[0].rotation.y = pitch * 300;   // knobs turn with their settings (visual feedback only)
      knobs[1].rotation.y = yaw * 300;
    },
  };
}

function buildIris() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const setPost = addPost(group, materials.post);
  const R = CONFIG.iris.plateRadius;
  const plate = new THREE.Mesh(new THREE.RingGeometry(0.006, R, 48), materials.anodised);
  plate.rotation.y = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.002, 8, 48), materials.anodised);
  rim.rotation.y = Math.PI / 2;
  const lever = box(0.003, 0.004, 0.012, materials.accent);
  group.add(plate, rim, lever);
  let opening = null;
  return {
    group,
    update(part, look = {}) {
      setPost(part.height - R);
      plate.position.y = part.height;
      rim.position.y = part.height;
      lever.position.set(0, part.height + R * 0.7, 0.012);
      if (part.opening !== opening) {
        plate.geometry.dispose();
        plate.geometry = new THREE.RingGeometry(part.opening / 2, R, 48);
        opening = part.opening;
      }
      applyLook(materials, look);
    },
  };
}

function buildSpatialFilter() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const setPost = addPost(group, materials.post);
  const base = box(0.075, 0.008, 0.05, materials.anodised);
  const ringPlate = box(0.006, 0.05, 0.05, materials.anodised);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CONFIG.mount.ringRadius + 0.0015, 0.0015, 8, 32), materials.accent);
  ring.rotation.y = Math.PI / 2;
  const pinPlate = box(0.004, 0.05, 0.05, materials.anodised);
  const objective = cylinderX(0.009, 0.02, standard({ color: 0xc9ccd2, roughness: 0.3, metalness: 0.9 }));
  const pinhole = new THREE.Mesh(new THREE.CircleGeometry(0.004, 24), standard({ color: 0x111111, side: THREE.DoubleSide }));
  pinhole.rotation.y = Math.PI / 2;
  const knobX = cylinderY(0.004, 0.01, materials.accent);
  const knobY = cylinderY(0.004, 0.01, materials.accent);
  knobY.rotation.x = Math.PI / 2;
  group.add(base, ringPlate, ring, pinPlate, objective, pinhole, knobX, knobY);
  return {
    group,
    update(part, look = {}) {
      const h = part.height;
      setPost(h - 0.03);
      base.position.set(-0.03, h - 0.03, 0);
      ringPlate.position.set(-CONFIG.mount.ringOffset, h, 0);
      ring.position.set(-CONFIG.mount.ringOffset - 0.004, h, 0);
      pinPlate.position.set(0.002, h, 0);
      const dz = part.focus - CONFIG.objective.focusAt;
      objective.visible = part.objective;
      objective.position.set(-(CONFIG.objective.focalLength + dz) - 0.006, h, 0);
      pinhole.visible = part.pinhole;
      pinhole.position.set(-0.0005, h, 0);
      knobX.position.set(0.002, h + 0.03, 0.018);
      knobY.position.set(0.002, h, 0.03);
      knobX.rotation.y = part.phX * 2e4;   // pinhole knobs turn with their settings (visual feedback only)
      knobY.rotation.y = part.phY * 2e4;
      applyLook(materials, look);
    },
  };
}

function buildLens() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const setPost = addPost(group, materials.post);
  const radius = CONFIG.lens.diameter / 2;
  const holder = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.002, 0.003, 12, 48), materials.anodised);
  holder.rotation.y = Math.PI / 2;
  const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0xccffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35 });
  const glass = cylinderX(radius, 0.004, glassMaterial, 48);
  group.add(holder, glass);
  return {
    group,
    update(part, look = {}) {
      setPost(part.height - radius - 0.004);
      holder.position.y = part.height;
      glass.position.y = part.height;
      applyLook(materials, look);
      glassMaterial.opacity = look.locked ? 0.15 : 0.35;
    },
  };
}

function paintCard(data, pixels, image) {
  for (let j = 0; j < pixels; j++) {
    const row = pixels - 1 - j;   // texture row 0 is the bottom; image row 0 is the top
    for (let i = 0; i < pixels; i++) {
      const [r, g, b] = cardPixel(image ? image[row * pixels + i] : 0);
      const k = 4 * (j * pixels + i);
      data[k] = r;
      data[k + 1] = g;
      data[k + 2] = b;
      data[k + 3] = 255;
    }
  }
}

function buildScreen() {
  const materials = partMaterials();
  const group = new THREE.Group();
  const { size, centreHeight, cardPixels } = CONFIG.screen;
  const data = new Uint8Array(cardPixels * cardPixels * 4);
  paintCard(data, cardPixels, null);
  const texture = new THREE.DataTexture(data, cardPixels, cardPixels, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const cardMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: false });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cardMaterial);
  card.rotation.y = -Math.PI / 2;   // faces −X, toward the laser; local +X maps to world +Z (rail +x)
  card.position.set(0, centreHeight, 0);
  const back = box(0.003, size + 0.006, size + 0.006, materials.anodised);
  back.position.set(0.003, centreHeight, 0);
  const foot = box(0.06, 0.004, 0.16, materials.anodised);
  foot.position.set(0.03, 0.002, 0);
  const standHeight = centreHeight - size / 2;
  const stand = box(0.004, standHeight, 0.02, materials.anodised);
  stand.position.set(0.004, standHeight / 2, 0);
  group.add(card, back, foot, stand);
  return {
    group,
    update(part, look = {}) {
      paintCard(data, cardPixels, look.cardImage ?? null);
      texture.needsUpdate = true;
      applyLook(materials, look);
      cardMaterial.transparent = Boolean(look.locked);
      cardMaterial.opacity = look.locked ? 0.4 : 1;
    },
  };
}

const BUILDERS = { a1: buildIris, a2: buildIris, sf: buildSpatialFilter, lens: buildLens, screen: buildScreen };

export function createPartModel(id) {
  const part = BUILDERS[id]();
  part.group.name = id;
  part.group.userData.partId = id;
  part.group.traverse((object) => {
    if (object.isMesh) object.userData.partId = id;
  });
  return part;
}

const RACK_X = { a1: 0.08, a2: 0.22, sf: 0.42, lens: 0.66, screen: 0.86 };

export function rackSlot(id) {
  return { x: RACK_X[id], z: -0.24 };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=57 failed=0`.

- [ ] **Step 6: Commit**

```bash
git add js/vendor js/scene tests
git commit -m "feat(scene): vendor three.js 0.170.0 and add the 3D view and bench models" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Beam rendering and part interaction

**Files:**
- Create: `js/scene/beam.js`, `js/scene/interact.js`
- Test: `tests/scene/beam-interact.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: three.js (Task 12); `createView` result and part models from Task 12 (`view.renderer`, `view.camera`, `view.controls`, `parts: Map<id, { group }>`); `BenchResult.segments` / `.spots` (Task 9).
- Produces:
  - `beamOpacity(power) → [0.15, 0.85]`; `createBeamView(scene) → { group, update(result) }` (two tapered tubes per segment — core and glow — and one disc per spot).
  - `groundPoint(origin, direction, height = 0) → { x, z } | null`; `dropTarget(point) → { kind: 'rail', z } | { kind: 'rack' } | { kind: 'cancel' }` (rail band |world Z| ≤ 0.12; rack area world Z ≤ −0.15).
  - `createInteraction({ view, parts, canPick(id), onLocked(id), onDrop(id, z | null), onRemove(id), onSelect(id | null) }) → { selected, dispose() }`. Dragging a part disables orbit; a tap selects a part; a tap on the rail with a part selected places it; `onDrop(id, null)` means "cancelled — restore positions".

- [ ] **Step 1: Write the failing tests**

`tests/scene/beam-interact.test.js`:

```js
import * as THREE from 'three';
import { test, assert, assertEqual, assertClose } from '../harness.js';
import { createBeamView, beamOpacity } from '../../js/scene/beam.js';
import { groundPoint, dropTarget } from '../../js/scene/interact.js';

test('scene: beam view draws core + glow per segment and one disc per spot', () => {
  const scene = new THREE.Scene();
  const beam = createBeamView(scene);
  beam.update({
    laserOn: true,
    segments: [
      { z0: 0, x0: 0, y0: 0.1, z1: 0.1, x1: 0, y1: 0.1, r0: 5e-4, r1: 5e-4, power: 1 },
      { z0: 0.1, x0: 0, y0: 0.1, z1: 0.8, x1: 0, y1: 0.1, r0: 5e-4, r1: 6e-4, power: 0.8 },
    ],
    spots: [{ z: 0.8, x: 0, y: 0.1, radius: 1e-3, power: 0.1 }],
  });
  assertEqual(beam.group.children.length, 5);
  beam.update({ laserOn: false, segments: [], spots: [] });
  assertEqual(beam.group.children.length, 0);
});

test('scene: beam opacity grows with power within 0.15–0.85', () => {
  assertClose(beamOpacity(0), 0.15, 1e-12);
  assertClose(beamOpacity(1), 0.85, 1e-12);
  assert(beamOpacity(0.01) < beamOpacity(0.5), 'monotonic');
});

test('interact: pointer rays meet the table top', () => {
  const p = groundPoint({ x: 0.5, y: 0.5, z: 0.5 }, { x: 0, y: -1, z: -1 });
  assertClose(p.x, 0.5, 1e-12);
  assertClose(p.z, 0, 1e-12);
  assertEqual(groundPoint({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 0, z: 0 }), null, 'parallel ray');
  assertEqual(groundPoint({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 1, z: 0 }), null, 'pointing up');
});

test('interact: drop targets are the rail band, the rack area, or nothing', () => {
  const rail = dropTarget({ x: 0.42, z: 0.05 });
  assertEqual(rail.kind, 'rail');
  assertClose(rail.z, 0.42, 1e-12);
  assertEqual(dropTarget({ x: 0.3, z: -0.2 }).kind, 'rack');
  assertEqual(dropTarget({ x: 0.3, z: 0.25 }).kind, 'cancel');
  assertEqual(dropTarget(null).kind, 'cancel');
});
```

Append to `tests/all.js`:

```js
import './scene/beam-interact.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/scene/beam.js`:

```js
// Glowing beam segments and light spots drawn from a BenchResult. World axes: X = rail z, Y = height, Z = rail x.
import * as THREE from 'three';

const MIN_RADIUS = 0.0006;
const UP = new THREE.Vector3(0, 1, 0);

export function beamOpacity(power) {
  return Math.min(0.85, Math.max(0.15, 0.15 + 0.7 * Math.max(0, power) ** 0.35));
}

function glowMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    color: 0x3cff5a,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function tube(segment, scale, extra, opacity) {
  const a = new THREE.Vector3(segment.z0, segment.y0, segment.x0);
  const b = new THREE.Vector3(segment.z1, segment.y1, segment.x1);
  const length = a.distanceTo(b);
  if (length < 1e-6) return null;
  const r0 = Math.max(segment.r0, MIN_RADIUS) * scale + extra;
  const r1 = Math.max(segment.r1, MIN_RADIUS) * scale + extra;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, length, 20, 1, true), glowMaterial(opacity));
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return mesh;
}

export function createBeamView(scene) {
  const group = new THREE.Group();
  group.name = 'beam';
  scene.add(group);
  function clear() {
    for (const child of [...group.children]) {
      child.geometry.dispose();
      child.material.dispose();
      group.remove(child);
    }
  }
  return {
    group,
    update(result) {
      clear();
      if (!result || !result.laserOn) return;
      for (const segment of result.segments) {
        const opacity = beamOpacity(segment.power);
        const core = tube(segment, 1, 0, opacity);
        const glow = tube(segment, 2.2, 0.0008, opacity * 0.25);
        if (core) group.add(core);
        if (glow) group.add(glow);
      }
      for (const spot of result.spots) {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(spot.radius, 0.001), 32), glowMaterial(beamOpacity(spot.power)));
        disc.rotation.y = Math.PI / 2;
        disc.position.set(spot.z - 0.0012, spot.y, spot.x);
        group.add(disc);
      }
    },
  };
}
```

`js/scene/interact.js`:

```js
// Pointer interaction with parts: drag from the rack to the rail, along the rail, back to the rack; tap-to-place.
import * as THREE from 'three';

export function groundPoint(origin, direction, height = 0) {
  if (Math.abs(direction.y) < 1e-6) return null;
  const t = (height - origin.y) / direction.y;
  if (t <= 0) return null;
  return { x: origin.x + t * direction.x, z: origin.z + t * direction.z };
}

export function dropTarget(point) {
  if (!point) return { kind: 'cancel' };
  if (Math.abs(point.z) <= 0.12) return { kind: 'rail', z: point.x };
  if (point.z <= -0.15) return { kind: 'rack' };
  return { kind: 'cancel' };
}

const TAP_PIXELS = 5;

export function createInteraction({ view, parts, canPick, onLocked, onDrop, onRemove, onSelect }) {
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

  function targetOf(event) {
    const ray = rayFrom(event);
    return dropTarget(groundPoint(ray.origin, ray.direction));
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
    const ray = rayFrom(event);
    const p = groundPoint(ray.origin, ray.direction);
    if (p) parts.get(drag.id).group.position.set(p.x, 0, Math.abs(p.z) <= 0.12 ? 0 : p.z);
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
      const target = targetOf(event);
      if (target.kind === 'rail') onDrop(id, target.z);
      else if (target.kind === 'rack') onRemove(id);
      else onDrop(id, null);
      return;
    }
    const wasTap = press && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TAP_PIXELS;
    press = null;
    if (wasTap && selected) {
      const target = targetOf(event);
      if (target.kind === 'rail') onDrop(selected, target.z);
      selected = null;
      onSelect(null);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  return {
    get selected() {
      return selected;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=61 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/scene tests
git commit -m "feat(scene): draw the glowing beam and add drag/tap part placement" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Panel controls and toasts

**Files:**
- Create: `js/ui/controls.js`, `js/ui/toast.js`
- Test: `tests/ui/controls.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: nothing from earlier tasks (labels are passed in as strings or functions).
- Produces:
  - `createKnob({ label, unit, value, min, max, fine, coarse, format, onChange, labels })` → `{ el, setValue(v), setEnabled(on), refresh() }`. `label` may be a function (re-evaluated on `refresh`); `labels = { fine: () => string, coarse: () => string }`. −/+ buttons step by fine (or coarse after toggling the mode button), hold to repeat; drag the dial vertically (4 px per step); ArrowUp/Right = +fine, ArrowDown/Left = −fine, Shift = coarse. Values clamp to [min, max]; `onChange` fires only when the value changes.
  - `createSlider({ label, unit, value, min, max, step, format, onChange })` → `{ el, setValue, setEnabled, refresh }`.
  - `createButton({ label, onClick, className })` → `{ el, setEnabled, setPressed, refresh }`.
  - `createPositionControl({ label, value, fine, coarse, onChange, labels })` → `{ el, setValue, setEnabled, refresh }` — shows the rail position in mm; −/+ request `value ± step`; typing a number and committing requests `mm / 1000`. The caller decides and calls `setValue` with the actual position.
  - `showToast(message, { root = document.body, duration = 4000 }) → HTMLElement`.

- [ ] **Step 1: Write the failing tests**

`tests/ui/controls.test.js`:

```js
import { test, assert, assertEqual, assertClose } from '../harness.js';
import { createKnob, createSlider, createButton, createPositionControl } from '../../js/ui/controls.js';
import { showToast } from '../../js/ui/toast.js';

const labels = { fine: () => 'Fine', coarse: () => 'Coarse' };
const sandbox = () => document.getElementById('sandbox');
const press = (el) => {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
};

test('controls: knob steps by fine, coarse after toggling, and clamps', () => {
  const seen = [];
  const knob = createKnob({ label: 'Pitch', unit: 'mrad', value: 0, min: -1, max: 1, fine: 0.1, coarse: 0.5, onChange: (v) => seen.push(v), labels });
  sandbox().appendChild(knob.el);
  press(knob.el.querySelector('.plus'));
  assertClose(seen.at(-1), 0.1, 1e-12);
  knob.el.querySelector('.mode').click();
  assertEqual(knob.el.querySelector('.mode').textContent, 'Coarse');
  press(knob.el.querySelector('.plus'));
  assertClose(seen.at(-1), 0.6, 1e-12);
  press(knob.el.querySelector('.plus'));
  assertClose(seen.at(-1), 1, 1e-12, 'clamped at max');
  knob.el.remove();
});

test('controls: knob keyboard arrows (Shift = coarse) and disabled state', () => {
  const seen = [];
  const knob = createKnob({ label: () => 'Y', value: 0, min: -1, max: 1, fine: 0.1, coarse: 0.5, onChange: (v) => seen.push(v), labels });
  sandbox().appendChild(knob.el);
  const dial = knob.el.querySelector('.dial');
  dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assertClose(seen.at(-1), 0.1, 1e-12);
  dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
  assertClose(seen.at(-1), -0.4, 1e-12);
  knob.setEnabled(false);
  const count = seen.length;
  press(knob.el.querySelector('.plus'));
  dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assertEqual(seen.length, count, 'disabled knob ignores input');
  knob.el.remove();
});

test('controls: slider and button report changes', () => {
  let got = null;
  let clicks = 0;
  const slider = createSlider({
    label: 'Opening', unit: 'mm', value: 0.012, min: 0.001, max: 0.012, step: 0.0001,
    format: (v) => (v * 1e3).toFixed(1), onChange: (v) => { got = v; },
  });
  sandbox().appendChild(slider.el);
  const input = slider.el.querySelector('input');
  input.value = '0.005';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assertClose(got, 0.005, 1e-12);
  assertEqual(slider.el.querySelector('.control-value').textContent, '5.0 mm');
  const button = createButton({ label: 'Go', onClick: () => { clicks += 1; } });
  sandbox().appendChild(button.el);
  button.el.click();
  assertEqual(clicks, 1);
  slider.el.remove();
  button.el.remove();
});

test('controls: position control accepts typed millimetres and ± steps', () => {
  const seen = [];
  const pos = createPositionControl({ label: 'z', value: 0.1, fine: 0.001, coarse: 0.01, onChange: (z) => seen.push(z), labels });
  sandbox().appendChild(pos.el);
  assertEqual(pos.el.querySelector('input').value, '100');
  const input = pos.el.querySelector('input');
  input.value = '250';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  assertClose(seen.at(-1), 0.25, 1e-12);
  press(pos.el.querySelector('.plus'));
  assertClose(seen.at(-1), 0.101, 1e-12, 'steps from the confirmed value');
  pos.el.remove();
});

test('toast: shows a message and removes it later', async () => {
  const toast = showToast('Hello', { duration: 50 });
  assert(document.body.contains(toast), 'shown');
  assertEqual(toast.textContent, 'Hello');
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert(!document.body.contains(toast), 'removed');
});
```

Append to `tests/all.js`:

```js
import './ui/controls.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/ui/controls.js`:

```js
// Panel controls: knob dials, sliders, buttons and rail-position inputs (spec §3.4). No physics here.
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 70;

const textOf = (label) => (typeof label === 'function' ? label() : label);

// Press-and-hold repeats `action`; Enter/Space trigger it once from the keyboard.
function holdRepeat(button, action) {
  let timer = null;
  let interval = null;
  const stop = () => {
    clearTimeout(timer);
    clearInterval(interval);
    timer = null;
    interval = null;
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    stop();
    action();
    timer = setTimeout(() => {
      interval = setInterval(action, REPEAT_INTERVAL);
    }, REPEAT_DELAY);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, stop);
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  });
}

export function createKnob({ label, unit = '', value, min, max, fine, coarse, format = (v) => String(v), onChange, labels }) {
  let current = value;
  let useCoarse = false;
  let enabled = true;
  const el = document.createElement('div');
  el.className = 'control knob';
  el.innerHTML = `
    <div class="control-label"></div>
    <div class="knob-row">
      <button type="button" class="step minus" aria-label="−">−</button>
      <div class="dial" tabindex="0" role="slider">
        <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"></circle><line x1="20" y1="20" x2="20" y2="6"></line></svg>
      </div>
      <button type="button" class="step plus" aria-label="+">+</button>
      <button type="button" class="mode"></button>
    </div>
    <div class="control-value"></div>`;
  const labelEl = el.querySelector('.control-label');
  const valueEl = el.querySelector('.control-value');
  const dial = el.querySelector('.dial');
  const line = el.querySelector('line');
  const mode = el.querySelector('.mode');

  function render() {
    const text = textOf(label);
    labelEl.textContent = text;
    valueEl.textContent = `${format(current)} ${unit}`.trim();
    line.setAttribute('transform', `rotate(${((current - min) / (max - min)) * 300 - 150} 20 20)`);
    dial.setAttribute('aria-label', text);
    dial.setAttribute('aria-valuemin', String(min));
    dial.setAttribute('aria-valuemax', String(max));
    dial.setAttribute('aria-valuenow', String(current));
    dial.setAttribute('aria-valuetext', valueEl.textContent);
    mode.textContent = useCoarse ? labels.coarse() : labels.fine();
  }
  function set(v) {
    const next = Math.min(max, Math.max(min, v));
    if (next === current) return;
    current = next;
    render();
    onChange(current);
  }
  const step = (n) => {
    if (enabled) set(current + n * (useCoarse ? coarse : fine));
  };

  holdRepeat(el.querySelector('.plus'), () => step(1));
  holdRepeat(el.querySelector('.minus'), () => step(-1));
  mode.addEventListener('click', () => {
    useCoarse = !useCoarse;
    render();
  });
  let dragY = null;
  let accumulated = 0;
  dial.addEventListener('pointerdown', (event) => {
    if (!enabled) return;
    dragY = event.clientY;
    accumulated = 0;
    dial.setPointerCapture(event.pointerId);
  });
  dial.addEventListener('pointermove', (event) => {
    if (dragY === null) return;
    accumulated += dragY - event.clientY;
    dragY = event.clientY;
    const steps = Math.trunc(accumulated / 4);
    if (steps !== 0) {
      accumulated -= steps * 4;
      step(steps);
    }
  });
  const endDrag = () => {
    dragY = null;
  };
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
  dial.addEventListener('keydown', (event) => {
    if (!enabled) return;
    const amount = event.shiftKey ? coarse : fine;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      set(current + amount);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      set(current - amount);
    }
  });
  render();
  return {
    el,
    setValue(v) {
      current = Math.min(max, Math.max(min, v));
      render();
    },
    setEnabled(on) {
      enabled = Boolean(on);
      el.classList.toggle('disabled', !enabled);
      el.querySelectorAll('button').forEach((b) => {
        b.disabled = !enabled;
      });
      dial.tabIndex = enabled ? 0 : -1;
    },
    refresh: render,
  };
}

export function createSlider({ label, unit = '', value, min, max, step, format = (v) => String(v), onChange }) {
  const el = document.createElement('label');
  el.className = 'control slider';
  el.innerHTML = '<span class="control-label"></span><input type="range"><span class="control-value"></span>';
  const input = el.querySelector('input');
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  function render() {
    el.querySelector('.control-label').textContent = textOf(label);
    el.querySelector('.control-value').textContent = `${format(Number(input.value))} ${unit}`.trim();
  }
  input.addEventListener('input', () => {
    render();
    onChange(Number(input.value));
  });
  render();
  return {
    el,
    setValue(v) {
      input.value = String(v);
      render();
    },
    setEnabled(on) {
      input.disabled = !on;
      el.classList.toggle('disabled', !on);
    },
    refresh: render,
  };
}

export function createButton({ label, onClick, className = '' }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `control button ${className}`.trim();
  const render = () => {
    el.textContent = textOf(label);
  };
  el.addEventListener('click', () => onClick());
  render();
  return {
    el,
    setEnabled(on) {
      el.disabled = !on;
    },
    setPressed(on) {
      el.setAttribute('aria-pressed', String(Boolean(on)));
      el.classList.toggle('pressed', Boolean(on));
    },
    refresh: render,
  };
}

export function createPositionControl({ label, value, fine, coarse, onChange, labels }) {
  let current = value;
  let useCoarse = false;
  const decimals = fine < 1e-3 ? 1 : 0;
  const el = document.createElement('div');
  el.className = 'control position';
  el.innerHTML = `
    <div class="control-label"></div>
    <div class="position-row">
      <button type="button" class="step minus" aria-label="−">−</button>
      <input type="number" class="position-input" inputmode="decimal">
      <span class="unit">mm</span>
      <button type="button" class="step plus" aria-label="+">+</button>
      <button type="button" class="mode"></button>
    </div>`;
  const input = el.querySelector('input');
  const mode = el.querySelector('.mode');
  input.step = decimals ? '0.5' : '1';
  function render() {
    const text = textOf(label);
    el.querySelector('.control-label').textContent = text;
    input.setAttribute('aria-label', text);
    if (document.activeElement !== input) input.value = (current * 1e3).toFixed(decimals);
    mode.textContent = useCoarse ? labels.coarse() : labels.fine();
  }
  holdRepeat(el.querySelector('.plus'), () => onChange(current + (useCoarse ? coarse : fine)));
  holdRepeat(el.querySelector('.minus'), () => onChange(current - (useCoarse ? coarse : fine)));
  mode.addEventListener('click', () => {
    useCoarse = !useCoarse;
    render();
  });
  input.addEventListener('change', () => {
    const mm = Number(input.value);
    if (Number.isFinite(mm)) onChange(mm / 1e3);
  });
  render();
  return {
    el,
    setValue(v) {
      current = v;
      render();
    },
    setEnabled(on) {
      el.querySelectorAll('button, input').forEach((node) => {
        node.disabled = !on;
      });
    },
    refresh: render,
  };
}
```

`js/ui/toast.js`:

```js
// Short warning messages at the bottom of the page (spec §3.6).
export function showToast(message, { root = document.body, duration = 4000 } = {}) {
  let host = root.querySelector(':scope > .toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    root.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.classList.add('leaving'), Math.max(0, duration - 400));
  setTimeout(() => toast.remove(), duration);
  return toast;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=66 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/ui tests
git commit -m "feat(ui): add knob, slider, button and position controls plus toasts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: 2D close-up insets

**Files:**
- Create: `js/ui/insets.js`
- Test: `tests/ui/insets.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `toneMap`, `beamColour`, `cardPixel`, `renderScreen`, `gaussianSpotSampler` (Task 7).
- Produces:
  - `niceStep(spanMm) → 1, 2 or 5 × 10^n`.
  - `drawApertureInset(canvas, { r, outer, beam })` — iris or ring face; `beam = { dx, dy, radius } | null` (metres, relative to the hole centre).
  - `drawPlaneAInset(canvas, planeA, noLightText)` — `planeA` as in `BenchResult.planeA` or `null`.
  - `drawScreenInset(canvas, screen, mark, noLightText)` — `screen` as in `BenchResult.screen` (uses `screen.window`) or `null`; `mark` is `{x, y}` in rail coordinates or `null`.

- [ ] **Step 1: Write the failing tests**

`tests/ui/insets.test.js`:

```js
import { test, assert, assertClose } from '../harness.js';
import { niceStep, drawApertureInset, drawPlaneAInset, drawScreenInset } from '../../js/ui/insets.js';
import { renderScreen, gaussianSpotSampler } from '../../js/optics/screen.js';

const makeCanvas = () => {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  return c;
};
const pixel = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);

test('insets: scale steps are 1, 2 or 5 × 10^n', () => {
  assertClose(niceStep(6), 1, 1e-12);
  assertClose(niceStep(20), 2, 1e-12);
  assertClose(niceStep(50), 10, 1e-12);
  assertClose(niceStep(0.3), 0.05, 1e-12);
});

test('insets: an iris face shows the beam on the blades and a dark hole without a beam', () => {
  const c = makeCanvas();
  // View half-size = max(2.5·r, 1.6·(offset + radius)) = 3.2 mm → beam centre at x ≈ 80 + 1.5/3.2·80 = 117.5 px.
  drawApertureInset(c, { r: 0.5e-3, outer: 0.025, beam: { dx: 1.5e-3, dy: 0, radius: 0.5e-3 } });
  const onSpot = pixel(c, 117, 80);
  const far = pixel(c, 20, 20);
  assert(onSpot[1] > far[1] + 100, `green on the blades: ${onSpot} vs ${far}`);
  drawApertureInset(c, { r: 0.5e-3, outer: 0.025, beam: null });
  assert(pixel(c, 80, 80)[1] < 20, 'dark hole without a beam');
});

test('insets: plane A and the screen draw, and fall back to a message without light', () => {
  const c = makeCanvas();
  drawPlaneAInset(c, { holeRadius: 0.5e-3, rings: [{ x: 0, y: 0, radius: 5e-3 }, { x: 0, y: 0, radius: 3e-3 }] });
  drawPlaneAInset(c, null, 'No light');
  const centre = { x: 0, y: 0.1 };
  const shot = renderScreen({ sample: gaussianSpotSampler({ centre, radius: 2e-3 }), centre, size: 10e-3, pixels: 64 });
  drawScreenInset(c, { window: shot }, { x: 3e-3, y: 0.1 });
  const middle = pixel(c, 80, 80);
  assert(middle[1] > 200, `bright spot in the middle: ${middle}`);
  drawScreenInset(c, null, null, 'No light');
});
```

Append to `tests/all.js`:

```js
import './ui/insets.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/ui/insets.js`:

```js
// 2D close-ups drawn on <canvas>: iris faces, the spatial-filter ring, plane A and the screen (spec §3.8).
import { toneMap, beamColour, cardPixel } from '../optics/screen.js';

export function niceStep(spanMm) {
  const raw = spanMm / 6;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const m = raw / pow;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
}

const viewHalf = (...sizes) => Math.min(0.025, Math.max(0.003, ...sizes));
const mmLabel = (value) => `${Number(value.toPrecision(3))} mm`;

function drawScaleBar(ctx, width, height, half) {
  const spanMm = half * 2e3;
  const step = niceStep(spanMm);
  ctx.fillStyle = 'rgba(225,230,238,0.9)';
  ctx.fillRect(8, height - 9, (step / spanMm) * width, 2);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(mmLabel(step), 8, height - 13);
}

function drawMessage(ctx, width, height, message) {
  ctx.fillStyle = 'rgba(162,169,182,0.9)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, width / 2, height / 2);
  ctx.textAlign = 'start';
}

// An iris or ring face: plate, hole and the beam's light where it lands (metres, relative to the hole centre).
export function drawApertureInset(canvas, { r, outer, beam }) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const half = viewHalf(2.5 * r, beam ? 1.6 * (Math.hypot(beam.dx, beam.dy) + beam.radius) : 0);
  const scale = width / (2 * half);
  const image = ctx.createImageData(width, height);
  for (let j = 0; j < height; j++) {
    const y = half - (j + 0.5) / scale;
    for (let i = 0; i < width; i++) {
      const x = -half + (i + 0.5) / scale;
      const rho = Math.hypot(x, y);
      const base = rho <= r ? [8, 8, 10] : rho <= outer ? [52, 55, 61] : [18, 20, 24];
      let light = 0;
      if (beam) {
        const dx = x - beam.dx;
        const dy = y - beam.dy;
        light = Math.exp((-2 * (dx * dx + dy * dy)) / (beam.radius * beam.radius));
        if (rho <= r) light *= 0.25;          // light going through the hole barely shows on this face
        else if (rho > outer) light *= 0.1;
      }
      const [lr, lg, lb] = beamColour(toneMap(light));
      const k = 4 * (j * width + i);
      image.data[k] = Math.min(255, base[0] + lr);
      image.data[k + 1] = Math.min(255, base[1] + lg);
      image.data[k + 2] = Math.min(255, base[2] + lb);
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  ctx.strokeStyle = 'rgba(0,191,255,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.max(1, r * scale), 0, 2 * Math.PI);
  ctx.stroke();
  drawScaleBar(ctx, width, height, half);
}

export function drawPlaneAInset(canvas, planeA, noLightText = '—') {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = '#34373d';
  ctx.fillRect(0, 0, width, height);
  if (!planeA) {
    drawMessage(ctx, width, height, noLightText);
    return;
  }
  const reach = Math.max(...planeA.rings.map((g) => Math.hypot(g.x, g.y) + g.radius));
  const half = viewHalf(1.1 * reach, 2.5 * planeA.holeRadius);
  const scale = width / (2 * half);
  const cx = width / 2;
  const cy = height / 2;
  ctx.fillStyle = '#08080a';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, planeA.holeRadius * scale), 0, 2 * Math.PI);
  ctx.fill();
  planeA.rings.forEach((g, n) => {
    ctx.beginPath();
    ctx.arc(cx + g.x * scale, cy - g.y * scale, g.radius * scale, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(80,255,110,0.06)';
    ctx.fill();
    ctx.strokeStyle = `rgba(80,255,110,${0.8 - n * 0.2})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  drawScaleBar(ctx, width, height, half);
}

let scratch = null;
function scratchCanvas(pixels) {
  if (!scratch || scratch.width !== pixels) {
    scratch = document.createElement('canvas');
    scratch.width = pixels;
    scratch.height = pixels;
  }
  return scratch;
}

// The computed screen image with a mm ruler; `mark` is the step-2a mark in rail coordinates (or null).
export function drawScreenInset(canvas, screen, mark = null, noLightText = '—') {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = '#0e1013';
  ctx.fillRect(0, 0, width, height);
  if (!screen) {
    drawMessage(ctx, width, height, noLightText);
    return;
  }
  const { image, pixels, size, centre } = screen.window;
  const off = scratchCanvas(pixels);
  const offCtx = off.getContext('2d');
  const data = offCtx.createImageData(pixels, pixels);
  for (let i = 0; i < pixels * pixels; i++) {
    const [r, g, b] = cardPixel(image[i]);
    data.data[4 * i] = r;
    data.data[4 * i + 1] = g;
    data.data[4 * i + 2] = b;
    data.data[4 * i + 3] = 255;
  }
  offCtx.putImageData(data, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, width, height);

  const spanMm = size * 1e3;
  const step = niceStep(spanMm);
  ctx.strokeStyle = 'rgba(14,16,19,0.8)';
  ctx.lineWidth = 1;
  for (let mm = 0; mm <= spanMm + 1e-9; mm += step) {
    const p = (mm / spanMm) * width;
    ctx.beginPath();
    ctx.moveTo(p, height);
    ctx.lineTo(p, height - 6);
    ctx.moveTo(0, height - p);
    ctx.lineTo(6, height - p);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(14,16,19,0.9)';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(mmLabel(step), 8, 12);

  if (mark) {
    const px = ((mark.x - (centre.x - size / 2)) / size) * width;
    const py = ((centre.y + size / 2 - mark.y) / size) * height;
    if (px >= 0 && px <= width && py >= 0 && py <= height) {
      ctx.strokeStyle = 'rgba(255,179,71,0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 6, py);
      ctx.lineTo(px + 6, py);
      ctx.moveTo(px, py - 6);
      ctx.lineTo(px, py + 6);
      ctx.stroke();
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=69 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/ui/insets.js tests
git commit -m "feat(ui): draw iris, plane-A and screen close-ups" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Side panel

**Files:**
- Create: `js/ui/panel.js`
- Test: `tests/ui/panel.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: a translator `t(key, params?)` passed in (Task 11 in the app, identity in tests).
- Produces: `createPanel(root, { t, onNext, onHint, onRestart })` → `{ currentControls, earlierControls, renderLabels(), renderStep({ stepId, checks, hintsShown, hintCount, questions, canAdvance, isLast, summary }), invalidate(), setMoreVisible(bool), renderReadouts([{ label, value }]) }`. Think cards and hints are rebuilt only when the step or hint count changes (so open cards stay open while knobs turn); `invalidate()` forces a rebuild (after a language switch). The narrow-screen sheet handle cycles the panel's `full` / `collapsed` classes.

- [ ] **Step 1: Write the failing tests**

`tests/ui/panel.test.js`:

```js
import { test, assert, assertEqual } from '../harness.js';
import { createPanel } from '../../js/ui/panel.js';

const t = (key) => key;
function mount() {
  const root = document.createElement('aside');
  document.getElementById('sandbox').appendChild(root);
  return root;
}

test('panel: renders checks, hints, think cards and the next button state', () => {
  const root = mount();
  let next = 0;
  let hint = 0;
  const panel = createPanel(root, { t, onNext: () => { next += 1; }, onHint: () => { hint += 1; }, onRestart() {} });
  panel.renderStep({
    stepId: 's1', checks: [{ id: 'closed', pass: true }, { id: 'positions', pass: false }],
    hintsShown: 1, hintCount: 4, questions: ['q3'], canAdvance: false, isLast: false,
  });
  const items = root.querySelectorAll('.checklist li');
  assertEqual(items.length, 2);
  assert(items[0].classList.contains('pass') && items[1].classList.contains('fail'), 'pass/fail classes');
  assertEqual(items[0].textContent, '✓step.s1.check.closed');
  assertEqual(root.querySelector('.step-title').textContent, 'step.s1.title');
  assertEqual(root.querySelectorAll('.hints li').length, 1);
  assertEqual(root.querySelectorAll('.think details').length, 1);
  assert(root.querySelector('.next-btn').disabled, 'next disabled until checks pass');
  root.querySelector('.hint-btn').click();
  assertEqual(hint, 1);
  panel.renderStep({
    stepId: 's1', checks: [{ id: 'closed', pass: true }], hintsShown: 4, hintCount: 4,
    questions: [], canAdvance: true, isLast: false,
  });
  assert(!root.querySelector('.next-btn').disabled, 'next enabled');
  assert(root.querySelector('.hint-btn').disabled, 'all hints shown');
  assertEqual(root.querySelector('.hint-btn').textContent, 'ui.noMoreHints');
  root.querySelector('.next-btn').click();
  assertEqual(next, 1);
  panel.renderReadouts([{ label: 'Power', value: '50.0 %' }]);
  assertEqual(root.querySelector('.readouts dd').textContent, '50.0 %');
  root.remove();
});

test('panel: think cards stay open while the same step re-renders; last step shows the summary', () => {
  const root = mount();
  const panel = createPanel(root, { t, onNext() {}, onHint() {}, onRestart() {} });
  const args = { stepId: 's2b', checks: [], hintsShown: 0, hintCount: 4, questions: ['q3'], canAdvance: false, isLast: false };
  panel.renderStep(args);
  root.querySelector('.think details').open = true;
  panel.renderStep(args);
  assert(root.querySelector('.think details').open, 'still open after a re-render');
  panel.renderStep({ ...args, stepId: 's3', questions: ['q1'] });
  assert(!root.querySelector('.think details').open, 'a new step starts closed');
  panel.renderStep({ ...args, stepId: 'done', hintCount: 0, questions: [], isLast: true, summary: ['line 1', 'line 2'] });
  assertEqual(root.querySelectorAll('.summary p').length, 2);
  assert(root.querySelector('.next-btn').hidden, 'no next button on the last step');
  assert(!root.querySelector('.summary-restart').hidden, 'restart offered');
  root.remove();
});
```

Append to `tests/all.js`:

```js
import './ui/panel.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py`
Expected: a `FAIL (load error)` line; exit code 1.

- [ ] **Step 3: Write the implementation**

`js/ui/panel.js`:

```js
// Side panel: step card (title, body, checklist, hints, think cards, next), controls host and readouts (spec §3.2).
export function createPanel(root, { t, onNext, onHint, onRestart }) {
  root.innerHTML = `
    <button type="button" class="sheet-handle"></button>
    <section class="step-card" aria-live="polite">
      <h2 class="step-title"></h2>
      <p class="step-body"></p>
      <h3 class="checklist-title"></h3>
      <ul class="checklist"></ul>
      <button type="button" class="hint-btn"></button>
      <ol class="hints"></ol>
      <div class="think"></div>
      <div class="summary" hidden></div>
      <button type="button" class="summary-restart" hidden></button>
      <button type="button" class="next-btn"></button>
    </section>
    <section class="controls-card">
      <h3 class="controls-title"></h3>
      <div class="controls-current"></div>
      <details class="controls-more"><summary class="controls-more-title"></summary><div class="controls-earlier"></div></details>
    </section>
    <section class="readouts-card">
      <h3 class="readouts-title"></h3>
      <dl class="readouts"></dl>
    </section>`;
  const q = (selector) => root.querySelector(selector);
  q('.next-btn').addEventListener('click', () => onNext());
  q('.hint-btn').addEventListener('click', () => onHint());
  q('.summary-restart').addEventListener('click', () => onRestart());
  const sheetStates = ['', 'full', 'collapsed'];
  let sheet = 0;
  q('.sheet-handle').addEventListener('click', () => {
    root.classList.remove('full', 'collapsed');
    sheet = (sheet + 1) % sheetStates.length;
    if (sheetStates[sheet]) root.classList.add(sheetStates[sheet]);
  });

  let shownStep = null;
  let shownHints = -1;

  function renderLabels() {
    q('.checklist-title').textContent = t('ui.checklist');
    q('.controls-title').textContent = t('ui.controls');
    q('.controls-more-title').textContent = t('ui.moreControls');
    q('.readouts-title').textContent = t('ui.readouts');
    q('.sheet-handle').textContent = t('ui.sheet');
    q('.summary-restart').textContent = t('step.done.restart');
  }

  function renderStep({ stepId, checks, hintsShown, hintCount, questions, canAdvance, isLast, summary = null }) {
    renderLabels();
    q('.step-title').textContent = t(`step.${stepId}.title`);
    q('.step-body').textContent = t(`step.${stepId}.body`);
    q('.checklist-title').hidden = checks.length === 0;
    q('.checklist').replaceChildren(...checks.map((c) => {
      const li = document.createElement('li');
      li.className = c.pass ? 'pass' : 'fail';
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = c.pass ? '✓' : '✗';
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = t(`step.${stepId}.check.${c.id}`);
      li.append(mark, text);
      return li;
    }));
    if (shownStep !== stepId) {
      shownStep = stepId;
      shownHints = -1;
      q('.think').replaceChildren(...questions.map((id) => {
        const details = document.createElement('details');
        const summaryEl = document.createElement('summary');
        summaryEl.textContent = t('ui.think');
        const p = document.createElement('p');
        p.textContent = t(`question.${id}`);
        details.append(summaryEl, p);
        return details;
      }));
    }
    if (shownHints !== hintsShown) {
      shownHints = hintsShown;
      q('.hints').replaceChildren(...Array.from({ length: hintsShown }, (_, i) => {
        const li = document.createElement('li');
        li.textContent = t(`step.${stepId}.hint.${i + 1}`);
        return li;
      }));
    }
    const hintButton = q('.hint-btn');
    hintButton.hidden = hintCount === 0;
    hintButton.disabled = hintsShown >= hintCount;
    hintButton.textContent = hintsShown >= hintCount ? t('ui.noMoreHints') : t('ui.hint');
    const next = q('.next-btn');
    next.textContent = t('ui.next');
    next.disabled = !canAdvance;
    next.hidden = isLast;
    const summaryBox = q('.summary');
    summaryBox.hidden = !summary;
    q('.summary-restart').hidden = !summary;
    if (summary) {
      summaryBox.replaceChildren(...summary.map((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
      }));
    }
  }

  return {
    currentControls: q('.controls-current'),
    earlierControls: q('.controls-earlier'),
    renderLabels,
    renderStep,
    invalidate() {
      shownStep = null;
      shownHints = -1;
    },
    setMoreVisible(visible) {
      q('.controls-more').hidden = !visible;
    },
    renderReadouts(items) {
      q('.readouts').replaceChildren(...items.flatMap(({ label, value }) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }));
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=71 failed=0`.

- [ ] **Step 5: Commit**

```bash
git add js/ui/panel.js tests
git commit -m "feat(ui): add the step panel with checklist, hints, think cards and readouts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Experiment page — wiring, layout and styles

**Files:**
- Create: `laser.html`, `css/style.css`, `js/app.js`
- Test: `tests/app.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: everything above — `CONFIG`, `randomSeed`, `bench`, state functions, `STEPS`/flow functions, `t`/`setLanguage`/`onLanguageChange`/`applyTranslations`, `createPanel`, the control factories, inset drawers, `showToast`, `webglAvailable`, and (lazily) `createView`, `buildBench`, `createPartModel`, `rackSlot`, `createBeamView`, `createInteraction`.
- Produces: `laser.html` with `window.eolab = { ready, errors, t, seed, getState(), getFlow(), getResult(), lastBenchMs, lastRenderMs }` for tests and debugging. Controls carry `data-control="<control id>"` (position groups: `<part>.place`, `<part>.z`, `<part>.unplace`); camera buttons carry `data-camera`; inset toggles carry `data-inset`.

- [ ] **Step 1: Write the failing test**

`tests/app.test.js`:

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

test('app: laser page boots, turns the laser on and moves to step 1', async () => {
  const { frame, app, doc } = await loadPage('../laser.html?seed=7');
  assertEqual(app.errors.length, 0, `errors: ${app.errors.join(' | ')}`);
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.start.title'));
  assert(doc.querySelector('#viewport canvas'), '3D canvas created');
  doc.querySelector('[data-control="laser.power"]').click();
  assert(doc.querySelector('.checklist li').classList.contains('pass'), 'laser-on check passes');
  const next = doc.querySelector('.next-btn');
  assert(!next.disabled, 'next enabled');
  next.click();
  assertEqual(doc.querySelector('.step-title').textContent, app.t('step.s1.title'));
  doc.querySelector('[data-control="a1.place"]').click();
  assert(app.getState().parts.a1.onRail, 'Aperture 1 placed on the rail');
  assert(app.getResult().segments.length > 0, 'beam traced');
  assertEqual(doc.querySelectorAll('.inset:not([hidden])').length, 2, 'step 1 shows the two iris close-ups');
  frame.remove();
});
```

Append to `tests/all.js`:

```js
import './app.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py --filter app:`
Expected: `FAIL app: laser page boots, turns the laser on and moves to step 1 — page did not become ready` (or a load error), exit code 1.

- [ ] **Step 3: Write the page**

`laser.html`:

```html
<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EO LAB · 實驗一</title>
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
  <script type="module" src="./js/app.js"></script>
</body>
</html>
```

`css/style.css`:

```css
/* EO LAB Web — shared styles (laser.html and index.html). */
:root {
  --bg: #0f1115;
  --surface: #181b21;
  --surface-2: #20242c;
  --border: #2c313b;
  --text: #e7eaf0;
  --text-dim: #a2a9b6;
  --accent: #00bfff;
  --pass: #3ccf6e;
  --fail: #ff6b6b;
  --warn: #ffb347;
  --radius: 10px;
  --panel-width: 360px;
  --topbar-height: 48px;
  color-scheme: dark;
  font-family: system-ui, -apple-system, "Segoe UI", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); }
button { font: inherit; color: inherit; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; cursor: pointer; }
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: 0.45; cursor: not-allowed; }
a { color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
[hidden] { display: none !important; }
.lab-page { overflow: hidden; }

/* top bar */
.topbar { position: fixed; inset: 0 0 auto 0; height: var(--topbar-height); display: flex; align-items: center; gap: 12px; padding: 0 12px; background: var(--surface); border-bottom: 1px solid var(--border); z-index: 20; }
.topbar-back { text-decoration: none; white-space: nowrap; }
.progress { display: flex; gap: 6px; list-style: none; margin: 0 auto; padding: 0; overflow-x: auto; }
.progress li { padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-dim); font-size: 13px; white-space: nowrap; }
.progress li.done { color: var(--pass); border-color: var(--pass); }
.progress li.current { color: #002433; background: var(--accent); border-color: var(--accent); font-weight: 700; }
.topbar-actions { display: flex; gap: 8px; }

/* lab layout */
.lab { position: fixed; inset: var(--topbar-height) 0 0 0; }
.viewport { position: absolute; inset: 0 var(--panel-width) 0 0; }
.viewport canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.nowebgl { position: absolute; left: 24px; right: calc(var(--panel-width) + 24px); top: 40%; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); line-height: 1.6; }
.camera-presets { position: absolute; left: 12px; bottom: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
.insets { position: absolute; left: 12px; top: 12px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100% - 70px); overflow-y: auto; }
.inset-toggles { display: flex; gap: 4px; flex-wrap: wrap; max-width: 360px; }
.inset-toggles button { padding: 2px 8px; font-size: 12px; }
.inset-toggles button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
.inset { margin: 0; width: 172px; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.inset figcaption { margin-bottom: 4px; font-size: 12px; color: var(--text-dim); }
.inset canvas { display: block; width: 160px; height: 160px; border-radius: 6px; }

/* panel */
.panel { position: absolute; top: 0; right: 0; bottom: 0; width: var(--panel-width); display: flex; flex-direction: column; gap: 14px; padding: 14px; overflow-y: auto; background: var(--surface); border-left: 1px solid var(--border); }
.sheet-handle { display: none; }
.panel h2 { margin: 0 0 6px; font-size: 18px; }
.panel h3 { margin: 10px 0 6px; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: var(--text-dim); }
.step-body { margin: 0; line-height: 1.6; }
.checklist { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.checklist li { display: flex; align-items: baseline; gap: 8px; }
.checklist .mark { width: 1.2em; text-align: center; font-weight: 700; }
.checklist li.pass .mark { color: var(--pass); }
.checklist li.fail .mark { color: var(--fail); }
.hint-btn { margin-top: 8px; align-self: flex-start; }
.hints { margin: 6px 0 0; padding-left: 20px; line-height: 1.5; color: var(--warn); }
.think details { margin-top: 6px; padding: 6px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; }
.think summary { cursor: pointer; color: var(--accent); }
.think p { margin: 6px 0 0; line-height: 1.5; }
.summary p { margin: 4px 0; }
.summary-restart { margin-top: 6px; }
.next-btn { width: 100%; margin-top: 10px; padding: 10px; font-weight: 700; color: #002433; background: var(--accent); border-color: var(--accent); }
.controls-card, .readouts-card { padding-top: 6px; border-top: 1px solid var(--border); }
.controls-current, .controls-earlier { display: grid; gap: 10px; }
.controls-more summary { margin: 8px 0; cursor: pointer; color: var(--text-dim); }
.readouts { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 0; }
.readouts dt { color: var(--text-dim); }
.readouts dd { margin: 0; font-variant-numeric: tabular-nums; }

/* controls */
.control { display: grid; gap: 4px; }
.control-label { font-size: 13px; color: var(--text-dim); }
.control-value { font-variant-numeric: tabular-nums; }
.knob-row, .position-row { display: flex; align-items: center; gap: 6px; }
.dial { width: 40px; height: 40px; border-radius: 50%; cursor: ns-resize; touch-action: none; }
.dial svg { width: 100%; height: 100%; }
.dial circle { fill: var(--surface-2); stroke: var(--accent); stroke-width: 2; }
.dial line { stroke: var(--text); stroke-width: 3; stroke-linecap: round; }
.step { width: 34px; height: 34px; padding: 0; font-size: 18px; }
.mode { padding: 4px 8px; font-size: 12px; }
.slider input[type="range"] { width: 100%; accent-color: var(--accent); }
.position-input { width: 84px; padding: 6px; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; }
.control.disabled { opacity: 0.5; }
button.control { justify-self: start; }
button.pressed { color: var(--pass); border-color: var(--pass); }

/* toasts */
.toast-host { position: fixed; left: 50%; bottom: 24px; z-index: 50; display: grid; gap: 8px; transform: translateX(-50%); pointer-events: none; }
.toast { max-width: min(90vw, 520px); padding: 10px 14px; color: #ffe2b5; background: #3a2a10; border: 1px solid var(--warn); border-radius: 8px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4); transition: opacity 0.4s; }
.toast.leaving { opacity: 0; }

/* narrow screens: the panel becomes a bottom sheet */
@media (max-width: 767px) {
  :root { --panel-width: 0px; }
  .viewport { inset: 0; }
  .panel { top: auto; left: 0; right: 0; width: auto; height: 45%; border-left: 0; border-top: 1px solid var(--border); border-radius: 14px 14px 0 0; }
  .panel.full { height: calc(100% - 12px); }
  .panel.collapsed { height: 56px; overflow: hidden; }
  .sheet-handle { display: block; align-self: center; padding: 4px 14px; font-size: 12px; }
  .nowebgl { right: 24px; top: 20%; }
  .insets { flex-direction: row; flex-wrap: wrap; max-width: calc(100% - 24px); max-height: 40%; }
  .inset { width: 112px; }
  .inset canvas { width: 100px; height: 100px; }
  .camera-presets { bottom: calc(45% + 12px); }
  .progress li { padding: 2px 6px; }
}
```

`js/app.js`:

```js
// Experiment 1 page (laser.html): input → state → bench() → 3D scene, close-ups, panel and step checks.
import { CONFIG } from './optics/config.js';
import { randomSeed } from './optics/rng.js';
import { bench } from './optics/bench.js';
import * as S from './lab/state.js';
import * as F from './lab/steps.js';
import { t, getLanguage, setLanguage, onLanguageChange, applyTranslations } from './i18n/index.js';
import { createPanel } from './ui/panel.js';
import { createKnob, createSlider, createButton, createPositionControl } from './ui/controls.js';
import { drawApertureInset, drawPlaneAInset, drawScreenInset } from './ui/insets.js';
import { showToast } from './ui/toast.js';
import { webglAvailable } from './scene/webgl.js';

const { laser: L, post: P, objective: O, pinhole: PH, iris: I } = CONFIG;
const modeLabels = { fine: () => t('ui.fine'), coarse: () => t('ui.coarse') };
const partLabel = (id, key) => () => `${t(`part.${id}`)} · ${t(key)}`;
const fixed = (digits, factor) => (v) => (v * factor).toFixed(digits);

function heightKnob(id) {
  return { path: `parts.${id}.height`, label: partLabel(id, 'control.height'), unit: 'mm', format: fixed(2, 1e3), min: P.min, max: P.max, fine: P.fine, coarse: P.coarse };
}
function decentreKnob(key) {
  return { path: `parts.sf.${key}`, label: () => t(`control.sf.${key}`), unit: 'µm', format: fixed(0, 1e6), min: -O.decentreRange, max: O.decentreRange, fine: O.decentreFine, coarse: O.decentreCoarse };
}
function pinholeKnob(key) {
  return { path: `parts.sf.${key}`, label: () => t(`control.sf.${key}`), unit: 'µm', format: fixed(0, 1e6), min: -PH.range, max: PH.range, fine: PH.fine, coarse: PH.coarse };
}

const KNOBS = {
  'laser.pitch': { path: 'laser.pitch', label: () => t('control.laser.pitch'), unit: 'mrad', format: fixed(2, 1e3), min: -L.knobRange, max: L.knobRange, fine: L.knobFine, coarse: L.knobCoarse },
  'laser.yaw': { path: 'laser.yaw', label: () => t('control.laser.yaw'), unit: 'mrad', format: fixed(2, 1e3), min: -L.knobRange, max: L.knobRange, fine: L.knobFine, coarse: L.knobCoarse },
  'a1.height': heightKnob('a1'),
  'a2.height': heightKnob('a2'),
  'sf.height': heightKnob('sf'),
  'lens.height': heightKnob('lens'),
  'sf.objX': decentreKnob('objX'),
  'sf.objY': decentreKnob('objY'),
  'sf.focus': { path: 'parts.sf.focus', label: () => t('control.sf.focus'), unit: 'mm', format: fixed(3, 1e3), min: 0, max: O.travel, fine: O.focusFine, coarse: O.focusCoarse },
  'sf.phX': pinholeKnob('phX'),
  'sf.phY': pinholeKnob('phY'),
};
const SLIDERS = {
  'a1.opening': { path: 'parts.a1.opening', label: partLabel('a1', 'control.opening') },
  'a2.opening': { path: 'parts.a2.opening', label: partLabel('a2', 'control.opening') },
};
const PLACE_DEFAULTS = { a1: 0.05, a2: 0.9, sf: 0.2, lens: 0.45, screen: 1.0 };
const Z_STEPS = { a1: CONFIG.rail, a2: CONFIG.rail, sf: CONFIG.rail, lens: CONFIG.lens, screen: CONFIG.screen };
const INSET_IDS = ['a1', 'a2', 'ring', 'planeA', 'screen'];
const CAMERAS = ['overview', 'laser', 'filter', 'screen'];

// ---- state ----
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : randomSeed();
let state = S.createInitialState(seed);
let flow = F.createFlow();
let result = bench(state);
let selectedPart = null;
let scene3d = null;
const startedAt = performance.now();
const debug = window.eolab ?? (window.eolab = { errors: [] });

const panel = createPanel(document.getElementById('panel'), {
  t,
  onNext: () => {
    if (!F.canAdvance(flow, state, result)) return;
    flow = F.advance(flow, state, performance.now());
    enterStep();
  },
  onHint: () => {
    flow = F.revealHint(flow);
    renderPanel();
  },
  onRestart: restart,
});

function restart() {
  if (window.confirm(t('ui.restartConfirm'))) location.search = `?seed=${randomSeed()}`;
}

function update(next) {
  if (next !== state) {
    const prev = state;
    state = next;
    const t0 = performance.now();
    result = bench(state);
    debug.lastBenchMs = performance.now() - t0;
    const detected = F.detectWarnings(flow, prev, state, result);
    flow = detected.flow;
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
  const [{ createView }, models, { createBeamView }, { createInteraction }] = await Promise.all([
    import('./scene/view.js'),
    import('./scene/models.js'),
    import('./scene/beam.js'),
    import('./scene/interact.js'),
  ]);
  const view = createView(document.getElementById('viewport'));
  const benchModel = models.buildBench(view.scene);
  const parts = new Map(S.PART_IDS.map((id) => {
    const model = models.createPartModel(id);
    view.scene.add(model.group);
    return [id, model];
  }));
  const beam = createBeamView(view.scene);
  createInteraction({
    view,
    parts,
    canPick: (id) => F.isPartUnlocked(flow, id),
    onLocked: warnLocked,
    onDrop: (id, z) => (z === null ? renderScene() : update(S.placePart(state, id, z))),
    onRemove: (id) => update(S.removePart(state, id)),
    onSelect: (id) => {
      selectedPart = id;
      renderScene();
    },
  });
  view.start();
  return { view, benchModel, parts, beam, rackSlot: models.rackSlot };
}

function renderScene() {
  if (!scene3d) return;
  const { benchModel, parts, beam, rackSlot } = scene3d;
  benchModel.laser.update({ height: state.hidden.laserHeight, pitch: state.laser.pitch, yaw: state.laser.yaw });
  for (const id of S.PART_IDS) {
    const part = state.parts[id];
    const model = parts.get(id);
    if (part.onRail) {
      model.group.position.set(part.z, 0, 0);
    } else {
      const slot = rackSlot(id);
      model.group.position.set(slot.x, 0, slot.z);
    }
    model.update(part, {
      locked: !F.isPartUnlocked(flow, id),
      selected: selectedPart === id,
      cardImage: id === 'screen' && result.screen ? result.screen.card.image : null,
    });
  }
  beam.update(result);
}

function applyCamera(name) {
  if (!scene3d) return;
  const { sf, screen } = state.parts;
  const focus = name === 'filter' && sf.onRail ? sf.z : name === 'screen' && screen.onRail ? screen.z : undefined;
  scene3d.view.setPreset(name, focus);
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

function faceBeam(face) {
  return face ? { dx: face.dx, dy: face.dy, radius: face.radius } : null;
}

function renderInsets() {
  const noLight = t('inset.noLight');
  document.querySelector('.inset-toggles').setAttribute('aria-label', t('ui.insets'));
  for (const id of INSET_IDS) {
    const { figure, toggle, canvas, caption } = insetParts[id];
    const visible = insetVisible.has(id);
    toggle.textContent = t(`inset.${id}`);
    toggle.setAttribute('aria-pressed', String(visible));
    caption.textContent = t(`inset.${id}`);
    figure.hidden = !visible;
    if (!visible) continue;
    if (id === 'a1' || id === 'a2') {
      drawApertureInset(canvas, { r: state.parts[id].opening / 2, outer: I.plateRadius, beam: faceBeam(result.irisFaces[id]) });
    } else if (id === 'ring') {
      drawApertureInset(canvas, { r: CONFIG.mount.ringRadius, outer: 0.012, beam: faceBeam(result.irisFaces.ring) });
    } else if (id === 'planeA') {
      drawPlaneAInset(canvas, result.planeA, noLight);
    } else {
      const mark = state.parts.screen.mark;
      drawScreenInset(canvas, result.screen, mark ? { x: mark.x, y: CONFIG.screen.centreHeight + mark.y } : null, noLight);
    }
  }
}

// ---- controls ----
const widgets = new Map();

function controlEnabled(id) {
  const { parts } = state;
  const sf = parts.sf;
  switch (id) {
    case 'sf.objective': return sf.onRail && !sf.objective;
    case 'sf.pinhole': return sf.onRail && sf.objective && !sf.pinhole;
    case 'sf.objX':
    case 'sf.objY':
    case 'sf.focus': return sf.objective;
    case 'sf.phX':
    case 'sf.phY': return sf.pinhole;
    case 'screen.mark': return parts.screen.onRail && Boolean(result.at.screen);
    case 'a2.remove': return parts.a2.onRail;
    default: {
      const part = id.split('.')[0];
      return part in parts ? parts[part].onRail : true;
    }
  }
}

function positionGroup(id) {
  const steps = Z_STEPS[id];
  const place = createButton({
    label: partLabel(id, 'ui.place'),
    onClick: () => {
      if (!F.isPartUnlocked(flow, id)) {
        warnLocked(id);
        return;
      }
      const z = S.nearestFreeZ(state, id, PLACE_DEFAULTS[id]);
      if (z !== null) update(S.placePart(state, id, z));
    },
  });
  const position = createPositionControl({
    label: partLabel(id, 'control.z'),
    value: state.parts[id].z,
    fine: steps.zFine,
    coarse: steps.zCoarse,
    labels: modeLabels,
    onChange: (z) => update(S.placePart(state, id, z)),
  });
  const remove = createButton({ label: partLabel(id, 'ui.remove'), onClick: () => update(S.removePart(state, id)) });
  place.el.dataset.control = `${id}.place`;
  position.el.dataset.control = `${id}.z`;
  remove.el.dataset.control = `${id}.unplace`;
  widgets.set(`${id}.z`, { kind: 'position', id, place, position, remove });
  return [place.el, position.el, remove.el];
}

const BUTTONS = {
  'laser.power': {
    label: () => `${t('control.laser.power')}: ${state.laser.on ? t('ui.on') : t('ui.off')}`,
    onClick: () => update(S.setLaserOn(state, !state.laser.on)),
  },
  'sf.objective': {
    label: () => (state.parts.sf.objective ? t('control.installed') : t('control.sf.objective')),
    onClick: () => update(S.installObjective(state, result.at.ring ?? { x: 0, y: state.parts.sf.height })),
  },
  'sf.pinhole': {
    label: () => (state.parts.sf.pinhole ? t('control.installed') : t('control.sf.pinhole')),
    onClick: () => {
      if (result.at.objective) update(S.installPinhole(state, result.at.objective.focusCentre));
    },
  },
  'screen.mark': {
    label: () => t('control.screen.mark'),
    onClick: () => {
      if (result.at.screen) update(S.markScreen(state, result.at.screen));
    },
  },
  'a2.remove': { label: partLabel('a2', 'ui.remove'), onClick: () => update(S.removePart(state, 'a2')) },
};

function makeControl(id) {
  if (KNOBS[id]) {
    const def = KNOBS[id];
    const widget = createKnob({ ...def, value: S.getValue(state, def.path), labels: modeLabels, onChange: (v) => update(S.setValue(state, def.path, v)) });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: def.path });
    return [widget.el];
  }
  if (SLIDERS[id]) {
    const def = SLIDERS[id];
    const widget = createSlider({
      label: def.label, unit: 'mm', value: S.getValue(state, def.path), min: I.openingMin, max: I.openingMax,
      step: I.openingStep, format: fixed(1, 1e3), onChange: (v) => update(S.setValue(state, def.path, v)),
    });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: def.path });
    return [widget.el];
  }
  if (id.endsWith('.z')) return positionGroup(id.split('.')[0]);
  const widget = createButton(BUTTONS[id]);
  widget.el.dataset.control = id;
  widgets.set(id, { kind: 'button', widget });
  return [widget.el];
}

function buildControls() {
  widgets.clear();
  const { current, earlier } = F.unlockedControls(flow);
  panel.currentControls.replaceChildren(...current.flatMap(makeControl));
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
    } else if (entry.kind === 'position') {
      const part = state.parts[entry.id];
      entry.place.el.hidden = part.onRail;
      entry.position.el.hidden = !part.onRail;
      entry.remove.el.hidden = !part.onRail;
      entry.position.setValue(part.z);
      entry.place.refresh();
      entry.remove.refresh();
    } else {
      entry.widget.refresh();
      entry.widget.setEnabled(controlEnabled(id));
    }
  }
}

// ---- panel ----
function readouts() {
  const none = t('readout.none');
  const d = result.divergence;
  return [
    { label: t('readout.power'), value: result.laserOn ? `${(result.powerAtScreen * 100).toFixed(1)} %` : none },
    { label: t('readout.pinhole'), value: result.pinhole ? `${(result.pinhole.transmission * 100).toFixed(1)} %` : none },
    { label: t('readout.diameter'), value: result.screen ? `${(result.screen.d4sigma * 1e3).toFixed(1)} mm` : none },
    { label: t('readout.divergence'), value: d ? `${(d.theta * 1e3).toFixed(2)} mrad · ${t(`readout.${d.state}`)}` : none },
  ];
}

function summaryLines() {
  const predicted = (CONFIG.lens.focalLength / O.focalLength) * 2 * L.waistRadius;
  const elapsed = (performance.now() - startedAt) / 1000;
  return [
    t('step.done.measured', {
      measured: result.screen ? (result.screen.d4sigma * 1e3).toFixed(1) : t('readout.none'),
      predicted: (predicted * 1e3).toFixed(1),
    }),
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
    isLast: step.id === 'done',
    summary: step.id === 'done' ? summaryLines() : null,
  });
  panel.renderReadouts(readouts());
}

function renderProgress() {
  document.querySelector('.progress').replaceChildren(...F.STEPS.map((step, index) => {
    const li = document.createElement('li');
    li.textContent = step.id === 'start' ? t('progress.start') : step.id === 'done' ? t('progress.done') : F.STEP_LABELS[step.id];
    li.className = index < flow.index ? 'done' : index === flow.index ? 'current' : '';
    if (index === flow.index) li.setAttribute('aria-current', 'step');
    return li;
  }));
}

function renderStatic() {
  applyTranslations(document);
  document.documentElement.lang = getLanguage() === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  document.title = `EO LAB · ${t('app.exp1Short')}`;
  document.querySelector('.lang-btn').textContent = t('ui.switchLanguage');
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
Object.assign(debug, { ready: true, t, seed, getState: () => state, getFlow: () => flow, getResult: () => result });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=72 failed=0`.

- [ ] **Step 5: Look at it in the browser pane**

Serve the site with `python tools/serve.py --port 8765` (run in the background), open `http://127.0.0.1:8765/laser.html?seed=1` in the browser pane and take a screenshot. Expected: the dark bench with the rail, rack and laser; the step card "開始" on the right with the laser-power control; no console errors (check the console messages). Fix anything broken, re-run the tests.

- [ ] **Step 6: Commit**

```bash
git add laser.html css js/app.js tests
git commit -m "feat: wire the Experiment 1 page with scene, close-ups, panel and controls" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Lobby, README and end-to-end verification

**Files:**
- Create: `index.html`, `js/lobby.js`
- Modify: `css/style.css` (append lobby styles), `README.md` (replace)
- Test: `tests/lobby.test.js`
- Modify: `tests/all.js` (append one import)

**Interfaces:**
- Consumes: `t`, `getLanguage`, `setLanguage`, `onLanguageChange`, `applyTranslations` (Task 11); styles (Task 17).
- Produces: `index.html` with `window.eolabLobby = { ready, t }` once rendered.

- [ ] **Step 1: Write the failing test**

`tests/lobby.test.js`:

```js
import { test, assert, assertEqual } from './harness.js';

test('lobby: shows the experiment cards and switches language', async () => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:900px;height:700px;position:absolute;left:-9999px;top:0;border:0';
  frame.src = '../index.html';
  document.body.appendChild(frame);
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (frame.contentWindow && frame.contentWindow.eolabLobby && frame.contentWindow.eolabLobby.ready) resolve();
      else if (Date.now() - started > 20000) reject(new Error('lobby did not load'));
      else setTimeout(poll, 50);
    };
    poll();
  });
  const doc = frame.contentDocument;
  const { t } = frame.contentWindow.eolabLobby;
  assertEqual(doc.querySelector('h1').textContent, t('app.title'));
  assertEqual(doc.querySelectorAll('.card').length, 3);
  assert(doc.querySelector('.card a[href="./laser.html"]'), 'link to Experiment 1');
  const before = doc.querySelector('h1').textContent;
  doc.querySelector('.lang-btn').click();
  assert(doc.querySelector('h1').textContent !== before, 'title changes language');
  doc.querySelector('.lang-btn').click();
  frame.remove();
});
```

Append to `tests/all.js`:

```js
import './lobby.test.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python tools/run_tests.py --filter lobby:`
Expected: `FAIL lobby: shows the experiment cards and switches language — lobby did not load`; exit code 1.

- [ ] **Step 3: Write the lobby, its styles and the README**

`index.html`:

```html
<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EO LAB</title>
  <link rel="stylesheet" href="./css/style.css">
</head>
<body class="lobby-page">
  <main class="lobby">
    <header class="lobby-header">
      <div>
        <h1 data-i18n="app.title"></h1>
        <p class="lobby-subtitle" data-i18n="lobby.subtitle"></p>
      </div>
      <button type="button" class="lang-btn"></button>
    </header>
    <section class="cards">
      <article class="card">
        <h2 data-i18n="lobby.exp1.title"></h2>
        <p data-i18n="lobby.exp1.body"></p>
        <a class="card-action" href="./laser.html" data-i18n="lobby.start"></a>
      </article>
      <article class="card disabled" aria-disabled="true">
        <h2 data-i18n="lobby.michelson.title"></h2>
        <p data-i18n="lobby.comingLater"></p>
      </article>
      <article class="card disabled" aria-disabled="true">
        <h2 data-i18n="lobby.mz.title"></h2>
        <p data-i18n="lobby.comingLater"></p>
      </article>
    </section>
    <section class="controls-guide">
      <h2 data-i18n="lobby.controls.title"></h2>
      <p data-i18n="lobby.controls.mouse"></p>
      <p data-i18n="lobby.controls.touch"></p>
    </section>
  </main>
  <script type="module" src="./js/lobby.js"></script>
</body>
</html>
```

`js/lobby.js`:

```js
// Lobby page: translated cards and the language switch.
import { t, getLanguage, setLanguage, onLanguageChange, applyTranslations } from './i18n/index.js';

function render() {
  applyTranslations(document);
  document.documentElement.lang = getLanguage() === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  document.title = t('app.title');
  document.querySelector('.lang-btn').textContent = t('ui.switchLanguage');
}

document.querySelector('.lang-btn').addEventListener('click', () => setLanguage(getLanguage() === 'zh-TW' ? 'en' : 'zh-TW'));
onLanguageChange(render);
render();
window.eolabLobby = { ready: true, t };
```

Append to `css/style.css`:

```css
/* lobby */
.lobby-page { overflow-y: auto; }
.lobby { max-width: 960px; margin: 0 auto; padding: 32px 16px 48px; }
.lobby-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.lobby-header h1 { margin: 0; font-size: 30px; }
.lobby-subtitle { margin: 6px 0 0; color: var(--text-dim); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin: 28px 0; }
.card { display: flex; flex-direction: column; gap: 10px; padding: 18px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.card h2 { margin: 0; font-size: 18px; }
.card p { margin: 0; line-height: 1.6; color: var(--text-dim); }
.card.disabled { opacity: 0.55; }
.card-action { align-self: flex-start; margin-top: auto; padding: 8px 16px; font-weight: 700; color: #002433; text-decoration: none; background: var(--accent); border-radius: 8px; }
.controls-guide { padding: 18px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.controls-guide h2 { margin: 0 0 8px; font-size: 16px; }
.controls-guide p { margin: 6px 0; line-height: 1.6; color: var(--text-dim); }
```

Replace `README.md` with:

```markdown
# EO LAB Web

A browser version of 光電實驗(一) 實驗一「對光、平行光、與光擴束」 (NTUT). Students align a laser with two irises, build a spatial filter (20× objective + 25 µm pinhole) and collimate the expanded beam with an f = 200 mm lens, following the handout's procedure. Everything on screen is computed live: Gaussian beams, a Fourier-optics pinhole and real collimation.

- 繁體中文 by default, with an English switch.
- Works with mouse or touch; needs WebGL 2 (current Chrome, Edge, Firefox or Safari).

## Run it locally

Browsers block ES modules opened from `file://`, so serve the folder:

    python tools/serve.py

then open http://127.0.0.1:8765/ . (`python -m http.server` also works on machines that serve `.js` as JavaScript.)
Add `?seed=1234` to `laser.html` to reproduce a particular random start.

## Tests

    python tools/run_tests.py
    python tools/run_tests.py --filter pinhole

The runner uses headless Edge or Chrome; set `EOLAB_BROWSER` to the browser executable if it is installed somewhere unusual.

## Publish on GitHub Pages

1. Create a GitHub repository and push this folder (`git remote add origin <url>`, then `git push -u origin main`).
2. In the repository settings: Pages → Build and deployment → Deploy from a branch → `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repository>/`.

## Change parameters or text

- Physical constants, ranges and pass thresholds: `js/optics/config.js`.
- UI text: `js/i18n/zh-TW.js` and `js/i18n/en.js` (same keys in both).

## Layout

- `js/optics/` — physics (pure and tested): beam tracing, Gaussian beams, irises, pinhole far field, screen.
- `js/lab/` — bench state, and the Chapter 1 steps, checks and warnings.
- `js/scene/` — three.js bench, beam and interaction.
- `js/ui/` — panel, controls, close-ups and toasts.
- `docs/superpowers/` — design spec and implementation plan.

three.js 0.170.0 is included under the MIT licence (`js/vendor/LICENSE-three.txt`).
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python tools/run_tests.py`
Expected: `SUMMARY passed=73 failed=0`.

- [ ] **Step 5: End-to-end check in the browser pane (desktop, phone, both languages)**

Create `C:/Users/wongz/Desktop/LAB/VR/.claude/launch.json` (outside the repository) if it does not exist, so the browser pane can start the server:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "eo-lab-web", "runtimeExecutable": "python", "runtimeArgs": ["eo-lab-web/tools/serve.py", "--port", "8765"], "port": 8765 }
  ]
}
```

Start it with the browser pane's `preview_start` (name `eo-lab-web`) and check, taking screenshots as you go:
1. Lobby at `/`: three cards; 中/EN switch changes every text.
2. `laser.html?seed=1`, desktop size: complete the whole procedure by hand, using drag-and-drop for at least one part and the panel buttons for others. At each step the checklist turns ✓ only when the handout condition is met; Next works; the done summary shows a measured diameter and 22.2 mm predicted.
3. Provoke the warnings: change Aperture 2's height while it is far away in step 1 (M1); turn a laser knob in step 2a (M2); wind the objective to 0 in step 3 (M4); click the lens on the rack in step 1 (M5).
4. Physics looks right: the noisy expanded beam with the objective only; dim Airy rings with the pinhole far from focus; a clean bright spot at focus; a collimated beam whose diameter stays the same when the screen moves.
5. Speed: after turning a few knobs, `window.eolab.lastBenchMs` and `window.eolab.lastRenderMs` (read with the JavaScript tool) stay under 50 ms.
6. Phone size: resize the pane to the `mobile` preset, reload, and check the bottom sheet, the close-up row and the controls; then reset to `desktop`.
7. English: switch language on the experiment page; no raw keys (such as `step.s1.title`) appear anywhere.
8. Console: no errors.

Fix anything found (add a test first when it is logic), re-run `python tools/run_tests.py`, then continue.

- [ ] **Step 6: Commit**

```bash
git add index.html js/lobby.js css/style.css README.md tests
git commit -m "feat: add the lobby, README and end-to-end checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec section | Task(s) |
|---|---|
| §1 Background, decisions, non-goals | Global Constraints; scope of Tasks 1–18 |
| §2 Platforms, WebGL 2 fallback, http serving, no external requests | Tasks 1 (serve.py), 12 (webgl.js, vendored three.js), 17 (no-WebGL message), 18 (README) |
| §3.1 Pages | Tasks 17 (`laser.html`), 18 (`index.html`) |
| §3.2 Layout: top bar, panel, bottom sheet, insets, toasts | Tasks 14, 15, 16, 17 |
| §3.3 Bench, parts, ranges, rail rules | Tasks 2 (config), 8 (state), 12 (models) |
| §3.4 Interaction: camera, drag, tap-to-place, knobs, keyboard | Tasks 12 (view), 13 (interact), 14 (controls), 17 (wiring) |
| §3.5 Steps and checks | Task 10 (+ solvability test), Task 11 (texts) |
| §3.6 Warnings M1–M5 | Tasks 10 (M1–M4), 17 (M5) |
| §3.7 Readouts | Tasks 9 (values), 17 (formatting) |
| §3.8 Close-up insets | Tasks 9 (data), 15 (drawing), 17 (toggles) |
| §3.9 Visual style | Tasks 12, 13, 17 |
| §3.10 Glossary | Task 11 |
| §4.1 Parameters and random start | Tasks 2, 5, 8 |
| §4.2 Beam centre ray | Tasks 3, 9 |
| §4.3 Gaussian beam | Tasks 3, 9 |
| §4.4 Spatial filter (Fourier optics) | Tasks 5, 6, 9 |
| §4.5 Screen image | Tasks 7, 9 |
| §4.6 Collimation | Task 9 |
| §4.7 Irises and stopping | Tasks 4, 9 |
| §4.8 Plane A | Task 9 |
| §5 Architecture | File Structure; every task's Interfaces block |
| §6 Testing | Every task (unit), Task 10 (flow), Task 17–18 (page, manual) |
| §7 Hosting and repository | Tasks 1, 12, 18 |
| §8 Assumptions | Task 2 (`config.js` values) |

