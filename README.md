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
